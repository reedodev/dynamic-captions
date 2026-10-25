---
name: "dynamic-captions"
description: "영상(말하는 영상, 랩·노래 가사 영상, 쇼츠, 롱폼)을 주면 말과 가사를 단어 단위로 받아 적고, 같은 장면에 19가지 자막 스타일과 문장마다 스타일을 바꾸는 자동 섞기(mix) 시안을 먼저 보여 준 뒤, 고른 스타일로 자막이 박힌 mp4와 투명 자막(.mov)을 만든다. 자막이 왼쪽·오른쪽·위·아래로 돌아가며 나오고, 얼굴을 피하고, 박자에 맞춰 살짝 커지고, 후렴은 크게 나온다. 자막 스타일, 다이나믹 자막, 가사 자막, 자막 효과, 자막 시안, 쇼츠 자막 요청에 사용한다."
---

# dynamic-captions (영상 → 자막 스타일 시안 → 최종 자막 영상)

JIZURA(노래 가사 타이포)와 GitHub 오픈소스 자막 스킬들의 아이디어를 모아 만든 도구다. 출처와 라이선스는 `references/sources.md`. 모든 스크립트는 `scripts/` 폴더에 있고, 아래 명령의 `scripts/`는 이 스킬 폴더 기준이다. Python은 `python`(아래 준비물의 패키지가 설치된 것)을 쓴다.

## 준비물 (쓰기 전에 있어야 하는 것)

| 준비물 | 어디에 쓰나요 | 꼭 필요한가요 |
|---|---|---|
| Node.js 18 이상 | 모든 스크립트 | 필수 |
| ffmpeg와 ffprobe (PATH에 있어야 함) | 영상 읽기, 자막 합성 | 필수 |
| Chrome 또는 Chromium (못 찾으면 환경변수 `CHROME`에 경로) | 자막을 그리는 화면 | 필수 |
| Python 3.10 이상 + `pip install openai-whisper numpy` | 말·노래 받아쓰기(`transcribe.py`) | 필수(대본 시간표가 따로 있으면 생략 가능) |
| `pip install librosa` | 노래 박자 검출(`detect-beat.py`) | 선택 |
| `pip install opencv-python-headless` | 얼굴 찾기(`find-faces.py`) | 선택 |
| 자막이 박혀 있지 않은 원본 영상 | 새 자막과 겹치지 않게 | 필수 |
| 대본이나 가사 텍스트 | 철자 맞추기(`align-script.mjs`) | 권장 |
| NVIDIA 그래픽카드 또는 Apple Silicon 맥 | 빠른 인코딩(`--encoder auto`) | 선택 |

## 바꿔 쓰기: 이렇게 말하세요

| 이렇게 말하면 | 바뀌는 것 |
|---|---|
| "자막을 더 크게 / 작게" | `--scale 1.4` / `--scale 0.9` |
| "자막이 한쪽에만 나오게" | `--pos fixed` 또는 `--pos bottom-left` |
| "배경이 밝아서 안 보여" | `--shade 0.5` |
| "인물 얼굴을 가리지 마" | `find-faces.py` 후 `--faces faces.json` |
| "노래 박자에 맞춰" | `detect-beat.py` 후 `--beat beat.json` |
| "이모지 / 밑줄 넣어줘" | `--deco emoji,line` |
| "색을 바꿔줘" | `--palette mint`(gold, mint, sky, rose, lime) |
| "빨리 만들어줘" | `--workers 4 --encoder auto` |
| "H.265(HEVC)로 만들어줘" | `--codec h265` (`--encoder auto`와 같이 쓰면 GPU) |
| "투명 자막 파일도 줘" | `--alpha` |
| "문장마다 스타일을 내가 정할게" | `--plan plan.json` |


## 흐름 (영상 하나당 이 순서)

**빠른 시작(한 줄)**: `node scripts/start.mjs <영상> --lang ko [--script 가사.txt] [--faces] [--beat --bpm-hint 88] --out job` 가 아래 2~5단계(받아쓰기, 철자 맞추기+청취 클립, 얼굴, 박자, 작업 폴더, 시안)를 한 번에 하고 `overview.png` 에서 멈춘다. 그 뒤 스타일을 골라 `render.mjs final` 만 실행하면 된다. 단계별로 직접 하고 싶을 때만 아래를 따른다.

1. **입력 확인**: 영상 파일, 말인지 노래인지, 가로(16:9)인지 세로(9:16)인지, 영상에 이미 박힌 자막이 있는지 본다. 이미 박힌 자막이 있으면 새 자막과 겹치므로 사용자에게 알리고 자막 없는 원본을 받는다.
2. **단어 시간표 만들기** (`words.json`)
   - 말소리와 노래 모두 먼저: `python scripts/transcribe.py <영상 또는 음원> --out words.json --lang ko` (Whisper large-v3-turbo, 단어 단위). 빨간 글씨로 나오는 Triton 경고(`Failed to compile`, `Python.h not found`, `falling back to a slower ... implementation`)는 모두 같은 종류이며 결과에 영향이 없으니 무시한다(종료 코드가 0이면 정상). 끝 침묵에서 Whisper가 지어낸 말은 자동으로 버리고, 음표·깨진 글자가 20%를 넘으면 종료 코드 3으로 막는다. 결과에는 `precision`(word-level 또는 cue-level)이 기록된다. 대본·가사가 있으면 `--prompt-file script.txt`로 철자 힌트를 줄 수 있다(시험에서 효과는 작아서 12곳이 11곳으로 줄었다).
   - LRC·SRT만 있고 목소리 시간이 필요 없을 때는 `make-captions`의 `--lrc` / `--srt`를 쓴다. 줄 안 단어 시각은 글자 수 비례 **추정**이라 보고서에 "추정"이라고 적는다. 영상을 오디오 맨 앞이 아니라 중간부터 잘랐다면 `--shift <잘라 낸 초>`를 준다(20초부터 자른 클립은 `--shift 20`).
   - **대본이나 가사가 없으면** 아래 철자 맞추기와 청취 확인 단계는 건너뛴다. 대신 받아쓰기 결과를 눈으로 읽어 이름·숫자·고유명사를 고치고(`words.json`을 직접 고쳐도 된다), 소리와 맞는다고 쓰지 않는다.
   - **대본이나 가사가 있으면 반드시 철자를 맞춘다**: `node scripts/align-script.mjs --words words.json --script script.txt --out words.aligned.json`. 철자는 대본에서, 시간은 목소리에서 가져온다(글자 단위 정렬이라 띄어쓰기가 달라도 된다). 단어 하나의 길이는 최대 1.8초로 자른다(`--max-word`). 일치율이 60% 미만이면 다른 영상이거나 다른 구간이므로 멈춘다. `[Verse]` 같은 태그 줄은 뺀 순수 가사만 `script.txt`에 둔다.
   - **직접 들어 확인할 곳 만들기**: AI는 소리를 못 듣는다. `node scripts/listen-check.mjs --video <영상> --aligned words.aligned.json --out <폴더>`가 가사와 받아쓰기가 다른 곳마다 6초 클립을 잘라 `listen-check.mp4`(+`listen-check.md` 표)로 묶는다. 사용자가 약 1분 들어 보고 어느 단어가 틀렸는지 답하게 한다. 이 확인 전에는 "가사와 소리가 맞다"고 쓰지 않는다.
   - 강조할 단어를 정한다(문장마다 1개 정도, 영상에서 실제 중요한 말만): `--emphasis "단어,단어"` 또는 words.json의 `"emph": true`. 정하지 않으면 숫자, 천천히 말한 단어, 가장 긴 단어 순으로 잡힌다.
3. **작업 폴더 만들기**: `node scripts/make-captions.mjs --video <영상> --words words.aligned.json --out <작업폴더>/job [옵션]`. 프레임 파일이 길이만큼 쌓이므로 디스크 여유가 있는 곳에 둔다. 임시 프레임 폴더는 `--tmp`, 환경변수 `DYNCAP_TMP`, `scripts/local.json`의 `tmp` 순으로 정하고 없으면 시스템 임시 폴더다. 옵션은 아래 "옵션 모음".
4. **스타일 시안 먼저**: `node scripts/render.mjs preview <job>` → `job/preview/overview.png`(전 스타일 한 장면 비교), `style-<id>.png`(스타일별 4장면), `mix-plan.json`(자동 섞기가 문장마다 고른 스타일과 자리). 시안은 첫 4장면뿐 아니라 **모든 문장**의 자리·크기·얼굴 겹침을 검사한다. **답변 본문에 overview.png를 붙이고 전체 경로를 적는다.** 사용자가 고른 스타일은 `references/choices.md`(없으면 새로 만든다)에 한 줄 적고 다음 영상의 추천 순서에 반영한다. 사용자가 고르기 전에는 전체 렌더를 하지 않는다. 묻지 않는 자동 실행이면 아래 표에서 추천 1개를 고르고 이유를 한 줄 남긴다.
5. **최종 렌더**: `node scripts/render.mjs final <job> --style <id> [--range 시작,끝] [--alpha] [--encoder auto] [--codec h265] [--workers 4]`
   - 긴 영상은 먼저 `--range 0,20` 같은 20초 샘플을 보여 주고 승인 후 전체를 돌린다.
   - `--workers N`(기본 3): N개의 Chrome이 프레임을 나눠 그린다. 75초 1080p에서 1개 197초 → 4개 64초(약 3배). 같은 구간을 1개와 4개로 만들어 비교했을 때 프레임 수가 같고 화면은 거의 같았다(PSNR 55.7dB). `--workers 1`이 옛 방식이다.
   - `--encoder auto`: GPU 인코더를 1프레임 시험 인코딩해서 되는 것을 쓴다. NVIDIA(h264_nvenc) → 맥(h264_videotoolbox) → CPU(libx264) 순서. 기본은 CPU(libx264).
   - `--codec h265`: H.265(HEVC)로 만든다. `--encoder auto`면 hevc_nvenc → hevc_videotoolbox → libx265 순서(셋 다 안 되면 libx264), `--encoder`를 안 주면 libx265. 직접 고를 수도 있다: `--encoder libx264|libx265|h264_nvenc|hevc_nvenc|h264_videotoolbox|hevc_videotoolbox`. H.265 파일에는 애플 기기(QuickTime·사진·아이폰)에서 열리도록 `hvc1` 태그가 붙는다. 화질은 모든 인코더를 libx264 `-crf 16`과 비슷하게 맞췄다(맥 VideoToolbox의 `-q:v`는 Apple Silicon에서만 된다).
   - **final이 `구역 경고`로 멈추면**(긴 문장이 자기 자리 밖으로 나감): `make-captions`를 `--scale`만 0.1~0.2 낮춰서 새 폴더에 다시 만들고 final을 다시 돌린다. 시안을 처음부터 다시 볼 필요는 없지만, 글자 크기를 바꾸면 얼굴 겹침 결과도 바뀌니 `얼굴:` 줄을 다시 읽는다. `--allow-overflow`는 이유를 보고할 때만 쓴다.
   - 결과 파일 이름은 `captioned-<스타일>.mp4`(구간을 주면 `captioned-<스타일>-<시작>-<끝>.mp4`), `--name`으로 바꿀 수 있다. `job/out` 폴더는 첫 렌더가 성공해야 만들어진다. 결과: `job/out/<이름>.mp4`(소리 유지), `--alpha`면 투명 자막 `…-alpha.mov`(ProRes 4444, 70초에 244MB라 필요할 때만), 검수 시트 `…-sheet.png`, 결과 기록 `<이름>.json`(스타일, 인코더, 워커 수, 시간 정밀도, 구역 경고, 읽기 속도, 글씨 크기, 문장별 자리).
   - 렌더 시간은 영상 길이의 약 1~3배다(워커·GPU에 따라). 가변 프레임율 영상(AI 영상 내보내기는 60fps 표시지만 실제 약 24fps)은 `make-captions`가 자동으로 실제 프레임율에 맞춘다.
6. **검수 (직접)**: 장면은 `ffmpeg -ss 4.5 -i <최종.mp4> -frames:v 1 scene1.png`처럼 한 장씩 뽑을 수 있다(여러 시각을 한 번에 보려면 `-vf "fps=1/2,scale=480:-2,tile=4x3"`). 시트와 최종 mp4에서 장면 몇 곳을 이미지로 직접 열어 글자 판독, 잘림, 안전 구역, 얼굴 가림, 강조 단어를 본다. 프레임 수·길이·소리 유무는 `ffprobe`로 확인한다. 직접 들은 것이 아니면 들었다고 쓰지 않는다. 산출물은 전체 경로를 적고 가능하면 탐색기에서 파일을 선택해 열어 준다.

## 옵션 모음 (`make-captions.mjs`)

| 옵션 | 뜻 |
|---|---|
| `--palette gold|mint|sky|rose|lime` | 강조색(베이지 계열은 없음) |
| `--scale 1.3` | 글자 크기 배율. 16:9 가사·말 영상은 1.25~1.3부터 시안으로 본다 |
| `--shade 0.4` | 자막 뒤에 부드러운 어두운 띠를 깔아 밝은 화면에서도 읽히게(0~1) |
| `--pos varied|fixed|<자리이름>` | 기본 varied: 문장마다 자리가 왼쪽·오른쪽·위·아래로 바뀜(같은 자리 연속 없음) |
| `--pos-avoid a,b` | 비워 둘 자리. 얼굴 정보(`--faces`)가 있으면 자동으로 피하므로 보통 필요 없음 |
| `--pos-plan plan.json` | `[{"from":0,"to":6,"pos":"upper-left"}]` 구간별 고정 자리 |
| `--faces faces.json` | 자막이 얼굴을 가리지 않게 자리를 고름(아래 "얼굴 피하기") |
| `--beat beat.json` `--beat-strength 0.045` | 노래의 박마다 자막이 살짝 커졌다 돌아옴(아래 "노래 효과") |
| `--hook off` | 후렴(반복되는 줄) 자동 감지를 끔 |
| `--plan plan.json` | mix에서 구간별 스타일 고정: `[{"from":0,"to":8,"style":"hero-key"}]` |
| `--deco emoji,line` | 이모지 / 자막 밑 강조선. **기본 끔**(아래 "선택 장식") |
| `--emoji-map map.json` | `{"단어":"이모지"}` 직접 지정이 기본 목록보다 우선 |
| `--shift N`, `--zone 위,아래`, `--emphasis` | 위 흐름 참고 |

## 자막 자리 (왼쪽·오른쪽·위·아래)

- 가로 8곳: bottom-center, bottom-left, bottom-right, top-center, upper-left, upper-right, mid-left, mid-right, (mid-center는 후렴용). 세로 6곳: mid-center, mid-left, mid-right, upper-center, upper-left, upper-right. 왼쪽 자리는 왼쪽 맞춤, 오른쪽 자리는 오른쪽 맞춤이다.
- 플랫폼 안전 영역은 그대로 지킨다: 가로는 아래 22%를 비우고(유튜브 자막 자리), 세로는 아래 약 30%·위 10%·오른쪽 10%(앱 버튼)를 비운다. 세로 가운데 자리의 좌우는 앱 버튼을 피해 11%~89%만 쓴다. `render.mjs`는 자막이 자기 자리 밖으로 나가면 렌더를 멈춘다(오른쪽 자리에서 크게 튀어나오는 스타일이 화면 밖으로 나가는 문제를 이 검사가 잡았고, 세로 가운데 자리가 오른쪽 버튼 구역을 침범한 것도 이 검사가 잡았다).
- **글씨 크기 보장**: 가장 작은 글자가 1080p 가로에서 40px, 1080×1920 세로에서 50px보다 작아지면 같은 높이대의 넓은 자리(예: upper-left → top-center)로 옮긴다. 그래도 작으면 `글씨 크기: 작은 자막 N개`로 보고한다. 앞말이 작은 스타일(hero-key, lead-big, stamp)의 앞말은 본문 글자의 0.7~0.78배다.

## 얼굴 피하기 (`find-faces.py`)

1. `python scripts/find-faces.py <영상> --out faces.json` (초당 2번 얼굴을 찾는다. YuNet 모델(MIT, `assets/models`) 우선, 없으면 OpenCV Haar). `faces.preview.png`에 찾은 얼굴 상자가 그려지니 **먼저 열어 본다**.
2. `make-captions.mjs ... --faces faces.json`. 문장이 나오는 동안(앞뒤 0.5초 포함) 보인 얼굴과 자막 글자 상자가 2% 넘게 겹치면 다른 자리를 차례로 시도한다. `얼굴: 자막이 얼굴을 가리는 묶음 N개` 줄로 결과를 알려 준다.
- 한계: 사람 정면 얼굴 위주다. 만화·동물·용·뒷모습·옆모습·아주 작은 얼굴은 놓칠 수 있다(AI로 만든 사진 속 인물은 100%, 소녀와 용이 나오는 AI 영상은 83% 구간에서 찾았다). 얼굴만 피하고 몸·소품은 피하지 않는다.

## 노래 효과

- **박자 맞춤**: `python scripts/detect-beat.py <음원> --out beat.json --bpm-hint 88`(BPM을 알면 힌트로 준다. 랩은 반/두 배 템포로 잘못 잡히기 쉽다). `confidence`가 0.35 미만이면 쓰지 않는다. `make-captions --beat beat.json`을 주면 박마다 자막이 4.5% 커졌다가 0.4초 안에 돌아온다. 시험(힌트 88인 곡): 89.1BPM, 신뢰도 0.94, 박 간격 0.682초(88BPM과 일치).
- **후렴 자동 판별**: 같은 글자 줄이 2번 이상 나오는 구간(6자 이상)은 후렴으로 보고 글자를 12% 키우고 가운데에 두며 hero-key·impact-wide·stack-kinetic·stamp 중에서 고른다. 후렴이 줄 나눔이 달라도 전체 글에서 찾아서 잡는다.
- 노래·랩 절차: ①음원에서 `transcribe.py` ②가사 줄(태그 줄 제외)을 `script.txt`로 저장해 `align-script.mjs` ③`listen-check.mjs`로 사용자 청취 확인 ④그림 한 장짜리면 ffmpeg zoompan으로 천천히 확대한 배경 영상을 만들어 `make-captions`에 넣는다 ⑤`detect-beat.py` ⑥(사람이 나오면) `find-faces.py`. JIZURA 특유의 큰 가사 타이포·투명 PNG ZIP이 필요하면 [JIZURA](https://852wa.github.io/JIZURA/)(MIT)를 따로 쓴다.

## 글꼴 (`--font`, `--font-key`)
- 무료 5종: `pretendard`, `black-han`, `plex`, `gaegu`, `myeongjo` (OFL, 상업 이용 가능). 예: `--font myeongjo`, 큰 핵심어만 `--font-key black-han`, 내 파일은 `--font ./My.ttf`.
- 내 글꼴에 없는 글자는 Pretendard로 자동 대체된다(네모 방지). 굵기는 파일이 정하고 억지로 굵게 만들지 않는다.
- 사용자가 글꼴을 말하지 않으면 지정하지 않는다(스타일마다 기본 글꼴). 남이 만든 글꼴의 영상·상업 이용 조건은 이 스킬이 검사하지 않으니 사용자에게 확인하라고 알린다.
- 자세한 설명: `references/fonts.md`. 손글씨를 글꼴로 만드는 방법: `references/handwriting-font.md`.

## 설명 영상용 차분한 자막 (`--style plain`)
- 어두운 둥근 상자 안의 흰 글자가 한 줄씩 한꺼번에 나타난다. 색·단어별 효과 없음. 설명·강의·튜토리얼에 쓴다(`mix`에는 섞이지 않음). 글씨는 `--scale 0.85` 안팎이 편하다.

## 선택 장식 (기본 꺼짐)

- 이모지와 밑줄(라인)은 **기본 꺼짐**이다. 사용자가 요청할 때만 `--deco emoji,line`을 준다. 이모지는 기본 목록(한국어·영어 약 45개)에 있는 단어에서만 나온다. 한 글자 키는 단어 맨 앞에서만 맞춘다. 의미가 안 맞는 이모지는 `--emoji-map`으로 덮어쓰고 시안에서 확인한다.

## 스타일 고르는 기준 (19개 + plain + mix)

| id | 이름 | 어울리는 곳 | 주의 |
|---|---|---|---|
| block-sweep | 색 블록 훑기 | 쇼츠·릴스 설명, 가장 무난한 기본 | 블록 위 글자는 어두운 색 |
| pop-word | 한 단어 팝 | 짧고 빠른 쇼츠, 후킹 문장 | 1~2단어라 긴 설명엔 부적합 |
| karaoke-fill | 노래방 채우기 | 노래·가사, 낭독 | 한 줄이 길면 두 줄 |
| hero-key | 핵심어 히어로 | 결론·숫자·반전 한마디 | 한 화면에 강조 하나 |
| stack-kinetic | 크기 대비 쌓기 | 쇼츠 하이라이트, 후렴 | 짧은 구절에만 |
| underline-ink | 밑줄 짚기 | 롱폼 설명, 차분한 편집 | 가장 조용함 |
| glass-card | 유리 카드 | 롱폼, 밝은 배경 | 글자 수 짧게 |
| neon-glow | 네온 점등 | 어두운 배경, 음악 | 밝은 배경에서 판독 떨어짐 |
| lead-big | 작은말+큰핵심어 | 말하는 얼굴 영상, 브이로그 쇼츠 | 앞말이 길면 두 줄 |
| chip-label | 라벨 칩 | 숫자·조항·고유명사를 노란 칩으로 | 칩은 문장당 하나 |
| stamp | 도장 찍기 | 경고·결론·"이것만" | 가벼운 문장엔 과함 |
| line-rise | 줄마다 올라오기 | 차분한 설명, 롱폼 | 글자 수 많으면 느려 보임 |
| hand-note | 손글씨 메모 | 일상·브이로그 말투 | 정보 많은 문장엔 부적합 |
| line-focus | 줄 패널 강조 | 대화·인터뷰 | 패널이 화면을 더 가림 |
| fill-rise | 윤곽 채움 | 노래 후렴·훅 | 제목체에 없는 글자는 대체 글꼴 |
| impact-wide | 꽉 찬 큰 글씨 | 훅, 제목, 한마디(폭을 가득 채움) | 1~2단어만 |
| news-bar | 뉴스 띠 | 정보 전달, 뉴스 말투 | 띠가 화면을 가림 |
| typewriter | 타자기 | 낭독, 차분한 문장(글자가 한 자씩 나타남) | 빠른 말에는 느려 보임 |
| wave | 출렁 글자 | 노래, 가벼운 말(말하는 단어의 글자가 물결침) | 정보 문장엔 과함 |
| mix | 자동 섞기 | 말하는 영상 전체 | `mix-plan.json`에서 어색한 문장은 plan으로 고정 |

- 설명·실습 롱폼은 차분한 스타일(underline-ink, line-rise, glass-card, line-focus, typewriter)을 우선 추천한다(시청 효과는 미검증). 튀는 효과(pop-word, neon-glow, stack-kinetic, wave, impact-wide)는 짧은 쇼츠·음악에 쓴다.

## 꼭 지킬 규칙

- **안전 구역**: 위 "자막 자리"와 같다. 구역을 벗어나면 렌더가 멈춘다. `--scale`을 줄이거나 `--allow-overflow`로 무시할 수 있지만 무시하려면 이유를 보고한다. 근거: 유튜브 자막(CC)이 화면 아래쪽에 뜨는 자리와 쇼츠·릴스의 앱 버튼 자리를 비우는 규칙이다.
- **글자 판독이 먼저**: 스크램블·강한 글리치·긴 블러 진입 금지, 조각나거나 겹쳐 읽히지 않을 것(JIZURA 실패 기록). 강조는 색 블록·밑줄처럼 글자를 가리지 않는 방식으로 한다.
- **색**: 베이지·크림·아이보리·샌드 계열은 쓰지 않는다. 채널 색 규칙이 있으면 `make-captions.mjs`의 PALETTES 값을 채널 색으로 바꾼다.
- 플랫폼별 영상 규격(릴스·쇼츠는 9:16 등)은 올리는 곳의 규칙을 따른다. 이 스킬은 영상 비율과 음성을 바꾸지 않는다.
- 사용자가 준 영상의 원본 소리·화면은 그대로 두고 자막만 더한다. 이미 공개된 영상은 사용자 요청 없이 고치거나 다시 올리지 않는다.
- 자막 문구는 임의로 바꾸지 않는다(오인식은 대본으로 고치고, 글꼴에 없는 글자는 사용자에게 묻는다).
- 위임할 때는 이 문서와 `references/styles.md`를 함께 전달한다.

## 자동 점검 출력 (preview·final이 찍음)

글씨 크기(최소 허용 px, 작은 자막 수, 자리 옮김 수), 얼굴 가림 수, 읽기 속도(묶음별 자/초, 17 초과 빠름·25 초과 위험은 외국 저장소 기준이라 한글은 참고용), 글꼴에 없는 글자, 자리 이탈 경고, 프레임 수 차이(2 초과 시 경고). 시안을 고른 뒤 영상 파일이 바뀌면 final이 멈춘다(크기·수정 시각 비교).

## 알려진 한계 (정직하게)

- 직접 듣지 못한다. 가사·말과 소리가 맞는지는 시간표와 `listen-check` 클립으로 사용자가 확인해야 한다.
- 랩·노래의 단어 시간은 Whisper 기반이라 거칠다(12곳 불일치, 1.8초 길이 제한으로 보정). 한국어 강제 정렬 모델은 없다.
- 얼굴은 정면 사람 얼굴만 찾는다. 몸·소품·용은 피하지 않는다.
- 글자 위치를 장면 중요도(손, 제품 등)로 정하지 못한다.
- 사람 뒤에 글자를 넣는 효과(인물 분리 필요)와 스크램블 효과는 넣지 않았다.
- 스타일 취향은 사람마다 다르다. 시안으로 사용자가 직접 고르게 한다.

## 문제 해결

- `페이지 오류`가 나오면 `render.mjs`가 보여 준 첫 오류부터 고친다. 스타일 코드는 `scripts/runtime.js` 한 파일이며 렌더 때마다 작업 폴더로 복사된다. 새 스타일은 `S['id'] = { label, group, build(ph, el), update(ph, t) }` 형식으로 추가하면 `preview`에 자동 포함된다(크게 키우고 싶으면 `fill: 배율`).
- 한 줄이 너무 길거나 구역을 벗어나면 해당 스타일의 `group`(한 묶음 글자 수·단어 수)을 줄인다.
- 스타일 구현 메모와 시험 기록은 `references/styles.md`.
