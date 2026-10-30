#!/usr/bin/env node
// start.mjs : the one-command start for beginners. Does steps 1-4 of the usual flow and stops at the style sheet.
//   node scripts/start.mjs <video> [--lang ko] [--script lyrics.txt] [--faces] [--beat] [--bpm-hint 88] [--out job]
//                          [--model large-v3-turbo] [--tmp <dir>] [any make-captions option, e.g. --scale 1.25 --shade 0.4 --palette mint]
// 1) transcribe (Whisper)  2) if --script: fix the spelling from the script + build the "please listen here" clip
// 3) if --faces: find faces   4) if --beat: detect the beat   5) make the job folder   6) render the style sheet
// Then it prints the exact command for the final render. Look at <out>/preview/overview.png and pick a style first.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
// the video can be the first word or --video <file> (a run with only --video used to print the help and stop, which looked like no output)
const vi = argv.indexOf('--video'); if (vi >= 0 && argv[vi + 1]) { argv.unshift(argv[vi + 1]); argv.splice(vi + 1, 2); }
const video = argv[0] && !argv[0].startsWith('--') ? path.resolve(argv[0]) : null;
if (video && !fs.existsSync(video)) console.error('video not found: ' + video);
if (!video || !fs.existsSync(video)) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 8).join('\n')); process.exit(video ? 2 : 1); }
const own = new Set(['lang', 'script', 'faces', 'beat', 'bpm-hint', 'out', 'model', 'tmp', 'sample']);
const mine = {}, pass = [];
for (let i = 1; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue; const k = argv[i].slice(2); const hasVal = argv[i + 1] != null && !argv[i + 1].startsWith('--');
  if (own.has(k)) mine[k] = hasVal ? argv[++i] : true; else { pass.push(argv[i]); if (hasVal) pass.push(argv[++i]); }
}
const out = path.resolve(mine.out || 'job'); fs.mkdirSync(out, { recursive: true });
const run = (cmd, args, label) => { const r = spawnSync(cmd, args, { encoding: 'utf8' }); if (r.status !== 0) { console.error(`\n[${label}] failed (exit ${r.status}):\n` + ((r.stderr || '') + (r.stdout || '')).split('\n').slice(-12).join('\n')); process.exit(r.status || 1); } return r; };

// find a Python that has the packages we need (PYTHON env first)
const can = (py, mod) => spawnSync(py, ['-c', `import ${mod}`], { stdio: 'ignore' }).status === 0;
// local.json python: this PC's python can be saved once in scripts/local.json as {"python": "C:/path/python.exe"}
let localPy = null; try { localPy = JSON.parse(fs.readFileSync(path.join(HERE, 'local.json'), 'utf8')).python || null; } catch {}
const candidates = [process.env.PYTHON, localPy, 'python', 'python3', 'py'].filter(Boolean);
const pyFor = (mod) => candidates.find((p) => can(p, mod));
const pyWhisper = pyFor('whisper');
if (!pyWhisper) { console.error('Python with openai-whisper was not found (tried: ' + candidates.join(', ') + ').\nFix one of these:\n  1) install it:  pip install openai-whisper numpy\n  2) point to the python that has it:  PYTHON=<path to python.exe>  (PowerShell: $env:PYTHON="C:\\path\\python.exe")\n  3) save it once in ' + path.join(HERE, 'local.json') + ' as {"python": "C:/path/python.exe"}'); process.exit(3); }

console.log('1/5 transcribing (the first run downloads a speech model, about 1.5 GB; this can take several minutes)...');
const words = path.join(out, 'words.json');
run(pyWhisper, [path.join(HERE, 'transcribe.py'), video, '--out', words, '--lang', String(mine.lang || 'ko'), ...(mine.model ? ['--model', String(mine.model)] : []), ...(mine.script ? ['--prompt-file', path.resolve(String(mine.script))] : [])], 'transcribe');
let useWords = words;

if (mine.script) {
  console.log('2/5 fixing the spelling from your script...');
  const al = path.join(out, 'words.aligned.json');
  const r = spawnSync(process.execPath, [path.join(HERE, 'align-script.mjs'), '--words', words, '--script', path.resolve(String(mine.script)), '--out', al], { encoding: 'utf8' });
  process.stdout.write(r.stdout || ''); if (r.status === 0) { useWords = al; const l = spawnSync(process.execPath, [path.join(HERE, 'listen-check.mjs'), '--video', video, '--aligned', al, '--out', path.join(out, 'listen')], { encoding: 'utf8' }); process.stdout.write(l.stdout || ''); } else { console.error('script and audio differ too much (or align failed): captions will use the raw transcription.\n' + (r.stderr || '')); }
} else console.log('2/5 (no --script given: spelling is as heard; read the words in words.json and fix names or numbers)');

const extra = [];
if (mine.faces) { const py = pyFor('cv2'); if (!py) console.log('3/5 skipped faces: pip install opencv-python-headless'); else { console.log('3/5 finding faces...'); const fj = path.join(out, 'faces.json'); run(py, [path.join(HERE, 'find-faces.py'), video, '--out', fj], 'find-faces'); extra.push('--faces', fj); console.log('   check ' + path.join(out, 'faces.preview.png') + ' (green boxes = what was found)'); } } else console.log('3/5 (no --faces)');
if (mine.beat) { const py = pyFor('librosa'); if (!py) console.log('4/5 skipped beat: pip install librosa'); else { console.log('4/5 detecting the beat...'); const bj = path.join(out, 'beat.json'); const r = run(py, [path.join(HERE, 'detect-beat.py'), video, '--out', bj, ...(mine['bpm-hint'] ? ['--bpm-hint', String(mine['bpm-hint'])] : [])], 'detect-beat'); process.stdout.write(r.stdout); const c = JSON.parse(fs.readFileSync(bj, 'utf8')).confidence; if (c >= 0.35) extra.push('--beat', bj); else console.log('   confidence is low, so the beat pulse is not used'); } } else console.log('4/5 (no --beat)');

console.log('5/5 making the job folder and the style sheet...');
const hasScale = pass.includes('--scale'), hasShade = pass.includes('--shade');
{ const mc = run(process.execPath, [path.join(HERE, 'make-captions.mjs'), '--video', video, '--words', useWords, '--out', out, ...(hasScale ? [] : ['--scale', '1.25']), ...(hasShade ? [] : ['--shade', '0.4']), ...extra, ...pass], 'make-captions'); (mc.stdout || '').split('\n').filter((l) => /주의|joined|preset/.test(l)).forEach((l) => console.log(l)); }
const pv = spawnSync(process.execPath, [path.join(HERE, 'render.mjs'), 'preview', out, ...(mine.tmp ? ['--tmp', path.resolve(String(mine.tmp))] : [])], { encoding: 'utf8' });
if (pv.status !== 0) { console.error('preview failed:\n' + ((pv.stderr || '') + (pv.stdout || '')).split('\n').slice(-12).join('\n')); process.exit(pv.status || 1); }
console.log((pv.stdout || '').split('\n').filter((l) => /글씨 크기|얼굴:|읽기 속도|overview pages/.test(l)).join('\n'));
if (mine.sample) { console.log('extra: short moving samples of the emotion motions (--sample)...'); spawnSync(process.execPath, [path.join(HERE, 'sample.mjs'), out, ...(mine.tmp ? ['--tmp', path.resolve(String(mine.tmp))] : []), ...(typeof mine.sample === 'string' ? ['--styles', mine.sample] : [])], { stdio: 'inherit' }); }
console.log(`\nDone. Open this picture and choose a style:\n  ${path.join(out, 'preview', 'overview.png')}\nThen make the video (a 20-second sample first, drop --range for the whole video):\n  node ${path.join(HERE, 'render.mjs')} final "${out}" --style mix --range 0,20`);
