// sample.mjs : short moving sample clips, one per style, so you can see the motion (the style sheet only shows still pictures)
//   node sample.mjs <jobdir> [--styles jolt-pop,heart-thump,...] [--at 2.5] [--len 1.8] [--tmp <dir>] [--encoder auto]
// default styles: the 7 emotion motions. --at: start time (default: the first emotion line of the mix plan, else the first line).
// -> <jobdir>/samples/sample-<style>.mp4 (one per style) and samples/all-samples.mp4 (all of them one after another, in the printed order)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2); const job = argv[0] && !argv[0].startsWith('--') ? path.resolve(argv[0]) : null; const opt = {};
for (let i = 1; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') || argv[i + 1] == null ? true : argv[++i];
if (!job || !fs.existsSync(path.join(job, 'job.json'))) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 4).join('\n')); process.exit(1); }
const EMO = ['sway-breeze', 'jitter-nerve', 'heart-thump', 'tilt-wonder', 'jolt-pop', 'droop-sigh', 'boom-shake'];
const styles = opt.styles ? String(opt.styles).split(',').map((s) => s.trim()).filter(Boolean) : EMO;
let at = opt.at != null ? +opt.at : null;
if (at == null) { try { const plan = JSON.parse(fs.readFileSync(path.join(job, 'preview', 'mix-plan.json'), 'utf8')); const e = plan.find((p) => EMO.includes(p.style)) || plan[0]; at = e ? Math.max(0, e.start - 0.15) : 0; } catch { at = 0; } }
const len = +(opt.len || 1.8); const dur = JSON.parse(fs.readFileSync(path.join(job, 'job.json'), 'utf8')).duration || at + len;
const a = Math.max(0, Math.min(at, dur - 0.5)), b = Math.min(dur, a + len);
const outDir = path.join(job, 'samples'); fs.mkdirSync(outDir, { recursive: true });
const made = [];
for (const s of styles) {
  const name = `sample-${s}.mp4`; console.log(`sample ${s} ${a.toFixed(2)}-${b.toFixed(2)}s`);
  const r = spawnSync(process.execPath, [path.join(HERE, 'render.mjs'), 'final', job, '--style', s, '--range', `${a.toFixed(2)},${b.toFixed(2)}`, '--name', name, '--workers', '1', '--allow-overflow', ...(opt.tmp ? ['--tmp', String(opt.tmp)] : []), ...(opt.encoder ? ['--encoder', String(opt.encoder)] : [])], { encoding: 'utf8' });
  const src = path.join(job, 'out', name);
  if (r.status === 0 && fs.existsSync(src)) { fs.renameSync(src, path.join(outDir, name)); for (const ext of ['.json', '-sheet.png']) { const x = src.replace(/\.mp4$/, ext); if (fs.existsSync(x)) fs.rmSync(x); } made.push(path.join(outDir, name)); }
  else console.error(`  failed: ${s}\n` + ((r.stderr || '') + (r.stdout || '')).split('\n').slice(-6).join('\n'));
}
if (made.length > 1) {
  const list = path.join(outDir, 'list.txt'); fs.writeFileSync(list, made.map((m) => `file '${m.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', path.join(outDir, 'all-samples.mp4')], { encoding: 'utf8' });
  fs.rmSync(list); if (r.status === 0) console.log('all samples: ' + path.join(outDir, 'all-samples.mp4') + '  (order: ' + styles.join(', ') + ')');
}
made.forEach((m) => console.log('  ' + m));
process.exit(made.length ? 0 : 1);
