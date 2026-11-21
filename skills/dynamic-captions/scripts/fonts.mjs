#!/usr/bin/env node
// fonts.mjs : the caption font library (all free OFL fonts from Google Fonts)
//   node fonts.mjs list                    -> every font id, its look, whether the file is here
//   node fonts.mjs fetch [all|id,id]       -> download missing fonts (+ their OFL licence) from github.com/google/fonts into assets/fonts
//   node fonts.mjs measure                 -> measure each font's Hangul height and save size-adjust % in fonts.json (fonts look equally tall)
//   node fonts.mjs sheet [out.png] [--text "문구"]  -> one picture with every installed font, using its tracking / width / slant profile
// Use a font: make-captions --font <id> (all text) | --font-key <id> (big key words) | --fonts hand=<id>,sfx=<id>,cute=<id>,heavy=<id>,round=<id>
// Profile overrides: --tracking -0.02 (em), --width 95 (%), --slant -8 (deg, negative leans right)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FD = path.join(HERE, '..', 'assets', 'fonts');
const REG = path.join(FD, 'fonts.json');
const reg = JSON.parse(fs.readFileSync(REG, 'utf8'));
const [cmd = 'list', arg, ...rest] = process.argv.slice(2);
const opt = {}; for (let i = 0; i < rest.length; i++) if (rest[i].startsWith('--')) opt[rest[i].slice(2)] = rest[++i];
const have = (f) => fs.existsSync(path.join(FD, f.file));
function findChrome() {
  if (process.env.CHROME && fs.existsSync(process.env.CHROME)) return process.env.CHROME;
  for (const p of ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']) if (fs.existsSync(p)) return p;
  const base = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (fs.existsSync(base)) for (const d of fs.readdirSync(base).filter((x) => /^chromium-\d+$/.test(x))) for (const sub of ['chrome-win64', 'chrome-win', 'chrome-linux']) for (const exe of ['chrome.exe', 'chrome']) { const p = path.join(base, d, sub, exe); if (fs.existsSync(p)) return p; }
  throw new Error('Chrome/Chromium not found: set CHROME=<path>');
}
const chromeArgs = (extra) => ['--headless=new', '--disable-gpu', '--allow-file-access-from-files', '--hide-scrollbars', '--force-device-scale-factor=1', '--no-first-run', `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'dyncap-fonts-'))}`, ...extra];
const faces = (list) => list.map((f) => `@font-face{font-family:"F_${f.id}";src:url("${pathToFileURL(path.join(FD, f.file)).href}")${f.size && f.size !== 100 && cmd === 'sheet' ? `;size-adjust:${f.size}%` : ''}}`).join('\n');

if (cmd === 'list') {
  for (const f of reg.fonts) console.log(`${have(f) ? '✓' : '·'} ${f.id.padEnd(13)} ${f.kind.padEnd(8)} ${f.ko}  (자간 ${f.tracking}em, 장평 ${f.width}%, 기울기 ${f.slant}°, 크기 ${f.size}%)${have(f) ? '' : '  -> node fonts.mjs fetch ' + f.id}`);
} else if (cmd === 'fetch') {
  const want = !arg || arg === 'all' ? reg.fonts : reg.fonts.filter((f) => String(arg).split(',').includes(f.id));
  for (const f of want) {
    if (have(f)) { console.log('have   ' + f.id); continue; }
    if (!f.gf) { console.log('skip   ' + f.id + ' (no download address)'); continue; }
    const base = 'https://raw.githubusercontent.com/google/fonts/main/';
    const r = await fetch(base + f.gf); if (!r.ok) { console.log('FAIL   ' + f.id + ' ' + r.status); continue; }
    fs.writeFileSync(path.join(FD, f.file), Buffer.from(await r.arrayBuffer()));
    const lic = await fetch(base + path.posix.dirname(f.gf) + '/OFL.txt'); if (lic.ok) fs.writeFileSync(path.join(FD, f.file.replace(/\.(ttf|otf|woff2?)$/i, '') + '-OFL.txt'), Buffer.from(await lic.arrayBuffer()));
    console.log('got    ' + f.id + ' ' + f.file);
  }
} else if (cmd === 'measure') {
  // Hangul ink height of "한글자막" at 100px vs Pretendard -> size-adjust so every font looks about as tall (emoji font is skipped)
  const list = reg.fonts.filter((f) => have(f) && f.kind !== 'emoji');
  const html = path.join(os.tmpdir(), 'dyncap-measure.html');
  fs.writeFileSync(html, `<!doctype html><meta charset=utf-8><style>${faces(list)}</style><body><pre id=o>wait</pre><script>
  const ids=${JSON.stringify(list.map((f) => f.id))};
  Promise.all(ids.map(i=>document.fonts.load('100px "F_'+i+'"','한글자막가'))).then(()=>{const cv=document.createElement('canvas');cv.width=900;cv.height=400;const c=cv.getContext('2d',{willReadFrequently:true});const res={};
  // ink height by scanning pixels (font metrics lie for some Korean fonts): average of the inked rows of each syllable box
  for(const i of ids){c.clearRect(0,0,900,400);c.font='100px "F_'+i+'"';c.fillStyle='#000';c.fillText('다가나하사',20,250);const d=c.getImageData(0,0,900,400).data;let top=-1,bot=-1;for(let y=0;y<400;y++){let ink=0;for(let x=0;x<900;x++)if(d[(y*900+x)*4+3]>100){ink++;}if(ink>3){if(top<0)top=y;bot=y;}}res[i]=bot-top+1;}
  document.getElementById('o').textContent='RES'+JSON.stringify(res)+'END';});</script>`);
  const r = spawnSync(findChrome(), chromeArgs(['--virtual-time-budget=15000', '--dump-dom', pathToFileURL(html).href]), { encoding: 'utf8', maxBuffer: 1 << 26 });
  const m = /RES(.*?)END/.exec(r.stdout || ''); if (!m) { console.error('measure failed', (r.stderr || '').slice(-400)); process.exit(1); }
  const h = JSON.parse(m[1]); const ref = h.pretendard;
  for (const f of reg.fonts) if (h[f.id]) { f.size = Math.round(Math.min(260, Math.max(70, (ref / h[f.id]) * 100))); console.log(f.id.padEnd(13), 'height', h[f.id].toFixed(1), '-> size', f.size + '%'); }
  fs.writeFileSync(REG, JSON.stringify(reg, null, 1) + '\n'); console.log('saved', REG);
} else if (cmd === 'sheet') {
  const out = path.resolve(arg && !arg.startsWith('--') ? arg : 'font-sheet.png'); const text = opt.text || '오늘 내가 꿀템 하나 소개해줄게!';
  const list = reg.fonts.filter((f) => have(f) && f.kind !== 'emoji'); const rowH = 118, W = 1600, H = 40 + rowH * list.length;
  const html = path.join(os.tmpdir(), 'dyncap-sheet.html');
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  fs.writeFileSync(html, `<!doctype html><meta charset=utf-8><style>${faces(list)}
  body{margin:0;background:#17181d;color:#fff;width:${W}px;font-family:"F_pretendard"} .r{display:flex;align-items:center;height:${rowH}px;border-bottom:1px solid #2a2c33;padding:0 24px}
  .l{width:330px;font-size:24px;color:#9aa3b5;line-height:1.3} .l b{color:#fff;font-size:28px;display:block} .t{font-size:64px;white-space:nowrap;display:inline-block}</style>
  <body><div style="height:40px"></div>${list.map((f) => `<div class=r><div class=l><b>${f.id}</b>${esc(f.ko)}</div><div class=t style="font-family:'F_${f.id}','F_pretendard';letter-spacing:${f.tracking}em;transform:scaleX(${f.width / 100}) skewX(${f.slant}deg);transform-origin:left center;line-height:${f.lh}">${esc(text)}</div></div>`).join('')}</body>`);
  const r = spawnSync(findChrome(), chromeArgs(['--virtual-time-budget=15000', `--window-size=${W},${H}`, `--screenshot=${out}`, pathToFileURL(html).href]), { encoding: 'utf8' });
  if (!fs.existsSync(out)) { console.error('sheet failed', (r.stderr || '').slice(-400)); process.exit(1); }
  console.log('sheet:', out, `(${list.length} fonts)`);
} else { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 8).join('\n')); process.exit(1); }
