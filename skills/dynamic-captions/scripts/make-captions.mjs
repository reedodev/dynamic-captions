#!/usr/bin/env node
// make-captions.mjs : build a caption job folder (captions.html + data.js + fonts) for one video.
// Usage:
//   node make-captions.mjs --video in.mp4 --out <jobdir> (--words words.json | --lrc song.lrc | --srt subs.srt)
//        [--palette gold|mint|sky|rose|lime] [--emphasis "단어,단어"] [--zone 0.52,0.68] [--scale 1]
//        [--deco emoji,line]  emoji reaction on the key moment + accent line drawn under the caption (either or both)
//        [--emoji-map map.json]  {"word":"emoji"} extra/override emoji keywords (your map wins over the built-in list)
//        [--shade 0.45]  soft dark band behind the caption (0..1) for bright footage
//        [--pos varied|fixed|<name>]  varied (default): each caption moves between left/right/top/bottom spots; fixed: one spot; or one name e.g. bottom-left
//        [--pin 0.79] [--pin-x center|left|right]  PIN: every caption sits at ONE fixed height (centre at 79% of the height; 79 also works) and never moves, like a broadcast subtitle. Overrides --pos / --pos-plan / chorus centring / face dodging. The user's own choice: the platform-safe bottom area is NOT kept free (a warning is printed)
//        [--pos-avoid names]  spots that must stay empty (e.g. where a face is): landscape bottom-center,bottom-left,bottom-right,top-center,upper-left,upper-right,mid-left,mid-right; portrait mid-center,mid-left,mid-right,upper-center,upper-left,upper-right
//        [--pos-plan plan.json]  [{"from":0,"to":6,"pos":"upper-left"}] fixed spot for those seconds
//        [--beat beat.json] [--beat-strength 0.045]  songs: the caption swells on every beat (make beat.json with detect-beat.py; shifts with --shift)
//        [--faces faces.json]  captions avoid faces (make faces.json with find-faces.py; shifts with --shift)
//        [--font dongle|jua|dohyeon|singleday|yeonsung|sunflower|gugi|pretendard|black-han|plex|gaegu|myeongjo|classic|<file.ttf/.otf/.woff2>]  one font for the whole job (default: each style keeps its own font). Glyphs a custom font lacks fall back to Pretendard automatically.
//        [--font-key <same choices>]  font only for the big key words (hero-key, stamp, impact-wide ...); with --font-key alone the other text keeps its default font
//        [--fx off] [--fx-max 4]  (mix) emotion / sound words get an emotion motion (sway-breeze, jitter-nerve, heart-thump, tilt-wonder, jolt-pop, droop-sigh, boom-shake), at most fx-max times per video, 3 s apart
//        [--overlays overlays.json]  name tags, inset pictures/clips, side sound-word text (format: references/overlays.example.json; times follow --shift)
//        [--sfx auto] [--sfx-max 6]  side sound-word text added automatically at emotion / sound words (e.g. 두근두근, 깜짝~, 방긋방긋)
//        [--line-ratio 0.42] [--line-gap 6]  duo-tight: small line height vs big line, gap between the lines in px (at 1080)
//        [--fast off] [--speed 0.7]  entrances get shorter automatically when captions change quickly; --speed fixes the factor
//        [--preset brand.json] [--save-preset brand.json]  load / save look options (palette, scale, shade, pos, font, deco, fx, line, speed ...)
//        [--fonts hand=nanumpen,sfx=dokdo-east,cute=cute,heavy=gothic-a1,round=gowun-dodum,fat=bagel,pen=..,brush=..,main=..,key=..,calm=..,serif=..]  font per role (ids: node fonts.mjs list)
//        [--tracking -0.02] [--width 95] [--slant -6]  letter spacing (em), 장평 (%), 기울기 (deg, negative leans right). Default: the chosen font's own profile (fonts.json)
//        [--emoji auto|off] [--emoji-pos auto|end|top|corner|burst|side] [--emoji-anim auto|pop|bounce|wiggle|float|spin|pulse] [--emoji-gap 2.5] [--emoji-max N] [--emoji-font auto|system|noto]
//        [--title "자막 모션 v2 🎁"] [--title-style white|yellow|dark|pink|mint] [--title-from 0] [--title-to 9] [--title-y 0.12]  fixed top title badge (emoji ok)
//        [--look reels-pop|cute-vlog|talk-bubble|calm-explainer|variety-show|lyric-mood|kids-story]  built-in look: style pool + emoji + fonts + palette (assets/looks.json)
//        [--mix-pool a,b,c]  style=mix picks only from these styles (e.g. the ones you starred in the picker)
//        [--merge-numbers off]  keep number pieces split by speech recognition (default: "39" + ",000원" -> "39,000원")
//        [--hook off]  turn off the chorus/hook detection (repeated lines become bigger, centred, punchier)
//        [--shift seconds]   (clip cut later than the audio the timings come from: words move earlier by this much)
//        [--plan plan.json]   (style=mix only) [{"from":0,"to":8,"style":"hero-key"}, ...] seconds -> fixed style for those phrases
// words.json = { "words": [ { "text": "안녕하세요", "start": 0.4, "end": 0.9, "emph": false } ] }
// Zone is a fraction of video height. Defaults follow the YouTube-caption safe zones:
//   16:9  -> caption block bottom edge at 78% of height (zone 0.58..0.78, text sits on the bottom edge)
//   9:16  -> caption band 52..68% of height (text centred in the band)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, '..');
const argv = process.argv.slice(2); const opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') || argv[i + 1] == null ? true : argv[++i];
// presets: --preset brand.json loads saved look options (options typed on the command line win); --save-preset brand.json saves this run's look options
const PRESET_KEYS = ['palette', 'scale', 'shade', 'pin', 'pin-x', 'pos', 'pos-avoid', 'font', 'font-key', 'deco', 'hook', 'fx', 'fx-max', 'line-ratio', 'line-gap', 'sfx', 'sfx-max', 'fast', 'speed', 'zone', 'beat-strength', 'merge-numbers', 'fonts', 'tracking', 'width', 'slant', 'emoji', 'emoji-pos', 'emoji-anim', 'emoji-gap', 'emoji-max', 'emoji-font', 'mix-pool', 'title-style', 'look'];
const LOOKS = JSON.parse(fs.readFileSync(path.join(SKILL, 'assets', 'looks.json'), 'utf8')).looks;
if (opt.preset) { const pf = String(opt.preset); const p = JSON.parse(fs.readFileSync(pf, 'utf8')); for (const [k, v] of Object.entries(p)) if (PRESET_KEYS.includes(k) && opt[k] === undefined) opt[k] = v; console.log('  preset: ' + pf); }
// --look <id>: a built-in look (style pool + emoji + fonts + palette). Command-line options and --preset values win over the look.
if (opt.look && opt.look !== true) { const lk = LOOKS[String(opt.look)]; if (!lk) { console.error('unknown look ' + opt.look + ' / ' + Object.keys(LOOKS).join(', ')); process.exit(2); } for (const [k, v] of Object.entries(lk.options)) if (opt[k] === undefined) opt[k] = v; console.log('  look: ' + opt.look + ' (' + lk.ko + ')'); }
if (opt['save-preset']) { const p = {}; for (const k of PRESET_KEYS) if (opt[k] !== undefined) p[k] = opt[k]; fs.writeFileSync(String(opt['save-preset']), JSON.stringify(p, null, 1) + '\n'); console.log('  saved preset: ' + opt['save-preset'] + ' ' + JSON.stringify(p)); }
if (!opt.video || !opt.out) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 11).join('\n')); process.exit(1); }

const PALETTES = {
  gold: { accent: '#FFD21F', accent2: '#FF4D6D' }, mint: { accent: '#19E3B1', accent2: '#FFD21F' }, sky: { accent: '#4DA3FF', accent2: '#FFD21F' },
  rose: { accent: '#FF5A7A', accent2: '#FFE14D' }, lime: { accent: '#C8FF3D', accent2: '#FF5A7A' },
};
const probe = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,avg_frame_rate,duration:stream_side_data=rotation:format=duration', '-of', 'json', path.resolve(opt.video)], { encoding: 'utf8' }).stdout);
const st = probe.streams[0]; let width = st.width, height = st.height;
const rot = Math.abs(+(st.side_data_list?.find((x) => x.rotation != null)?.rotation || 0)); if (rot === 90 || rot === 270) [width, height] = [height, width];
const [fn, fd] = st.r_frame_rate.split('/').map(Number); let fps = Math.round(fn / (fd || 1));
// exact frame rate (e.g. 30000/1001 = 29.97): frame n is drawn at n * den / num seconds so caption layers line up frame-exactly with the source in an editor
let rate = { num: fn || fps, den: fd || 1 }; if (rate.num / rate.den > 240 || !(rate.num > 0)) rate = { num: fps, den: 1 };
// variable-frame-rate sources (e.g. AI video exports tagged 60 fps that really hold ~24 frames/s): follow the real average rate
const [an, ad] = String(st.avg_frame_rate || '0/1').split('/').map(Number); const avgFps = ad ? an / ad : 0;
if (avgFps > 0 && Math.abs(avgFps - fps) / fps > 0.1) { console.log(`  note: variable frame rate (tagged ${fps} fps, real average ${avgFps.toFixed(2)} fps) -> captions rendered at ${Math.max(24, Math.round(avgFps))} fps`); fps = Math.max(24, Math.round(avgFps)); rate = { num: fps, den: 1 }; }
// length of the VIDEO stream (the container may be longer when the audio runs a little past the last frame)
const duration = st.duration && +st.duration > 0 ? Math.min(+st.duration, +(probe.format.duration || st.duration)) : +(probe.format.duration);

function tsec(s) { const m = s.match(/(?:(\d+):)?(\d+):(\d+)[.,](\d+)/); return (+(m[1] || 0)) * 3600 + +m[2] * 60 + +m[3] + +('0.' + m[4]); }
function spread(text, a, b) { // approximate word timing inside one timed line (proportional to characters)
  const ws = text.trim().split(/\s+/).filter(Boolean); const total = ws.reduce((n, w) => n + w.length, 0) || 1; let t = a; const dur = Math.max(0.2, b - a);
  // lineEnd marks the last word of a lyric/subtitle line: the caption grouping never joins words across it
  return ws.map((w, k) => { const d = dur * (w.length / total); const o = { text: w, start: +t.toFixed(3), end: +(t + d * 0.92).toFixed(3), approx: true, lineEnd: k === ws.length - 1 }; t += d; return o; });
}
let words, precision = 'cue-level';
if (opt.words) { const j = JSON.parse(fs.readFileSync(opt.words, 'utf8')); words = j.words; precision = j.precision || 'word-level'; }
else if (opt.lrc) {
  const lines = fs.readFileSync(opt.lrc, 'utf8').split(/\r?\n/).map((l) => l.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/)).filter(Boolean).map((m) => ({ t: +m[1] * 60 + +m[2], text: m[3].trim() })).filter((l) => l.text);
  words = lines.flatMap((l, i) => spread(l.text, l.t, Math.min((lines[i + 1]?.t ?? duration) - 0.06, l.t + 6)));
} else if (opt.srt) {
  const blocks = fs.readFileSync(opt.srt, 'utf8').replace(/\r/g, '').split(/\n\n+/);
  words = blocks.flatMap((b) => { const ls = b.split('\n'); const k = ls.findIndex((l) => l.includes('-->')); if (k < 0) return []; const [a, c] = ls[k].split('-->').map((x) => tsec(x.trim())); return spread(ls.slice(k + 1).join(' ').replace(/<[^>]+>/g, ''), a, c); });
} else { console.error('need --words, --lrc or --srt'); process.exit(1); }
// --shift N : the video was cut N seconds after the start of the audio the timings refer to (trimmed clip) -> move every word N seconds earlier
// number pieces: speech recognition often splits "39,000원" into "39" + ",000원" (or "3" + ".5배"); join them back (--merge-numbers off to keep)
if (opt['merge-numbers'] !== 'off') { const mw = []; let merged = 0; for (const w of words) { const p = mw[mw.length - 1]; if (p && /\d$/.test(p.text) && /^[,.]\d/.test(w.text) && w.start - p.end < 0.6) { p.text += w.text; p.end = Math.max(p.end, w.end); if (w.lineEnd) p.lineEnd = true; merged++; } else mw.push({ ...w }); } if (merged) console.log('  joined number pieces: ' + merged); words = mw; }
const shift = +(opt.shift || 0);
if (shift) words = words.map((w) => ({ ...w, start: Math.max(0, w.start - shift), end: w.end - shift })).filter((w) => w.end > 0.05);
words = words.filter((w) => w.text && w.end > w.start).sort((a, b) => a.start - b.start).filter((w) => w.start < duration);
if (!words.length) { console.error('no words'); process.exit(1); }
const approx = words.filter((w) => w.approx).length;

const portrait = height > width;
const zone = opt.zone ? String(opt.zone).split(',').map(Number) : portrait ? [0.52, 0.68] : [0.58, 0.78];
const palette = PALETTES[opt.palette || 'gold'] || PALETTES.gold;
const out = path.resolve(opt.out); fs.mkdirSync(path.join(out, 'fonts'), { recursive: true });
// ---- fonts: the font library (assets/fonts/fonts.json, `node fonts.mjs list`) by id, or any font file of your own (copied into the job folder)
const FREG = JSON.parse(fs.readFileSync(path.join(SKILL, 'assets/fonts/fonts.json'), 'utf8')).fonts; const FBY = Object.fromEntries(FREG.map((f) => [f.id, f]));
const FALIAS = { 'east-sea': 'dokdo-east', eastsea: 'dokdo-east', cutefont: 'cute', gowun: 'gowun-dodum', gothic: 'gothic-a1', 'noto': 'noto-emoji', bagelfat: 'bagel', pen: 'nanumpen', brush: 'nanumbrush' };
const haveFont = (f) => f && fs.existsSync(path.join(SKILL, 'assets/fonts', f.file));
const resolveFont = (spec, tag) => {
  if (!spec || spec === true) return null; const s = String(spec); const id = FALIAS[s.toLowerCase()] || s.toLowerCase();
  if (FBY[id]) { if (!haveFont(FBY[id])) { console.error(`font ${id} is not downloaded yet: node scripts/fonts.mjs fetch ${id}`); process.exit(2); } return { src: 'fonts/' + FBY[id].file, prof: FBY[id] }; }
  const p = path.resolve(s);
  if (!fs.existsSync(p) || !/\.(ttf|otf|woff2?)$/i.test(p)) { console.error('font not found: ' + s + '\n  use one of: ' + FREG.map((f) => f.id).join(', ') + ' or the path of a .ttf/.otf/.woff/.woff2 file'); process.exit(2); }
  const name = 'user-' + tag + path.extname(p).toLowerCase(); fs.copyFileSync(p, path.join(out, 'fonts', name)); return { src: 'fonts/' + name, prof: null };
};
const classic = String(opt.font) === 'classic'; // old defaults: Pretendard / Black Han Sans / IBM Plex / Gaegu
const fAll = classic ? null : resolveFont(opt.font, 'all'); const fKey = resolveFont(opt['font-key'], 'key');
const fontAll = fAll && fAll.src, fontKey = fKey && fKey.src;
// --fonts role=id,... : font per role (main, key, calm, hand, pen, brush, sfx, cute, heavy, round, fat, serif)
const ROLE = {}; if (opt.fonts && opt.fonts !== true) for (const kv of String(opt.fonts).split(',')) { const [r, v] = kv.split('=').map((x) => x.trim()); if (r && v) ROLE[r] = resolveFont(v, 'role-' + r); }
// default look = Dongle Bold (rounded, glyphs are small for their em box, so the runtime scales the size by fontScale). With --font / --font-key / classic the default is not used.
const useDongle = !classic && !fontAll && !fontKey && !ROLE.main; const fontScale = useDongle ? 2.3 : 1;
const used = new Set();
// size-adjust from the font profile (measured with fonts.mjs measure) makes every chosen font look as tall as Pretendard; the default Dongle keeps its old fontScale way
const face = (fam, src, w, prof) => { used.add(src); return '@font-face{font-family:' + fam + ';src:url(' + src + ');font-weight:' + w + (prof && prof.size && prof.size !== 100 ? ';size-adjust:' + prof.size + '%' : '') + '}'; };
const pick = (role, fallbackId) => ROLE[role] || (fAll && role !== 'emoji' ? fAll : null) || (FBY[fallbackId] && haveFont(FBY[fallbackId]) ? { src: 'fonts/' + FBY[fallbackId].file, prof: FBY[fallbackId] } : { src: 'fonts/Pretendard-ExtraBold.woff2', prof: null });
const R = { main: ROLE.main || fAll, key: ROLE.key || fKey || ROLE.main || fAll };
const faceCss = [
  face('CapBase', 'fonts/Pretendard-ExtraBold.woff2', '100 900'), // glyph fallback: always available
  R.main ? face('CapMain', R.main.src, '100 900', R.main.prof) : face('CapMain', classic ? 'fonts/Pretendard-ExtraBold.woff2' : useDongle ? 'fonts/Dongle-Bold.ttf' : 'fonts/Jua-Regular.ttf', !classic ? '100 900' : '800'),
  R.key ? face('CapDisplay', R.key.src, '100 900', R.key.prof) : face('CapDisplay', classic ? 'fonts/BlackHanSans-Regular.ttf' : useDongle ? 'fonts/Dongle-Bold.ttf' : 'fonts/Jua-Regular.ttf', !classic ? '100 900' : '400'),
  (ROLE.calm || fAll) ? face('CapCalm', (ROLE.calm || fAll).src, '100 900', (ROLE.calm || fAll).prof) : face('CapCalm', 'fonts/IBMPlexSansKR-Bold.ttf', '700'),
  (ROLE.hand || fAll) ? face('CapHand', (ROLE.hand || fAll).src, '100 900', (ROLE.hand || fAll).prof) : face('CapHand', classic ? 'fonts/Gaegu-Bold.ttf' : 'fonts/SingleDay-Regular.ttf', !classic ? '100 900' : '700'),
  face('CapSerif', (ROLE.serif || fAll || { src: 'fonts/NanumMyeongjo-ExtraBold.ttf' }).src, '100 900', (ROLE.serif || fAll || {}).prof),
  // v1.4 roles used by the reels / bubble styles (each falls back to Pretendard when its file is missing: node fonts.mjs fetch)
  ...[['CapPen', 'pen', 'nanumpen'], ['CapBrush', 'brush', 'nanumbrush'], ['CapSfx', 'sfx', 'dokdo-east'], ['CapCute', 'cute', 'cute'], ['CapHeavy', 'heavy', 'gothic-a1'], ['CapRound', 'round', 'gowun-dodum'], ['CapFat', 'fat', 'bagel']].map(([fam, role, id]) => { const f = pick(role, id); return face(fam, f.src, '100 900', f.prof); }),
].join('\n');
// emoji font: Noto Color Emoji when it is in assets/fonts (same look on every PC, `node fonts.mjs fetch noto-emoji`), else the system emoji font
const emojiFont = String(opt['emoji-font'] || 'auto'); const notoOk = haveFont(FBY['noto-emoji']) && emojiFont !== 'system';
const emojiOn = opt.emoji === 'auto' || opt.emoji === true || String(opt.deco || '').includes('emoji');
const emojiCss = notoOk && emojiOn ? face('CapEmoji', 'fonts/' + FBY['noto-emoji'].file, '100 900') : '';
if (emojiFont === 'noto' && !notoOk) console.log('  주의: --emoji-font noto 인데 글꼴 파일이 없습니다. node scripts/fonts.mjs fetch noto-emoji 후 다시 실행하세요(지금은 시스템 이모지).');
// letter spacing / 장평 / 기울기: profile of the main font (only when a font was chosen), command line wins
const mainProf = (R.main && R.main.prof) || null; const typo = { tracking: opt.tracking != null ? +opt.tracking : mainProf ? mainProf.tracking : 0, width: opt.width != null ? +opt.width : mainProf ? mainProf.width : 100, slant: opt.slant != null ? +opt.slant : mainProf ? mainProf.slant : 0 };
const roleTypo = {}; for (const [fam, role, id] of [['CapPen', 'pen', 'nanumpen'], ['CapBrush', 'brush', 'nanumbrush'], ['CapSfx', 'sfx', 'dokdo-east'], ['CapCute', 'cute', 'cute'], ['CapHeavy', 'heavy', 'gothic-a1'], ['CapRound', 'round', 'gowun-dodum'], ['CapFat', 'fat', 'bagel'], ['CapHand', 'hand', null], ['CapDisplay', 'key', null]]) { const f = ROLE[role] || (id && !fAll ? { prof: FBY[id] } : null); if (f && f.prof) roleTypo[fam] = { tracking: f.prof.tracking, slant: f.prof.slant }; }
// only the fonts this job uses are copied (the library is large)
for (const src of [...used, 'fonts/IBMPlexSansKR-Bold.ttf', ...(notoOk && emojiOn ? ['fonts/' + FBY['noto-emoji'].file] : [])]) { const f = path.basename(src); const from = path.join(SKILL, 'assets/fonts', f); if (fs.existsSync(from) && !fs.existsSync(path.join(out, 'fonts', f))) fs.copyFileSync(from, path.join(out, 'fonts', f)); }
fs.copyFileSync(path.join(HERE, 'runtime.js'), path.join(out, 'runtime.js'));

// ---- overlays (name tags, inset pictures / clips, side sound-word text) from --overlays overlays.json
const overlays = { tags: [], insets: [], sfx: [], titles: [] };
if (opt.overlays) {
  const of = path.resolve(String(opt.overlays)); const oj = JSON.parse(fs.readFileSync(of, 'utf8')); const od = path.dirname(of); const sh = +(opt.shift || 0);
  const T = (x, d) => (x == null ? d : +(+x - sh).toFixed(3));
  const warnPos = (what, x, y) => { if (x != null && (x < 0.02 || x > 0.98)) console.log('  주의(overlay): ' + what + ' x=' + x + ' 가 화면 가장자리에 너무 가깝습니다(자동으로 안쪽으로 밀어 넣음).'); if (portrait && y != null && (y > 0.75 || y < 0.08)) console.log('  주의(overlay): ' + what + ' y=' + y + ' 는 세로 영상의 앱 버튼·제목 구역(위 8%·아래 25%)에 걸립니다.'); };
  overlays.tags = (oj.tags || []).map((g) => { warnPos('tag ' + (g.name || ''), g.x, g.y); return { name: String(g.name || ''), desc: g.desc ? String(g.desc) : '', color: g.color, x: g.x, y: g.y, size: g.size, from: T(g.from, 0), to: T(g.to, duration) }; }).filter((g) => g.to > 0.05);
  overlays.sfx = (oj.sfx || []).map((g) => { warnPos('sfx ' + (g.text || ''), g.x, g.y); return { text: String(g.text || ''), at: T(g.at, 0), dur: g.dur || 1.2, x: g.x, y: g.y, rot: g.rot, size: g.size, color: g.color }; }).filter((g) => g.text && g.at + g.dur > 0.05);
  (oj.insets || []).forEach((g, i) => {
    const sp = path.isAbsolute(g.src) ? g.src : path.join(od, g.src); if (!fs.existsSync(sp)) { console.error('inset source not found: ' + sp); process.exit(2); }
    warnPos('inset ' + g.src, g.x, g.y);
    const dir = path.join(out, 'inset', String(overlays.insets.length)); fs.mkdirSync(dir, { recursive: true });
    const isVid = /\.(mp4|mov|mkv|webm|gif|avi)$/i.test(sp); let frames = 1, ext = 'jpg', ifps = 12;
    if (isVid) { const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(g.clipFrom || 0), '-t', String(g.clipDur || Math.min(30, Math.max(1, (g.to ?? duration) - (g.from ?? 0)))), '-i', sp, '-vf', 'fps=' + ifps + ',scale=540:-2', '-q:v', '4', path.join(dir, '%04d.jpg')]); if (r.status !== 0) { console.error('inset clip failed: ' + String(r.stderr)); process.exit(2); } frames = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).length; if (!frames) { console.error('inset clip produced no frames: ' + sp); process.exit(2); } }
    else { ext = path.extname(sp).slice(1).toLowerCase() || 'png'; fs.copyFileSync(sp, path.join(dir, '0001.' + ext)); }
    const pr = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path.join(dir, '0001.' + ext)], { encoding: 'utf8' }); const [aw, ah] = String(pr.stdout).trim().split(',').map(Number);
    if (!(aw > 0 && ah > 0)) { console.error('inset size unreadable: ' + sp); process.exit(2); }
    overlays.insets.push({ from: T(g.from, 0), to: T(g.to, duration), x: g.x, y: g.y, w: g.w, rot: g.rot, frame: g.frame, loop: g.loop, aw, ah, ext, frames, fps: ifps });
  });
  overlays.insets = overlays.insets.filter((g) => g.to > 0.05);
  overlays.titles = (oj.titles || []).map((g) => ({ text: String(g.text || ''), style: g.style || 'white', from: T(g.from, 0), to: T(g.to, duration), y: g.y, x: g.x, size: g.size })).filter((g) => g.text && g.to > 0.05);
}
// emoji v2 (--emoji auto, or the old --deco emoji): placement, motion, spacing
const deco = opt.deco ? String(opt.deco).split(',').map((s) => s.trim()).filter(Boolean) : []; if (emojiOn && !deco.includes('emoji')) deco.push('emoji'); if (opt.emoji === 'off' && deco.includes('emoji')) deco.splice(deco.indexOf('emoji'), 1);
const emoji = { pos: String(opt['emoji-pos'] || 'auto'), anim: String(opt['emoji-anim'] || 'auto'), gap: opt['emoji-gap'] != null ? +opt['emoji-gap'] : 2.5, max: opt['emoji-max'] != null ? +opt['emoji-max'] : 999, font: notoOk && emojiOn ? 'CapEmoji' : null };
// --title: a fixed title badge at the top for the whole video (or --title-from/--title-to)
if (opt.title && opt.title !== true) overlays.titles = [{ text: String(opt.title), style: String(opt['title-style'] || 'white'), from: opt['title-from'] != null ? +opt['title-from'] : 0, to: opt['title-to'] != null ? +opt['title-to'] : duration, y: opt['title-y'] != null ? +opt['title-y'] : undefined }];
const data = { rate, typo, roleTypo, emoji, mixPool: opt['mix-pool'] && opt['mix-pool'] !== true ? String(opt['mix-pool']).split(',').map((s) => s.trim()).filter(Boolean) : [], fontScale, overlays, sfxAuto: opt.sfx === 'auto', sfxMax: opt['sfx-max'] != null ? +opt['sfx-max'] : 6, width, height, fps, duration, words, palette, zone: { top: zone[0], bottom: zone[1] }, emphasis: opt.emphasis ? String(opt.emphasis).split(',').map((s) => s.trim()).filter(Boolean) : [], scale: +(opt.scale || 1), deco, shade: +(opt.shade || 0), faces: opt.faces ? (JSON.parse(fs.readFileSync(opt.faces, 'utf8')).samples || []).map((s) => ({ t: +(s.t - (+opt.shift || 0)).toFixed(2), boxes: s.boxes })).filter((s) => s.t >= -0.5 && s.t <= duration + 0.5) : [], hook: opt.hook === 'off' ? 'off' : 'auto', beats: opt.beat ? (JSON.parse(fs.readFileSync(opt.beat, 'utf8')).beats || []).map((b) => b - (+opt.shift || 0)).filter((b) => b >= 0 && b <= duration) : [], beatStrength: +(opt['beat-strength'] || 0.045), pin: (() => { if (opt.pin == null || opt.pin === true) return null; let y = parseFloat(opt.pin); if (!(y > 0)) { console.error('--pin needs a height like 0.79 or 79'); process.exit(2); } if (y > 1) y /= 100; y = Math.min(0.97, Math.max(0.03, y)); const x = ['left', 'right'].includes(String(opt['pin-x'])) ? String(opt['pin-x']) : 'center'; return { y: +y.toFixed(3), x }; })(), pos: opt.pos || 'varied', posAvoid: opt['pos-avoid'] ? String(opt['pos-avoid']).split(',').map((s) => s.trim()).filter(Boolean) : [], posPlan: opt['pos-plan'] ? JSON.parse(fs.readFileSync(opt['pos-plan'], 'utf8')) : [], emojiMap: opt['emoji-map'] ? JSON.parse(fs.readFileSync(opt['emoji-map'], 'utf8')) : {}, plan: opt.plan ? JSON.parse(fs.readFileSync(opt.plan, 'utf8')) : [], lineRatio: opt['line-ratio'] ? +opt['line-ratio'] : undefined, lineGap: opt['line-gap'] != null ? +opt['line-gap'] : undefined, fx: opt.fx === 'off' ? 'off' : 'auto', fxMax: opt['fx-max'] != null ? +opt['fx-max'] : 4, fast: opt.fast === 'off' ? 'off' : 'auto', speed: opt.speed ? +opt.speed : undefined };
// big faces: in a close-up (often a 16:9 talking shot turned 9:16) the face fills the frame and there is little free room for captions
if (data.faces.length) { const big = data.faces.filter((f) => f.boxes.some((b) => (b[3] - b[1]) > (portrait ? 0.25 : 0.4))).length / data.faces.length; if (big >= 0.3) console.log(`  주의(big faces): 얼굴이 화면 높이의 ${portrait ? '25' : '40'}%보다 큰 장면이 ${Math.round(big * 100)}%입니다. 자막이 얼굴과 겹치기 쉽습니다. 자막은 얼굴 아래(가슴) 자리로 먼저 옮겨지고, 그래도 겹치면 '얼굴:' 줄에 개수가 나옵니다. 더 줄이려면 --scale 0.9, 또는 얼굴이 작은 원본(넓게 찍은 화면)을 쓰세요.`); }
if (data.pin) { const y = data.pin.y; console.log(`  pin: 자막을 높이 ${(y * 100).toFixed(0)}% 한 자리에 고정(${data.pin.x === 'center' ? '가운데' : data.pin.x === 'left' ? '왼쪽' : '오른쪽'} 맞춤). --pos / --pos-plan / 후렴 가운데 / 얼굴 피하기는 무시됩니다.`); const lim = portrait ? 0.70 : zone[1]; if (y + 0.07 > lim) console.log(`  주의(pin): 이 자리는 ${portrait ? '쇼츠·릴스 앱 버튼과 설명 글이 덮는 아래 약 30%' : '유튜브 자막(CC)이 뜨는 아래 22%'}에 걸칩니다. 사용자가 고른 위치이므로 렌더는 막지 않습니다. 보고서에 적습니다.`); if (data.faces.length) console.log('  주의(pin): 얼굴 위치 정보는 있지만 고정 자리는 얼굴을 피하지 않습니다. 시안에서 얼굴 가림을 직접 확인하세요.'); }
fs.writeFileSync(path.join(out, 'data.js'), 'window.CAPDATA=' + JSON.stringify(data) + ';');
fs.writeFileSync(path.join(out, 'captions.html'), `<!doctype html><html><head><meta charset="utf-8"><style>
${faceCss}
${emojiCss}
html,body{margin:0;background:transparent;width:${width}px;height:${height}px;overflow:hidden}
#cap{position:absolute}
</style></head><body><div id="shade"></div><div id="cap"></div><script src="data.js"></script><script src="runtime.js"></script></body></html>`);
const vst = fs.statSync(path.resolve(opt.video));
fs.writeFileSync(path.join(out, 'job.json'), JSON.stringify({ precision, videoStat: { size: vst.size, mtimeMs: vst.mtimeMs }, video: path.resolve(opt.video), width, height, fps, rate, duration, zone, pin: data.pin || null, palette: opt.palette || 'gold', font: opt.font || null, fontKey: opt['font-key'] || null, words: words.length, approxWords: approx }, null, 1));
console.log(`job: ${out}\n  timing precision: ${precision}${precision === 'cue-level' ? ' (line-level estimate: words inside a line are spread by characters; say so in the report)' : ''}\n  video ${width}x${height} @${fps}fps ${duration.toFixed(1)}s | words ${words.length}${approx ? ` (timing approximate for ${approx}: LRC/SRT line split)` : ''} | zone ${zone.join('~')} of height`);

