"""find-faces.py : where are the faces in a video?  -> faces.json  (for make-captions --faces)

Usage (Python with opencv):
  python find-faces.py <video> --out faces.json [--fps 2] [--min-size 0.04]

Output: {"width":1920,"height":1080,"engine":"yunet|haar","samples":[{"t":0.5,"boxes":[[x0,y0,x1,y1]]}, ...]}
Boxes are fractions of the frame (0..1). make-captions moves a caption to another spot when its text would cover a face.
Limits (honest): only human-like frontal faces are found. Cartoon characters, animals, dragons, side/back views and tiny faces
can be missed - look at faces.preview.png (a contact sheet with the boxes drawn) before trusting it.
"""
import argparse, json, os
import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("--out", default="faces.json")
ap.add_argument("--fps", type=float, default=2.0, help="samples per second")
ap.add_argument("--min-size", type=float, default=0.04, help="smallest face height as a fraction of the frame height")
a = ap.parse_args()

cap = cv2.VideoCapture(a.src)
W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)); H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
nfr = cap.get(cv2.CAP_PROP_FRAME_COUNT); fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
dur = nfr / fps if nfr > 0 else 0
if dur <= 0 or dur > 36000:
    import subprocess
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", a.src], capture_output=True, text=True).stdout.strip() or 0)

engine = "haar"; yn = None
# 1st choice: YuNet (OpenCV face detector, MIT license, 0.2 MB model in assets/models). Fallback: OpenCV Haar cascades.
model = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "models", "face_detection_yunet_2023mar.onnx")
if hasattr(cv2, "FaceDetectorYN") and os.path.exists(model):
    yn = cv2.FaceDetectorYN.create(model, "", (320, 320), 0.6, 0.3, 5000)
    engine = "yunet"
casc = []
if yn is None and hasattr(cv2, "CascadeClassifier"):  # fallback only when the YuNet model is unusable
    casc = [cv2.CascadeClassifier(cv2.data.haarcascades + n) for n in ("haarcascade_frontalface_alt2.xml", "haarcascade_frontalface_default.xml")]
if yn is None and not casc:
    raise SystemExit("no face detector available: the YuNet model (assets/models) and OpenCV Haar cascades are both missing")

def nms(boxes):
    # keep the strongest box; drop any box whose overlap covers more than 30% of the smaller one
    keep = []
    for b in sorted(boxes, key=lambda b: -b[4]):
        ok = True
        for k in keep:
            ix = max(0, min(b[2], k[2]) - max(b[0], k[0])); iy = max(0, min(b[3], k[3]) - max(b[1], k[1]))
            small = min((b[2] - b[0]) * (b[3] - b[1]), (k[2] - k[0]) * (k[3] - k[1]))
            if small > 0 and ix * iy / small > 0.3: ok = False; break
        if ok: keep.append(b)
    return [k[:4] for k in keep]

def detect(frame):
    h, w = frame.shape[:2]
    boxes = []
    if yn is not None:
        yn.setInputSize((w, h))
        _, faces = yn.detect(frame)
        for f in (faces if faces is not None else []):
            x, y, bw, bh = f[:4]
            boxes.append([float(max(0, x / w)), float(max(0, y / h)), float(min(1, (x + bw) / w)), float(min(1, (y + bh) / h)), float(f[14]) if len(f) > 14 else 1.0])
        boxes = nms(boxes)
    if not boxes:
        g = cv2.equalizeHist(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY))
        for c in casc:
            for (x, y, bw, bh) in c.detectMultiScale(g, 1.1, 6, minSize=(int(h * a.min_size), int(h * a.min_size))):
                boxes.append([x / w, y / h, (x + bw) / w, (y + bh) / h])
            if boxes:
                break
    return [b for b in boxes if (b[3] - b[1]) >= a.min_size]


samples = []; sheet = []
t = 0.0; step = 1.0 / a.fps
while t < dur:
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, frame = cap.read()
    if not ok:
        break
    boxes = detect(frame)
    samples.append({"t": round(t, 2), "boxes": [[round(v, 4) for v in b] for b in boxes]})
    if len(sheet) < 12 and int(t / max(dur / 12, 0.5)) >= len(sheet):
        f = frame.copy()
        for b in boxes:
            cv2.rectangle(f, (int(b[0] * W), int(b[1] * H)), (int(b[2] * W), int(b[3] * H)), (0, 255, 0), max(3, W // 300))
        sheet.append(cv2.resize(f, (480, int(480 * H / W))))
    t += step
cap.release()
json.dump({"width": W, "height": H, "engine": engine, "samples": samples}, open(a.out, "w"))
withf = sum(1 for s in samples if s["boxes"])
if sheet:
    cols = 4; rows = (len(sheet) + cols - 1) // cols
    cell_h = sheet[0].shape[0]; canvas = np.zeros((rows * cell_h, cols * 480, 3), dtype=np.uint8)
    for i, im in enumerate(sheet):
        canvas[(i // cols) * cell_h:(i // cols + 1) * cell_h, (i % cols) * 480:(i % cols + 1) * 480] = im
    cv2.imwrite(os.path.splitext(a.out)[0] + ".preview.png", canvas)
print(f"engine {engine} | samples {len(samples)} | with a face {withf} ({100 * withf // max(1, len(samples))}%) -> {a.out}")
