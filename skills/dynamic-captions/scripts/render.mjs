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
// exact source frame rate (29.97 = 30000/1001 ...): frame n is drawn at n / FR seconds, so caption layers line up frame-exactly in an editor
const RATE = job.rate && job.rate.num ? job.rate : { num: fps, den: 1 }; const FR = RATE.num / RATE.den; const FRS = RATE.den === 1 ? String(RATE.num) : RATE.num + '/' + RATE.den;
const ff = (args, cwd) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit', cwd }); if (r.status) throw new Error('ffmpeg failed: ' + args.join(' ').slice(0, 300)); };

// video encoder: --encoder libx264 (default) | h264_nvenc | h264_videotoolbox | h264_qsv | h264_amf | auto (first hardware encoder whose 1-frame test works: Mac videotoolbox, else NVIDIA, Intel, AMD; else libx264)
let usedEnc = 'libx264'; let usedWorkers = 1; const tempDirs = []; // frame folders: removed on every exit path unless --keep
function venc() {
  let enc = String(opt.encoder || 'libx264');
  if (enc === 'auto') { const order = process.platform === 'darwin' ? ['h264_videotoolbox'] : ['h264_nvenc', 'h264_qsv', 'h264_amf']; enc = order.find((e) => spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=256x256:d=0.1', '-pix_fmt', 'yuv420p', '-c:v', e, '-f', 'null', '-'], { stdio: 'ignore' }).status === 0) || 'libx264'; }
  usedEnc = enc; console.log('encoder:', enc);
  if (enc === 'h264_nvenc') return ['-c:v', 'h264_nvenc', '-preset', 'p5', '-rc', 'vbr', '-cq', '18', '-b:v', '0'];
  if (enc === 'h264_videotoolbox') return ['-c:v', 'h264_videotoolbox', '-q:v', '65', '-allow_sw', '1'];
  if (enc === 'h264_qsv') return ['-c:v', 'h264_qsv', '-global_quality', '20'];
  if (enc === 'h264_amf') return ['-c:v', 'h264_amf', '-rc', 'cqp', '-qp_i', '18', '-qp_p', '20'];
  return ['-c:v', 'libx264', '-crf', '16', '-preset', 'medium'];
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
    for (let i = 0; i < 300; i++) { if (await ev('window.ready === true').catch(() => false)) return; await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('captions page never ready (style ' + style + '): ' + (errors.join(' | ') || 'no page error'));
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
    if (job.pin) { if (b.y1 > 0.985 * H || b.y0 < 0.01 * H) why.push('화면 위아래 밖으로 나감 (pin)'); } // --pin: user-chosen spot, platform-safe areas are not enforced (only the frame edge)
    else {
    if (b.y1 > (zb + tol + (portrait ? 0.04 : 0)) * H) why.push('아래 금지 구역 침범 ' + (b.y1 / H * 100).toFixed(0) + '%');
    if (portrait && b.y0 < 0.10 * H) why.push('위 버튼 구역 침범 ' + (b.y0 / H * 100).toFixed(0) + '%');
    if (portrait && b.x1 > 0.90 * W) why.push('오른쪽 버튼 구역 침범 ' + (b.x1 / W * 100).toFixed(0) + '%');
    }
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

// ---- --layers [prores|webm|png]: one transparent clip per caption (+ overlay-only stretches), at the source's exact frame rate,
// plus timeline files that place them on the right frame: FCPXML 1.9 (Final Cut Pro, DaVinci Resolve), FCP7 XML (Premiere Pro), CSV (CapCut and others)
async function exportLayers({ work, outDir, name, n0, N, vis, ra }) {
  const fmt = ['webm', 'png'].includes(String(opt.layers)) ? String(opt.layers) : 'prores';
  const dir = path.join(outDir, name.replace(/\.mp4$/, '') + '-layers'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const ph = await ev('window.phraseTimes()'); const label = new Array(N).fill(null);
  for (let n = 0; n < N; n++) { if (!vis[n]) continue; const t = (n0 + n) / FR; const p = ph.find((q) => t >= q.vs && t < q.ve); label[n] = p ? 'p' + p.k : 'ov'; }
  const segs = []; for (let n = 0; n < N; n++) { if (!label[n]) continue; const last = segs[segs.length - 1]; if (last && last.label === label[n] && last.end === n) last.end = n + 1; else segs.push({ label: label[n], start: n, end: n + 1 }); }
  // overlay-only gaps shorter than ~0.3 s (title badge between two captions) join the caption before them, so the editor gets fewer tiny clips
  for (let i = segs.length - 1; i >= 0; i--) { const g = segs[i]; if (g.label !== 'ov' || g.end - g.start >= Math.round(FR * 0.3)) continue; const prev = segs[i - 1], next = segs[i + 1]; if (prev && prev.end === g.start) { prev.end = g.end; segs.splice(i, 1); } else if (next && next.start === g.end) { next.start = g.start; segs.splice(i, 1); } }
  const tb = Math.round(FR), ntsc = RATE.den === 1001;
  const tc = (f) => { const ff2 = f % tb, s = Math.floor(f / tb); return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60, ff2].map((x) => String(x).padStart(2, '0')).join(':'); };
  const slug = (s) => s.replace(/[\\/:*?"<>|\s]+/g, '_').replace(/_+/g, '_').slice(0, 24);
  const ext = fmt === 'prores' ? '.mov' : fmt === 'webm' ? '.webm' : '';
  segs.forEach((g, i) => {
    const p = g.label === 'ov' ? null : ph.find((q) => 'p' + q.k === g.label); g.text = p ? p.text : '(overlay)'; g.style = p ? p.sid : '';
    g.file = `${String(i + 1).padStart(3, '0')}_${tc(n0 + g.start).replace(/:/g, '-')}_${slug(g.text)}${ext}`; const len = g.end - g.start;
    const inp = ['-framerate', FRS, '-start_number', String(g.start), '-i', path.join(work, 'f_%06d.png'), '-frames:v', String(len)];
    if (fmt === 'prores') ff([...inp, '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-vendor', 'apl0', path.join(dir, g.file)]);
    else if (fmt === 'webm') ff([...inp, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '28', '-auto-alt-ref', '0', '-row-mt', '1', path.join(dir, g.file)]);
    else { const sub = path.join(dir, g.file); fs.mkdirSync(sub, { recursive: true }); for (let k = 0; k < len; k++) fs.copyFileSync(path.join(work, `f_${String(g.start + k).padStart(6, '0')}.png`), path.join(sub, `${String(k).padStart(5, '0')}.png`)); }
  });
  // CSV: start / end frames and timecodes of every clip on the timeline (the timeline starts at the --range start)
  fs.writeFileSync(path.join(dir, 'layers.csv'), '\ufeffno,file,start_frame,end_frame,start_tc,end_tc,start_sec,end_sec,style,text\n' + segs.map((g, i) => [i + 1, g.file, n0 + g.start, n0 + g.end, tc(n0 + g.start), tc(n0 + g.end), ((n0 + g.start) / FR).toFixed(3), ((n0 + g.end) / FR).toFixed(3), g.style, '"' + g.text.replace(/"/g, '""') + '"'].join(',')).join('\n') + '\n');
  const furl = (p) => 'file:///' + path.resolve(p).replace(/\\/g, '/').replace(/^\/+/, '').split('/').map((x, i) => (i === 0 && /:$/.test(x) ? x : encodeURIComponent(x))).join('/');
  const rt = (f) => `${f * RATE.den}/${RATE.num}s`; const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  if (fmt !== 'png') {
    const totalSrc = Math.round(duration * FR);
    // FCPXML 1.9: the source video on the main storyline, every caption clip connected above it (lane 1) on its exact frame
    const fcp = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE fcpxml>\n<fcpxml version="1.9">\n <resources>\n  <format id="r1" frameDuration="${RATE.den}/${RATE.num}s" width="${W}" height="${H}"/>\n  <asset id="v0" name="${esc(path.basename(job.video))}" start="0s" duration="${rt(totalSrc)}" hasVideo="1" hasAudio="1" format="r1" audioSources="1" audioChannels="2"><media-rep kind="original-media" src="${esc(furl(job.video))}"/></asset>\n` +
      segs.map((g, i) => `  <asset id="c${i + 1}" name="${esc(g.file)}" start="0s" duration="${rt(g.end - g.start)}" hasVideo="1" format="r1"><media-rep kind="original-media" src="${esc(furl(path.join(dir, g.file)))}"/></asset>`).join('\n') +
      `\n </resources>\n <library>\n  <event name="captions">\n   <project name="${esc(name.replace(/\.mp4$/, ''))}">\n    <sequence format="r1" duration="${rt(N)}" tcStart="0s" tcFormat="NDF">\n     <spine>\n      <asset-clip ref="v0" name="${esc(path.basename(job.video))}" offset="0s" start="${rt(n0)}" duration="${rt(N)}" format="r1">\n` +
      segs.map((g, i) => `       <asset-clip ref="c${i + 1}" lane="1" name="${esc(g.text)}" offset="${rt(n0 + g.start)}" start="0s" duration="${rt(g.end - g.start)}" format="r1"/>`).join('\n') +
      `\n      </asset-clip>\n     </spine>\n    </sequence>\n   </project>\n  </event>\n </library>\n</fcpxml>\n`;
    fs.writeFileSync(path.join(dir, 'timeline.fcpxml'), fcp);
    // FCP7 XML (xmeml 4): Premiere Pro imports this; V1 = source video, V2 = captions
    const rate = `<rate><timebase>${tb}</timebase><ntsc>${ntsc ? 'TRUE' : 'FALSE'}</ntsc></rate>`; const pu = (p) => 'file://localhost/' + path.resolve(p).replace(/\\/g, '/').replace(/^\/+/, '').split('/').map((x, i) => (i === 0 && /:$/.test(x) ? x : encodeURIComponent(x))).join('/');
    const sc = `<samplecharacteristics><width>${W}</width><height>${H}</height></samplecharacteristics>`;
    const xm = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE xmeml>\n<xmeml version="4">\n<sequence id="seq1"><name>${esc(name.replace(/\.mp4$/, ''))}</name><duration>${N}</duration>${rate}<media><video><format>${sc}</format>\n` +
      `<track><clipitem id="src"><name>${esc(path.basename(job.video))}</name><duration>${totalSrc}</duration>${rate}<start>0</start><end>${N}</end><in>${n0}</in><out>${n0 + N}</out><file id="file-src"><name>${esc(path.basename(job.video))}</name><pathurl>${esc(pu(job.video))}</pathurl>${rate}<duration>${totalSrc}</duration><media><video>${sc}</video><audio/></media></file></clipitem></track>\n<track>` +
      segs.map((g, i) => `<clipitem id="cap${i + 1}"><name>${esc(g.text)}</name><duration>${g.end - g.start}</duration>${rate}<start>${g.start}</start><end>${g.end}</end><in>0</in><out>${g.end - g.start}</out><file id="file-cap${i + 1}"><name>${esc(g.file)}</name><pathurl>${esc(pu(path.join(dir, g.file)))}</pathurl>${rate}<duration>${g.end - g.start}</duration><media><video>${sc}</video></media></file></clipitem>`).join('\n') +
      `</track></video></media></sequence>\n</xmeml>\n`;
    fs.writeFileSync(path.join(dir, 'timeline-premiere.xml'), xm);
  }
  fs.writeFileSync(path.join(dir, 'README.txt'), [
    `자막 레이어 ${segs.length}개 (${fmt === 'prores' ? 'ProRes 4444 투명 MOV' : fmt === 'webm' ? 'VP9 투명 WebM' : '투명 PNG 연속 그림'}), 프레임율 ${FRS} (원본과 같음), 크기 ${W}x${H}`,
    '', '- layers.csv : 클립마다 시작·끝 프레임과 타임코드. 타임라인 0초 = 원본 영상 ' + ra + '초 지점.',
    fmt !== 'png' ? '- Final Cut Pro / DaVinci Resolve : 파일 > 가져오기 > timeline.fcpxml (원본 영상 위에 자막이 제자리에 놓임)' : '',
    fmt !== 'png' ? '- Premiere Pro : 파일 > 가져오기 > timeline-premiere.xml (V1 원본, V2 자막)' : '',
    '- CapCut 등 : 클립 파일을 layers.csv 의 시작 시각에 맞춰 원본 위 트랙에 올립니다. 투명 MOV가 검게 보이면 --layers webm 이나 --layers png 로 다시 뽑습니다.',
    '- 자막 문구를 고치려면 make-captions 부터 다시 만들고 render final --layers 를 다시 실행합니다.',
    '- 편집 프로그램별 가져오기는 이 스킬에서 직접 열어 시험하지 못했습니다(파일 형식만 맞춤).',
  ].filter((x) => x !== '').join('\n') + '\n');
  return { dir, count: segs.length, format: fmt };
}

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
    // overview pages: at most 16 styles (portrait, 4 columns) or 12 (landscape, 3 columns) per picture, so the text stays big enough to read
    const ovi = at.length > 1 ? 1 : 0; const cols = isPortrait ? 4 : 3; const per = isPortrait ? 16 : 12; const pages = [];
    for (let pg = 0; pg * per < styles.length; pg++) {
      const part = styles.slice(pg * per, (pg + 1) * per); const name = pg === 0 ? 'overview.png' : `overview-${pg + 1}.png`; pages.push(path.join(dir, name));
      const pat = part.map((s) => ['-i', tiles[s][ovi]]).flat();
      const lay = part.map((_, k) => { const cx = k % cols, ry = Math.floor(k / cols); return `${cx ? Array(cx).fill('w0').join('+') : '0'}_${ry ? Array(ry).fill('h0').join('+') : '0'}`; }).join('|');
      if (part.length === 1) fs.copyFileSync(tiles[part[0]][ovi], path.join(dir, name)); else ff([...pat, '-filter_complex', `xstack=inputs=${part.length}:layout=${lay}:fill=black`, '-frames:v', '1', path.join(dir, name)]);
    }
    if (pages.length > 1) console.log('overview pages: ' + pages.join(' , '));
    await load('mix'); const mixPlan = await ev('window.mixPlan'); const posPlan = await ev('window.posPlan'); fs.writeFileSync(path.join(dir, 'mix-plan.json'), JSON.stringify(mixPlan.map((m, i) => ({ ...m, pos: posPlan[i] && posPlan[i].pos })), null, 1));
    fs.writeFileSync(path.join(dir, 'qa.json'), JSON.stringify({ at, zone: job.zone, qa, report }, null, 1));
    console.log('preview moments (s):', at.join(', ')); console.log('overview:', path.join(dir, 'overview.png'));
    for (const s of styles) console.log(`  ${s} (${labels[s]}): ${path.join(dir, `style-${s}.png`)}  ${qa[s].length ? '구역 경고 ' + JSON.stringify(qa[s]) : '구역 OK'}  | 글자 최소 ${sizeInfo[s].min}px, 작음 ${sizeInfo[s].small}개, 자리 옮김 ${sizeInfo[s].moved}개, 얼굴 겹침 ${sizeInfo[s].onFace}개`);
  } else if (mode === 'probe') {
    // debug: where is the caption at --at t for --style s (bounds, spot, sizes)
    await load(opt.style || 'block-sweep'); for (const t of String(opt.at || '1').split(',').map(Number)) { await ev(`window.seek(${t})`); console.log(t, JSON.stringify({ bounds: await ev('window.bounds()'), spot: await ev('window.posRect && window.posRect()'), info: await ev('window.layoutInfo && window.layoutInfo()'), expr: opt.expr ? await ev(String(opt.expr)) : undefined })); }
  } else if (mode === 'frames') {
    // internal: a worker process draws frames [n0, n1) into the shared work folder (file index = index0 + n - n0)
    await load(opt.style); const wn0 = +opt.n0, wn1 = +opt.n1, i0 = +opt.index0; const wblank = path.join(opt.work, `blank-${i0}.png`); await png(-5, wblank);
    for (let n = wn0; n < wn1; n++) { const t = n / FR; const f = path.join(opt.work, `f_${String(i0 + n - wn0).padStart(6, '0')}.png`); if (await ev(`window.visible(${t})`)) await png(t, f); else fs.copyFileSync(wblank, f); }
  } else if (mode === 'final') {
    const style = opt.style; if (!style) throw new Error('--style required');
    const vs = fs.statSync(job.video);
    if (job.videoStat && (vs.size !== job.videoStat.size || Math.abs(vs.mtimeMs - job.videoStat.mtimeMs) > 1000) && !opt.force) throw new Error('영상 파일이 작업 폴더를 만든 뒤 바뀌었습니다. 시안 승인은 무효입니다. make-captions.mjs부터 다시 실행하세요(--force로 무시 가능).');
    await load(style); const report = await qaReport();
    const [ra, rb] = opt.range ? String(opt.range).split(',').map(Number) : [0, duration];
    const n0 = Math.round(ra * FR), n1 = Math.round(Math.min(rb, duration) * FR), N = n1 - n0;
    const tmpBase = opt.tmp || process.env.DYNCAP_TMP || LOCAL.tmp || path.join(os.tmpdir(), 'dynamic-captions'); fs.mkdirSync(tmpBase, { recursive: true });
    const work = path.join(tmpBase, 'dyncap-' + path.basename(JOB) + '-' + style + '-' + Date.now()); fs.mkdirSync(work, { recursive: true }); tempDirs.push(work);
    const blank = path.join(work, 'blank.png'); await png(-5, blank);
    const times = []; for (let n = 0; n < N; n++) times.push((n0 + n) / FR);
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
    ff(['-ss', String(ra), '-t', String(N / FR), '-i', job.video, '-framerate', FRS, '-start_number', '0', '-i', path.join(work, 'f_%06d.png'), '-filter_complex', '[0:v][1:v]overlay=shortest=1:format=auto,format=yuv420p[v]', '-map', '[v]', '-map', '0:a?', ...venc(), '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', out]);
    let alpha = null;
    if (opt.alpha) { alpha = path.join(outDir, name.replace(/\.mp4$/, '') + '-alpha.mov'); ff(['-framerate', FRS, '-start_number', '0', '-i', path.join(work, 'f_%06d.png'), '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', alpha]); }
    let layerInfo = null;
    if (opt.layers) layerInfo = await exportLayers({ work, outDir, name, n0, N, vis, ra });
    // key=value output: the csv field order and a trailing comma differ between files, so reading the last csv field gave a false 'frames differ' warning
    const prRaw = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=nb_read_frames,width,height', '-of', 'default=nw=1', out], { encoding: 'utf8' }).stdout;
    const kv = Object.fromEntries(prRaw.split(/\r?\n/).filter(Boolean).map((l) => l.split('=')));
    const pr = `${kv.width},${kv.height},${kv.nb_read_frames}`;
    const got = +kv.nb_read_frames; const diff = Math.abs(got - N);
    console.log(`check: ${pr} (expected about ${N} frames, difference ${diff})` + (diff > 2 ? '  ⚠ 프레임 수가 다릅니다. 원본의 영상 줄기 길이·가변 프레임율을 ffprobe로 확인하세요' : ''));
    ff(['-i', out, '-vf', `fps=1/${Math.max(1, Math.round(N / FR / 20))},scale=${H > W ? 216 : 384}:-2,tile=${H > W ? 10 : 5}x2`, '-frames:v', '1', path.join(outDir, name.replace(/\.mp4$/, '') + '-sheet.png')]);
    if (!opt.keep) fs.rmSync(work, { recursive: true, force: true });
    fs.writeFileSync(out.replace(/\.mp4$/, '.json'), JSON.stringify({ made: new Date().toISOString(), video: job.video, videoStat: job.videoStat, style, range: [ra, rb], encoder: usedEnc, workers: usedWorkers, frames: N, fps, rate: RATE, layers: layerInfo || undefined, timingPrecision: job.precision || 'unknown', approxWords: job.approxWords, zoneWarnings: bad.length, qa: report, mixPlan: style === 'mix' ? await ev('window.mixPlan') : undefined, posPlan: await ev('window.posPlan') }, null, 1));
    console.log('video:', out); if (alpha) console.log('alpha:', alpha); if (layerInfo) console.log('layers:', layerInfo.dir, '(' + layerInfo.count + ' clips, ' + layerInfo.format + ')'); console.log('sheet:', path.join(outDir, name.replace(/\.mp4$/, '') + '-sheet.png'));
  } else throw new Error('unknown mode ' + mode);
} finally { await cleanup(); }







