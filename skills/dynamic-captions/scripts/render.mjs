#!/usr/bin/env node
// render.mjs : preview style sheets and final caption render for a job made by make-captions.mjs
//   node render.mjs preview <jobdir> [--styles all|block-sweep,pop-word] [--at 3.2,9,15,22]
//        -> <jobdir>/preview/overview.png (all styles, one moment) + style-<id>.png (4 moments) + qa.json
//   node render.mjs final <jobdir> --style <id> [--range a,b] [--alpha] [--name out.mp4] [--tmp <dir>] [--allow-overflow]
//        -> burned-in mp4 (<jobdir>/out/) ; --alpha also writes a transparent ProRes 4444 .mov
// Frames are rendered with headless Chrome (CDP) -> transparent PNG -> ffmpeg overlay.
// Big frame folders go to --tmp <dir>, or DYNCAP_TMP, or scripts/local.json {"tmp": "..."}, else <system temp>/dynamic-captions. Chrome: set CHROME=<path> if it is not found.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [mode, jobArg, ...rest] = process.argv.slice(2);
const opt = {}; for (let i = 0; i < rest.length; i++) if (rest[i].startsWith('--')) opt[rest[i].slice(2)] = rest[i + 1]?.startsWith('--') || rest[i + 1] == null ? true : rest[++i];
if (!mode || !jobArg) { console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 8).join('\n')); process.exit(1); }
const JOB = path.resolve(jobArg); if (mode !== 'frames') fs.copyFileSync(new URL('./runtime.js', import.meta.url), path.join(JOB, 'runtime.js')); // always render with the current runtime (worker processes reuse the copy the parent just made)
 const job = JSON.parse(fs.readFileSync(path.join(JOB, 'job.json'), 'utf8'));
const { width: W, height: H, fps, duration } = job; const isPortrait = H > W;
const ff = (args, cwd) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit', cwd }); if (r.status) throw new Error('ffmpeg failed: ' + args.join(' ').slice(0, 300)); };

// video encoder: --encoder libx264 (default) | libx265 | h264_nvenc | hevc_nvenc | h264_videotoolbox | hevc_videotoolbox | auto
//   --codec h264 (default) | h265 only matters for auto and when --encoder is not given (then libx264 / libx265).
//   auto takes the first GPU encoder that passes a 1-frame test encode: NVENC, then VideoToolbox (macOS), else the CPU encoder.
//   Quality is set to look about like libx264 -crf 16. HEVC gets the hvc1 tag so QuickTime, Photos and iPhones play it.
const ENC = {
  libx264: ['-c:v', 'libx264', '-crf', '16', '-preset', 'medium'],
  libx265: ['-c:v', 'libx265', '-crf', '18', '-preset', 'medium', '-tag:v', 'hvc1'],
  h264_nvenc: ['-c:v', 'h264_nvenc', '-preset', 'p5', '-rc', 'vbr', '-cq', '18', '-b:v', '0'],
  hevc_nvenc: ['-c:v', 'hevc_nvenc', '-preset', 'p5', '-rc', 'vbr', '-cq', '18', '-b:v', '0', '-tag:v', 'hvc1'],
  h264_videotoolbox: ['-c:v', 'h264_videotoolbox', '-q:v', '75'], // -q:v needs Apple Silicon
  hevc_videotoolbox: ['-c:v', 'hevc_videotoolbox', '-q:v', '75', '-tag:v', 'hvc1'],
};
let usedEnc = 'libx264'; let usedWorkers = 1; const tempDirs = []; // frame folders: removed on every exit path unless --keep
function venc() {
  const codec = String(opt.codec || 'h264'); if (codec !== 'h264' && codec !== 'h265') throw new Error('--codec must be h264 or h265');
  const h265 = codec === 'h265';
  let enc = String(opt.encoder || (h265 ? 'libx265' : 'libx264'));
  if (enc === 'auto') {
    const works = (e) => spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=256x256:d=0.1', ...ENC[e], '-f', 'null', '-'], { stdio: 'ignore' }).status === 0;
    const tries = h265 ? ['hevc_nvenc', ...(process.platform === 'darwin' ? ['hevc_videotoolbox'] : []), 'libx265'] : ['h264_nvenc', ...(process.platform === 'darwin' ? ['h264_videotoolbox'] : [])];
    enc = tries.find(works) || 'libx264'; if (h265 && enc === 'libx264') console.log('no H.265 encoder works here, using libx264');
  }
  if (!ENC[enc]) throw new Error(`unknown --encoder ${enc}: use auto, ${Object.keys(ENC).join(', ')}`);
  usedEnc = enc; console.log('encoder:', enc);
  return ENC[enc];
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.json': 'application/json' };
const srv = await new Promise((res) => { const s = http.createServer((q, r) => { const p = path.join(JOB, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (!p.startsWith(JOB) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); }).listen(0, '127.0.0.1', () => res(s)); });

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOCAL = (() => { try { return JSON.parse(fs.readFileSync(path.join(HERE, 'local.json'), 'utf8')); } catch { return {}; } })(); // optional, never published: this PC's own choices
function findChrome() {
  if (process.env.CHROME && fs.existsSync(process.env.CHROME)) return process.env.CHROME;
  const base = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (fs.existsSync(base)) for (const d of fs.readdirSync(base).filter((x) => /^chromium-\d+$/.test(x)).sort((a, b) => +b.split('-')[1] - +a.split('-')[1]))
    for (const sub of ['chrome-win64', 'chrome-win', 'chrome-linux']) for (const exe of ['chrome.exe', 'chrome']) { const p = path.join(base, d, sub, exe); if (fs.existsSync(p)) return p; }
  for (const p of ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium']) if (fs.existsSync(p)) return p;
  throw new Error('Chrome/Chromium not found: set CHROME=<path>');
}
const port = 9300 + Math.floor(Math.random() * 600);
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'dyncap-chrome-'));
const chrome = spawn(findChrome(), [`--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--headless=new', ...(process.platform === 'linux' ? ['--no-sandbox', '--disable-gpu'] : []), '--hide-scrollbars', '--mute-audio', `--window-size=${W},${H}`, '--force-device-scale-factor=1', '--font-render-hinting=none', '--force-color-profile=srgb', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let list; for (let i = 0; i < 100; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (list.some((x) => x.type === 'page')) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
const ws = new WebSocket(list.find((x) => x.type === 'page').webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let mid = 0; const pend = new Map(); const errors = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text); if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map((a) => a.value ?? a.description).join(' ')); if (d.id && pend.has(d.id)) { const { r, j } = pend.get(d.id); pend.delete(d.id); d.error ? j(new Error(d.error.message)) : r(d.result); } };
const send = (method, params = {}) => new Promise((r, j) => { const i = ++mid; pend.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.value;
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
async function load(style) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/captions.html?style=${style}&n=${attempt}` });
    for (let i = 0; i < 100; i++) { if (await ev('window.ready === true').catch(() => false)) return; await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('captions page never ready: ' + (errors.join(' | ') || 'no page error'));
}
const png = async (t, file) => {
  await ev(`window.seek(${t}).then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(1)))))`);
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(file, Buffer.from(data, 'base64'));
};
// zone check: caption boxes must stay inside the platform-safe band
async function zoneCheck(times) {
  const [zt, zb] = job.zone, portrait = H > W, tol = 0.02; const bad = [];
  for (const t of times) {
    await ev(`window.seek(${t})`); const b = await ev('window.bounds()'); if (!b) continue;
    const why = [];
    const pr = await ev('window.posRect && window.posRect()'); // the spot (left/right/top/bottom) this caption was given
    // hard rules: landscape keeps the bottom area free for YouTube captions; portrait keeps bottom ~30%, top 10% and right 10% (app UI) free
    if (b.y1 > (zb + tol + (portrait ? 0.04 : 0)) * H) why.push('아래 금지 구역 침범 ' + (b.y1 / H * 100).toFixed(0) + '%');
    if (portrait && b.y0 < 0.10 * H) why.push('위 버튼 구역 침범 ' + (b.y0 / H * 100).toFixed(0) + '%');
    if (portrait && b.x1 > 0.90 * W) why.push('오른쪽 버튼 구역 침범 ' + (b.x1 / W * 100).toFixed(0) + '%');
    if (b.x0 < 0.03 * W || b.x1 > 0.97 * W) why.push('좌우 잘림 위험');
    if (pr) { const m = 0.03; if (b.y0 < (pr.t - m) * H || b.y1 > (pr.b + m) * H || b.x0 < (pr.l - m) * W || b.x1 > (pr.r + m) * W) why.push(`자리(${(pr.l * 100).toFixed(0)}-${(pr.r * 100).toFixed(0)}% × ${(pr.t * 100).toFixed(0)}-${(pr.b * 100).toFixed(0)}%) 밖으로 나감`); }
    if (why.length) bad.push({ t: +t.toFixed(2), why: why.join(', '), box: [b.x0, b.y0, b.x1, b.y1].map(Math.round) });
  }
  return bad;
}
// QA numbers from the page: reading speed per phrase (chars/s, spaces excluded) and glyphs a font cannot draw
async function qaReport() {
  const stats = await ev('window.phraseStats()'); const cov = await ev('window.fontCoverage()');
  const sz = await ev('window.sizeScan()'); const small = sz.phrases.filter((p) => !p.ok), moved = sz.phrases.filter((p) => p.widened), onFace = sz.phrases.filter((p) => p.faceHit > 0.02);
  console.log(`얼굴: 자막이 얼굴을 가리는 묶음 ${onFace.length}개 (얼굴 정보가 있을 때만 의미 있음)`); for (const p of onFace.slice(0, 5)) console.log(`  얼굴 겹침 ${p.start}s ${(p.faceHit * 100).toFixed(0)}% "${p.text}" (${p.pos})`);
  console.log(`글씨 크기: 최소 허용 ${sz.minAllowed}px | 작은 자막 ${small.length}개 | 넓은 자리로 옮긴 자막 ${moved.length}개 | 가장 작은 글자 ${Math.min(...sz.phrases.map((p) => p.minPx))}px`);
  for (const p of small.slice(0, 5)) console.log(`  작음 ${p.start}s ${p.minPx}px "${p.text}" (${p.pos})`);
  const fast = stats.filter((s) => s.cps > 17), vfast = stats.filter((s) => s.cps > 25), miss = Object.entries(cov).filter(([, v]) => v.length);
  console.log(`읽기 속도: 가장 빠른 묶음 ${Math.max(...stats.map((s) => s.cps))}자/초 | 17자/초 초과 ${fast.length}개 | 25자/초 초과 ${vfast.length}개 (한글 기준은 시험 중이라 참고용)`);
  for (const s of fast.slice(0, 5)) console.log(`  빠름 ${s.start}s ${s.cps}자/초 "${s.text}"`);
  for (const [f, v] of miss) console.log(`  글꼴 ${f}에 없는 글자(대체 글꼴로 나옴): ${v.join('')}`);
  return { fast: fast.map((s) => ({ start: s.start, cps: s.cps, text: s.text })), missingGlyphs: Object.fromEntries(miss), size: { minAllowed: sz.minAllowed, small: small.map((p) => ({ start: p.start, minPx: p.minPx, pos: p.pos, text: p.text })), moved: moved.length }, faceOverlap: onFace.map((p) => ({ start: p.start, hit: p.faceHit, pos: p.pos, text: p.text })) };
}
const wordsData = JSON.parse(fs.readFileSync(path.join(JOB, 'data.js'), 'utf8').replace(/^window\.CAPDATA=/, '').replace(/;$/, '')).words;
const chromeExit = new Promise((res) => chrome.once('exit', res));
// stop Chrome (whole process tree), wait until it is really gone, then delete its profile and any leftover frame folder (unless --keep)
const cleanup = async () => {
  if (errors.length) console.log('페이지 오류:', errors.slice(0, 3).join(' | '));
  try { ws.close(); srv.close(); } catch {}
  try { if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(chrome.pid), '/t', '/f'], { stdio: 'ignore' }); else chrome.kill('SIGKILL'); } catch {}
  await Promise.race([chromeExit, new Promise((r) => setTimeout(r, 5000))]); await new Promise((r) => setTimeout(r, 600));
  const rm = (p) => { try { fs.rmSync(p, { recursive: true, force: true, maxRetries: 25, retryDelay: 200 }); } catch (e) { if (process.env.DYNCAP_DEBUG) console.error('rm failed', p, e.code); } };
  rm(prof); if (!opt.keep) tempDirs.forEach(rm);
};

try {
  if (mode === 'preview') {
    await load('block-sweep'); const all = await ev('Object.keys(window.styles)'); const labels = await ev('window.styles'); const report = await qaReport();
    const styles = !opt.styles || opt.styles === 'all' ? all : String(opt.styles).split(',');
    const speech = wordsData.filter((w) => w.end - w.start >= 0.2);
    const at = opt.at ? String(opt.at).split(',').map(Number) : [0.15, 0.4, 0.65, 0.88].map((f) => { const w = speech[Math.floor(f * (speech.length - 1))]; return +(w.start + (w.end - w.start) * 0.55).toFixed(2); });
    const dir = path.join(JOB, 'preview'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const frames = at.map((t, i) => { const f = path.join(dir, `frame${i}.png`); ff(['-ss', String(t), '-i', job.video, '-frames:v', '1', '-vf', `scale=${W}:${H}`, f]); return f; });
    fs.copyFileSync(path.join(HERE, '..', 'assets', 'fonts', 'IBMPlexSansKR-Bold.ttf'), path.join(dir, 'lab.ttf'));
    const qa = {}; const tiles = {}; const sizeInfo = {};
    for (const s of styles) {
      await load(s); tiles[s] = [];
      for (const [i, t] of at.entries()) {
        const cap = path.join(dir, `cap-${s}-${i}.png`); await png(t, cap);
        const out = path.join(dir, `tile-${s}-${i}.png`); fs.writeFileSync(path.join(dir, `l-${s}.txt`), `${s}  ${labels[s]}`);
        ff(['-i', frames[i], '-i', cap, '-filter_complex', `[0][1]overlay,scale=${isPortrait ? 270 : 480}:-2,drawtext=fontfile=lab.ttf:textfile=l-${s}.txt:x=8:y=8:fontsize=${isPortrait ? 20 : 24}:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=5`, '-frames:v', '1', out], dir);
        tiles[s].push(out);
      }
      { const ps = await ev('window.phraseStats()'); const every = ps.flatMap((p) => [p.start + 0.12, p.start + Math.min(p.visible, 1.2) * 0.5]); qa[s] = await zoneCheck([...new Set([...at, ...every])]); } { const z = await ev('window.sizeScan()'); sizeInfo[s] = { small: z.phrases.filter((p) => !p.ok).length, moved: z.phrases.filter((p) => p.widened).length, onFace: z.phrases.filter((p) => p.faceHit > 0.02).length, min: Math.min(...z.phrases.map((p) => p.minPx)) }; }
      const pat = tiles[s].map((f) => ['-i', f]).flat();
      if (at.length === 1) fs.copyFileSync(tiles[s][0], path.join(dir, `style-${s}.png`)); else ff([...pat, '-filter_complex', `hstack=inputs=${at.length}`, '-frames:v', '1', path.join(dir, `style-${s}.png`)]);
    }
    // overview: the second sample moment of every style
    const ovi = at.length > 1 ? 1 : 0; const cols = isPortrait ? 4 : 2; const pat = styles.map((s) => ['-i', tiles[s][ovi]]).flat();
    const lay = styles.map((_, k) => { const cx = k % cols, ry = Math.floor(k / cols); return `${cx ? Array(cx).fill('w0').join('+') : '0'}_${ry ? Array(ry).fill('h0').join('+') : '0'}`; }).join('|');
    if (styles.length === 1) fs.copyFileSync(tiles[styles[0]][ovi], path.join(dir, 'overview.png')); else ff([...pat, '-filter_complex', `xstack=inputs=${styles.length}:layout=${lay}`, '-frames:v', '1', path.join(dir, 'overview.png')]);
    await load('mix'); const mixPlan = await ev('window.mixPlan'); const posPlan = await ev('window.posPlan'); fs.writeFileSync(path.join(dir, 'mix-plan.json'), JSON.stringify(mixPlan.map((m, i) => ({ ...m, pos: posPlan[i] && posPlan[i].pos })), null, 1));
    fs.writeFileSync(path.join(dir, 'qa.json'), JSON.stringify({ at, zone: job.zone, qa, report }, null, 1));
    console.log('preview moments (s):', at.join(', ')); console.log('overview:', path.join(dir, 'overview.png'));
    for (const s of styles) console.log(`  ${s} (${labels[s]}): ${path.join(dir, `style-${s}.png`)}  ${qa[s].length ? '구역 경고 ' + JSON.stringify(qa[s]) : '구역 OK'}  | 글자 최소 ${sizeInfo[s].min}px, 작음 ${sizeInfo[s].small}개, 자리 옮김 ${sizeInfo[s].moved}개, 얼굴 겹침 ${sizeInfo[s].onFace}개`);
  } else if (mode === 'frames') {
    // internal: a worker process draws frames [n0, n1) into the shared work folder (file index = index0 + n - n0)
    await load(opt.style); const wn0 = +opt.n0, wn1 = +opt.n1, i0 = +opt.index0; const wblank = path.join(opt.work, `blank-${i0}.png`); await png(-5, wblank);
    for (let n = wn0; n < wn1; n++) { const t = n / fps; const f = path.join(opt.work, `f_${String(i0 + n - wn0).padStart(6, '0')}.png`); if (await ev(`window.visible(${t})`)) await png(t, f); else fs.copyFileSync(wblank, f); }
  } else if (mode === 'final') {
    const style = opt.style; if (!style) throw new Error('--style required');
    const vargs = venc(); // pick the encoder before drawing frames, so a wrong --encoder stops right away
    const vs = fs.statSync(job.video);
    if (job.videoStat && (vs.size !== job.videoStat.size || Math.abs(vs.mtimeMs - job.videoStat.mtimeMs) > 1000) && !opt.force) throw new Error('영상 파일이 작업 폴더를 만든 뒤 바뀌었습니다. 시안 승인은 무효입니다. make-captions.mjs부터 다시 실행하세요(--force로 무시 가능).');
    await load(style); const report = await qaReport();
    const [ra, rb] = opt.range ? String(opt.range).split(',').map(Number) : [0, duration];
    const n0 = Math.round(ra * fps), n1 = Math.round(Math.min(rb, duration) * fps), N = n1 - n0;
    const tmpBase = opt.tmp || process.env.DYNCAP_TMP || LOCAL.tmp || path.join(os.tmpdir(), 'dynamic-captions'); fs.mkdirSync(tmpBase, { recursive: true });
    const work = path.join(tmpBase, 'dyncap-' + path.basename(JOB) + '-' + style + '-' + Date.now()); fs.mkdirSync(work, { recursive: true }); tempDirs.push(work);
    const blank = path.join(work, 'blank.png'); await png(-5, blank);
    const times = []; for (let n = 0; n < N; n++) times.push((n0 + n) / fps);
    const vis = []; for (const t of times) vis.push(await ev(`window.visible(${t})`));
    // zone QA on visible moments (every ~0.2 s)
    const bad = await zoneCheck(times.filter((t, n) => vis[n] && n % Math.max(1, Math.round(fps * 0.2)) === 0));
    if (bad.length) { console.log('구역 경고:', JSON.stringify(bad.slice(0, 8)), bad.length > 8 ? `... 외 ${bad.length - 8}건` : ''); if (!opt['allow-overflow']) throw new Error('자막이 안전 구역을 벗어났습니다. 글자 크기(--scale)나 구역을 조정하거나 --allow-overflow 로 무시하세요.'); }
    const t0 = Date.now();
    // --workers N: N extra Chrome processes each draw a slice of the frames (default 3; 1 = old single-process way). The page is a pure function of time, so slices are independent.
    let workers = opt.workers === undefined ? 3 : +opt.workers; if (!(workers >= 1) || N < fps * 4) workers = 1;
    if (workers > 1) {
      const per = Math.ceil(N / workers); const procs = [];
      for (let k = 0; k < workers; k++) {
        const a = k * per, b = Math.min(N, a + per); if (a >= b) break;
        procs.push(new Promise((res, rej) => { const c = spawn(process.execPath, [fileURLToPath(import.meta.url), 'frames', JOB, '--style', style, '--n0', String(n0 + a), '--n1', String(n0 + b), '--index0', String(a), '--work', work], { stdio: ['ignore', 'ignore', 'pipe'] }); let err = ''; c.stderr.on('data', (d) => { err += d; }); c.on('exit', (code) => (code === 0 ? res() : rej(new Error(`worker ${k} failed (${code}): ${err.slice(-500)}`)))); }));
      }
      await Promise.all(procs); console.log(`frames drawn by ${procs.length} workers in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    } else {
      for (let n = 0; n < N; n++) {
        const f = path.join(work, `f_${String(n).padStart(6, '0')}.png`);
        if (vis[n]) await png(times[n], f); else fs.copyFileSync(blank, f);
        if (n % fps === 0) process.stdout.write(`\r${n}/${N} frames ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      }
      process.stdout.write('\n');
    }
    usedWorkers = workers;
    const outDir = path.join(JOB, 'out'); fs.mkdirSync(outDir, { recursive: true });
    const name = opt.name || `captioned-${style}${opt.range ? `-${ra}-${rb}` : ''}.mp4`; const out = path.join(outDir, name);
    ff(['-ss', String(ra), '-t', String(N / fps), '-i', job.video, '-framerate', String(fps), '-start_number', '0', '-i', path.join(work, 'f_%06d.png'), '-filter_complex', '[0:v][1:v]overlay=shortest=1:format=auto,format=yuv420p[v]', '-map', '[v]', '-map', '0:a?', ...vargs, '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', out]);
    let alpha = null;
    if (opt.alpha) { alpha = path.join(outDir, name.replace(/\.mp4$/, '') + '-alpha.mov'); ff(['-framerate', String(fps), '-start_number', '0', '-i', path.join(work, 'f_%06d.png'), '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', alpha]); }
    // key=value output: the csv field order and a trailing comma differ between files, so reading the last csv field gave a false 'frames differ' warning
    const prRaw = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=nb_read_frames,width,height', '-of', 'default=nw=1', out], { encoding: 'utf8' }).stdout;
    const kv = Object.fromEntries(prRaw.split(/\r?\n/).filter(Boolean).map((l) => l.split('=')));
    const pr = `${kv.width},${kv.height},${kv.nb_read_frames}`;
    const got = +kv.nb_read_frames; const diff = Math.abs(got - N);
    console.log(`check: ${pr} (expected about ${N} frames, difference ${diff})` + (diff > 2 ? '  ⚠ 프레임 수가 다릅니다. 원본의 영상 줄기 길이·가변 프레임율을 ffprobe로 확인하세요' : ''));
    ff(['-i', out, '-vf', `fps=1/${Math.max(1, Math.round(N / fps / 20))},scale=${H > W ? 216 : 384}:-2,tile=${H > W ? 10 : 5}x2`, '-frames:v', '1', path.join(outDir, name.replace(/\.mp4$/, '') + '-sheet.png')]);
    if (!opt.keep) fs.rmSync(work, { recursive: true, force: true });
    fs.writeFileSync(out.replace(/\.mp4$/, '.json'), JSON.stringify({ made: new Date().toISOString(), video: job.video, videoStat: job.videoStat, style, range: [ra, rb], encoder: usedEnc, workers: usedWorkers, frames: N, fps, timingPrecision: job.precision || 'unknown', approxWords: job.approxWords, zoneWarnings: bad.length, qa: report, mixPlan: style === 'mix' ? await ev('window.mixPlan') : undefined, posPlan: await ev('window.posPlan') }, null, 1));
    console.log('video:', out); if (alpha) console.log('alpha:', alpha); console.log('sheet:', path.join(outDir, name.replace(/\.mp4$/, '') + '-sheet.png'));
  } else throw new Error('unknown mode ' + mode);
} finally { await cleanup(); }







