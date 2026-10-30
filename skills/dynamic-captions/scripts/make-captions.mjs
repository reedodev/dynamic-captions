#!/usr/bin/env node
// make-captions.mjs : build a caption job folder (captions.html + data.js + fonts) for one video.
// Usage:
//   node make-captions.mjs --video in.mp4 --out <jobdir> (--words words.json | --lrc song.lrc | --srt subs.srt)
//        [--palette gold|mint|sky|rose|lime] [--emphasis "단어,단어"] [--zone 0.52,0.68] [--scale 1]
//        [--deco emoji,line]  emoji reaction on the key moment + accent line drawn under the caption (either or both)
//        [--emoji-map map.json]  {"word":"emoji"} extra/override emoji keywords (your map wins over the built-in list)
//        [--shade 0.45]  soft dark band behind the caption (0..1) for bright footage
//        [--pos varied|fixed|<name>]  varied (default): each caption moves between left/right/top/bottom spots; fixed: one spot; or one name e.g. bottom-left
//        [--pos-avoid names]  spots that must stay empty (e.g. where a face is): landscape bottom-center,bottom-left,bottom-right,top-center,upper-left,upper-right,mid-left,mid-right; portrait mid-center,mid-left,mid-right,upper-center,upper-left,upper-right
//        [--pos-plan plan.json]  [{"from":0,"to":6,"pos":"upper-left"}] fixed spot for those seconds
//        [--beat beat.json] [--beat-strength 0.045]  songs: the caption swells on every beat (make beat.json with detect-beat.py; shifts with --shift)
//        [--faces faces.json]  captions avoid faces (make faces.json with find-faces.py; shifts with --shift)
//        [--font pretendard|black-han|plex|gaegu|myeongjo|<file.ttf/.otf/.woff2>]  one font for the whole job (default: each style keeps its own font). Glyphs a custom font lacks fall back to Pretendard automatically.
//        [--font-key <same choices>]  font only for the big key words (hero-key, stamp, impact-wide ...); with --font-key alone the other text keeps its default font
//        [--fx off] [--fx-max 4]  (mix) emotion / sound words get an emotion motion (sway-breeze, jitter-nerve, heart-thump, tilt-wonder, jolt-pop, droop-sigh, boom-shake), at most fx-max times per video, 3 s apart
//        [--line-ratio 0.42] [--line-gap 6]  duo-tight: small line height vs big line, gap between the lines in px (at 1080)
//        [--fast off] [--speed 0.7]  entrances get shorter automatically when captions change quickly; --speed fixes the factor
//        [--preset brand.json] [--save-preset brand.json]  load / save look options (palette, scale, shade, pos, font, deco, fx, line, speed ...)
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
const PRESET_KEYS = ['palette', 'scale', 'shade', 'pos', 'pos-avoid', 'font', 'font-key', 'deco', 'hook', 'fx', 'fx-max', 'line-ratio', 'line-gap', 'fast', 'speed', 'zone', 'beat-strength', 'merge-numbers'];
if (opt.preset) { const pf = String(opt.preset); const p = JSON.parse(fs.readFileSync(pf, 'utf8')); for (const [k, v] of Object.entries(p)) if (PRESET_KEYS.includes(k) && opt[k] === undefined) opt[k] = v; console.log('  preset: ' + pf); }
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
// variable-frame-rate sources (e.g. AI video exports tagged 60 fps that really hold ~24 frames/s): follow the real average rate
const [an, ad] = String(st.avg_frame_rate || '0/1').split('/').map(Number); const avgFps = ad ? an / ad : 0;
if (avgFps > 0 && Math.abs(avgFps - fps) / fps > 0.1) { console.log(`  note: variable frame rate (tagged ${fps} fps, real average ${avgFps.toFixed(2)} fps) -> captions rendered at ${Math.max(24, Math.round(avgFps))} fps`); fps = Math.max(24, Math.round(avgFps)); }
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
for (const f of fs.readdirSync(path.join(SKILL, 'assets/fonts'))) fs.copyFileSync(path.join(SKILL, 'assets/fonts', f), path.join(out, 'fonts', f));
// ---- fonts: five bundled free fonts by name, or any font file of your own (it is copied into the job folder)
const FONTS = { pretendard: 'Pretendard-ExtraBold.woff2', 'black-han': 'BlackHanSans-Regular.ttf', plex: 'IBMPlexSansKR-Bold.ttf', gaegu: 'Gaegu-Bold.ttf', myeongjo: 'NanumMyeongjo-ExtraBold.ttf' };
const resolveFont = (spec, tag) => {
  if (!spec || spec === true) return null; const s = String(spec);
  if (FONTS[s.toLowerCase()]) return 'fonts/' + FONTS[s.toLowerCase()];
  const p = path.resolve(s);
  if (!fs.existsSync(p) || !/\.(ttf|otf|woff2?)$/i.test(p)) { console.error('font not found: ' + s + '\n  use one of: ' + Object.keys(FONTS).join(', ') + ' or the path of a .ttf/.otf/.woff/.woff2 file'); process.exit(2); }
  const name = 'user-' + tag + path.extname(p).toLowerCase(); fs.copyFileSync(p, path.join(out, 'fonts', name)); return 'fonts/' + name;
};
const fontAll = resolveFont(opt.font, 'all'); const fontKey = resolveFont(opt['font-key'], 'key');
const face = (fam, src, w) => '@font-face{font-family:' + fam + ';src:url(' + src + ');font-weight:' + w + '}';
const faceCss = [
  face('CapBase', 'fonts/Pretendard-ExtraBold.woff2', '100 900'), // glyph fallback: always available
  face('CapMain', fontAll || 'fonts/Pretendard-ExtraBold.woff2', fontAll ? '100 900' : '800'),
  face('CapDisplay', fontKey || fontAll || 'fonts/BlackHanSans-Regular.ttf', fontKey || fontAll ? '100 900' : '400'),
  face('CapCalm', fontAll || 'fonts/IBMPlexSansKR-Bold.ttf', fontAll ? '100 900' : '700'),
  face('CapHand', fontAll || 'fonts/Gaegu-Bold.ttf', fontAll ? '100 900' : '700'),
].join('\n');
fs.copyFileSync(path.join(HERE, 'runtime.js'), path.join(out, 'runtime.js'));
const data = { width, height, fps, duration, words, palette, zone: { top: zone[0], bottom: zone[1] }, emphasis: opt.emphasis ? String(opt.emphasis).split(',').map((s) => s.trim()).filter(Boolean) : [], scale: +(opt.scale || 1), deco: opt.deco ? String(opt.deco).split(',').map((s) => s.trim()).filter(Boolean) : [], shade: +(opt.shade || 0), faces: opt.faces ? (JSON.parse(fs.readFileSync(opt.faces, 'utf8')).samples || []).map((s) => ({ t: +(s.t - (+opt.shift || 0)).toFixed(2), boxes: s.boxes })).filter((s) => s.t >= -0.5 && s.t <= duration + 0.5) : [], hook: opt.hook === 'off' ? 'off' : 'auto', beats: opt.beat ? (JSON.parse(fs.readFileSync(opt.beat, 'utf8')).beats || []).map((b) => b - (+opt.shift || 0)).filter((b) => b >= 0 && b <= duration) : [], beatStrength: +(opt['beat-strength'] || 0.045), pos: opt.pos || 'varied', posAvoid: opt['pos-avoid'] ? String(opt['pos-avoid']).split(',').map((s) => s.trim()).filter(Boolean) : [], posPlan: opt['pos-plan'] ? JSON.parse(fs.readFileSync(opt['pos-plan'], 'utf8')) : [], emojiMap: opt['emoji-map'] ? JSON.parse(fs.readFileSync(opt['emoji-map'], 'utf8')) : {}, plan: opt.plan ? JSON.parse(fs.readFileSync(opt.plan, 'utf8')) : [], lineRatio: opt['line-ratio'] ? +opt['line-ratio'] : undefined, lineGap: opt['line-gap'] != null ? +opt['line-gap'] : undefined, fx: opt.fx === 'off' ? 'off' : 'auto', fxMax: opt['fx-max'] != null ? +opt['fx-max'] : 4, fast: opt.fast === 'off' ? 'off' : 'auto', speed: opt.speed ? +opt.speed : undefined };
fs.writeFileSync(path.join(out, 'data.js'), 'window.CAPDATA=' + JSON.stringify(data) + ';');
fs.writeFileSync(path.join(out, 'captions.html'), `<!doctype html><html><head><meta charset="utf-8"><style>
${faceCss}
html,body{margin:0;background:transparent;width:${width}px;height:${height}px;overflow:hidden}
#cap{position:absolute}
</style></head><body><div id="shade"></div><div id="cap"></div><script src="data.js"></script><script src="runtime.js"></script></body></html>`);
const vst = fs.statSync(path.resolve(opt.video));
fs.writeFileSync(path.join(out, 'job.json'), JSON.stringify({ precision, videoStat: { size: vst.size, mtimeMs: vst.mtimeMs }, video: path.resolve(opt.video), width, height, fps, duration, zone, palette: opt.palette || 'gold', font: opt.font || null, fontKey: opt['font-key'] || null, words: words.length, approxWords: approx }, null, 1));
console.log(`job: ${out}\n  timing precision: ${precision}${precision === 'cue-level' ? ' (line-level estimate: words inside a line are spread by characters; say so in the report)' : ''}\n  video ${width}x${height} @${fps}fps ${duration.toFixed(1)}s | words ${words.length}${approx ? ` (timing approximate for ${approx}: LRC/SRT line split)` : ''} | zone ${zone.join('~')} of height`);

