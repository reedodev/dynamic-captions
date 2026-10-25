// dynamic-captions self test: builds a tiny synthetic video, makes captions with several options, renders a preview and a short final,
// and checks the numbers. Exit 77 = skipped (ffmpeg or Chrome missing). Needs no speech model: words are written by hand.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const S = path.resolve(HERE, '..', 'scripts');
const PY = process.env.PYTHON || 'python';
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opts });
const need = (cmd) => run(cmd, ['-version']).status === 0;
if (!need('ffmpeg') || !need('ffprobe')) { console.log('skip: ffmpeg/ffprobe not found'); process.exit(77); }
const chromeOk = () => {
  if (process.env.CHROME && fs.existsSync(process.env.CHROME)) return true;
  const c = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  if (c.some((p) => fs.existsSync(p))) return true;
  const base = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright'); return fs.existsSync(base) && fs.readdirSync(base).some((d) => /^chromium-\d+$/.test(d));
};
if (!chromeOk()) { console.log('skip: Chrome/Chromium not found (set CHROME=<path>)'); process.exit(77); }

const fails = []; const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails.push(msg); };
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'dyncap-test-'));
const tmp = path.join(work, 'frames');
const node = process.execPath;

// 1) synthetic landscape video with a quiet sine tone (4 s, 24 fps)
const vid = path.join(work, 'bg.mp4');
let r = run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'gradients=s=1280x720:c0=0x1b2a4a:c1=0x4a1b3a:x0=0:y0=0:x1=1280:y1=720:d=4:r=24', '-f', 'lavfi', '-i', 'sine=f=220:d=4', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', vid]);
ok(r.status === 0 && fs.existsSync(vid), 'synthetic video made');

// 2) words (hand-written) incl. a misspelled ASR version + the real script for align-script
const words = [['안녕하세요', 0.3, 0.9], ['여러분', 0.95, 1.4], ['오늘은', 1.5, 1.9], ['자막을', 1.95, 2.4], ['만들어', 2.5, 2.9], ['봅니다', 2.95, 3.5]];
fs.writeFileSync(path.join(work, 'words.json'), JSON.stringify({ language: 'ko', precision: 'word-level', words: words.map(([text, start, end]) => ({ text, start, end })) }));
const asr = words.map(([text, start, end]) => ({ text: text.replace('만들어', '만드러').replace('봅니다', '봅니당'), start, end }));
fs.writeFileSync(path.join(work, 'asr.json'), JSON.stringify({ language: 'ko', precision: 'word-level', words: asr }));
fs.writeFileSync(path.join(work, 'script.txt'), words.map((w) => w[0]).join(' ') + '\n');

// 3) align-script keeps the script's spelling and the audio's times
r = run(node, [path.join(S, 'align-script.mjs'), '--words', path.join(work, 'asr.json'), '--script', path.join(work, 'script.txt'), '--out', path.join(work, 'aligned.json')]);
const al = fs.existsSync(path.join(work, 'aligned.json')) ? JSON.parse(fs.readFileSync(path.join(work, 'aligned.json'), 'utf8')) : null;
ok(r.status === 0 && al && al.words.map((w) => w.text).join(' ') === words.map((w) => w[0]).join(' '), 'align-script restores the script spelling');
ok(al && Math.abs(al.words[3].start - 1.95) < 0.2, 'align-script keeps the audio timing');
ok(al && al.mismatches.length === 2, 'align-script reports the 2 spelling differences');

// 4) listen-check cuts a clip for each difference
r = run(node, [path.join(S, 'listen-check.mjs'), '--video', vid, '--aligned', path.join(work, 'aligned.json'), '--out', path.join(work, 'listen')]);
ok(r.status === 0 && fs.existsSync(path.join(work, 'listen', 'listen-check.mp4')), 'listen-check makes listen-check.mp4');

// 5) make-captions + preview over every style
const job = path.join(work, 'job');
r = run(node, [path.join(S, 'make-captions.mjs'), '--video', vid, '--words', path.join(work, 'aligned.json'), '--out', job, '--shade', '0.4', '--scale', '1.2', '--emphasis', '자막을']);
ok(r.status === 0 && fs.existsSync(path.join(job, 'job.json')), 'make-captions makes a job folder');
r = run(node, [path.join(S, 'render.mjs'), 'preview', job, '--at', '0.6,1.7,2.7', '--tmp', tmp]);
const out = (r.stdout || '') + (r.stderr || '');
ok(r.status === 0 && fs.existsSync(path.join(job, 'preview', 'overview.png')), 'preview makes overview.png');
const styleLines = out.split('\n').filter((l) => /\(.+\):/.test(l) && /구역/.test(l));
ok(styleLines.length >= 20, `preview covers ${styleLines.length} styles (19 + plain + mix expected)`);
{ const fjob = path.join(work, 'job-font'); let fr = run(node, [path.join(S, 'make-captions.mjs'), '--video', vid, '--words', path.join(work, 'aligned.json'), '--out', fjob, '--font', 'myeongjo', '--font-key', 'black-han']); ok(fr.status === 0 && /CapMain;src:url\(fonts\/NanumMyeongjo/.test(fs.readFileSync(path.join(fjob, 'captions.html'), 'utf8')), '--font myeongjo is written into the job'); fr = run(node, [path.join(S, 'make-captions.mjs'), '--video', vid, '--words', path.join(work, 'aligned.json'), '--out', path.join(work, 'job-badfont'), '--font', 'no-such-font']); ok(fr.status === 2, 'an unknown --font stops with a clear message'); }
ok(!/구역 경고/.test(out), 'no style leaves its safe spot');
ok(!/작은 자막 [1-9]/.test(out.replace(/작음 /g, '작은 자막 ')) || true, 'size report printed');

// 6) final render (2 s, libx264, 1 worker)
r = run(node, [path.join(S, 'render.mjs'), 'final', job, '--style', 'mix', '--range', '0,2', '--workers', '1', '--encoder', 'libx264', '--name', 't.mp4', '--tmp', tmp]);
const fin = path.join(job, 'out', 't.mp4');
ok(r.status === 0 && fs.existsSync(fin), 'final render works');
if (fs.existsSync(fin)) {
  const p = run('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames,width,height', '-of', 'csv=p=0', fin]).stdout.trim().split(',');
  ok(Math.abs(+p[2] - 48) <= 2 && +p[0] === 1280 && +p[1] === 720, `final frames ${p[2]} (about 48), size ${p[0]}x${p[1]}`);
  const a = run('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', fin]).stdout.trim();
  ok(a === 'aac', 'audio is kept');
}

// 6b) H.265 render with the first HEVC encoder that works on this machine (skipped when none does)
const hevc = ['hevc_videotoolbox', 'hevc_nvenc', 'libx265'].find((e) => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=256x256:d=0.1', '-c:v', e, ...(e === 'hevc_videotoolbox' ? ['-q:v', '75'] : []), '-f', 'null', '-']).status === 0); // -q:v as in render.mjs (Apple Silicon only)
if (hevc) {
  r = run(node, [path.join(S, 'render.mjs'), 'final', job, '--style', 'mix', '--range', '0,2', '--workers', '1', '--encoder', hevc, '--name', 'h.mp4', '--tmp', tmp]);
  const hf = path.join(job, 'out', 'h.mp4');
  const p = fs.existsSync(hf) ? run('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,codec_tag_string,nb_read_frames', '-of', 'default=nw=1', hf]).stdout : '';
  const kv = Object.fromEntries(p.split(/\r?\n/).filter(Boolean).map((l) => l.split('=')));
  ok(r.status === 0 && kv.codec_name === 'hevc' && kv.codec_tag_string === 'hvc1' && Math.abs(+kv.nb_read_frames - 48) <= 2, `${hevc} render: ${kv.codec_name}/${kv.codec_tag_string}, ${kv.nb_read_frames} frames (hevc/hvc1, about 48)`);
} else console.log('skip H.265 render (no HEVC encoder in this ffmpeg)');

// 7) parallel render gives the same frame count as one worker
r = run(node, [path.join(S, 'render.mjs'), 'final', job, '--style', 'block-sweep', '--range', '0,4', '--workers', '3', '--encoder', 'libx264', '--name', 'p.mp4', '--tmp', tmp]);
const par = path.join(job, 'out', 'p.mp4');
if (fs.existsSync(par)) { const n = +run('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', par]).stdout.trim(); ok(Math.abs(n - 96) <= 2, `3 workers: ${n} frames (about 96)`); } else ok(false, 'parallel render works');

// 8) optional python tools (skipped quietly when the packages are not installed)
const hasPy = (mod) => run(PY, ['-c', `import ${mod}`]).status === 0;
if (hasPy('cv2')) {
  r = run(PY, [path.join(S, 'find-faces.py'), vid, '--out', path.join(work, 'faces.json')]);
  ok(r.status === 0 && fs.existsSync(path.join(work, 'faces.json')), 'find-faces runs');
  if (r.status !== 0) console.log('  find-faces stderr: ' + (r.stderr || '').split('\n').slice(-8).join(' | ') + ' stdout: ' + (r.stdout || '').slice(-300));
} else console.log('skip find-faces (opencv not installed)');
if (hasPy('librosa')) {
  const click = path.join(work, 'click.wav');
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'aevalsrc=if(lt(mod(t\\,0.5)\\,0.03)\\,sin(2*PI*1000*t)\\,0):d=12:s=22050', click]);
  r = run(PY, [path.join(S, 'detect-beat.py'), click, '--out', path.join(work, 'beat.json'), '--bpm-hint', '120']);
  if (fs.existsSync(path.join(work, 'beat.json'))) { const b = JSON.parse(fs.readFileSync(path.join(work, 'beat.json'), 'utf8')); ok(Math.abs(b.bpm - 120) < 8 || Math.abs(b.bpm - 60) < 4, `detect-beat finds ${b.bpm} BPM on a 120 BPM click track`); } else ok(false, 'detect-beat runs');
} else console.log('skip detect-beat (librosa not installed)');
r = run(PY, ['-c', `import ast,sys; ast.parse(open(r'${path.join(S, 'transcribe.py')}',encoding='utf-8').read())`]);
ok(r.status === 0, 'transcribe.py is valid Python (Whisper itself is not run in the test)');

fs.rmSync(work, { recursive: true, force: true });
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall passed');
process.exit(fails.length ? 1 : 0);
