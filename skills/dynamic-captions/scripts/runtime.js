// dynamic-captions runtime (browser side). Loaded by captions.html after data.js (window.CAPDATA).
// Contract for the renderer: window.ready, window.DURATION, window.seek(t), window.visible(t), window.bounds(), window.styles.
// style=mix : every phrase gets its own style (auto plan or D.plan = [{from, to, style}] in seconds).
(() => {
  const P = new URLSearchParams(location.search);
  const D = window.CAPDATA;
  const W = D.width, H = D.height, portrait = H > W;
  const styleId = P.get('style') || D.style || 'block-sweep';
  const root = document.getElementById('cap');
  const U = portrait ? W / 1080 : H / 1080;
  const FS = (portrait ? 88 : 64) * U * (D.scale || 1);
  const PAL = D.palette; // {accent, accent2}
  const CYCLE = [PAL.accent, '#FFFFFF', PAL.accent2]; // key-word colour rotation (mix / lead-big)
  const zone = D.zone;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
  const easeExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(x)));
  const easeBack = (x) => { x = clamp(x); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const strip = (s) => s.replace(/[.,!?…~"'“”‘’()\[\]]/g, '');
  // ---------- decoration layer: emoji reactions, accent line, dark shade (all optional: D.deco = ['emoji','line'], D.shade = 0..1) ----------
  const DECO = new Set(D.deco || []);
  const EMO_DEFAULT = { '와': '😮', '오': '😲', '빵': '🍞', '불': '🔥', '새까맣': '😱', '조금': '🤏', '성공': '🎉', '완벽': '👌', '천천히': '🐢', '먹': '😋', '용': '🐉', '잘했': '👏', '사랑': '❤️', '돈': '💰', '시간': '⏰', '아이디어': '💡', '질문': '❓', '위험': '⚠️', '주의': '⚠️', '컴퓨터': '💻', '영상': '🎬', '음악': '🎵', '노래': '🎵', '커피': '☕', '최고': '🏆', '추천': '👍', '좋': '👍', '봐': '👀', '확신': '💯', '무료': '🆓', '웃': '😄', '눈물': '😢', '화내': '😡', '놀라': '😮',
    fire: '🔥', perfect: '👌', wow: '😮', love: '❤️', money: '💰', idea: '💡', music: '🎵', bread: '🍞', dragon: '🐉', eat: '😋', free: '🆓', time: '⏰' };
  const EMO = Object.assign({}, EMO_DEFAULT, D.emojiMap || {});
  const emoKeys = Object.keys(EMO).sort((a, b) => b.length - a.length);
  // one-character keys must be at the start of the word ("용이" yes, "사용" no); longer keys may be anywhere inside. The user's emojiMap always wins.
  const emoMatch = (t) => { t = t.toLowerCase(); return emoKeys.find((k) => { k = k.toLowerCase(); return k.length <= 1 ? t.startsWith(k) : t.includes(k); }); };
  // display width in Hangul-equivalents (Hangul/CJK 1, Latin and digits .55, other .4): max-chars limits follow real width
  const wlen = (s) => { let n = 0; for (const ch of strip(s)) n += /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af\u3040-\u30ff\u4e00-\u9fff]/.test(ch) ? 1 : /[A-Za-z0-9]/.test(ch) ? 0.55 : 0.4; return n; };
  const OUT = (em = 0.065, c = 'rgba(8,8,12,.92)') => {
    const o = [[1, 0], [-1, 0], [0, 1], [0, -1], [.7, .7], [-.7, .7], [.7, -.7], [-.7, -.7]];
    return o.map(([x, y]) => `${(x * em).toFixed(3)}em ${(y * em).toFixed(3)}em 0 ${c}`).join(',') + `,0 .06em .18em rgba(0,0,0,.55)`;
  };

  // ---------- words, key words, phrases ----------
  const words = D.words.map((w, i) => ({ ...w, i, dur: Math.max(0.12, w.end - w.start) }));
  const emphList = (D.emphasis || []).map(strip);
  const isEmph = (w) => w.emph === true || emphList.some((e) => e && strip(w.text).includes(e));
  // words spoken noticeably slower than usual (>=2x the median time per character, >=0.4 s) are emphasis candidates (real timings only)
  const pcs = words.filter((w) => !w.approx && strip(w.text).length >= 2 && w.dur >= 0.2).map((w) => w.dur / strip(w.text).length).sort((a, b) => a - b);
  const medPC = pcs.length ? pcs[Math.floor(pcs.length / 2)] : 0.12;
  const slowSpoken = (w) => !w.approx && strip(w.text).length >= 2 && w.dur >= 0.4 && w.dur / strip(w.text).length >= 2 * medPC;
  function group(opts) {
    const out = []; let cur = [], chars = 0;
    const flush = () => { if (cur.length) out.push(cur); cur = []; chars = 0; };
    words.forEach((w) => {
      const n = wlen(w.text);
      if (cur.length && (cur.length >= opts.maxWords || chars + n > opts.maxChars || w.start - cur[cur.length - 1].end > 0.5 || cur[cur.length - 1].lineEnd)) flush();
      cur.push(w); chars += n;
      if (/[.?!…]$/.test(w.text) || (/,$/.test(w.text) && chars >= opts.maxChars * 0.6)) flush();
    });
    flush();
    // orphan guard: a phrase left with a single short word joins the previous phrase when it still fits
    if (opts.maxWords > 2) for (let i = out.length - 1; i > 0; i--) {
      const cur1 = out[i], prev = out[i - 1], last = prev[prev.length - 1];
      if (cur1.length === 1 && cur1[0].start - last.end < 0.3 && !last.lineEnd && !/[.?!…]$/.test(last.text) && prev.length <= opts.maxWords && prev.reduce((s, w) => s + wlen(w.text), 0) + wlen(cur1[0].text) <= opts.maxChars * 1.25) { prev.push(cur1[0]); out.splice(i, 1); }
    }
    return out.map((ws, k) => {
      const longest = ws.reduce((a, b) => (strip(b.text).length >= strip(a.text).length ? b : a), ws[0]);
      // key word: explicit > number > slowly spoken (not the last word, whose end often includes a pause) > longest
      const slow = ws.slice(0, -1).filter(slowSpoken).sort((a, b) => b.dur / strip(b.text).length - a.dur / strip(a.text).length)[0];
      const key = ws.find(isEmph) || ws.find((w) => /\d/.test(w.text)) || slow || longest;
      return { words: ws, start: ws[0].start, end: ws[ws.length - 1].end, key, k, hasEmph: ws.some(isEmph), hasNum: ws.some((w) => /\d/.test(w.text)) };
    }).map((ph, k, arr) => {
      const nxt = arr[k + 1];
      ph.vs = Math.max(0, ph.start - 0.06);
      ph.ve = nxt ? Math.min(ph.end + 0.4, nxt.start - 0.03) : ph.end + 0.4;
      if (ph.ve < ph.end + 0.12) ph.ve = ph.end + 0.12;
      const minVe = ph.vs + 0.7; // a caption stays on screen at least 0.7 s unless the next one starts
      if (ph.ve < minVe) ph.ve = nxt ? Math.min(minVe, nxt.start - 0.03) : minVe;
      return ph;
    });
  }

  // ---------- container (safe zone) ----------
  Object.assign(root.style, {
    position: 'absolute', left: (W * 0.06) + 'px', width: (W * 0.88) + 'px',
    top: (H * zone.top) + 'px', height: (H * (zone.bottom - zone.top)) + 'px',
    display: 'flex', justifyContent: 'center', alignItems: portrait ? 'center' : 'flex-end', textAlign: 'center',
  });
  const css = document.createElement('style');
  css.textContent = `
  #cap{font-family:CapMain,CapBase,sans-serif;font-weight:800;font-size:${FS}px;line-height:1.18;color:#fff;font-synthesis:none}
  #cap .ln{display:flex;flex-wrap:wrap;justify-content:var(--jc,center);align-items:baseline;column-gap:.3em;row-gap:.06em}
  #cap .w{display:inline-block;position:relative;white-space:nowrap;will-change:transform}
  #cap .col{display:flex;flex-direction:column;align-items:var(--ai,center);row-gap:.02em}
  #cap .dec{position:absolute;pointer-events:none}
  `;
  document.head.appendChild(css);
  const mk = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; };
  const keyColor = (ph, mix) => (mix ? CYCLE[ph.k % CYCLE.length] : PAL.accent);

  // helper for the "small words around one big key" family (hero-key, lead-big, stamp)
  function buildRows(ph, el, preSize, makeKey) {
    const col = mk('div', 'col', el); const k = ph.words.indexOf(ph.key);
    const pre = ph.words.slice(0, k), post = ph.words.slice(k + 1); ph.els = [];
    const row = (ws) => { if (!ws.length) return; const r = mk('div', 'ln', col); r.style.fontSize = preSize; ws.forEach((w) => { const s = mk('span', 'w', r, w.text); s.style.textShadow = OUT(0.07); ph.els[w.i] = s; }); };
    row(pre);
    const kr = mk('div', 'ln', col); const ks = mk('span', 'w', kr, ph.key.text); makeKey(ks); ph.els[ph.key.i] = ks;
    row(post);
  }
  const smallEnter = (s, p, vis) => { s.style.opacity = vis ? 1 : 0; s.style.transform = `translateY(${vis ? (1 - easeOut(p)) * 0.3 : 0.3}em)`; };

  // ---------- style library ----------
  const S = {};
  let SPD = 1; // entrance speed factor (1 = normal, smaller = faster), set from phrase timings below

  // 1. block-sweep : colour block covers the word while it is spoken
  S['block-sweep'] = {
    label: '색 블록 훑기', group: { maxChars: portrait ? 11 : 24, maxWords: portrait ? 4 : 7 },
    build(ph, el) {
      const ln = mk('div', 'ln', el); ph.els = ph.words.map((w) => {
        const s = mk('span', 'w', ln, w.text); s.style.padding = '0 .12em'; s.style.isolation = 'isolate';
        const b = mk('i', 'blk', s); Object.assign(b.style, { position: 'absolute', left: 0, right: 0, top: '.06em', bottom: '.0em', background: w === ph.key ? PAL.accent2 : PAL.accent, transformOrigin: 'left center', transform: 'scaleX(0)', zIndex: -1, borderRadius: '.14em' });
        s.b = b; return s;
      });
    },
    update(ph, t) {
      ph.words.forEach((w, k) => {
        const s = ph.els[k], on = t >= w.start && t < w.end + 0.08;
        const p = easeOut((t - w.start) / 0.11), fade = clamp(1 - (t - (w.end + 0.08)) / 0.18);
        s.b.style.transform = `scaleX(${t < w.start ? 0 : p})`; s.b.style.opacity = t < w.end + 0.08 ? 1 : fade;
        s.style.color = on ? '#0b0b0f' : '#fff'; s.style.textShadow = on ? 'none' : OUT(0.055);
        s.style.opacity = t < w.start ? 0.82 : 1;
        s.style.transform = on ? `scale(${1 + 0.07 * p})` : 'scale(1)';
      });
    },
  };

  // 2. pop-word : one or two words at a time, bounce-in
  S['pop-word'] = {
    label: '한 단어 팝', slack: 1.1, noFade: true, scale: 1.28, group: { maxChars: portrait ? 7 : 12, maxWords: 2 },
    build(ph, el, mix) {
      const ln = mk('div', 'ln', el); ln.style.fontFamily = 'CapDisplay,CapMain,CapBase,sans-serif'; ln.style.fontWeight = 400;
      ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); s.style.color = w === ph.key ? keyColor(ph, mix) : '#fff'; return s; });
    },
    update(ph, t) {
      ph.words.forEach((w, k) => {
        const s = ph.els[k], p = (t - w.start) / 0.2, vis = t >= w.start - 0.01;
        s.style.opacity = vis ? 1 : 0;
        const sc = vis ? 0.55 + 0.45 * easeBack(p) : 0.55;
        s.style.transform = `scale(${sc}) rotate(${(w === ph.key ? -3 : 0) * (1 - clamp(p)) - (w === ph.key ? 3 : 0)}deg)`;
        s.style.textShadow = OUT(0.06);
      });
    },
  };

  // 3. karaoke-fill : colour sweeps through each word
  S['karaoke-fill'] = {
    label: '노래방 채우기', group: { maxChars: portrait ? 11 : 22, maxWords: portrait ? 4 : 6 },
    build(ph, el) {
      const ln = mk('div', 'ln', el); ph.els = ph.words.map((w) => {
        const s = mk('span', 'w', ln, w.text); s.style.color = '#fff'; s.style.textShadow = OUT(0.06);
        const f = mk('span', 'f', s, w.text); Object.assign(f.style, { position: 'absolute', left: 0, top: 0, color: PAL.accent, textShadow: OUT(0.06), clipPath: 'inset(0 100% 0 0)' });
        s.f = f; return s;
      });
    },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k], p = clamp((t - w.start) / w.dur); s.f.style.clipPath = `inset(0 ${(1 - p) * 100}% 0 0)`; }); },
  };

  // 4. hero-key : the key word slams in big (display font), other words small
  S['hero-key'] = {
    label: '핵심어 히어로', slack: 1.25, group: { maxChars: portrait ? 12 : 22, maxWords: portrait ? 4 : 6 },
    build(ph, el, mix) {
      buildRows(ph, el, '0.7em', (ks) => Object.assign(ks.style, { fontFamily: 'CapDisplay,CapMain,CapBase,sans-serif', fontWeight: 400, fontSize: '2.1em', lineHeight: '1.0', color: keyColor(ph, mix), textShadow: OUT(0.05) + `,0 0 .3em ${keyColor(ph, mix)}55` }));
    },
    update(ph, t) {
      ph.words.forEach((w) => {
        const s = ph.els[w.i]; const p = (t - w.start) / (w === ph.key ? 0.22 : 0.16); const vis = t >= w.start - 0.01;
        if (w === ph.key) { s.style.opacity = vis ? 1 : 0; s.style.transform = `scale(${vis ? 1 + 0.25 * (1 - easeExpo(p)) : 1.25}) rotate(-3deg)`; } else smallEnter(s, p, vis);
      });
    },
  };

  // 5. stack-kinetic : sizes by importance, words fly in from alternating sides
  S['stack-kinetic'] = {
    label: '크기 대비 쌓기', group: { maxChars: portrait ? 13 : 24, maxWords: portrait ? 5 : 8 },
    build(ph, el, mix) {
      const ln = mk('div', 'ln', el); ln.style.columnGap = '.22em';
      ph.els = ph.words.map((w, k) => {
        const n = strip(w.text).length, key = w === ph.key; const s = mk('span', 'w', ln, w.text);
        s.style.fontSize = (key ? 1.55 : n <= 2 ? 0.72 : 1) + 'em'; s.style.color = key ? keyColor(ph, mix) : '#fff';
        if (key) { s.style.fontFamily = 'CapDisplay,CapMain,CapBase,sans-serif'; s.style.fontWeight = 400; }
        s.style.textShadow = OUT(0.065); s.dir = [-1, 0, 1, 0][k % 4]; s.dirY = [0, 1, 0, -1][k % 4]; return s;
      });
    },
    update(ph, t) {
      ph.words.forEach((w, k) => {
        const s = ph.els[k], p = easeOut((t - w.start) / 0.24), vis = t >= w.start - 0.01;
        s.style.opacity = vis ? p : 0; s.style.transform = `translate(${(1 - p) * 0.5 * s.dir}em,${(1 - p) * 0.4 * s.dirY}em)`; s.style.filter = `blur(${(1 - p) * 8}px)`;
      });
    },
  };

  // 6. underline-ink : calm; accent underline draws under the spoken word (no marker block over the text)
  S['underline-ink'] = {
    label: '밑줄 짚기', group: { maxChars: portrait ? 12 : 26, maxWords: portrait ? 4 : 8 },
    build(ph, el) {
      const ln = mk('div', 'ln', el); ln.style.fontFamily = 'CapCalm,CapMain,CapBase,sans-serif'; ln.style.fontWeight = 700;
      ph.els = ph.words.map((w) => {
        const s = mk('span', 'w', ln, w.text); s.style.textShadow = OUT(0.06);
        const u = mk('i', 'u', s); Object.assign(u.style, { position: 'absolute', left: 0, right: 0, bottom: '-.04em', height: '.11em', background: w === ph.key ? PAL.accent2 : PAL.accent, borderRadius: '.06em', transformOrigin: 'left', transform: 'scaleX(0)' });
        s.u = u; return s;
      });
    },
    update(ph, t) {
      ph.words.forEach((w, k) => {
        const s = ph.els[k], p = easeOut((t - w.start) / Math.max(0.18, Math.min(0.4, w.dur)));
        s.u.style.transform = `scaleX(${t < w.start ? 0 : p})`;
        const on = t >= w.start && t < w.end + 0.05; s.style.opacity = t < w.start ? 0.62 : 1; s.style.transform = `translateY(${on ? -0.04 : 0}em)`;
      });
    },
  };

  // 7. glass-card : dark rounded card, active word lights up
  S['glass-card'] = {
    label: '유리 카드', group: { maxChars: portrait ? 12 : 26, maxWords: portrait ? 4 : 8 },
    build(ph, el) {
      const card = mk('div', 'card', el); Object.assign(card.style, { background: 'rgba(12,16,28,.76)', border: '2px solid rgba(255,255,255,.2)', borderRadius: '.5em', padding: '.28em .62em .32em', boxShadow: '0 .3em 1em rgba(0,0,0,.45)', position: 'relative', fontSize: '0.86em' });
      const bar = mk('i', 'bar', card); Object.assign(bar.style, { position: 'absolute', left: '.22em', top: '.3em', bottom: '.3em', width: '.1em', borderRadius: '.05em', background: PAL.accent });
      const ln = mk('div', 'ln', card); ln.style.paddingLeft = '.18em'; ph.card = card;
      ph.els = ph.words.map((w) => mk('span', 'w', ln, w.text));
    },
    update(ph, t) {
      const e = easeOut((t - ph.vs) / 0.22); ph.card.style.transform = `translateY(${(1 - e) * 0.35}em)`;
      ph.words.forEach((w, k) => { const s = ph.els[k], on = t >= w.start && t < w.end + 0.05; s.style.color = on ? PAL.accent : t >= w.end ? '#fff' : 'rgba(255,255,255,.58)'; s.style.transform = `scale(${on ? 1.06 : 1})`; });
    },
  };

  // 8. neon-glow : words ignite one by one
  S['neon-glow'] = {
    label: '네온 점등', group: { maxChars: portrait ? 11 : 22, maxWords: portrait ? 4 : 6 },
    build(ph, el) { const ln = mk('div', 'ln', el); ln.style.letterSpacing = '.03em'; ln.style.fontWeight = 700; ph.els = ph.words.map((w) => mk('span', 'w', ln, w.text)); },
    update(ph, t) {
      ph.words.forEach((w, k) => {
        const s = ph.els[k], c = w === ph.key ? PAL.accent2 : PAL.accent, p = t - w.start;
        if (p < 0) { s.style.opacity = 0.28; s.style.color = '#cfd6e6'; s.style.textShadow = 'none'; return; }
        const flick = p < 0.18 ? (Math.sin(p * 90) > -0.3 ? 1 : 0.35) : 1;
        s.style.opacity = flick; s.style.color = '#fff'; s.style.textShadow = `0 0 .12em ${c},0 0 .32em ${c},0 0 .7em ${c}99,` + OUT(0.04, 'rgba(6,6,14,.85)');
      });
    },
  };

  // 9. lead-big : small lead-in line + one big bold key word whose colour rotates (white / accent / accent2)
  S['lead-big'] = {
    label: '작은말+큰핵심어', slack: 1.25, group: { maxChars: portrait ? 12 : 22, maxWords: portrait ? 4 : 6 },
    build(ph, el) {
      const c = CYCLE[ph.k % CYCLE.length];
      buildRows(ph, el, '0.72em', (ks) => Object.assign(ks.style, { fontSize: '1.85em', lineHeight: '1.02', color: c, textShadow: OUT(0.055) }));
      ph.els.forEach((s) => { if (s !== ph.els[ph.key.i]) { s.style.fontWeight = 700; } });
    },
    update(ph, t) {
      ph.words.forEach((w) => {
        const s = ph.els[w.i], vis = t >= w.start - 0.01;
        if (w === ph.key) { const p = (t - w.start) / 0.3; s.style.opacity = vis ? 1 : 0; s.style.transform = `translateY(${vis ? (1 - easeBack(p)) * 0.5 : 0.5}em) scale(${vis ? 0.85 + 0.15 * easeBack(p) : 0.85})`; }
        else smallEnter(s, (t - w.start) / 0.16, vis);
      });
    },
  };

  // 10. chip-label : key word gets a highlighter chip (accent bar, dark text), words rise one by one
  S['chip-label'] = {
    label: '라벨 칩', group: { maxChars: portrait ? 11 : 24, maxWords: portrait ? 4 : 7 },
    build(ph, el) {
      const ln = mk('div', 'ln', el); ph.els = ph.words.map((w) => {
        const s = mk('span', 'w', ln, w.text); s.style.textShadow = OUT(0.065);
        if (w === ph.key) Object.assign(s.style, { padding: '0 .22em', background: PAL.accent, color: '#0b0b0f', textShadow: 'none', borderRadius: '.16em', boxShadow: '0 .08em .3em rgba(0,0,0,.35)' });
        return s;
      });
    },
    update(ph, t) {
      ph.words.forEach((w, k) => {
        const s = ph.els[k], vis = t >= w.start - 0.01, p = (t - w.start) / 0.2;
        s.style.opacity = vis ? 1 : 0;
        if (w === ph.key) s.style.transform = `scale(${vis ? 0.6 + 0.4 * easeBack(p) : 0.6}) rotate(-2.5deg)`; else smallEnter(s, p, vis);
      });
    },
  };

  // 11. stamp : key word is stamped in a rotated red outline box, other words small
  S['stamp'] = {
    label: '도장 찍기', slack: 1.18, group: { maxChars: portrait ? 12 : 22, maxWords: portrait ? 4 : 6 },
    build(ph, el) {
      buildRows(ph, el, '0.78em', (ks) => Object.assign(ks.style, { fontSize: '1.5em', color: PAL.accent2, border: `.09em solid ${PAL.accent2}`, borderRadius: '.18em', padding: '.04em .3em .08em', background: 'rgba(0,0,0,.28)', textShadow: '0 0 .05em rgba(0,0,0,.5)', letterSpacing: '.02em' }));
    },
    update(ph, t) {
      ph.words.forEach((w) => {
        const s = ph.els[w.i], vis = t >= w.start - 0.01;
        if (w === ph.key) { const p = (t - w.start) / 0.16; s.style.opacity = vis ? 1 : 0; s.style.transform = `scale(${vis ? 1 + 0.3 * (1 - easeOut(p)) : 1.3}) rotate(-5deg)`; } else smallEnter(s, (t - w.start) / 0.16, vis);
      });
    },
  };

  // 12. line-rise : each word slides up out of a mask (calm editorial reveal)
  S['line-rise'] = {
    label: '줄마다 올라오기', group: { maxChars: portrait ? 12 : 26, maxWords: portrait ? 4 : 8 },
    build(ph, el) {
      const ln = mk('div', 'ln', el); ln.style.columnGap = '.12em'; ph.els = ph.words.map((w) => {
        const s = mk('span', 'w', ln, ''); Object.assign(s.style, { overflow: 'hidden', padding: '.12em .1em .18em', margin: '-.12em -.1em -.18em' });
        const i = mk('span', 'in', s, w.text); i.style.display = 'inline-block'; i.style.textShadow = OUT(0.06); if (w === ph.key) i.style.color = PAL.accent; s.inner = i; return s;
      });
    },
    update(ph, t) { ph.words.forEach((w, k) => { const p = easeOut((t - w.start + 0.04) / 0.26); ph.els[k].inner.style.transform = `translateY(${t < w.start - 0.04 ? 120 : (1 - p) * 120}%)`; }); },
  };

  // 13. hand-note : handwriting face, slight wobble, scribble underline under the key word (casual / vlog tone)
  S['hand-note'] = {
    label: '손글씨 메모', group: { maxChars: portrait ? 11 : 22, maxWords: portrait ? 4 : 6 },
    build(ph, el) {
      const ln = mk('div', 'ln', el); ln.style.fontFamily = 'CapHand,CapMain,CapBase,sans-serif'; ln.style.fontWeight = 700; ln.style.fontSize = '1.2em';
      ph.els = ph.words.map((w, k) => {
        const s = mk('span', 'w', ln, w.text); s.style.textShadow = OUT(0.07); s.rot = [-2, 1.5, -1, 2.5][k % 4];
        if (w === ph.key) { s.style.color = PAL.accent; const u = mk('i', 'u', s); Object.assign(u.style, { position: 'absolute', left: '-2%', right: '-2%', bottom: '-.02em', height: '.1em', background: PAL.accent, borderRadius: '.1em', transformOrigin: 'left', transform: 'scaleX(0) rotate(-1.5deg)' }); s.u = u; }
        return s;
      });
    },
    update(ph, t) {
      ph.words.forEach((w, k) => {
        const s = ph.els[k], vis = t >= w.start - 0.01, p = (t - w.start) / 0.18;
        s.style.opacity = vis ? 1 : 0; s.style.transform = `rotate(${s.rot}deg) scale(${vis ? 0.7 + 0.3 * easeBack(p) : 0.7})`;
        if (s.u) s.u.style.transform = `scaleX(${vis ? easeOut((t - w.start - 0.05) / 0.3) : 0}) rotate(-1.5deg)`;
      });
    },
  };

  // 14. line-focus : the spoken line sits on a solid panel; words have three states (not yet / speaking / spoken)
  S['line-focus'] = {
    label: '줄 패널 강조', group: { maxChars: portrait ? 11 : 20, maxWords: portrait ? 4 : 6 },
    build(ph, el) {
      const panel = mk('div', 'panel', el); Object.assign(panel.style, { background: '#2447ff', borderRadius: '.3em', padding: '.16em .5em .22em', boxShadow: '0 .2em .8em rgba(0,0,0,.4)' });
      const ln = mk('div', 'ln', panel); ph.panel = panel; ph.els = ph.words.map((w) => mk('span', 'w', ln, w.text));
    },
    update(ph, t) {
      const e = easeOut((t - ph.vs) / 0.18); ph.panel.style.transform = `scale(${0.92 + 0.08 * e})`;
      ph.words.forEach((w, k) => {
        const s = ph.els[k], on = t >= w.start && t < w.end + 0.04;
        s.style.color = on ? PAL.accent : t >= w.end ? '#fff' : 'rgba(255,255,255,.55)'; s.style.transform = `scale(${on ? 1.08 : 1})`;
        s.style.textShadow = on ? `0 0 .35em ${PAL.accent}88` : 'none';
      });
    },
  };

  // 15. fill-rise : outlined letters fill up from the bottom while the word is spoken (good for lyric hooks)
  S['fill-rise'] = {
    label: '윤곽 채움', slack: 1.1, group: { maxChars: portrait ? 8 : 16, maxWords: portrait ? 3 : 5 },
    build(ph, el, mix) {
      const ln = mk('div', 'ln', el); ln.style.fontFamily = 'CapDisplay,CapMain,CapBase,sans-serif'; ln.style.fontWeight = 400; ln.style.fontSize = '1.25em';
      ph.els = ph.words.map((w) => {
        const s = mk('span', 'w', ln, w.text); Object.assign(s.style, { color: 'transparent', webkitTextStroke: '.04em #fff', filter: 'drop-shadow(0 .04em .07em rgba(0,0,0,.75))' });
        const f = mk('span', 'f', s, w.text); Object.assign(f.style, { position: 'absolute', left: 0, top: 0, color: w === ph.key ? PAL.accent2 : PAL.accent, webkitTextStroke: '0', clipPath: 'inset(100% 0 0 0)' }); s.f = f; return s;
      });
    },
    update(ph, t) { ph.words.forEach((w, k) => { const p = clamp((t - w.start) / Math.max(0.2, w.dur)); ph.els[k].f.style.clipPath = `inset(${(1 - easeOut(p)) * 100}% 0 0 0)`; }); },
  };

  // 16. impact-wide : the phrase is blown up to fill the width (1-2 short words, display face) - for hooks, titles, punch lines
  S['impact-wide'] = {
    label: '꽉 찬 큰 글씨', fill: 2.4, slack: 1.1, group: { maxChars: portrait ? 6 : 10, maxWords: 2 },
    build(ph, el, mix) {
      const ln = mk('div', 'ln', el); ln.style.fontFamily = 'CapDisplay,CapMain,CapBase,sans-serif'; ln.style.fontWeight = 400; ln.style.lineHeight = '1.0';
      ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); s.style.color = w === ph.key ? keyColor(ph, mix) : '#fff'; s.style.textShadow = OUT(0.045); return s; });
    },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k], p = easeBack((t - w.start) / 0.18), vis = t >= w.start - 0.01; s.style.opacity = vis ? 1 : 0; s.style.transform = `scale(${vis ? 0.7 + 0.3 * p : 0.7})`; }); },
  };

  // 17. news-bar : dark band with a coloured edge tab slides in from the left; words appear as spoken, key word in the accent colour
  S['news-bar'] = {
    label: '뉴스 띠', group: { maxChars: portrait ? 12 : 24, maxWords: portrait ? 4 : 7 },
    build(ph, el) {
      const bar = mk('div', 'card', el); Object.assign(bar.style, { background: 'rgba(8,10,18,.84)', borderRadius: '.18em', padding: '.2em .6em .26em .95em', position: 'relative', fontSize: '.9em', boxShadow: '0 .2em .7em rgba(0,0,0,.45)' });
      const tab = mk('i', 'tab', bar); Object.assign(tab.style, { position: 'absolute', left: 0, top: 0, bottom: 0, width: '.3em', background: PAL.accent2, borderRadius: '.18em 0 0 .18em' });
      const ln = mk('div', 'ln', bar); ph.card = bar; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); if (w === ph.key) s.style.color = PAL.accent; return s; });
    },
    update(ph, t) { const e = easeOut((t - ph.vs) / 0.22); ph.card.style.transform = `translateX(${(1 - e) * -1.4}em)`; ph.words.forEach((w, k) => { ph.els[k].style.opacity = t >= w.start - 0.02 ? 1 : 0.0; }); },
  };

  // 18. typewriter : letters appear one by one while each word is spoken, blinking caret
  S['typewriter'] = {
    label: '타자기', group: { maxChars: portrait ? 10 : 20, maxWords: portrait ? 3 : 6 },
    build(ph, el) {
      const ln = mk('div', 'ln', el); ln.style.fontFamily = 'CapCalm,CapMain,CapBase,sans-serif'; ph.chars = [];
      ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, ''); s.style.textShadow = OUT(0.06); if (w === ph.key) s.style.color = PAL.accent; ph.chars.push([...w.text].map((c) => { const i = mk('span', 'c', s, c); i.style.display = 'inline-block'; return i; })); return s; });
      const caret = mk('i', 'caret', ln); Object.assign(caret.style, { display: 'inline-block', width: '.08em', height: '.9em', background: PAL.accent, marginLeft: '.05em', alignSelf: 'center' }); ph.caret = caret;
    },
    update(ph, t) { ph.words.forEach((w, k) => { const cs = ph.chars[k], p = clamp((t - w.start) / Math.max(0.15, w.dur * 0.8)); cs.forEach((c, i) => { c.style.opacity = p * cs.length > i ? 1 : 0; }); }); ph.caret.style.opacity = Math.floor(t * 4) % 2 === 0 ? 1 : 0.2; },
  };

  // 19. wave : letters of the spoken word bob like a wave and take the accent colour
  S['wave'] = {
    label: '출렁 글자', group: { maxChars: portrait ? 9 : 18, maxWords: portrait ? 3 : 6 },
    build(ph, el) {
      const ln = mk('div', 'ln', el); ph.chars = [];
      ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, ''); s.style.textShadow = OUT(0.065); ph.chars.push([...w.text].map((c) => { const i = mk('span', 'c', s, c); i.style.display = 'inline-block'; return i; })); return s; });
    },
    update(ph, t) { ph.words.forEach((w, k) => { const on = t >= w.start && t < w.end + 0.1; ph.chars[k].forEach((c, i) => { c.style.transform = on ? `translateY(${(-Math.sin((t - w.start) * 14 - i * 0.7) * 0.12).toFixed(3)}em)` : 'translateY(0)'; c.style.color = on ? (w === ph.key ? PAL.accent2 : PAL.accent) : '#fff'; }); ph.els[k].style.opacity = t < w.start ? 0.7 : 1; }); },
  };

  // 20. plain : calm explainer caption. White text in a dark rounded box, the whole line fades in at once. No colour, no word effects. Not part of mix.
  S['plain'] = {
    label: '차분한 자막(설명 영상용)', group: { maxChars: portrait ? 14 : 28, maxWords: portrait ? 4 : 9 },
    build(ph, el) {
      const card = mk('div', 'card', el); Object.assign(card.style, { background: 'rgba(8,12,24,.74)', borderRadius: '.3em', padding: '.2em .55em .26em', fontSize: '.86em', boxShadow: '0 .12em .5em rgba(0,0,0,.35)' });
      const ln = mk('div', 'ln', card); ph.card = card; ph.els = ph.words.map((w) => mk('span', 'w', ln, w.text));
    },
    update(ph, t) { ph.card.style.opacity = easeOut((t - ph.vs) / 0.18); },
  };


  // ======== v1.1 additions (2026-10-29): emotion / sound-word motions, layout and decoration styles ========
  // en(): entrance animations get shorter when captions change quickly (fast cuts / fast talk). SPD is set from the phrase timings.
  const en = (x) => x * SPD;
  const rnd = (i, t, f = 30) => { const v = Math.sin(i * 12.9898 + Math.floor(t * f) * 78.233) * 43758.5453; return v - Math.floor(v) - 0.5; };
  const letters = (w, s) => [...w.text].map((c) => { const i = mk('span', 'c', s, c); i.style.display = 'inline-block'; return i; });
  const charLine = (ph, el, font) => { const ln = mk('div', 'ln', el); if (font) { ln.style.fontFamily = font; ln.style.fontWeight = 400; } ph.chars = []; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, ''); s.style.textShadow = OUT(0.065); ph.chars.push(letters(w, s)); return s; }); return ln; };
  const DISP = 'CapDisplay,CapMain,CapBase,sans-serif';

  // E1. sway-breeze : relaxed / pleasant. letters sway softly like leaves, mint key
  S['sway-breeze'] = {
    label: '살랑 바람(여유·기분 좋음)', group: { maxChars: portrait ? 10 : 20, maxWords: portrait ? 3 : 6 },
    build(ph, el) { charLine(ph, el); ph.words.forEach((w, k) => { if (w === ph.key) ph.els[k].style.color = '#9FF3D2'; }); },
    update(ph, t) { ph.words.forEach((w, k) => { const vis = t >= w.start - 0.02, p = easeOut((t - w.start) / en(0.3)); ph.els[k].style.opacity = vis ? p : 0; ph.chars[k].forEach((c, i) => { const a = Math.sin(t * 3.2 + i * 0.8); c.style.transform = `translateY(${(a * 0.06 + (1 - p) * 0.25).toFixed(3)}em) rotate(${(a * 6).toFixed(2)}deg)`; }); }); },
  };
  // E2. jitter-nerve : urgent / nervous. letters tremble, pale ice-blue key
  S['jitter-nerve'] = {
    label: '덜덜 떨림(다급·긴장)', group: { maxChars: portrait ? 9 : 18, maxWords: portrait ? 3 : 5 },
    build(ph, el) { charLine(ph, el, DISP); ph.words.forEach((w, k) => { ph.els[k].style.color = w === ph.key ? '#BFE3FF' : '#fff'; }); },
    update(ph, t) { ph.words.forEach((w, k) => { const vis = t >= w.start - 0.02; ph.els[k].style.opacity = vis ? 1 : 0; const amp = w === ph.key ? 0.035 : 0.018; ph.chars[k].forEach((c, i) => { c.style.transform = vis ? `translate(${(rnd(i + k * 7, t) * amp * 2).toFixed(3)}em,${(rnd(i * 3 + k, t + 0.5) * amp * 2).toFixed(3)}em)` : 'none'; }); }); },
  };
  // E3. heart-thump : excited / fluttering. key word beats twice like a heart, pink glow
  S['heart-thump'] = {
    label: '두근 박동(설렘)', slack: 1.2, group: { maxChars: portrait ? 11 : 20, maxWords: portrait ? 4 : 6 },
    build(ph, el) { buildRows(ph, el, '0.72em', (ks) => Object.assign(ks.style, { fontFamily: DISP, fontWeight: 400, fontSize: '1.7em', lineHeight: '1.05', color: '#FF8FC1', textShadow: OUT(0.05) + ',0 0 .35em #FF5FA266' })); },
    update(ph, t) {
      ph.words.forEach((w) => { const s = ph.els[w.i], vis = t >= w.start - 0.01, p = (t - w.start) / en(0.2);
        if (w === ph.key) { const c = (((t - w.start) % 0.9) + 0.9) % 0.9, beat = Math.exp(-c * 14) + (c > 0.22 ? 0.7 * Math.exp(-(c - 0.22) * 14) : 0); s.style.opacity = vis ? 1 : 0; s.style.transform = `scale(${(vis ? (0.8 + 0.2 * easeBack(p)) * (1 + 0.12 * beat) : 0.8).toFixed(4)})`; }
        else smallEnter(s, p, vis); });
    },
  };
  // E4. tilt-wonder : curious / puzzled. the phrase tilts its head, a question mark leans in
  S['tilt-wonder'] = {
    label: '갸웃 기울기(궁금·의아)', slack: 1.15, group: { maxChars: portrait ? 10 : 16, maxWords: portrait ? 3 : 5 },
    build(ph, el) {
      const wrap = mk('div', 'ln', el); wrap.style.transformOrigin = '50% 90%'; ph.wrap = wrap;
      ph.els = ph.words.map((w) => { const s = mk('span', 'w', wrap, w.text); s.style.textShadow = OUT(0.065); if (w === ph.key) s.style.color = '#C9B6FF'; return s; });
      if (!/\?$/.test(ph.words[ph.words.length - 1].text)) { const q = mk('span', 'w', wrap, '?'); Object.assign(q.style, { fontFamily: DISP, fontWeight: 400, color: '#C9B6FF', textShadow: OUT(0.06), fontSize: '1.15em' }); ph.q = q; }
    },
    update(ph, t) {
      const e = easeOut((t - ph.vs) / en(0.45)); ph.wrap.style.transform = `rotate(${((portrait ? -4 : -2.5) * e).toFixed(2)}deg)`;
      ph.words.forEach((w, k) => { ph.els[k].style.opacity = t >= w.start - 0.02 ? 1 : 0; });
      if (ph.q) { const last = ph.words[ph.words.length - 1], q = easeBack((t - last.end + 0.1) / en(0.25)); ph.q.style.opacity = t >= last.end - 0.1 ? 1 : 0; ph.q.style.transform = `rotate(${(14 - 10 * clamp(q)).toFixed(1)}deg) scale(${(0.5 + 0.5 * q).toFixed(3)})`; }
    },
  };
  // E5. jolt-pop : surprise. each word jumps out from nothing with a big overshoot, tangerine key
  S['jolt-pop'] = {
    label: '깜짝 튀기(놀람)', slack: 1.3, noFade: true, scale: 1.15, group: { maxChars: portrait ? 8 : 14, maxWords: 3 },
    build(ph, el) { const ln = mk('div', 'ln', el); ln.style.fontFamily = DISP; ln.style.fontWeight = 400; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); s.style.color = w === ph.key ? '#FFB547' : '#fff'; s.style.textShadow = OUT(0.055); return s; }); },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k], vis = t >= w.start - 0.01, p = clamp((t - w.start) / en(0.28)); const sc = vis ? (p < 0.45 ? 1.2 * easeOut(p / 0.45) : 1.2 - 0.2 * easeOut((p - 0.45) / 0.55)) : 0; s.style.opacity = vis ? 1 : 0; s.style.transform = `translateY(${(0.12 * Math.sin(Math.PI * p)).toFixed(3)}em) scale(${sc.toFixed(3)})`; }); },
  };
  // E6. droop-sigh : disappointed. letters sag downward one by one and turn grey-blue
  S['droop-sigh'] = {
    label: '시무룩 처짐(실망·아쉬움)', group: { maxChars: portrait ? 10 : 20, maxWords: portrait ? 3 : 6 },
    build(ph, el) { charLine(ph, el, 'CapCalm,CapMain,CapBase,sans-serif'); },
    update(ph, t) { ph.words.forEach((w, k) => { const vis = t >= w.start - 0.02; ph.els[k].style.opacity = vis ? 1 : 0; const n = ph.chars[k].length; ph.chars[k].forEach((c, i) => { const p = easeOut((t - w.start - i * 0.05) / en(0.6)); c.style.transform = `translateY(${(p * 0.12 * (0.4 + i / n)).toFixed(3)}em) rotate(${(p * (w === ph.key ? 5 : 2)).toFixed(1)}deg)`; c.style.color = `rgb(${(255 - 95 * p) | 0},${(255 - 70 * p) | 0},${(255 - 40 * p) | 0})`; c.style.opacity = (1 - 0.25 * p).toFixed(3); }); }); },
  };
  // E7. boom-shake : shock / strong emphasis. yellow display letters slam and the caption shakes
  S['boom-shake'] = {
    label: '쾅 충격(강조)', slack: 1.2, noFade: true, scale: 1.2, group: { maxChars: portrait ? 7 : 12, maxWords: 2 },
    build(ph, el) { const ln = mk('div', 'ln', el); ln.style.fontFamily = DISP; ln.style.fontWeight = 400; ln.style.lineHeight = '1.0'; ph.wrap = ln; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); s.style.color = '#FFE14D'; s.style.textShadow = OUT(0.06) + ',0 .06em 0 #b8860b'; return s; }); },
    update(ph, t) { const d = t - ph.key.start, a = d >= 0 ? Math.exp(-d * 9) : 0; ph.wrap.style.transform = `translate(${(rnd(1, t, 40) * 0.22 * a).toFixed(3)}em,${(rnd(2, t, 40) * 0.18 * a).toFixed(3)}em) rotate(${(rnd(3, t, 40) * 5 * a).toFixed(2)}deg)`; ph.words.forEach((w, k) => { const vis = t >= w.start - 0.01, p = easeOut((t - w.start) / en(0.12)); ph.els[k].style.opacity = vis ? 1 : 0; ph.els[k].style.transform = `scale(${(vis ? 1.5 - 0.5 * p : 1.5).toFixed(3)})`; }); },
  };

  // L1. neon-flicker : neon sign title. glowing letters flicker on, then hold steady
  S['neon-flicker'] = {
    label: '네온 깜빡(형광등 제목)', group: { maxChars: portrait ? 9 : 18, maxWords: portrait ? 3 : 5 },
    build(ph, el) { const ln = mk('div', 'ln', el); ln.style.fontFamily = DISP; ln.style.fontWeight = 400; ph.els = ph.words.map((w) => { const c = w === ph.key ? PAL.accent2 : '#7DF9FF'; const s = mk('span', 'w', ln, w.text); s.style.color = '#F4FFFF'; s.style.textShadow = `0 0 .04em #fff,0 0 .14em ${c},0 0 .32em ${c},0 0 .6em ${c}aa,0 .04em .08em rgba(0,0,0,.6)`; return s; }); },
    update(ph, t) { ph.words.forEach((w, k) => { const d = t - w.start; let o = 0; if (d >= 0) o = d > en(0.45) ? 1 : (rnd(k + 5, t, 24) > -0.1 ? 1 : 0.15); ph.els[k].style.opacity = o; }); },
  };
  // L2. duo-tight : two lines with tight leading. small lead line on top, big line below (--line-ratio, --line-gap)
  S['duo-tight'] = {
    label: '두 줄 촘촘(작은 줄+큰 줄)', group: { maxChars: portrait ? 13 : 24, maxWords: portrait ? 5 : 8 },
    build(ph, el, mix) {
      const col = mk('div', 'col', el); col.style.rowGap = ((D.lineGap ?? 6) * U) + 'px'; const R = D.lineRatio || 0.45;
      const cut = Math.max(1, Math.floor(ph.words.length / 2)); const top = ph.words.slice(0, cut), bot = ph.words.slice(cut);
      const big = bot.length ? bot : top, small = bot.length ? top : [], B = 1.35;
      const r1 = mk('div', 'ln', col); r1.style.fontSize = Math.max(0.66, B * R).toFixed(3) + 'em'; r1.style.lineHeight = '1.0';
      const r2 = mk('div', 'ln', col); r2.style.fontSize = B + 'em'; r2.style.lineHeight = '0.98'; r2.style.fontFamily = DISP; r2.style.fontWeight = 400;
      ph.els = []; small.forEach((w) => { const s = mk('span', 'w', r1, w.text); s.style.textShadow = OUT(0.08); ph.els[ph.words.indexOf(w)] = s; });
      big.forEach((w) => { const s = mk('span', 'w', r2, w.text); s.style.textShadow = OUT(0.05); s.style.color = w === ph.key ? keyColor(ph, mix) : '#fff'; ph.els[ph.words.indexOf(w)] = s; });
    },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k], vis = t >= w.start - 0.02; smallEnter(s, (t - w.start) / en(0.18), true); if (!vis) { s.style.opacity = 0.38; s.style.transform = 'none'; } }); }, // unspoken words wait dimmed, so both lines keep their final layout
  };
  // L3. rise-lines : each line rises from behind an invisible edge, one line after another
  S['rise-lines'] = {
    label: '줄마다 올라오기', group: { maxChars: portrait ? 13 : 26, maxWords: portrait ? 5 : 8 },
    build(ph, el) {
      const col = mk('div', 'col', el); ph.lines = []; ph.els = []; const per = portrait ? 2 : 4;
      for (let i = 0; i < ph.words.length; i += per) { const clip = mk('div', 'ln', col); clip.style.overflow = 'hidden'; clip.style.padding = '0 .1em .08em'; const inner = mk('div', 'ln', clip); const ws = ph.words.slice(i, i + per); ws.forEach((w) => { const s = mk('span', 'w', inner, w.text); s.style.textShadow = OUT(0.06); if (w === ph.key) s.style.color = PAL.accent; ph.els[ph.words.indexOf(w)] = s; }); ph.lines.push({ inner, at: ws[0].start }); }
    },
    update(ph, t) { ph.lines.forEach((l) => { const p = easeExpo((t - l.at + 0.04) / en(0.32)); l.inner.style.transform = `translateY(${t < l.at - 0.04 ? 110 : ((1 - p) * 110).toFixed(2)}%)`; l.inner.style.opacity = t < l.at - 0.04 ? 0 : 1; l.inner.querySelectorAll('.w').forEach((e) => { e.style.opacity = t < l.at - 0.04 ? 0 : 1; }); }); },
  };
  // L4. num-box : numbers / key terms sit in a box that draws itself while spoken (prices, dates, clauses)
  S['num-box'] = {
    label: '숫자 상자(조항·숫자 강조)', slack: 1.08, group: { maxChars: portrait ? 11 : 22, maxWords: portrait ? 4 : 6 },
    build(ph, el) {
      const ln = mk('div', 'ln', el); ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); s.style.textShadow = OUT(0.06);
        if (w === ph.key) { Object.assign(s.style, { padding: '.02em .22em', color: PAL.accent, fontFamily: DISP, fontWeight: 400, isolation: 'isolate' }); const b = mk('i', 'bx', s); Object.assign(b.style, { position: 'absolute', inset: '0', border: `.07em solid ${PAL.accent}`, borderRadius: '.12em', background: 'rgba(0,0,0,.4)', zIndex: -1, clipPath: 'inset(0 100% 0 0)' }); s.bx = b; }
        return s; });
    },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k]; s.style.opacity = t >= w.start - 0.03 ? 1 : 0.35; if (s.bx) s.bx.style.clipPath = `inset(0 ${((1 - easeOut((t - w.start) / en(0.3))) * 100).toFixed(1)}% 0 0)`; }); },
  };
  // L5. chip-pop : the key word pops out of a centred pill; pill and word share one centre (no drift)
  S['chip-pop'] = {
    label: '칩 팝아웃(가운데 맞춤)', slack: 1.25, group: { maxChars: portrait ? 11 : 22, maxWords: portrait ? 4 : 6 },
    build(ph, el, mix) { const c = keyColor(ph, mix); buildRows(ph, el, '0.74em', (ks) => Object.assign(ks.style, { fontFamily: DISP, fontWeight: 400, fontSize: '1.45em', color: '#111', padding: '.08em .45em .1em', background: c === '#FFFFFF' ? PAL.accent : c, borderRadius: '1em', transformOrigin: '50% 50%', boxShadow: '0 .08em .3em rgba(0,0,0,.4)' })); },
    update(ph, t) { ph.words.forEach((w) => { const s = ph.els[w.i], vis = t >= w.start - 0.01, p = (t - w.start) / en(0.24); if (w === ph.key) { s.style.opacity = vis ? 1 : 0; s.style.transform = `scale(${(vis ? 0.4 + 0.6 * easeBack(p) : 0.4).toFixed(3)})`; } else smallEnter(s, p, vis); }); },
  };
  // L6. mask-slide : words slide up out of a hidden slot, word by word (clean, editorial)
  S['mask-slide'] = {
    label: '가림막 밀어 올리기', group: { maxChars: portrait ? 11 : 22, maxWords: portrait ? 4 : 7 },
    build(ph, el) { const ln = mk('div', 'ln', el); ph.els = []; ph.inn = ph.words.map((w, k) => { const s = mk('span', 'w', ln); s.style.overflow = 'hidden'; s.style.verticalAlign = 'bottom'; s.style.padding = '0 .04em .1em'; const i = mk('span', 'c', s, w.text); i.style.display = 'inline-block'; i.style.textShadow = OUT(0.06); if (w === ph.key) i.style.color = PAL.accent2; ph.els[k] = s; return i; }); },
    update(ph, t) { ph.words.forEach((w, k) => { const p = easeExpo((t - w.start + 0.03) / en(0.28)); ph.inn[k].style.transform = `translateY(${t < w.start - 0.03 ? 110 : ((1 - p) * 110).toFixed(2)}%)`; }); },
  };
  // L7. flip-card : a dark card flips forward in 3D, then the words light up as spoken
  S['flip-card'] = {
    label: '3D 뒤집기 카드', group: { maxChars: portrait ? 12 : 24, maxWords: portrait ? 4 : 7 },
    build(ph, el) { el.style.perspective = '12em'; const card = mk('div', 'card', el); Object.assign(card.style, { background: 'linear-gradient(160deg,rgba(28,30,48,.92),rgba(10,10,18,.92))', borderRadius: '.22em', padding: '.18em .55em .24em', border: `.04em solid ${PAL.accent}88`, transformOrigin: '50% 0%', boxShadow: '0 .25em .7em rgba(0,0,0,.5)', fontSize: '.92em' }); const ln = mk('div', 'ln', card); ph.card = card; ph.els = ph.words.map((w) => mk('span', 'w', ln, w.text)); },
    update(ph, t) { const p = clamp((t - ph.vs) / en(0.42)); ph.card.style.transform = `rotateX(${(p < 1 ? 90 * (1 - easeBack(p)) : 0).toFixed(1)}deg)`; ph.words.forEach((w, k) => { ph.els[k].style.color = t >= w.start - 0.02 ? (w === ph.key ? PAL.accent : '#fff') : 'rgba(255,255,255,.4)'; }); },
  };

  // D1. glitch-split : digital glitch. colour channels split and the word jumps sideways for a moment, then settles
  S['glitch-split'] = {
    label: '글리치(디지털 깨짐)', slack: 1.1, group: { maxChars: portrait ? 9 : 18, maxWords: portrait ? 3 : 5 },
    build(ph, el) { const ln = mk('div', 'ln', el); ln.style.fontFamily = DISP; ln.style.fontWeight = 400; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); if (w === ph.key) s.style.color = PAL.accent; return s; }); },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k], d = t - w.start, vis = d >= -0.02, g = vis && d < en(0.35) ? 1 - Math.max(0, d) / en(0.35) : 0; s.style.opacity = vis ? 1 : 0; s.style.transform = `translateX(${(rnd(k, t, 20) * 0.16 * g).toFixed(3)}em) skewX(${(rnd(k + 9, t, 20) * 18 * g).toFixed(1)}deg)`; const o = (0.04 + 0.06 * g).toFixed(3); s.style.textShadow = `${o}em 0 0 rgba(255,40,90,.85),-${o}em 0 0 rgba(40,220,255,.85),` + OUT(0.05); s.style.clipPath = g > 0.3 && rnd(k + 3, t, 20) > 0.2 ? `inset(${(30 + rnd(k + 4, t, 20) * 40).toFixed(0)}% 0 0 0)` : 'none'; }); },
  };
  // D2. script-write : handwriting reveal. each word is written left to right with a pen dot (hand font)
  S['script-write'] = {
    label: '손글씨 쓰기', group: { maxChars: portrait ? 10 : 20, maxWords: portrait ? 3 : 6 },
    build(ph, el) { const ln = mk('div', 'ln', el); ln.style.fontFamily = 'CapHand,CapMain,CapBase,sans-serif'; ln.style.fontWeight = 700; ln.style.fontSize = '1.15em'; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); s.style.textShadow = OUT(0.07); s.style.color = w === ph.key ? PAL.accent : '#fff'; const dot = mk('i', 'pen', s); Object.assign(dot.style, { position: 'absolute', top: '58%', width: '.14em', height: '.14em', borderRadius: '50%', background: '#fff', boxShadow: `0 0 .2em ${PAL.accent}` }); s.pen = dot; return s; }); },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k], p = clamp((t - w.start) / Math.max(en(0.2), w.dur * 0.9)); s.style.clipPath = `inset(-20% ${((1 - p) * 100).toFixed(1)}% -20% 0)`; s.style.opacity = p > 0 ? 1 : 0; s.pen.style.left = `calc(${(p * 100).toFixed(1)}% - .14em)`; s.pen.style.opacity = p > 0 && p < 1 ? 1 : 0; }); },
  };
  // D3. speech-bubble : comic speech bubble with a tail, dark text, pops from its tail
  S['speech-bubble'] = {
    label: '말풍선', slack: 1.25, group: { maxChars: portrait ? 11 : 22, maxWords: portrait ? 4 : 6 },
    build(ph, el) { const card = mk('div', 'card', el); Object.assign(card.style, { background: '#FFFDF6', color: '#16161c', borderRadius: '.7em', padding: '.16em .6em .22em', position: 'relative', fontSize: '.9em', border: '.05em solid #16161c', boxShadow: '.08em .1em 0 #16161c', transformOrigin: '22% 120%' }); const tail = mk('i', 'tail', card); Object.assign(tail.style, { position: 'absolute', left: '16%', bottom: '-.3em', width: '.5em', height: '.5em', background: '#FFFDF6', borderRight: '.05em solid #16161c', borderBottom: '.05em solid #16161c', transform: 'rotate(45deg)' }); const ln = mk('div', 'ln', card); ph.card = card; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); if (w === ph.key) s.style.color = '#E0475B'; return s; }); },
    update(ph, t) { const p = (t - ph.vs) / en(0.26); ph.card.style.transform = `scale(${(0.3 + 0.7 * easeBack(p)).toFixed(3)})`; ph.words.forEach((w, k) => { ph.els[k].style.opacity = t >= w.start - 0.03 ? 1 : 0.25; }); },
  };
  // D4. marker-swipe : a translucent highlighter is dragged across the key word (slightly tilted, uneven ends)
  S['marker-swipe'] = {
    label: '형광펜 칠하기', group: { maxChars: portrait ? 11 : 22, maxWords: portrait ? 4 : 7 },
    build(ph, el) { const ln = mk('div', 'ln', el); ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); s.style.textShadow = OUT(0.06); if (w === ph.key) { s.style.isolation = 'isolate'; const m = mk('i', 'mk', s); Object.assign(m.style, { position: 'absolute', left: '-.12em', right: '-.12em', top: '.42em', bottom: '.02em', background: `${PAL.accent}b0`, borderRadius: '.25em .08em .3em .1em', transform: 'rotate(-2deg) scaleX(0)', transformOrigin: 'left center', zIndex: -1 }); s.mk = m; } return s; }); },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k]; s.style.opacity = t >= w.start - 0.03 ? 1 : 0.6; if (s.mk) s.mk.style.transform = `rotate(-2deg) scaleX(${easeOut((t - w.start) / en(0.32)).toFixed(3)})`; }); },
  };
  // D5. bounce-word : each word drops in and bounces before resting
  S['bounce-word'] = {
    label: '통통 튀는 단어', slack: 1.05, group: { maxChars: portrait ? 10 : 20, maxWords: portrait ? 3 : 6 },
    build(ph, el, mix) { const ln = mk('div', 'ln', el); ln.style.fontFamily = DISP; ln.style.fontWeight = 400; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); s.style.textShadow = OUT(0.055); if (w === ph.key) s.style.color = keyColor(ph, mix); return s; }); },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k], d = (t - w.start) / SPD, vis = d >= -0.02; const y = vis ? -0.6 * Math.exp(-Math.max(0, d) * 6) * Math.abs(Math.cos(Math.max(0, d) * 13)) : -0.6; s.style.opacity = vis ? 1 : 0; s.style.transform = `translateY(${y.toFixed(3)}em)`; }); },
  };
  // D6. wobble-outline : a second outline wobbles around the letters (playful titles)
  S['wobble-outline'] = {
    label: '흔들 윤곽선', slack: 1.08, group: { maxChars: portrait ? 8 : 16, maxWords: portrait ? 3 : 5 },
    build(ph, el) { const ln = mk('div', 'ln', el); ln.style.fontFamily = DISP; ln.style.fontWeight = 400; ln.style.fontSize = '1.2em'; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); Object.assign(s.style, { color: w === ph.key ? PAL.accent : '#fff', webkitTextStroke: '.025em #111', isolation: 'isolate' }); const g = mk('span', 'g', s, w.text); Object.assign(g.style, { position: 'absolute', left: 0, top: 0, color: 'transparent', webkitTextStroke: `.035em ${w === ph.key ? '#fff' : PAL.accent}`, zIndex: -1 }); s.g = g; return s; }); },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k], vis = t >= w.start - 0.02; s.style.opacity = vis ? 1 : 0; const a = t * 9 + k; s.g.style.transform = `translate(${(Math.cos(a) * 0.05).toFixed(3)}em,${(Math.sin(a * 1.3) * 0.05).toFixed(3)}em)`; s.style.transform = `scale(${(vis ? 0.85 + 0.15 * easeBack((t - w.start) / en(0.2)) : 0.85).toFixed(3)})`; }); },
  };
  // D7. grad-shift : letters carry a slowly flowing colour gradient (palette colours), lighting up as spoken
  S['grad-shift'] = {
    label: '색 흐름 그라데이션', group: { maxChars: portrait ? 10 : 20, maxWords: portrait ? 3 : 6 },
    build(ph, el) { const ln = mk('div', 'ln', el); ln.style.fontFamily = DISP; ln.style.fontWeight = 400; ln.style.fontSize = '1.1em'; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); Object.assign(s.style, { backgroundImage: `linear-gradient(100deg,${PAL.accent},#ffffff 35%,${PAL.accent2} 65%,${PAL.accent})`, backgroundSize: '300% 100%', webkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 .03em .02em rgba(0,0,0,.9)) drop-shadow(0 0 .06em rgba(0,0,0,.8))' }); return s; }); },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k]; s.style.backgroundPosition = `${((t * 40 + k * 30) % 300).toFixed(1)}% 0`; s.style.opacity = t >= w.start - 0.03 ? 1 : 0.3; }); },
  };
  // D8. chorus-zoom : for song hooks. the whole line slowly zooms toward the viewer with a soft glow
  S['chorus-zoom'] = {
    label: '후렴 확대(노래)', slack: 1.15, group: { maxChars: portrait ? 10 : 20, maxWords: portrait ? 4 : 6 },
    build(ph, el, mix) { const ln = mk('div', 'ln', el); ln.style.fontFamily = DISP; ln.style.fontWeight = 400; ph.wrap = ln; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); s.style.textShadow = OUT(0.05) + `,0 0 .4em ${PAL.accent}66`; if (w === ph.key) s.style.color = keyColor(ph, mix); return s; }); },
    update(ph, t) { const p = clamp((t - ph.vs) / Math.max(0.5, ph.ve - ph.vs)); ph.wrap.style.transform = `scale(${(0.92 + 0.2 * p).toFixed(4)})`; ph.words.forEach((w, k) => { ph.els[k].style.opacity = t >= w.start - 0.03 ? 1 : 0.45; }); },
  };
  // D9. ink-seal : a red square seal is pressed onto the key word (blur -> sharp, slight squash)
  S['ink-seal'] = {
    label: '도장 꾹', slack: 1.2, group: { maxChars: portrait ? 11 : 22, maxWords: portrait ? 4 : 6 },
    build(ph, el) { buildRows(ph, el, '0.7em', (ks) => Object.assign(ks.style, { fontFamily: DISP, fontWeight: 400, fontSize: '1.4em', color: '#E5372B', border: '.08em solid #E5372B', borderRadius: '.14em', padding: '0 .2em .04em', background: 'rgba(255,250,240,.92)', boxShadow: '0 .05em .15em rgba(0,0,0,.4)' })); },
    update(ph, t) { ph.words.forEach((w) => { const s = ph.els[w.i], vis = t >= w.start - 0.01, p = clamp((t - w.start) / en(0.2)); if (w === ph.key) { const sc = vis ? 1.6 - 0.6 * easeOut(p) : 1.6; s.style.opacity = vis ? 1 : 0; s.style.filter = `blur(${((1 - p) * 0.06).toFixed(3)}em)`; s.style.transform = `rotate(-6deg) scale(${sc.toFixed(3)},${(sc - 0.06 * Math.sin(Math.PI * p)).toFixed(3)})`; } else smallEnter(s, (t - w.start) / en(0.16), vis); }); },
  };


  // ======== v1.2 batch A (2026-10-30): lyric / kinetic ========
  // A1. stagger-center : letters appear from the middle of the word outward (stagger-from-centre idea)
  S['stagger-center'] = {
    label: '가운데부터 퍼지기', group: { maxChars: portrait ? 10 : 20, maxWords: portrait ? 3 : 6 },
    build(ph, el) { charLine(ph, el, DISP); ph.words.forEach((w, k) => { if (w === ph.key) ph.els[k].style.color = PAL.accent; }); },
    update(ph, t) { ph.words.forEach((w, k) => { const cs = ph.chars[k], mid = (cs.length - 1) / 2; ph.els[k].style.opacity = t >= w.start - 0.03 ? 1 : 0; cs.forEach((c, i) => { const p = easeBack((t - w.start - Math.abs(i - mid) * en(0.05)) / en(0.22)); c.style.opacity = clamp(p * 3); c.style.transform = `scale(${(0.3 + 0.7 * p).toFixed(3)})`; }); }); },
  };
  // A2. split-reveal : the word opens from its centre line, top and bottom halves parting like a curtain
  S['split-reveal'] = {
    label: '위아래 갈라 열기', group: { maxChars: portrait ? 10 : 20, maxWords: portrait ? 3 : 6 },
    build(ph, el, mix) { const ln = mk('div', 'ln', el); ln.style.fontFamily = DISP; ln.style.fontWeight = 400; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); s.style.textShadow = OUT(0.055); if (w === ph.key) s.style.color = keyColor(ph, mix); return s; }); },
    update(ph, t) { ph.words.forEach((w, k) => { const p = easeOut((t - w.start + 0.02) / en(0.25)), h = ((1 - p) * 50).toFixed(1); ph.els[k].style.clipPath = `inset(${h}% -10% ${h}% -10%)`; ph.els[k].style.opacity = t >= w.start - 0.03 ? 1 : 0; }); },
  };
  // A3. rubber-stretch : the word lands stretched wide, then snaps back like rubber
  S['rubber-stretch'] = {
    label: '고무줄 늘이기', slack: 1.15, group: { maxChars: portrait ? 8 : 16, maxWords: portrait ? 2 : 4 },
    build(ph, el, mix) { const ln = mk('div', 'ln', el); ln.style.fontFamily = DISP; ln.style.fontWeight = 400; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); s.style.textShadow = OUT(0.055); if (w === ph.key) s.style.color = keyColor(ph, mix); return s; }); },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k], d = (t - w.start) / SPD, vis = d >= -0.02, a = vis ? Math.exp(-Math.max(0, d) * 7) * Math.cos(Math.max(0, d) * 22) : 0; s.style.opacity = vis ? 1 : 0; s.style.transform = `scale(${(1 + 0.12 * a).toFixed(3)},${(1 - 0.12 * a).toFixed(3)})`; }); },
  };
  // A4. spin-in : letters spin into place one after another
  S['spin-in'] = {
    label: '빙글 들어오기', slack: 1.05, group: { maxChars: portrait ? 9 : 18, maxWords: portrait ? 3 : 5 },
    build(ph, el) { charLine(ph, el, DISP); ph.words.forEach((w, k) => { if (w === ph.key) ph.els[k].style.color = PAL.accent2; }); },
    update(ph, t) { ph.words.forEach((w, k) => { ph.els[k].style.opacity = t >= w.start - 0.03 ? 1 : 0; ph.chars[k].forEach((c, i) => { const p = easeOut((t - w.start - i * en(0.04)) / en(0.3)); c.style.opacity = clamp(p * 2); c.style.transform = `rotate(${((1 - p) * -200).toFixed(1)}deg) scale(${(0.4 + 0.6 * p).toFixed(3)})`; }); }); },
  };
  // A5. blur-focus : the spoken word comes into focus quickly (0.2 s, never a long blur)
  S['blur-focus'] = {
    label: '흐림에서 선명', group: { maxChars: portrait ? 11 : 22, maxWords: portrait ? 4 : 6 },
    build(ph, el, mix) { const ln = mk('div', 'ln', el); ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); s.style.textShadow = OUT(0.06); if (w === ph.key) s.style.color = keyColor(ph, mix); return s; }); },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k], p = easeOut((t - w.start + 0.02) / en(0.2)); s.style.opacity = t >= w.start - 0.03 ? (0.3 + 0.7 * p).toFixed(3) : 0; s.style.filter = `blur(${((1 - p) * 0.08).toFixed(3)}em)`; s.style.transform = `scale(${(1.08 - 0.08 * p).toFixed(3)})`; }); },
  };
  // A6. slot-roll : letters roll up into place like a slot machine reel
  S['slot-roll'] = {
    label: '슬롯 굴리기', group: { maxChars: portrait ? 10 : 20, maxWords: portrait ? 3 : 6 },
    build(ph, el) { const ln = mk('div', 'ln', el); ln.style.fontFamily = DISP; ln.style.fontWeight = 400; ph.chars = []; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, ''); s.style.overflow = 'hidden'; s.style.verticalAlign = 'bottom'; s.style.padding = '0 .03em .06em'; if (w === ph.key) s.style.color = PAL.accent; ph.chars.push([...w.text].map((ch) => { const i = mk('span', 'c', s, ch); i.style.display = 'inline-block'; i.style.textShadow = OUT(0.06); return i; })); return s; }); },
    update(ph, t) { ph.words.forEach((w, k) => { ph.chars[k].forEach((c, i) => { const p = easeBack((t - w.start - i * en(0.035)) / en(0.26)); c.style.transform = `translateY(${t < w.start - 0.03 ? 120 : ((1 - p) * 120).toFixed(1)}%)`; }); }); },
  };
  // A7. echo-trail : two fading ghost copies trail behind the word and catch up
  S['echo-trail'] = {
    label: '잔상 겹치기', slack: 1.1, group: { maxChars: portrait ? 9 : 18, maxWords: portrait ? 3 : 5 },
    build(ph, el, mix) { const ln = mk('div', 'ln', el); ln.style.fontFamily = DISP; ln.style.fontWeight = 400; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); s.style.isolation = 'isolate'; s.style.textShadow = OUT(0.055); if (w === ph.key) s.style.color = keyColor(ph, mix); s.g = [1, 2].map((n) => { const g = mk('span', 'g', s, w.text); Object.assign(g.style, { position: 'absolute', left: 0, top: 0, color: n === 1 ? PAL.accent : PAL.accent2, zIndex: -1, textShadow: 'none' }); return g; }); return s; }); },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k], p = easeOut((t - w.start) / en(0.4)); s.style.opacity = t >= w.start - 0.02 ? 1 : 0; s.g.forEach((g, n) => { g.style.transform = `translate(${((1 - p) * -0.18 * (n + 1)).toFixed(3)}em,${((1 - p) * 0.06 * (n + 1)).toFixed(3)}em)`; g.style.opacity = ((1 - p) * (0.7 - n * 0.25)).toFixed(3); }); }); },
  };
  // A8. swing-hang : the line hangs from a pin above and swings to rest
  S['swing-hang'] = {
    label: '매달려 흔들', slack: 1.1, group: { maxChars: portrait ? 9 : 16, maxWords: portrait ? 3 : 5 },
    build(ph, el, mix) { const ln = mk('div', 'ln', el); ln.style.transformOrigin = '50% -40%'; ph.wrap = ln; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); s.style.textShadow = OUT(0.06); if (w === ph.key) s.style.color = keyColor(ph, mix); return s; }); },
    update(ph, t) { const d = Math.max(0, t - ph.vs) / SPD; ph.wrap.style.transform = `rotate(${(9 * Math.exp(-d * 3.2) * Math.cos(d * 9)).toFixed(2)}deg)`; ph.words.forEach((w, k) => { ph.els[k].style.opacity = t >= w.start - 0.03 ? 1 : 0.3; }); },
  };
  // A9. drop-letters : letters drop from above one by one and land
  S['drop-letters'] = {
    label: '글자 비 내리기', group: { maxChars: portrait ? 9 : 18, maxWords: portrait ? 3 : 5 },
    build(ph, el) { charLine(ph, el); ph.words.forEach((w, k) => { if (w === ph.key) ph.els[k].style.color = PAL.accent; }); },
    update(ph, t) { ph.words.forEach((w, k) => { ph.els[k].style.opacity = t >= w.start - 0.03 ? 1 : 0; ph.chars[k].forEach((c, i) => { const p = clamp((t - w.start - i * en(0.04)) / en(0.24)); const y = p < 1 ? -0.7 * (1 - p * p) : 0; c.style.opacity = clamp(p * 3); c.style.transform = `translateY(${y.toFixed(3)}em)`; }); }); },
  };
  // A10. skew-slide : words rush in from the right, leaning forward, then stand straight
  S['skew-slide'] = {
    label: '기울어 미끄러지기', group: { maxChars: portrait ? 10 : 20, maxWords: portrait ? 3 : 6 },
    build(ph, el, mix) { const ln = mk('div', 'ln', el); ln.style.fontFamily = DISP; ln.style.fontWeight = 400; ln.style.fontStyle = 'normal'; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); s.style.textShadow = OUT(0.055); if (w === ph.key) s.style.color = keyColor(ph, mix); return s; }); },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k], p = easeExpo((t - w.start + 0.02) / en(0.3)); s.style.opacity = t >= w.start - 0.03 ? clamp(p * 2) : 0; s.style.transform = `translateX(${((1 - p) * 0.8).toFixed(3)}em) skewX(${((1 - p) * -22).toFixed(1)}deg)`; }); },
  };

  // ---------- mix: one style per phrase ----------
  const MIX_BASE = ['block-sweep', 'line-rise', 'chip-label', 'lead-big', 'underline-ink', 'stack-kinetic', 'karaoke-fill', 'mask-slide', 'marker-swipe', 'rise-lines'];
  const MIX_KEY = ['hero-key', 'stamp', 'lead-big'];
  // emotion / sound words -> emotion motion (at most D.fxMax per video, default 4, at least 3 s apart; --fx off turns it off)
  const FX = [
    ['boom-shake', /쾅|펑|충격|반전|미쳤|절대|최악|폭발/],
    ['jolt-pop', /깜짝|헉|대박|놀라|세상에|어머/],
    ['heart-thump', /설레|두근|심쿵|사랑|반했|좋아해/],
    ['jitter-nerve', /덜덜|무서|긴장|떨려|급해|큰일|위험|어떡/],
    ['droop-sigh', /아쉽|실망|시무룩|슬퍼|슬프|망했|우울|힘들|피곤/],
    ['tilt-wonder', /궁금|갸웃|왜\?|뭐지|이상하|정말\?|진짜\?/],
    ['sway-breeze', /살랑|여유|편안|느긋|기분 ?좋|행복|산책|바람/],
  ];
  let fxUsed = 0, fxLast = -99;
  function fxFor(ph) {
    if (D.fx === 'off' || fxUsed >= (D.fxMax ?? 4) || ph.start - fxLast < 3) return null;
    const txt = ph.words.map((w) => w.text).join(' ');
    for (const [sid, re] of FX) if (re.test(txt)) { fxUsed++; fxLast = ph.start; return sid; }
    return null;
  }
  function planFor(ph, hist) {
    for (const r of D.plan || []) if (ph.start >= r.from && ph.start < r.to && S[r.style]) return r.style;
    const fx = fxFor(ph); if (fx) return fx;
    let pool;
    if (ph.hook && D.hook !== 'off') pool = ['hero-key', 'impact-wide', 'stack-kinetic', 'stamp', 'chorus-zoom', 'neon-flicker'];
    else if (ph.words.length <= 2) pool = ['pop-word', 'hero-key'];
    else if (ph.hasNum) pool = ['hero-key', 'chip-label', 'num-box'];
    else if (ph.hasEmph) pool = MIX_KEY;
    else pool = MIX_BASE;
    const recent = hist.slice(-2);
    let cand = pool.filter((s) => !recent.includes(s));
    if (!cand.length) cand = pool.filter((s) => s !== hist[hist.length - 1]);
    if (!cand.length) cand = pool;
    return cand[ph.k % cand.length];
  }

  // ---------- engine ----------
  const isMix = styleId === 'mix';
  if (!isMix && !S[styleId]) throw new Error('unknown style ' + styleId + ' / ' + Object.keys(S).join(','));
  const phrases = group(isMix ? { maxChars: portrait ? 12 : 24, maxWords: portrait ? 4 : 7 } : S[styleId].group);
  { const v = phrases.map((p) => p.ve - p.vs).sort((a, b) => a - b); const med = v.length ? v[v.length >> 1] : 1.5; SPD = D.speed ? +D.speed : D.fast === 'off' ? 1 : clamp(med / 1.4, 0.55, 1); window.speedFactor = SPD; }
  // hook / chorus detection: a phrase whose text appears 2+ times (repeated chorus lines) is a hook -> bigger, centred, punchier styles (D.hook = 'off' turns this off)
  // (counted as a piece of the whole text, so a chorus line still counts when it was split into phrases differently the second time)
  { const all = words.map((w) => strip(w.text)).join('').toLowerCase(); const count = (s) => { let n = 0, i = -1; while ((i = all.indexOf(s, i + s.length)) >= 0) n++; return n; }; phrases.forEach((ph) => { ph.hk = ph.words.map((w) => strip(w.text)).join('').toLowerCase(); ph.hook = D.hook !== 'off' && ph.hk.length >= 6 && count(ph.hk) >= 2; }); }
  if (isMix) { const hist = []; phrases.forEach((ph) => { ph.sid = planFor(ph, hist); hist.push(ph.sid); }); window.mixPlan = phrases.map((p) => ({ k: p.k, start: +p.start.toFixed(2), style: p.sid })); }
  else phrases.forEach((ph) => { ph.sid = styleId; });
  if (DECO.has('emoji')) { let prevE = ''; phrases.forEach((ph) => { const order = [ph.key, ...ph.words.filter((w) => w !== ph.key)]; for (const w of order) { const k = emoMatch(strip(w.text)); if (k && EMO[k] !== prevE) { ph.emo = { e: EMO[k], w, at: w.start }; prevE = EMO[k]; break; } } }); }
  let shadeEl = document.getElementById('shade');
  if (!shadeEl && D.shade > 0) { shadeEl = document.createElement('div'); shadeEl.id = 'shade'; root.parentNode.insertBefore(shadeEl, root); }
  if (shadeEl) { const a = D.shade || 0, top = Math.max(0, zone.top - 0.07) * H, bot = Math.min(1, zone.bottom + 0.06) * H; Object.assign(shadeEl.style, { position: 'absolute', left: 0, width: W + 'px', top: top + 'px', height: (bot - top) + 'px', opacity: 0, background: `linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,${a}) 30%, rgba(0,0,0,${a}) 70%, rgba(0,0,0,0))` }); }
  function elFor(ph, w) { const k = ph.words.indexOf(w); for (const c of [ph.els && ph.els[w.i], ph.els && ph.els[k]]) if (c && c.textContent.includes(w.text)) return c; return null; }
  function buildDeco(ph) {
    ph.deco = null; if (!DECO.size) return;
    const br = box.getBoundingClientRect(); const els = [...box.querySelectorAll('.w, .card')]; if (!els.length || !br.width) return;
    let x0 = 1e9, x1 = -1e9; els.forEach((e) => { const r = e.getBoundingClientRect(); if (r.width) { x0 = Math.min(x0, r.left); x1 = Math.max(x1, r.right); } });
    box.style.position = 'relative'; const d = {};
    if (DECO.has('line')) {
      const c = keyColor(ph, isMix); const line = mk('i', 'dec', box); Object.assign(line.style, { left: (x0 - br.left - 6) + 'px', width: (x1 - x0 + 12) + 'px', bottom: '.06em', height: '.085em', background: c, borderRadius: '.05em', transformOrigin: 'left center', transform: 'scaleX(0)', boxShadow: '0 .03em .12em rgba(0,0,0,.6)' });
      const dot = mk('i', 'dec', box); Object.assign(dot.style, { left: (x0 - br.left - 6) + 'px', bottom: '.0em', width: '.2em', height: '.2em', borderRadius: '50%', background: c, marginLeft: '-.06em', boxShadow: '0 .03em .12em rgba(0,0,0,.6)', opacity: 0 });
      d.line = line; d.dot = dot; d.w = x1 - x0 + 12;
    }
    if (ph.emo) {
      const el = elFor(ph, ph.emo.w); const r = el ? el.getBoundingClientRect() : null; let cx = r ? r.left + r.width / 2 - br.left : (x0 + x1) / 2 - br.left;
      const em = mk('span', 'dec', box, ph.emo.e); Object.assign(em.style, { left: cx + 'px', top: '0', fontSize: '1.75em', lineHeight: '1', fontFamily: '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif', filter: 'drop-shadow(0 .05em .08em rgba(0,0,0,.55))', opacity: 0, transformOrigin: '50% 80%' });
      d.emo = em; d.at = ph.emo.at;
    }
    ph.deco = d;
  }
  function updateDeco(ph, t) {
    const d = ph.deco; if (!d) return;
    if (d.line) { const p = easeOut((t - ph.vs) / 0.4); d.line.style.transform = `scaleX(${p})`; d.dot.style.opacity = p > 0.02 ? 1 : 0; d.dot.style.left = `calc(${(d.line.style.left)} + ${(d.w * p).toFixed(1)}px)`; }
    if (d.emo) { const p = (t - d.at) / 0.28, vis = t >= d.at - 0.01; d.emo.style.opacity = vis ? 1 : 0; d.emo.style.transform = `translate(-50%,0) translateY(${vis ? -Math.sin(Math.max(0, t - d.at) * 5) * 0.06 : 0.3}em) scale(${vis ? 0.35 + 0.65 * easeBack(p) : 0.35}) rotate(${(1 - clamp(p)) * -22}deg)`; }
  }
  // ---------- caption POSITIONS: left / right / top / bottom variety, always inside platform-safe areas ----------
  // landscape: nothing below zone.bottom (YouTube caption area stays free); portrait: nothing in the bottom 25%, top 10% and right 10% (app UI)
  const zt = zone.top, zb = zone.bottom, CH = portrait ? (zb - zt) + 0.04 : 0.26, MID = (zt + zb) / 2;
  const pc = (cy) => ({ t: cy - CH / 2, b: cy + CH / 2 }), ptop = (t) => ({ t, b: t + CH });
  const POS = portrait ? {
    'mid-center': { l: .11, r: .89, ...pc(MID), ax: 'c', ay: 'c' }, 'mid-left': { l: .05, r: .80, ...pc(MID), ax: 'l', ay: 'c' }, 'mid-right': { l: .18, r: .88, ...pc(MID), ax: 'r', ay: 'c' },
    'upper-center': { l: .11, r: .89, ...pc(.25), ax: 'c', ay: 'c' }, 'upper-left': { l: .05, r: .80, ...pc(.25), ax: 'l', ay: 'c' }, 'upper-right': { l: .18, r: .88, ...pc(.25), ax: 'r', ay: 'c' },
  } : {
    'bottom-center': { l: .06, r: .94, t: zb - CH - 0.015, b: zb - 0.015, ax: 'c', ay: 'e' }, 'bottom-left': { l: .05, r: .56, t: zb - CH - 0.015, b: zb - 0.015, ax: 'l', ay: 'e' }, 'bottom-right': { l: .44, r: .95, t: zb - CH - 0.015, b: zb - 0.015, ax: 'r', ay: 'e' },
    'top-center': { l: .06, r: .94, ...ptop(.06), ax: 'c', ay: 's' }, 'upper-left': { l: .05, r: .56, ...ptop(.06), ax: 'l', ay: 's' }, 'upper-right': { l: .44, r: .95, ...ptop(.06), ax: 'r', ay: 's' },
    'mid-left': { l: .05, r: .50, ...ptop(.38), ax: 'l', ay: 'c' }, 'mid-right': { l: .50, r: .95, ...ptop(.38), ax: 'r', ay: 'c' }, 'mid-center': { l: .06, r: .94, ...ptop(.38), ax: 'c', ay: 'c' },
  };
  const PDEF = portrait ? 'mid-center' : 'bottom-center';
  const PSEQ_ALL = portrait ? ['mid-center', 'upper-left', 'mid-right', 'upper-right', 'mid-left', 'upper-center'] : ['bottom-center', 'upper-left', 'bottom-right', 'upper-right', 'bottom-left', 'mid-right', 'top-center', 'mid-left'];
  const PSEQ = PSEQ_ALL.filter((p) => !(D.posAvoid || []).includes(p));
  const PMODE = D.pos || 'varied';
  phrases.forEach((ph, i) => {
    let p = null; for (const r of D.posPlan || []) if (ph.start >= r.from && ph.start < r.to && POS[r.pos]) p = r.pos;
    if (!p && ph.hook && D.hook !== 'off' && POS['mid-center'] && !(D.posAvoid || []).includes('mid-center')) p = 'mid-center';
    if (!p) p = POS[PMODE] ? PMODE : PMODE === 'fixed' || !PSEQ.length ? PDEF : PSEQ[i % PSEQ.length];
    ph.pos = p; ph.pos0 = p;
  });
  // smallest allowed text size (px at this frame size): 40 px on 1080p landscape, 50 px on 1080x1920. A phrase that gets smaller than this in a half-width spot moves to the full-width spot of the same band.
  const MINPX = (portrait ? 50 : 40) * U;
  const WIDEN = portrait ? { 'mid-left': 'mid-center', 'mid-right': 'mid-center', 'upper-left': 'upper-center', 'upper-right': 'upper-center' } : { 'bottom-left': 'bottom-center', 'bottom-right': 'bottom-center', 'upper-left': 'top-center', 'upper-right': 'top-center', 'mid-left': 'mid-center', 'mid-right': 'mid-center' };
  Object.defineProperty(window, 'posPlan', { get: () => phrases.map((ph) => ({ k: ph.k, start: +ph.start.toFixed(2), pos: ph.pos, assigned: ph.pos0, minPx: ph.minPx === undefined ? null : +ph.minPx.toFixed(1) })) });
  let curPos = null;
  function applyPos(ph) {
    const P = POS[ph.pos]; curPos = P;
    const jx = { l: 'flex-start', c: 'center', r: 'flex-end' }[P.ax], ay = { s: 'flex-start', c: 'center', e: 'flex-end' }[P.ay];
    Object.assign(root.style, { left: (W * P.l) + 'px', width: (W * (P.r - P.l)) + 'px', top: (H * P.t) + 'px', height: (H * (P.b - P.t)) + 'px', justifyContent: jx, alignItems: ay, textAlign: { l: 'left', c: 'center', r: 'right' }[P.ax] });
    root.style.setProperty('--jc', jx); root.style.setProperty('--ai', jx);
    if (shadeEl) { const a = D.shade || 0, cw = W * (P.r - P.l), ch = H * (P.b - P.t), ex = cw * 0.18, ey = ch * 0.9; const gx = P.ax === 'l' ? 30 : P.ax === 'r' ? 70 : 50, gy = P.ay === 's' ? 38 : P.ay === 'e' ? 62 : 50;
      Object.assign(shadeEl.style, { left: (W * P.l - ex) + 'px', width: (cw + 2 * ex) + 'px', top: (H * P.t - ey) + 'px', height: (ch + 2 * ey) + 'px', background: `radial-gradient(ellipse at ${gx}% ${gy}%, rgba(0,0,0,${a}) 0%, rgba(0,0,0,${(a * 0.85).toFixed(3)}) 42%, rgba(0,0,0,0) 72%)` }); }
  }
  const BEATS = (D.beats || []).slice().sort((a, b) => a - b);
  let mounted = -1, box = null;
  const find = (t) => { let f = null; for (const ph of phrases) { if (t >= ph.vs && t < ph.ve) f = ph; } return f; };
  // faces (D.faces = [{t, boxes:[[x0,y0,x1,y1] as fractions]}] from find-faces.py): a caption must not cover a face. Spots are tried until the text is big enough AND clear of every face seen during the phrase.
  const FACES = D.faces || [];
  const facesFor = (ph) => FACES.filter((s) => s.t >= ph.vs - 0.5 && s.t <= ph.ve + 0.5).flatMap((s) => s.boxes.map((b) => [Math.max(0, b[0] - 0.03), Math.max(0, b[1] - 0.03), Math.min(1, b[2] + 0.03), Math.min(1, b[3] + 0.03)]));
  function faceHit(fb) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; box.querySelectorAll('.w, .card').forEach((e) => { const r = e.getBoundingClientRect(); if (r.width) { x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); } });
    const area = Math.max(1, (x1 - x0) * (y1 - y0)); let hit = 0;
    for (const f of fb) { const ix = Math.max(0, Math.min(x1, f[2] * W) - Math.max(x0, f[0] * W)), iy = Math.max(0, Math.min(y1, f[3] * H) - Math.max(y0, f[1] * H)); hit += ix * iy; }
    return Math.min(1, hit / area);
  }
  function mount(ph) {
    const fb = FACES.length ? facesFor(ph) : []; const avoid = D.posAvoid || [];
    const order = [ph.pos0]; if (WIDEN[ph.pos0]) order.push(WIDEN[ph.pos0]);
    if (fb.length) for (const p of Object.keys(POS)) if (!order.includes(p)) order.push(p);
    const cand = order.filter((p, i) => POS[p] && (i === 0 || !avoid.includes(p)));
    let best = null;
    for (const p of cand) { ph.pos = p; layout(ph); ph.faceHit = fb.length ? faceHit(fb) : 0; const score = (ph.minPx >= MINPX ? 0 : 1) + ph.faceHit * 10; if (!best || score < best.score) best = { p, score }; if (ph.minPx >= MINPX && ph.faceHit <= 0.02) { best = null; break; } }
    if (best && ph.pos !== best.p) { ph.pos = best.p; layout(ph); ph.faceHit = fb.length ? faceHit(fb) : 0; }
    ph.widened = ph.pos !== ph.pos0;
  }
  function layout(ph) {
    const sty = S[ph.sid];
    root.innerHTML = ''; box = mk('div', 'box', root); box.style.willChange = 'opacity';
    applyPos(ph);
    root.style.fontSize = (FS * (sty.scale || 1) * (ph.hook && D.hook !== 'off' ? 1.12 : 1)) + 'px';
    sty.build(ph, box, isMix); mounted = ph.k;
    if (DECO.has('emoji') && ph.emo) box.style.paddingTop = '1.75em'; // room for the emoji above the text
    if (DECO.has('line')) box.style.paddingBottom = '.34em'; // room for the accent line
    // auto-fit: shrink the whole phrase if wider than 90% of the frame (or taller than the portrait band)
    const els = box.querySelectorAll('.w, .card'); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    els.forEach((e) => { const r = e.getBoundingClientRect(); if (!r.width) return; x0 = Math.min(x0, r.left); x1 = Math.max(x1, r.right); y0 = Math.min(y0, r.top); y1 = Math.max(y1, r.bottom); });
    const cw = root.clientWidth, ch = root.clientHeight, bh = box.getBoundingClientRect().height; // box height includes the emoji / line padding
    const slack = sty.slack || 1; let ratio = Math.min(sty.fill || 1, (cw * 0.97) / ((x1 - x0) * slack));
    ratio = Math.min(ratio, (ch * 0.94) / (Math.max(bh, y1 - y0) * slack)); // 6% of the spot's height stays free for pop / swell animations
    box.style.fontSize = (ratio * 100).toFixed(1) + '%';
    // left/right-aligned captions grow toward the frame edge while they pop in (scale up to `slack`): keep that much room on the edge side
    if (curPos.ax !== 'c') { const grow = Math.max(0, ((sty.slack || 1) - 1) / 2) * (x1 - x0) * ratio + 6; if (curPos.ax === 'r') box.style.marginRight = grow + 'px'; else box.style.marginLeft = grow + 'px'; }
    buildDeco(ph);
    const wsz = [...box.querySelectorAll('.w')].map((e) => parseFloat(getComputedStyle(e).fontSize)).filter((n) => n > 0); ph.minPx = wsz.length ? Math.min(...wsz) : 99;
  }
  window.styles = { ...Object.fromEntries(Object.entries(S).map(([k, v]) => [k, v.label])), mix: '자동 섞기' };
  window.DURATION = D.duration;
  // mounts every phrase once and reports the smallest text size and the spot actually used (for QA)
  window.sizeScan = async () => { const out = []; for (const ph of phrases) { await window.seek((ph.vs + ph.ve) / 2); out.push({ k: ph.k, start: +ph.start.toFixed(2), text: ph.words.map((w) => w.text).join(' '), pos: ph.pos, assigned: ph.pos0, widened: !!ph.widened, minPx: +(ph.minPx === undefined ? 99 : ph.minPx).toFixed(1), ok: (ph.minPx === undefined ? 99 : ph.minPx) >= MINPX, faceHit: +(ph.faceHit || 0).toFixed(3) }); } return { minAllowed: +MINPX.toFixed(1), phrases: out }; };
  // QA data for the renderer: reading speed per phrase, and characters a font cannot draw (silently replaced by a fallback font)
  window.phraseStats = () => phrases.map((ph) => { const chars = ph.words.reduce((n, w) => n + [...strip(w.text)].length, 0); const vis = ph.ve - ph.vs; return { k: ph.k, start: +ph.start.toFixed(2), chars, visible: +vis.toFixed(2), cps: +(chars / vis).toFixed(1), text: ph.words.map((w) => w.text).join(' ') }; });
  window.fontCoverage = () => {
    const chars = [...new Set(words.flatMap((w) => [...strip(w.text)]))].filter((c) => !/\s/.test(c));
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const cx = cv.getContext('2d', { willReadFrequently: true });
    const px = (font, ch) => { cx.clearRect(0, 0, 64, 64); cx.font = font; cx.fillText(ch, 4, 48); return cx.getImageData(0, 0, 64, 64).data; };
    const res = {};
    for (const [name, spec] of [['CapMain', '800 40px'], ['CapDisplay', '400 40px'], ['CapCalm', '700 40px'], ['CapHand', '700 40px']]) {
      res[name] = chars.filter((ch) => { const a = px(`${spec} ${name}, "Zzz Fallback"`, ch), b = px(`${spec} "Zzz Fallback"`, ch); for (let i = 3; i < a.length; i += 4) if (a[i] !== b[i]) return false; return true; });
    }
    return res;
  };
  window.visible = (t) => !!find(t);
  window.seek = async (t) => {
    const ph = find(t);
    if (!ph) { root.innerHTML = ''; mounted = -1; if (shadeEl) shadeEl.style.opacity = 0; return; }
    const sty = S[ph.sid];
    if (mounted !== ph.k) { try { mount(ph); } catch (e) { console.error('build ' + ph.sid + ': ' + e.stack); throw e; } }
    box.style.opacity = sty.noFade ? 1 : Math.min(clamp((t - ph.vs) / 0.1), clamp((ph.ve - t) / 0.12));
    try { sty.update(ph, t); } catch (e) { console.error('update ' + ph.sid + ': ' + e.stack); throw e; }
    updateDeco(ph, t); if (shadeEl) shadeEl.style.opacity = box.style.opacity;
    // beat pulse: the whole caption swells a little on every beat of the song (D.beats = beat times in seconds; D.beatStrength default 0.045)
    if (BEATS.length) { let lo = 0, hi = BEATS.length - 1, b = -1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (BEATS[mid] <= t) { b = mid; lo = mid + 1; } else hi = mid - 1; } const dt = b >= 0 ? t - BEATS[b] : 9; box.style.transform = dt < 0.4 ? `scale(${(1 + (D.beatStrength || 0.045) * Math.exp(-dt * 9)).toFixed(4)})` : 'none'; }
  };
  window.posRect = () => (mounted >= 0 && curPos ? { l: curPos.l, r: curPos.r, t: curPos.t, b: curPos.b } : null);
  window.bounds = () => {
    const els = root.querySelectorAll('.w, .card, .dec'); if (!els.length) return null;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    els.forEach((e) => { const r = e.getBoundingClientRect(); if (r.width === 0 || getComputedStyle(e).opacity === '0') return; x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); });
    return x0 > 1e8 ? null : { x0, y0, x1, y1, W, H };
  };
  Promise.all(['800 40px CapBase', '800 40px CapMain', '400 40px CapDisplay', '700 40px CapCalm', '700 40px CapHand'].map((f) => document.fonts.load(f, '가나다ABC'))).then(() => { window.ready = true; });
})();





