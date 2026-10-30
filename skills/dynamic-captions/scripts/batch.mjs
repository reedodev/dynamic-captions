// batch.mjs : run the one-command start (start.mjs) for every video in a folder, one after another.
//   node batch.mjs <folder> [--out <folder>] [any start.mjs / make-captions option, e.g. --lang ko --preset brand.json]
// Each video gets its own job folder (<out>/<video name>/) with words.json and preview/overview.png. It stops at the style sheets:
// look at them, then render each with render.mjs final. A failed video is reported and the next one still runs.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const dir = argv[0] && !argv[0].startsWith('--') ? path.resolve(argv[0]) : null;
if (!dir || !fs.existsSync(dir)) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 4).join('\n')); process.exit(1); }
const rest = argv.slice(1); const oi = rest.indexOf('--out'); let outRoot = path.join(dir, 'captions-jobs');
if (oi >= 0) { outRoot = path.resolve(rest[oi + 1]); rest.splice(oi, 2); }
const vids = fs.readdirSync(dir).filter((f) => /\.(mp4|mov|mkv|webm|m4v)$/i.test(f) && !/^captioned-/.test(f)).sort();
if (!vids.length) { console.log('no videos in ' + dir); process.exit(1); }
const res = [];
for (const [i, v] of vids.entries()) {
  const job = path.join(outRoot, path.parse(v).name); console.log(`\n=== ${i + 1}/${vids.length} ${v} -> ${job}`);
  const t0 = Date.now(); const r = spawnSync(process.execPath, [path.join(HERE, 'start.mjs'), path.join(dir, v), '--out', job, ...rest], { stdio: 'inherit' });
  res.push({ video: v, ok: r.status === 0, seconds: Math.round((Date.now() - t0) / 1000), sheet: path.join(job, 'preview', 'overview.png') });
}
console.log('\nsummary');
for (const r of res) console.log(`  ${r.ok ? 'OK  ' : 'FAIL'} ${r.video} (${r.seconds}s) ${r.ok ? r.sheet : ''}`);
fs.mkdirSync(outRoot, { recursive: true }); fs.writeFileSync(path.join(outRoot, 'batch-summary.json'), JSON.stringify(res, null, 1));
process.exit(res.every((r) => r.ok) ? 0 : 4);
