#!/usr/bin/env node
// picker.mjs : type your own line and see EVERY caption style moving on it, side by side, then star the ones you like.
//   node picker.mjs <jobdir> [--port 8765] [--text "오늘 내가 꿀템 하나 소개해줄게!"] [--open]
//   -> http://127.0.0.1:8765/  (tabs: new / basic / reels+emoji / bubbles / emotion+sound / variety / info / lyrics / starred)
// The background of every card is a frame of the job's own video. Starred styles become a copy-ready command:
//   one style  -> render.mjs final <job> --style <id>
//   several    -> make-captions ... --mix-pool a,b,c   then   render.mjs final <job> --style mix
// Nothing is rendered to disk; the page plays the real caption runtime live (Ctrl+C to stop the server).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [jobArg, ...rest] = process.argv.slice(2);
const opt = {}; for (let i = 0; i < rest.length; i++) if (rest[i].startsWith('--')) opt[rest[i].slice(2)] = rest[i + 1]?.startsWith('--') || rest[i + 1] == null ? true : rest[++i];
if (!jobArg) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 8).join('\n')); process.exit(1); }
const JOB = path.resolve(jobArg); const job = JSON.parse(fs.readFileSync(path.join(JOB, 'job.json'), 'utf8'));
fs.copyFileSync(path.join(HERE, 'runtime.js'), path.join(JOB, 'runtime.js'));
// background: one frame from the middle of the video
const bg = path.join(JOB, 'picker-bg.jpg');
if (!fs.existsSync(bg)) spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(Math.min(job.duration * 0.4, 8)), '-i', job.video, '-frames:v', '1', '-vf', `scale=${job.width > job.height ? 640 : 360}:-2`, '-q:v', '4', bg]);
// style list + labels read from the runtime source (one source of truth)
const src = fs.readFileSync(path.join(HERE, 'runtime.js'), 'utf8'); const styles = []; const seen = new Set();
for (const m of src.matchAll(/S\['([\w-]+)'\]\s*=\s*\{\s*\n?\s*label:\s*'([^']+)'|(?:cardStyle|duoStyle|SOLO)\('([\w-]+)',\s*'([^']+)'/g)) { const id = m[1] || m[3], label = m[2] || m[4]; if (!seen.has(id)) { seen.add(id); styles.push({ id, label }); } }
const V14 = JSON.parse((/const V14 = (\[[^\]]+\])/.exec(src) || [, '[]'])[1].replace(/'/g, '"'));
const BASIC = ['block-sweep', 'pop-word', 'karaoke-fill', 'hero-key', 'stack-kinetic', 'underline-ink', 'glass-card', 'neon-glow', 'lead-big', 'chip-label', 'stamp', 'line-rise', 'hand-note', 'line-focus', 'fill-rise', 'impact-wide', 'news-bar', 'typewriter', 'wave', 'plain', 'broadcast'];
const CATS = [
  ['new', 'v1.4 새 스타일', (id) => V14.includes(id)],
  ['basic', '기본', (id) => BASIC.includes(id)],
  ['reels', '릴스·이모지', (id) => /^(reels-|emoji-|duo-|solo-|paper-strip|oval-pill|plate-|tag-)/.test(id)],
  ['bubble', '말풍선·대화', (id) => /bubble|chat|speech|quote|chip-bar/.test(id)],
  ['emotion', '감정·효과음', (id) => /sway-breeze|jitter-nerve|heart-thump|tilt-wonder|jolt-pop|droop-sigh|boom-shake|sfx-glow|laugh-tiles|horror-serif/.test(id)],
  ['variety', '예능·뉴스·레트로', (id) => /variety|alert-bar|vhs|comic|tape|paper-cut|sticker|doodle|pixel|retro|news-bar|glitch|ink-seal|stamp/.test(id)],
  ['info', '정보·숫자', (id) => /count-up|check-list|quiz|progress|bullet|arrow|bracket|price|search|percent|num-box|chip-label|reels-qa|reels-twotone/.test(id)],
  ['lyric', '가사·키네틱', (id) => /karaoke|chorus|wave|fill-rise|neon|stagger|split-reveal|rubber|spin-in|blur-focus|slot-roll|echo|swing|drop-letters|skew|glow-title|grad-shift|bounce-word|wobble|reels-haze/.test(id)],
];
styles.forEach((s) => { s.cats = CATS.filter(([, , f]) => f(s.id)).map(([k]) => k); });
const W = job.width, H = job.height, portrait = H > W; const cardW = portrait ? 220 : 360, cardH = Math.round(cardW * H / W);
const text0 = typeof opt.text === 'string' ? opt.text : '오늘 내가 꿀템 하나 소개해줄게!';
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>자막 스타일 고르기</title><style>
@font-face{font-family:UI;src:url(fonts/Pretendard-ExtraBold.woff2)}
*{box-sizing:border-box}body{margin:0;background:#f3f5f9;font-family:UI,sans-serif;color:#1d2230}
header{position:sticky;top:0;z-index:5;background:#fff;border-bottom:1px solid #e3e6ee;padding:14px 18px}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
input[type=text]{flex:1;min-width:260px;font:inherit;font-size:20px;padding:10px 14px;border:2px solid #d5dae6;border-radius:12px}
.tab{border:0;border-radius:99px;padding:8px 14px;background:#eef1f7;font:inherit;font-size:15px;cursor:pointer}.tab.on{background:#2f6bff;color:#fff}
label{font-size:15px;display:flex;gap:6px;align-items:center}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(${cardW}px,1fr));gap:16px;padding:18px 18px 110px}
.card{background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(20,30,60,.08);cursor:pointer;border:3px solid transparent}
.card.sel{border-color:#ff4f8b}.card .scr{position:relative;width:${cardW}px;height:${cardH}px;margin:0 auto;background:#222 url(picker-bg.jpg) center/cover;overflow:hidden}
.card iframe{position:absolute;left:0;top:0;width:${W}px;height:${H}px;border:0;transform:scale(${(cardW / W).toFixed(5)});transform-origin:0 0;pointer-events:none;background:transparent}
.meta{padding:8px 10px 10px;font-size:14px;line-height:1.35}.meta b{display:block;font-size:13px;color:#7a8296}.star{float:right;font-size:18px}
footer{position:fixed;left:0;right:0;bottom:0;background:#1d2230;color:#fff;padding:12px 18px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
footer code{background:#2c3346;padding:6px 10px;border-radius:8px;font-size:13px;flex:1;min-width:280px;white-space:nowrap;overflow:auto}
footer button{border:0;border-radius:10px;padding:9px 14px;font:inherit;cursor:pointer}.copy{background:#2f6bff;color:#fff}.clear{background:#3a4258;color:#fff}
</style></head><body>
<header><div class="row"><b style="font-size:18px">내 문구</b><input id="t" type="text" value="${text0.replace(/"/g, '&quot;')}" placeholder="여기에 자막 문구를 쓰면 모든 스타일에 바로 나옵니다">
<label><input id="emo" type="checkbox" checked> 이모지</label></div>
<div class="row" id="tabs" style="margin-top:10px"></div></header>
<main id="grid"></main>
<footer><span id="cnt">고른 스타일 0개 · 카드를 눌러 골라 주세요</span><code id="cmd"></code><button class="copy" id="copy">명령 복사</button><button class="clear" id="clr">비우기</button></footer>
<script>
const STY=${JSON.stringify(styles)}, CATS=${JSON.stringify(CATS.map(([k, n]) => [k, n]))}, JOB=${JSON.stringify(JOB)};
const sel=new Set(JSON.parse(localStorage.getItem('dyncap-sel')||'[]'));let cat='new';
const tabs=document.getElementById('tabs');[['all','전체'],...CATS,['sel','고른 것']].forEach(([k,n])=>{const b=document.createElement('button');b.className='tab'+(k===cat?' on':'');b.textContent=n+(k==='all'?' '+STY.length:'');b.onclick=()=>{cat=k;[...tabs.children].forEach(x=>x.classList.toggle('on',x===b));draw();};tabs.appendChild(b);});
const grid=document.getElementById('grid');const io=new IntersectionObserver((es)=>es.forEach((e)=>{const c=e.target;if(e.isIntersecting){if(!c.querySelector('iframe')){const f=document.createElement('iframe');f.src=url(c.dataset.id);c.querySelector('.scr').appendChild(f);}}else{const f=c.querySelector('iframe');if(f)f.remove();}}),{rootMargin:'300px'});
const url=(id)=>'captions.html?style='+encodeURIComponent(id)+'&demo='+encodeURIComponent(document.getElementById('t').value)+'&emoji='+(document.getElementById('emo').checked?1:0);
function draw(){io.disconnect();grid.innerHTML='';STY.filter(s=>cat==='all'||(cat==='sel'?sel.has(s.id):s.cats.includes(cat))).forEach(s=>{const c=document.createElement('div');c.className='card'+(sel.has(s.id)?' sel':'');c.dataset.id=s.id;c.innerHTML='<div class="scr"></div><div class="meta"><span class="star">'+(sel.has(s.id)?'★':'☆')+'</span>'+s.label+'<b>'+s.id+'</b></div>';c.onclick=()=>{sel.has(s.id)?sel.delete(s.id):sel.add(s.id);c.classList.toggle('sel');c.querySelector('.star').textContent=sel.has(s.id)?'★':'☆';save();};grid.appendChild(c);io.observe(c);});save();}
function save(){localStorage.setItem('dyncap-sel',JSON.stringify([...sel]));const a=[...sel];document.getElementById('cnt').textContent='고른 스타일 '+a.length+'개';const S='node scripts/';document.getElementById('cmd').textContent=!a.length?'카드를 눌러 마음에 드는 스타일을 고르세요':a.length===1?S+'render.mjs final "'+JOB+'" --style '+a[0]:'--mix-pool '+a.join(',')+'   (make-captions 에 붙인 뒤 render.mjs final ... --style mix)';}
let tm;document.getElementById('t').oninput=()=>{clearTimeout(tm);tm=setTimeout(()=>grid.querySelectorAll('.card').forEach(c=>{const f=c.querySelector('iframe');if(f)f.src=url(c.dataset.id);}),450);};
document.getElementById('emo').onchange=()=>document.getElementById('t').oninput();
document.getElementById('copy').onclick=()=>navigator.clipboard.writeText(document.getElementById('cmd').textContent);
document.getElementById('clr').onclick=()=>{sel.clear();draw();};draw();
</script></body></html>`;
fs.writeFileSync(path.join(JOB, 'picker.html'), html);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };
let port = +(opt.port || 8765);
const server = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p === '/') p = '/picker.html'; const f = path.join(JOB, p); if (!f.startsWith(JOB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'max-age=3600' }); fs.createReadStream(f).pipe(r); })
  ;
server.on('error', (e) => { if (e.code === 'EADDRINUSE' && port < +(opt.port || 8765) + 30) { port++; server.listen(port, '127.0.0.1'); } else throw e; });
server.on('listening', () => {
    const u = `http://127.0.0.1:${port}/`; console.log(`picker: ${u}  (${styles.length} styles, ${V14.length} new)  Ctrl+C to stop`);
    if (opt.open) { const c = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', u]] : process.platform === 'darwin' ? ['open', [u]] : ['xdg-open', [u]]; spawn(c[0], c[1], { stdio: 'ignore', detached: true }).unref(); }
});
server.listen(port, '127.0.0.1');
