// export-subs.mjs : write plain subtitle files from the word timings, for a YouTube caption track or an editor
//   node export-subs.mjs --words words.json [--out captions] [--formats srt,vtt,ass] [--max-chars 16] [--gap 0.5]
//                        [--width 1080 --height 1920]   (ASS canvas size; default 1080x1920)
//   or --job <jobdir>   (reads job/data.js, the same words the burned-in captions use, and its video size)
// -> captions.srt / captions.vtt (one cue per line of words) and captions.ass (karaoke: each word lights up as it is said, \k tags)
// Lines break at a pause longer than --gap seconds, at . ? ! and when a line would pass --max-chars characters.
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2); const opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') || argv[i + 1] == null ? true : argv[++i];
let words, W = +(opt.width || 1080), H = +(opt.height || 1920);
if (opt.job) {
  const src = fs.readFileSync(path.join(opt.job, 'data.js'), 'utf8').replace(/^window\.CAPDATA=/, '').replace(/;\s*$/, '');
  const d = JSON.parse(src); words = d.words; if (!opt.width) { W = d.width; H = d.height; }
} else if (opt.words) words = JSON.parse(fs.readFileSync(opt.words, 'utf8')).words;
else { console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 7).join('\n')); process.exit(1); }
words = words.filter((w) => w.text && w.end > w.start);
if (!words.length) { console.error('no words with times'); process.exit(2); }
const maxChars = +(opt['max-chars'] || (W > H ? 32 : 16)), gap = +(opt.gap || 0.5);
const formats = String(opt.formats || 'srt,vtt,ass').split(',').map((s) => s.trim().toLowerCase());
const out = path.resolve(String(opt.out || 'captions'));

// group words into lines
const lines = []; let cur = [];
const len = (ws) => ws.map((w) => w.text).join(' ').length;
for (const w of words) {
  const last = cur[cur.length - 1];
  if (cur.length && (w.start - last.end > gap || len([...cur, w]) > maxChars || last.lineEnd)) { lines.push(cur); cur = []; }
  cur.push(w); if (/[.?!…]$/.test(w.text)) { lines.push(cur); cur = []; }
}
if (cur.length) lines.push(cur);
const cues = lines.map((ws, i) => { const nx = lines[i + 1]; return { start: ws[0].start, end: Math.min(ws[ws.length - 1].end + 0.3, nx ? nx[0].start - 0.02 : 1e9), words: ws, text: ws.map((w) => w.text).join(' ') }; });

const pad = (n, z = 2) => String(n).padStart(z, '0');
const ts = (t, sep) => { const ms = Math.max(0, Math.round(t * 1000)); return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}${sep}${pad(ms % 1000, 3)}`; };
const done = [];
if (formats.includes('srt')) { fs.writeFileSync(out + '.srt', cues.map((c, i) => `${i + 1}\n${ts(c.start, ',')} --> ${ts(c.end, ',')}\n${c.text}\n`).join('\n')); done.push(out + '.srt'); }
if (formats.includes('vtt')) { fs.writeFileSync(out + '.vtt', 'WEBVTT\n\n' + cues.map((c) => `${ts(c.start, '.')} --> ${ts(c.end, '.')}\n${c.text}\n`).join('\n')); done.push(out + '.vtt'); }
if (formats.includes('ass')) {
  const at = (t) => { const cs = Math.max(0, Math.round(t * 100)); return `${Math.floor(cs / 360000)}:${pad(Math.floor(cs / 6000) % 60)}:${pad(Math.floor(cs / 100) % 60)}.${pad(cs % 100)}`; };
  const fsz = Math.round((W > H ? 64 : 88) * (W > H ? H : W) / 1080), mv = Math.round(H * (W > H ? 0.22 : 0.32));
  const head = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${W}\nPlayResY: ${H}\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Pretendard,${fsz},&H0000D7FF,&H00FFFFFF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,${Math.round(fsz * 0.07)},${Math.round(fsz * 0.04)},2,${Math.round(W * 0.08)},${Math.round(W * 0.08)},${mv},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  // \k: a word is drawn in SecondaryColour (white) until its time, then in PrimaryColour (yellow)
  const ev = cues.map((c) => { let t = c.start; const parts = c.words.map((w, i) => { const lead = Math.max(0, w.start - t); t = w.start; const dur = Math.max(1, Math.round(((c.words[i + 1] ? c.words[i + 1].start : w.end) - w.start) * 100)); t += dur / 100; return (lead >= 0.01 ? `{\\k${Math.round(lead * 100)}}` : '') + `{\\k${dur}}${w.text.replace(/[{}]/g, '')}` + (i < c.words.length - 1 ? ' ' : ''); }); return `Dialogue: 0,${at(c.start)},${at(c.end)},Default,,0,0,0,,${parts.join('')}`; });
  fs.writeFileSync(out + '.ass', head + ev.join('\n') + '\n'); done.push(out + '.ass');
}
console.log(`cues: ${cues.length} | longest line ${Math.max(...cues.map((c) => c.text.length))} chars`);
done.forEach((f) => console.log('wrote ' + f));
