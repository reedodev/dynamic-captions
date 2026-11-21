// dynamic-captions runtime (browser side). Loaded by captions.html after data.js (window.CAPDATA).
// Contract for the renderer: window.ready, window.DURATION, window.seek(t), window.visible(t), window.bounds(), window.styles.
// style=mix : every phrase gets its own style (auto plan or D.plan = [{from, to, style}] in seconds).
(() => {
  const P = new URLSearchParams(location.search);
  const D = window.CAPDATA;
  // ---------- demo mode (picker.html): ?demo=<typed text> makes word timings from the text and the page loops by itself ----------
  const DEMO = P.get('demo');
  if (DEMO != null) {
    const ws = (DEMO.trim() || '오늘 내가 꿀템 하나 소개해줄게!').split(/\s+/).slice(0, 16); let t = 0.25;
    D.words = ws.map((w) => { const d = Math.max(0.24, Math.min(0.62, 0.1 * [...w].length + 0.1)); const o = { text: w, start: +t.toFixed(3), end: +(t + d).toFixed(3) }; t += d + 0.06; return o; });
    D.duration = t + 1.3; D.emphasis = P.get('key') ? [P.get('key')] : []; D.faces = []; D.beats = []; D.plan = []; D.posPlan = []; D.pos = 'fixed'; D.pin = null;
    D.overlays = { tags: [], insets: [], sfx: [], titles: [] }; D.sfxAuto = false; D.deco = (D.deco || []).filter((x) => x !== 'emoji'); if (D.emoji) D.emoji = Object.assign({}, D.emoji, { font: null }); /* picker: system emoji font (the 25 MB one is too heavy for dozens of live cards) */ if (P.get('emoji') === '1') { D.deco.push('emoji'); D.emoji = Object.assign({}, D.emoji || {}, { gap: 0 }); }
  }
  const W = D.width, H = D.height, portrait = H > W;
  const styleId = P.get('style') || D.style || 'block-sweep';
  const root = document.getElementById('cap');
  const U = portrait ? W / 1080 : H / 1080;
  const FS = (portrait ? 88 : 64) * U * (D.scale || 1) * (D.fontScale || 1);
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
  // emoji dictionary (v1.4: ~330 Korean + English keys in 12 groups). Longer keys win; one-character keys only match at the start of a word.
  const EMO_DEFAULT = {
    // feelings / reactions
    '사랑': '❤️', '좋아해': '🥰', '행복': '😊', '기뻐': '😆', '기쁘': '😆', '신나': '🥳', '신났': '🥳', '웃': '😄', 'ㅋㅋ': '🤣', 'ㅎㅎ': '😆', 'ㅠㅠ': '😭', 'ㅜㅜ': '😭', '울었': '😢', '울고': '😢', '울어': '😢', '눈물': '😢', '슬퍼': '😢', '슬프': '😢', '화내': '😡', '화나': '😡', '짜증': '😤', '놀라': '😮', '놀랍': '😮', '깜짝': '😲', '헉': '😱', '대박': '🤯', '미쳤': '🤯', '충격': '😱', '무서': '😨', '소름': '🥶', '걱정': '😟', '불안': '😰', '고민': '🤔', '궁금': '🤔', '생각': '💭', '비밀': '🤫', '쉿': '🤫', '졸려': '😪', '졸리': '😪', '잠들': '😴', '꿲잠': '😴', '자요': '😴', '피곤': '🥱', '배고': '🤤', '맛있': '😋', '감사': '🙏', '고마': '🙏', '미안': '🙇', '축하': '🎉', '성공': '🎉', '완벽': '👌', '최고': '🏆', '1등': '🥇', '우승': '🏆', '응원': '📣', '화이팅': '💪', '파이팅': '💪', '힘내': '💪', '부끄': '😳', '설레': '💓', '두근': '💓', '심쿡': '💘', '귀여': '🥰', '귀엽': '🥰', '예뻐': '😍', '예쁘': '😍', '이뻐': '😍', '멋있': '😎', '멋지': '😎', '대단': '👏', '박수': '👏', '잘했': '👏', '칭찬': '👍', '추천': '👍', '좋': '👍', '싫': '🙅', '안돼': '🙅', '금지': '🚫', '별로': '😕', '아쉽': '🥺', '실망': '😞', '한숨': '😮‍💨', '휴우': '😮‍💨', '와우': '😮', '우와': '😮', '헐': '😳', '새까맣': '😱', '확신': '💯', '진심': '💯',
    // check / info / actions
    '정답': '⭕', '오답': '❌', '틀렸': '❌', '체크': '✅', '확인': '✅', '완료': '✅', '끝': '🏁', '시작': '🚀', '출발': '🚀', '도전': '🔥', '꿀팁': '💡', '팁': '💡', '꿀템': '🍯', '꿀': '🍯', '비법': '🔑', '핵심': '🎯', '목표': '🎯', '집중': '🎯', '중요': '❗', '주의': '⚠️', '조심': '⚠️', '위험': '⚠️', '경고': '🚨', '긴급': '🚨', '속보': '🚨', '질문': '❓', '왜': '🤔', '비교': '⚖️', '선택': '👉', '여기': '👉', '클릭': '👆', '구독': '🔔', '좋아요': '👍', '알림': '🔔', '댓글': '💬', '공유': '📤', '저장': '📌', '링크': '🔗', '약속': '🤝', '비싸': '💸', '새로': '🆕', '업데이트': '🆕', '출시': '🚀', '오픈': '🎉', '검색': '🔍', '찾': '🔍', '비결': '🤫', '마법': '🪄', '행운': '🍀', '하트': '💖', '반짝': '✨', '꿈': '💭', '폭발': '💥', '쾅': '💥', '펑': '💥', '불꽃': '🎆', '수업': '🎓', '강의': '🎓', '자막': '💬', '편집': '✂️', '단계': '🪜', '방법': '🛠️',
    // money / shopping
    '돈': '💰', '무료': '🆓', '공짜': '🆓', '꽁짜': '🆓', '할인': '🏷️', '세일': '🏷️', '가격': '💸', '부자': '🤑', '월급': '💵', '투자': '📈', '주식': '📈', '상승': '📈', '올랐': '📈', '하락': '📉', '떨어졌': '📉', '쇼핑': '🛍️', '선물': '🎁', '택배': '📦', '배송': '📦', '이벤트': '🎁', '당첨': '🎊', '카드': '💳', '용돈': '💵', '저축': '🐷',
    // time
    '시간': '⏰', '오늘': '📅', '내일': '📆', '아침': '🌅', '점심': '🍱', '저녁': '🌇', '밤': '🌙', '새벽': '🌌', '주말': '🎈', '월요일': '😩', '금요일': '🥳', '매일': '🔁', '기다': '⏳', '빨리': '⚡', '천천히': '🐢', '조금': '🤏',
    // weather / nature
    '비가': '☔', '빗물': '☔', '날씨': '🌤️', '더워': '🥵', '덥': '🥵', '추워': '🥶', '춥': '🥶', '여름': '🏖️', '겨울': '⛄', '봄': '🌸', '가을': '🍁', '바다': '🌊', '꽃': '🌸', '나무': '🌳', '별': '⭐', '하늘': '☁️', '무지개': '🌈', '바람': '🍃', '불': '🔥', '눈사람': '☃️', '햇살': '☀️', '우주': '🚀', '지구': '🌍', '세계': '🌍', '한국': '🇰🇷',
    // food
    '커피': '☕', '라떼': '☕', '빵': '🍞', '케이크': '🍰', '치킨': '🍗', '피자': '🍕', '라면': '🍜', '밥': '🍚', '고기': '🥩', '맥주': '🍺', '와인': '🍷', '과일': '🍎', '사과': '🍎', '딸기': '🍓', '수박': '🍉', '아이스크림': '🍦', '초콜릿': '🍫', '떡볶이': '🌶️', '김치': '🥬', '다이어트': '🥗', '먹': '😋', '요리': '🍳', '디저트': '🍰', '쿠키': '🍪', '햇버거': '🍔', '초밥': '🍣',
    // tech / work / study
    '컴퓨터': '💻', '노트북': '💻', '핸드폰': '📱', '휴대폰': '📱', '스마트폰': '📱', '앱': '📱', '코딩': '👨‍💻', '코드': '👨‍💻', '인공지능': '🤖', '로봇': '🤖', '영상': '🎬', '사진': '📸', '카메라': '📷', '촬영': '🎥', '메모': '📝', '공부': '📚', '책': '📖', '시험': '📝', '회사': '🏢', '회의': '🗣️', '메일': '📧', '데이터': '📊', '통계': '📊', '그래프': '📊', '아이디어': '💡', '계획': '🗓️', '자동': '⚙️', '설정': '⚙️', '인터넷': '🌐', '유튜브': '▶️', '게임': '🎮',
    // places / travel / sport / hobby
    '여행': '✈️', '비행기': '✈️', '기차': '🚆', '버스': '🚌', '운전': '🚗', '집': '🏠', '학교': '🏫', '병원': '🏥', '카페': '☕', '호텔': '🏨', '캠핑': '🏕️', '산책': '🚶', '운동': '🏃', '헬스': '🏋️', '달리기': '🏃', '축구': '⚽', '야구': '⚾', '농구': '🏀', '골프': '⛳', '음악': '🎵', '노래': '🎤', '춤': '💃', '영화': '🎬', '파티': '🥳', '생일': '🎂', '결혼': '💍', '아기': '👶', '건강': '💪', '아파': '🤕', '아프': '🤕',
    // animals
    '강아지': '🐶', '멍멍': '🐶', '고양이': '🐱', '냥': '🐱', '토끼': '🐰', '곰': '🐻', '용': '🐉', '공룡': '🦖', '다람쥐': '🐿️', '새가': '🐦', '물고기': '🐟', '돌고래': '🐬', '판다': '🐼', '병아리': '🐥',
    // English
    fire: '🔥', perfect: '👌', wow: '😮', love: '❤️', money: '💰', idea: '💡', music: '🎵', bread: '🍞', dragon: '🐉', eat: '😋', free: '🆓', time: '⏰', happy: '😊', sad: '😢', cool: '😎', new: '🆕', tip: '💡', coffee: '☕', food: '😋', sleep: '😴', win: '🏆', best: '🏆', check: '✅', done: '✅', start: '🚀', launch: '🚀', wait: '⏳', question: '❓', secret: '🤫', gift: '🎁', sale: '🏷️', travel: '✈️', dog: '🐶', cat: '🐱', ai: '🤖', video: '🎬', photo: '📸', phone: '📱', game: '🎮', party: '🥳', birthday: '🎂', thanks: '🙏', sorry: '🙇', omg: '😱', lol: '🤣', haha: '😆', warning: '⚠️', important: '❗', goal: '🎯', magic: '🪄', luck: '🍀', star: '⭐', rain: '☔', sun: '☀️', hot: '🥵', cold: '🥶', heart: '💖', crazy: '🤯', amazing: '🤩', easy: '👌', fast: '⚡', book: '📖', study: '📚', work: '💼', home: '🏠' };
  // no keyword: the sentence itself can still get one (laugh / cry / question / short exclamation)
  const emoSent = (txt, ph) => (/ㅋㅋ/.test(txt) ? '🤣' : /ㅎㅎ/.test(txt) ? '😆' : /ㅠㅠ|ㅜㅜ/.test(txt) ? '😭' : /\?!?$/.test(txt) ? '🤔' : ph.words.length <= 4 && /!$/.test(txt) ? '✨' : null);
  const EMO = Object.assign({}, EMO_DEFAULT, D.emojiMap || {});
  const emoKeys = Object.keys(EMO).sort((a, b) => b.length - a.length);
  const EMO_LOW = new Set(['오늘', '내일', '시간', '매일', '아침', '저녁', '점심', '조금', 'time']);
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
  // typography (v1.4): letter spacing / 장평 (horizontal scale) / 기울기 (lean) from the chosen font's profile or --tracking / --width / --slant
  const TYPO = Object.assign({ tracking: 0, width: 100, slant: 0 }, D.typo || {});
  const TF = (+TYPO.width !== 100 || +TYPO.slant) ? `scaleX(${(TYPO.width / 100).toFixed(3)}) skewX(${(+TYPO.slant).toFixed(2)}deg)` : '';
  const RTY = D.roleTypo || {};
  const EMOF = (D.emoji && D.emoji.font ? D.emoji.font + ',' : '') + '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji"';
  const FAM = (f) => `${f},CapMain,CapBase,${EMOF},sans-serif`;
  const useF = (el, f, w = 400) => { el.style.fontFamily = FAM(f); el.style.fontWeight = w; if (RTY[f] && RTY[f].tracking) el.style.letterSpacing = RTY[f].tracking + 'em'; return el; };
  const css = document.createElement('style');
  css.textContent = `
  #cap{font-family:CapMain,CapBase,${EMOF},sans-serif;font-weight:800;font-size:${FS}px;line-height:1.18;color:#fff;font-synthesis:none;letter-spacing:${+TYPO.tracking || 0}em}
  #cap .ln{display:flex;flex-wrap:wrap;justify-content:var(--jc,center);align-items:baseline;column-gap:.3em;row-gap:.06em}
  #cap .w{display:inline-block;position:relative;white-space:nowrap;will-change:transform}
  #cap .col{display:flex;flex-direction:column;align-items:var(--ai,center);row-gap:.02em}
  #cap .dec{position:absolute;pointer-events:none}
  #cap .fx{position:absolute;pointer-events:none;display:block;line-height:0}
  ${D.fontScale > 1 ? '#cap,#cap .ln,#cap .card,#cap .col{line-height:.8 !important}' : ''}
  #cap .fx svg{display:block}
  #cap .v14,#cap .v14 .ln,#cap .v14 .card,#cap .v14 .col,#cap .v14 .pp{line-height:1.12 !important}
  #cap .v14 .card{max-width:var(--cmax,9999px);box-sizing:border-box}
  ${D.rate ? '' : '@font-face{font-family:CapSerif;src:url(fonts/NanumMyeongjo-ExtraBold.ttf);font-weight:800}'}
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
        const p = easeOut((t - w.start) / 0.09), fade = clamp(1 - (t - (w.end + 0.08)) / 0.18);
        s.b.style.transform = `scaleX(${t < w.start ? 0 : p})`; s.b.style.opacity = t < w.end + 0.08 ? 1 : fade;
        const full = on && p >= 0.98; s.style.color = full ? '#0b0b0f' : '#fff'; s.style.textShadow = full ? 'none' : OUT(0.055);
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

  // 20b. broadcast : TV-style subtitle. White bold text with a thin dark outline (no box), the whole line appears at once. Made for --pin (fixed spot). Not part of mix.
  S['broadcast'] = {
    label: '방송 자막(흰 글자+검은 윤곽, 한 줄 한꺼번에)', scale: (D.fontScale || 1) > 1 ? 0.3 : 0.64, group: { maxChars: portrait ? 18 : 34, maxWords: portrait ? 6 : 11 },
    build(ph, el) {
      const ln = mk('div', 'ln', el); ln.style.fontFamily = 'CapCalm,CapBase,sans-serif'; ln.style.fontWeight = 700; ln.style.columnGap = '.26em'; ph.card = ln; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); s.style.textShadow = OUT(0.07, 'rgba(0,0,0,.95)') + ',0 .04em .12em rgba(0,0,0,.6)'; s.style.color = '#fff'; return s; });
    },
    update(ph, t) { ph.card.style.opacity = easeOut((t - ph.vs) / 0.12); },
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
    build(ph, el) { const card = mk('div', 'card', el); Object.assign(card.style, { background: '#FFFDF6', color: '#16161c', borderRadius: '.7em', padding: '.16em .6em .22em', position: 'relative', fontSize: '.9em', border: '.05em solid #16161c', boxShadow: '.08em .1em 0 #16161c', transformOrigin: '22% 120%', boxSizing: 'border-box', maxWidth: Math.floor(root.clientWidth * 0.9) + 'px' }); const tail = mk('i', 'tail', card); Object.assign(tail.style, { position: 'absolute', left: '16%', bottom: '-.3em', width: '.5em', height: '.5em', background: '#FFFDF6', borderRight: '.05em solid #16161c', borderBottom: '.05em solid #16161c', transform: 'rotate(45deg)' }); const ln = mk('div', 'ln', card); ph.card = card; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); if (w === ph.key) s.style.color = '#E0475B'; return s; }); },
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


  // ======== v1.2 batch B (2026-10-30): variety TV / news / retro / paper ========
  // B1. variety-outline : Korean variety-show caption. thick coloured outline, tilted, pops per word
  S['variety-outline'] = {
    label: '예능 두꺼운 테두리', slack: 1.15, group: { maxChars: portrait ? 9 : 16, maxWords: portrait ? 3 : 5 },
    build(ph, el) { const ln = mk('div', 'ln', el); ln.style.fontFamily = DISP; ln.style.fontWeight = 400; ln.style.transform = 'rotate(-3deg)'; ph.els = ph.words.map((w) => { const c = w === ph.key ? '#FF4D6D' : '#2F6BFF'; const s = mk('span', 'w', ln, w.text); const ring = (d, col) => [[1, 0], [-1, 0], [0, 1], [0, -1], [.7, .7], [-.7, .7], [.7, -.7], [-.7, -.7], [.38, .92], [-.38, .92], [.38, -.92], [-.38, -.92], [.92, .38], [-.92, .38], [.92, -.38], [-.92, -.38]].map(([x, y]) => `${(x * d).toFixed(3)}em ${(y * d).toFixed(3)}em 0 ${col}`).join(','); Object.assign(s.style, { color: '#fff', textShadow: ring(0.07, c) + ',' + ring(0.11, '#111') + ',.07em .12em 0 #111' }); return s; }); },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k], vis = t >= w.start - 0.02; s.style.opacity = vis ? 1 : 0; s.style.transform = `scale(${(vis ? 0.6 + 0.4 * easeBack((t - w.start) / en(0.2)) : 0.6).toFixed(3)})`; }); },
  };
  // B2. alert-bar : breaking-news style red band with a blinking dot (no extra words added)
  S['alert-bar'] = {
    label: '속보 빨간 띠', group: { maxChars: portrait ? 12 : 24, maxWords: portrait ? 4 : 7 },
    build(ph, el) { const bar = mk('div', 'card', el); Object.assign(bar.style, { background: 'linear-gradient(90deg,#C8102E,#E5243B)', borderRadius: '.1em', padding: '.16em .6em .22em 1.1em', position: 'relative', fontSize: '.9em', boxShadow: '0 .15em .5em rgba(0,0,0,.45)', borderBottom: '.08em solid #fff' }); const dot = mk('i', 'dot', bar); Object.assign(dot.style, { position: 'absolute', left: '.38em', top: '50%', width: '.32em', height: '.32em', marginTop: '-.16em', borderRadius: '50%', background: '#fff' }); ph.dot = dot; const ln = mk('div', 'ln', bar); ph.card = bar; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); if (w === ph.key) s.style.color = '#FFE14D'; return s; }); },
    update(ph, t) { const e = easeExpo((t - ph.vs) / en(0.25)); ph.card.style.clipPath = `inset(0 ${((1 - e) * 100).toFixed(1)}% 0 0)`; ph.dot.style.opacity = Math.floor(t * 3) % 2 ? 0.25 : 1; ph.words.forEach((w, k) => { ph.els[k].style.opacity = t >= w.start - 0.03 ? 1 : 0.35; }); },
  };
  // B3. vhs-retro : 90s VHS look. soft colour fringe, scan lines on the letters, a small wobble
  S['vhs-retro'] = {
    label: 'VHS 레트로', group: { maxChars: portrait ? 10 : 20, maxWords: portrait ? 3 : 6 },
    build(ph, el) { const ln = mk('div', 'ln', el); ln.style.fontFamily = 'CapCalm,CapMain,CapBase,sans-serif'; ph.wrap = ln; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); Object.assign(s.style, { color: w === ph.key ? '#FFE9A8' : '#F2F2F2', textShadow: `.035em 0 0 rgba(255,50,80,.8),-.035em 0 0 rgba(60,200,255,.8),` + OUT(0.05), backgroundImage: 'repeating-linear-gradient(0deg,rgba(0,0,0,.28) 0 .04em,transparent .04em .09em)', webkitBackgroundClip: 'text', backgroundClip: 'text' }); return s; }); },
    update(ph, t) { ph.wrap.style.transform = `translateX(${(Math.sin(t * 2.3) * 0.015 + (rnd(7, t, 12) > 0.42 ? 0.03 : 0)).toFixed(3)}em)`; ph.words.forEach((w, k) => { ph.els[k].style.opacity = t >= w.start - 0.03 ? 1 : 0; }); },
  };
  // B4. comic-burst : the key word sits in a yellow comic starburst (sound-effect panel)
  S['comic-burst'] = {
    label: '만화 효과음 별', slack: 1.2, group: { maxChars: portrait ? 10 : 18, maxWords: portrait ? 3 : 5 },
    build(ph, el) {
      buildRows(ph, el, '0.7em', (ks) => { Object.assign(ks.style, { fontFamily: DISP, fontWeight: 400, fontSize: '1.45em', color: '#111', padding: '.42em .55em', isolation: 'isolate' }); const b = mk('i', 'burst', ks); const pts = []; for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, r = i % 2 ? 36 : 50; pts.push(`${(50 + r * Math.cos(a)).toFixed(1)}% ${(50 + r * Math.sin(a) * 0.92).toFixed(1)}%`); } Object.assign(b.style, { position: 'absolute', inset: '-.05em -.1em', background: '#FFD60A', clipPath: `polygon(${pts.join(',')})`, zIndex: -1, filter: 'drop-shadow(.05em .06em 0 #111)' }); });
    },
    update(ph, t) { ph.words.forEach((w) => { const s = ph.els[w.i], vis = t >= w.start - 0.01, p = (t - w.start) / en(0.22); if (w === ph.key) { s.style.opacity = vis ? 1 : 0; s.style.transform = `rotate(-6deg) scale(${(vis ? 0.5 + 0.5 * easeBack(p) : 0.5).toFixed(3)})`; } else smallEnter(s, p, vis); }); },
  };
  // B5. tape-strip : each word printed on a strip of masking tape, slightly crooked
  S['tape-strip'] = {
    label: '마스킹 테이프', group: { maxChars: portrait ? 11 : 22, maxWords: portrait ? 4 : 6 },
    build(ph, el) { const ln = mk('div', 'ln', el); ln.style.columnGap = '.18em'; ph.els = ph.words.map((w, k) => { const s = mk('span', 'w', ln, w.text); Object.assign(s.style, { background: w === ph.key ? 'rgba(255,214,10,.92)' : 'rgba(240,236,226,.93)', color: '#1d1d1f', padding: '.06em .3em .1em', clipPath: 'polygon(2% 0,98% 4%,100% 50%,97% 100%,3% 96%,0 52%)', transform: `rotate(${((k % 3) - 1) * 1.8}deg)`, fontSize: '.9em' }); s.rot = ((k % 3) - 1) * 1.8; return s; }); },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k], p = easeOut((t - w.start + 0.02) / en(0.2)); s.style.opacity = t >= w.start - 0.03 ? 1 : 0; s.style.transform = `rotate(${s.rot}deg) translateY(${((1 - p) * -0.2).toFixed(3)}em)`; }); },
  };
  // B6. paper-cut : words on cut-out coloured paper pieces (collage)
  S['paper-cut'] = {
    label: '색종이 오려 붙이기', group: { maxChars: portrait ? 11 : 22, maxWords: portrait ? 4 : 6 },
    build(ph, el) { const cols = ['#FF6B6B', '#4DABF7', '#FFD43B', '#69DB7C', '#B197FC']; const ln = mk('div', 'ln', el); ln.style.columnGap = '.14em'; ph.els = ph.words.map((w, k) => { const s = mk('span', 'w', ln, w.text); const bg = cols[(k + ph.k) % cols.length]; Object.assign(s.style, { background: bg, color: '#111', padding: '.08em .28em .12em', fontFamily: DISP, fontWeight: 400, boxShadow: '.05em .07em 0 rgba(0,0,0,.55)' }); s.rot = (rnd(k, ph.k, 1) * 8).toFixed(1); return s; }); },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k], vis = t >= w.start - 0.02; s.style.opacity = vis ? 1 : 0; s.style.transform = `rotate(${s.rot}deg) scale(${(vis ? 0.8 + 0.2 * easeBack((t - w.start) / en(0.18)) : 0.8).toFixed(3)})`; }); },
  };
  // B7. sticker-peel : thick white sticker outline with a shadow, slapped on with a twist
  S['sticker-peel'] = {
    label: '스티커 붙이기', slack: 1.12, group: { maxChars: portrait ? 9 : 16, maxWords: portrait ? 3 : 5 },
    build(ph, el, mix) { const ln = mk('div', 'ln', el); ln.style.fontFamily = DISP; ln.style.fontWeight = 400; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); const o = [[1, 0], [-1, 0], [0, 1], [0, -1], [.7, .7], [-.7, .7], [.7, -.7], [-.7, -.7]].map(([x, y]) => `${(x * 0.11).toFixed(3)}em ${(y * 0.11).toFixed(3)}em 0 #fff`).join(','); Object.assign(s.style, { color: w === ph.key ? keyColor(ph, mix) === '#FFFFFF' ? PAL.accent : keyColor(ph, mix) : '#1b1b22', textShadow: o + ',.06em .12em .1em rgba(0,0,0,.5)' }); return s; }); },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k], vis = t >= w.start - 0.02, p = easeBack((t - w.start) / en(0.22)); s.style.opacity = vis ? 1 : 0; s.style.transform = `rotate(${((1 - clamp(p)) * 14 - 2).toFixed(1)}deg) scale(${(vis ? 0.7 + 0.3 * p : 0.7).toFixed(3)})`; }); },
  };
  // B8. doodle-circle : a hand-drawn loop is scribbled around the key word
  S['doodle-circle'] = {
    label: '낙서 동그라미', slack: 1.05, group: { maxChars: portrait ? 11 : 22, maxWords: portrait ? 4 : 6 },
    build(ph, el) { const ln = mk('div', 'ln', el); ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); s.style.textShadow = OUT(0.06); if (w === ph.key) { s.style.color = PAL.accent; const NS = 'http://www.w3.org/2000/svg'; const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 100 40'); svg.setAttribute('preserveAspectRatio', 'none'); Object.assign(svg.style, { position: 'absolute', left: '-14%', top: '-28%', width: '128%', height: '156%', overflow: 'visible', pointerEvents: 'none' }); const path = document.createElementNS(NS, 'path'); path.setAttribute('d', 'M60 3 C25 0 3 9 4 21 C5 33 33 39 58 37 C83 35 98 27 96 16 C94 6 72 2 45 5'); Object.assign(path.style, { fill: 'none', stroke: PAL.accent2, strokeWidth: '2.6', strokeLinecap: 'round', vectorEffect: 'non-scaling-stroke' }); path.style.strokeWidth = (0.1 * FS) + 'px'; path.setAttribute('pathLength', '100'); path.style.strokeDasharray = '100'; svg.appendChild(path); s.appendChild(svg); s.path = path; } return s; }); },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k]; s.style.opacity = t >= w.start - 0.03 ? 1 : 0.55; if (s.path) s.path.style.strokeDashoffset = (100 * (1 - easeOut((t - w.start) / en(0.45)))).toFixed(1); }); },
  };
  // B9. pixel-game : 8-bit game text. hard pixel shadow in steps, letters appear in steps on a dark box
  S['pixel-game'] = {
    label: '8비트 게임', group: { maxChars: portrait ? 11 : 22, maxWords: portrait ? 4 : 6 },
    build(ph, el) { const card = mk('div', 'card', el); Object.assign(card.style, { background: '#0b0b18', border: '.08em solid #fff', boxShadow: '0 0 0 .06em #0b0b18,.1em .1em 0 .06em #5B5BFF', padding: '.14em .5em .2em', fontSize: '.88em' }); const ln = mk('div', 'ln', card); ln.style.fontFamily = DISP; ln.style.fontWeight = 400; ph.card = card; ph.chars = []; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, ''); s.style.color = w === ph.key ? '#7CFF6B' : '#fff'; s.style.textShadow = '.06em .06em 0 #5B5BFF'; ph.chars.push(letters(w, s)); return s; }); },
    update(ph, t) { ph.words.forEach((w, k) => { const cs = ph.chars[k], n = Math.floor(clamp((t - w.start) / Math.max(en(0.15), w.dur * 0.7)) * cs.length + (t >= w.start ? 1 : 0)); cs.forEach((c, i) => { c.style.opacity = i < n ? 1 : 0; }); }); ph.card.style.opacity = t >= ph.vs ? 1 : 0; },
  };
  // B10. retro-shadow : retro 3D lettering with a long stepped extrusion in the accent colour
  S['retro-shadow'] = {
    label: '레트로 입체 그림자', slack: 1.08, group: { maxChars: portrait ? 9 : 16, maxWords: portrait ? 3 : 5 },
    build(ph, el) { const ln = mk('div', 'ln', el); ln.style.fontFamily = DISP; ln.style.fontWeight = 400; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); s.style.color = w === ph.key ? '#FFF3C4' : '#fff'; return s; }); },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k], p = easeOut((t - w.start) / en(0.3)), n = Math.round(6 * p); const sh = []; for (let i = 1; i <= 6; i++) sh.push(`${(i * 0.018 * (i <= n ? 1 : 0)).toFixed(3)}em ${(i * 0.018 * (i <= n ? 1 : 0)).toFixed(3)}em 0 ${i === 6 ? '#111' : PAL.accent2}`); s.style.textShadow = sh.join(',') + ',0 0 .02em #111'; s.style.opacity = t >= w.start - 0.03 ? 1 : 0; s.style.transform = `translate(${(-0.05 * p).toFixed(3)}em,${(-0.05 * p).toFixed(3)}em)`; }); },
  };


  // ======== v1.2 batch C (2026-10-30): info / numbers / quiz ========
  // C1. count-up : digits in a word count up from 0 to the spoken value; the final text is exactly the original
  const countText = (txt, p) => { if (p >= 1) return txt; return txt.replace(/\d[\d,]*(\.\d+)?/g, (m) => { const v = parseFloat(m.replace(/,/g, '')); if (!isFinite(v)) return m; const dec = (m.split('.')[1] || '').length; const n = (v * easeOut(p)).toFixed(dec); return m.includes(',') ? Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : n; }); };
  S['count-up'] = {
    label: '숫자 카운트업', slack: 1.05, group: { maxChars: portrait ? 11 : 22, maxWords: portrait ? 4 : 6 },
    build(ph, el) { const ln = mk('div', 'ln', el); ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); s.style.textShadow = OUT(0.06); if (/\d/.test(w.text)) { Object.assign(s.style, { color: PAL.accent, fontFamily: DISP, fontWeight: 400, fontVariantNumeric: 'tabular-nums', fontSize: '1.25em' }); s.num = true; } else if (w === ph.key) s.style.color = PAL.accent; return s; }); },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k]; s.style.opacity = t >= w.start - 0.03 ? 1 : 0.35; if (s.num) s.textContent = t < w.start ? countText(w.text, 0) : countText(w.text, (t - w.start) / Math.max(0.35, w.dur)); }); },
  };
  // C2. check-list : a check box ticks in front of the line when it starts (to-do, tips)
  S['check-list'] = {
    label: '체크 표시', group: { maxChars: portrait ? 11 : 22, maxWords: portrait ? 4 : 7 },
    build(ph, el) { const ln = mk('div', 'ln', el); ln.style.alignItems = 'center'; const box = mk('span', 'card', ln); Object.assign(box.style, { display: 'inline-block', width: '.78em', height: '.78em', border: '.08em solid #fff', borderRadius: '.16em', position: 'relative', boxShadow: '0 .04em .1em rgba(0,0,0,.6)', background: 'rgba(0,0,0,.25)' }); const tick = mk('i', 'tick', box); Object.assign(tick.style, { position: 'absolute', left: '.2em', top: '-.08em', width: '.3em', height: '.6em', borderRight: `.12em solid ${PAL.accent}`, borderBottom: `.12em solid ${PAL.accent}`, transform: 'rotate(40deg)', transformOrigin: 'left bottom', clipPath: 'inset(100% 0 0 0)' }); ph.tick = tick; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); s.style.textShadow = OUT(0.06); if (w === ph.key) s.style.color = PAL.accent; return s; }); },
    update(ph, t) { ph.tick.style.clipPath = `inset(${((1 - easeOut((t - ph.start) / en(0.3))) * 100).toFixed(1)}% 0 0 0)`; ph.words.forEach((w, k) => { ph.els[k].style.opacity = t >= w.start - 0.03 ? 1 : 0.4; }); },
  };
  // C3. quiz-card : quiz panel with a round question badge; the key word is hidden by a bar until it is said
  S['quiz-card'] = {
    label: '퀴즈 카드', group: { maxChars: portrait ? 11 : 22, maxWords: portrait ? 4 : 6 },
    build(ph, el) { const card = mk('div', 'card', el); Object.assign(card.style, { background: '#ffffff', color: '#14141c', borderRadius: '.3em', padding: '.18em .55em .22em 1.5em', position: 'relative', fontSize: '.88em', boxShadow: `0 .12em 0 ${PAL.accent2},0 .2em .6em rgba(0,0,0,.4)` }); const b = mk('i', 'badge', card, '?'); Object.assign(b.style, { position: 'absolute', left: '.3em', top: '50%', width: '.95em', height: '.95em', marginTop: '-.475em', borderRadius: '50%', background: PAL.accent2, color: '#fff', fontStyle: 'normal', fontFamily: DISP, fontSize: '.95em', lineHeight: '.98em', textAlign: 'center' }); const ln = mk('div', 'ln', card); ph.card = card; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); if (w === ph.key) { s.style.isolation = 'isolate'; const cover = mk('i', 'cv', s); Object.assign(cover.style, { position: 'absolute', inset: '.08em -.06em .02em', background: '#14141c', borderRadius: '.12em', transformOrigin: 'right center' }); s.cv = cover; s.style.color = '#D6336C'; } return s; }); },
    update(ph, t) { ph.card.style.transform = `translateY(${((1 - easeOut((t - ph.vs) / en(0.22))) * 0.4).toFixed(3)}em)`; ph.words.forEach((w, k) => { const s = ph.els[k]; s.style.opacity = t >= w.start - 0.03 || s.cv ? 1 : 0.35; if (s.cv) s.cv.style.transform = `scaleX(${(1 - easeOut((t - w.start) / en(0.25))).toFixed(3)})`; }); },
  };
  // C4. progress-bar : a thin bar under the line fills while the line is spoken
  S['progress-bar'] = {
    label: '진행 막대', group: { maxChars: portrait ? 12 : 24, maxWords: portrait ? 4 : 7 },
    build(ph, el) { const col = mk('div', 'col', el); col.style.rowGap = '.14em'; const ln = mk('div', 'ln', col); ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); s.style.textShadow = OUT(0.06); if (w === ph.key) s.style.color = PAL.accent; return s; }); const track = mk('div', 'card', col); Object.assign(track.style, { width: '100%', height: '.13em', background: 'rgba(255,255,255,.28)', borderRadius: '.1em', overflow: 'hidden' }); const fill = mk('i', 'fill', track); Object.assign(fill.style, { display: 'block', height: '100%', width: '100%', background: `linear-gradient(90deg,${PAL.accent},${PAL.accent2})`, transformOrigin: 'left center' }); ph.fill = fill; },
    update(ph, t) { ph.fill.style.transform = `scaleX(${clamp((t - ph.start) / Math.max(0.3, ph.end - ph.start)).toFixed(3)})`; ph.words.forEach((w, k) => { ph.els[k].style.opacity = t >= w.start - 0.03 ? 1 : 0.4; }); },
  };
  // C5. bullet-point : a round bullet pops, then the line slides in beside it (lists, steps)
  S['bullet-point'] = {
    label: '글머리표 줄', group: { maxChars: portrait ? 11 : 22, maxWords: portrait ? 4 : 7 },
    build(ph, el) { const ln = mk('div', 'ln', el); ln.style.alignItems = 'center'; const dot = mk('span', 'card', ln); Object.assign(dot.style, { display: 'inline-block', width: '.42em', height: '.42em', borderRadius: '50%', background: PAL.accent, boxShadow: `0 0 0 .08em rgba(0,0,0,.5)` }); ph.dot = dot; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); s.style.textShadow = OUT(0.06); if (w === ph.key) s.style.color = PAL.accent; return s; }); },
    update(ph, t) { ph.dot.style.transform = `scale(${easeBack((t - ph.vs) / en(0.2)).toFixed(3)})`; ph.words.forEach((w, k) => { const s = ph.els[k], p = easeOut((t - w.start + 0.03) / en(0.2)); s.style.opacity = t >= w.start - 0.03 ? clamp(p * 2) : 0; s.style.transform = `translateX(${((1 - p) * -0.35).toFixed(3)}em)`; }); },
  };
  // C6. arrow-point : an arrow bobs in from the left and points at the key word
  S['arrow-point'] = {
    label: '화살표 가리키기', slack: 1.05, group: { maxChars: portrait ? 10 : 20, maxWords: portrait ? 3 : 6 },
    build(ph, el) { const ln = mk('div', 'ln', el); ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); s.style.textShadow = OUT(0.06); if (w === ph.key) { s.style.color = PAL.accent; const a = mk('i', 'arr', s); s.style.paddingLeft = '.6em'; Object.assign(a.style, { position: 'absolute', left: '0', top: '50%', marginTop: '-.24em', width: 0, height: 0, borderTop: '.24em solid transparent', borderBottom: '.24em solid transparent', borderLeft: `.4em solid ${PAL.accent2}`, filter: 'drop-shadow(0 .03em .02em rgba(0,0,0,.8))' }); s.arr = a; } return s; }); },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k]; s.style.opacity = t >= w.start - 0.03 ? 1 : 0.45; if (s.arr) { const p = easeBack((t - w.start + 0.1) / en(0.25)); s.arr.style.opacity = t >= w.start - 0.1 ? 1 : 0; s.arr.style.transform = `translateX(${((1 - clamp(p)) * -0.3 + Math.sin(t * 9) * 0.05).toFixed(3)}em)`; } }); },
  };
  // C7. bracket-focus : corner brackets close in around the key word like a camera focus frame
  S['bracket-focus'] = {
    label: '초점 괄호', slack: 1.1, group: { maxChars: portrait ? 10 : 20, maxWords: portrait ? 3 : 6 },
    build(ph, el) { const ln = mk('div', 'ln', el); ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); s.style.textShadow = OUT(0.06); if (w === ph.key) { s.style.color = PAL.accent; s.style.padding = '0 .12em'; s.br = ['lt', 'rt', 'lb', 'rb'].map((c) => { const b = mk('i', 'br', s); const L = c[0] === 'l', T = c[1] === 't'; Object.assign(b.style, { position: 'absolute', width: '.3em', height: '.3em', [L ? 'left' : 'right']: '-.08em', [T ? 'top' : 'bottom']: '-.02em', [L ? 'borderLeft' : 'borderRight']: '.07em solid #fff', [T ? 'borderTop' : 'borderBottom']: '.07em solid #fff', filter: 'drop-shadow(0 0 .03em rgba(0,0,0,.9))' }); b.dx = L ? -1 : 1; b.dy = T ? -1 : 1; return b; }); } return s; }); },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k]; s.style.opacity = t >= w.start - 0.03 ? 1 : 0.45; if (s.br) { const p = easeOut((t - w.start + 0.05) / en(0.3)); s.br.forEach((b) => { b.style.opacity = t >= w.start - 0.05 ? 1 : 0; b.style.transform = `translate(${(b.dx * (1 - p) * 0.25).toFixed(3)}em,${(b.dy * (1 - p) * 0.25).toFixed(3)}em)`; }); } }); },
  };
  // C8. price-tag : the key word (a price) hangs on a tag with a punched hole
  S['price-tag'] = {
    label: '가격표', slack: 1.15, group: { maxChars: portrait ? 11 : 22, maxWords: portrait ? 4 : 6 },
    build(ph, el) { buildRows(ph, el, '0.7em', (ks) => { Object.assign(ks.style, { fontFamily: DISP, fontWeight: 400, fontSize: '1.35em', color: '#111', background: PAL.accent, padding: '.06em .35em .1em .9em', clipPath: 'polygon(.45em 0,100% 0,100% 100%,.45em 100%,0 50%)', transformOrigin: '.2em 50%' }); const hole = mk('i', 'hole', ks); Object.assign(hole.style, { position: 'absolute', left: '.36em', top: '50%', width: '.2em', height: '.2em', marginTop: '-.1em', borderRadius: '50%', background: 'rgba(20,20,28,.85)' }); }); },
    update(ph, t) { ph.words.forEach((w) => { const s = ph.els[w.i], vis = t >= w.start - 0.01, p = (t - w.start) / en(0.4); if (w === ph.key) { const d = Math.max(0, t - w.start) / SPD; s.style.opacity = vis ? 1 : 0; s.style.transform = `rotate(${(vis ? -10 * Math.exp(-d * 5) * Math.cos(d * 12) : -10).toFixed(2)}deg)`; } else smallEnter(s, p, vis); }); },
  };
  // C9. search-bar : the line is typed into a search box with a magnifier icon
  S['search-bar'] = {
    label: '검색창 입력', group: { maxChars: portrait ? 11 : 22, maxWords: portrait ? 4 : 6 },
    build(ph, el) { const card = mk('div', 'card', el); Object.assign(card.style, { background: '#fff', color: '#202124', borderRadius: '1em', padding: '.16em .7em .2em 1.45em', position: 'relative', fontSize: '.84em', boxShadow: '0 .1em .45em rgba(0,0,0,.45)', minWidth: '5em', textAlign: 'left' }); const lens = mk('i', 'lens', card); Object.assign(lens.style, { position: 'absolute', left: '.45em', top: '50%', width: '.42em', height: '.42em', marginTop: '-.3em', border: '.08em solid #5f6368', borderRadius: '50%' }); const handle = mk('i', 'h', lens); Object.assign(handle.style, { position: 'absolute', right: '-.2em', bottom: '-.16em', width: '.22em', height: '.08em', background: '#5f6368', transform: 'rotate(45deg)' }); const ln = mk('div', 'ln', card); ln.style.justifyContent = 'flex-start'; ph.card = card; ph.chars = []; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, ''); if (w === ph.key) s.style.color = '#1a73e8'; ph.chars.push(letters(w, s)); return s; }); const caret = mk('i', 'caret', ln); Object.assign(caret.style, { display: 'inline-block', width: '.06em', height: '.85em', background: '#1a73e8', alignSelf: 'center' }); ph.caret = caret; },
    update(ph, t) { ph.words.forEach((w, k) => { const cs = ph.chars[k], p = clamp((t - w.start) / Math.max(0.15, w.dur * 0.75)); cs.forEach((c, i) => { c.style.display = p * cs.length > i ? 'inline-block' : 'none'; }); ph.els[k].style.display = t >= w.start ? 'inline-block' : 'none'; }); ph.caret.style.opacity = Math.floor(t * 3) % 2 ? 0.15 : 1; },
  };
  // C10. percent-ring : a ring gauge fills next to the number / key word (stats, progress)
  S['percent-ring'] = {
    label: '원형 게이지', slack: 1.05, group: { maxChars: portrait ? 10 : 20, maxWords: portrait ? 3 : 6 },
    build(ph, el) { const ln = mk('div', 'ln', el); ln.style.alignItems = 'center'; const ring = mk('span', 'card', ln); Object.assign(ring.style, { display: 'inline-block', width: '1em', height: '1em', borderRadius: '50%', boxShadow: '0 0 .1em rgba(0,0,0,.6)' }); ph.ring = ring; const m = ph.key.text.match(/(\d+(?:\.\d+)?)\s*%/); ph.goal = m ? clamp(+m[1] / 100) : 1; ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); s.style.textShadow = OUT(0.06); if (w === ph.key) s.style.color = PAL.accent; return s; }); },
    update(ph, t) { const p = ph.goal * easeOut((t - ph.key.start + 0.1) / en(0.6)); const deg = (p * 360).toFixed(1); ph.ring.style.background = `radial-gradient(circle,rgba(10,10,16,.85) 52%,transparent 54%),conic-gradient(${PAL.accent} ${deg}deg,rgba(255,255,255,.25) ${deg}deg)`; ph.words.forEach((w, k) => { ph.els[k].style.opacity = t >= w.start - 0.03 ? 1 : 0.4; }); },
  };

  // ======== v1.3 batch D (2026-11-01): 2-tier "impact" captions (small setup line + big themed line) ========
  // Captured from a public Korean caption-motion demo (frames, not code). Each style = small white setup line + one big line that
  // pops in with its own theme: gold sparkle, fire, orange glow, hearts, angel wings, shaking blue, yellow sticker, blue select box,
  // pink title, paper strip. Colours are fixed per theme (the palette option does not change them).
  const RING = (em, c, n = 16) => { const a = []; for (let i = 0; i < n; i++) { const r = (i / n) * Math.PI * 2; a.push(`${(Math.cos(r) * em).toFixed(3)}em ${(Math.sin(r) * em).toFixed(3)}em 0 ${c}`); } return a.join(','); };
  const FXE = (parent, html, css) => { const e = mk('span', 'fx', parent); e.innerHTML = html; Object.assign(e.style, css); return e; };
  const STAR = (c) => `<svg viewBox="0 0 20 20" width="100%" height="100%"><path d="M10 0L12.3 7.7L20 10L12.3 12.3L10 20L7.7 12.3L0 10L7.7 7.7Z" fill="${c}"/></svg>`;
  const HEART = `<svg viewBox="0 0 24 22" width="100%" height="100%"><defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF9BD2"/><stop offset="1" stop-color="#FF3C9E"/></linearGradient></defs><path d="M12 21C4 14 1 10 1 6.5C1 3.5 3.5 1 6.5 1C9 1 11 2.5 12 4.5C13 2.5 15 1 17.5 1C20.5 1 23 3.5 23 6.5C23 10 20 14 12 21Z" fill="url(#hg)" stroke="#fff" stroke-width="1.2"/><ellipse cx="7" cy="6" rx="2.6" ry="1.5" fill="#fff" opacity=".85" transform="rotate(-30 7 6)"/></svg>`;
  const FLAME = `<svg viewBox="0 0 20 32" width="100%" height="100%"><defs><linearGradient id="fg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FF2A00"/><stop offset=".55" stop-color="#FF8A00"/><stop offset="1" stop-color="#FFE45C"/></linearGradient></defs><path d="M10 0C14 8 20 12 18 22C17 28 12 32 10 32C6 32 2 28 2 22C2 14 8 10 10 0Z" fill="url(#fg)"/><path d="M10 14C12 18 14 20 13 25C12.5 28 11 29 10 29C8.5 29 7 28 7 25C7 20 9 18 10 14Z" fill="#FFF3B0" opacity=".85"/></svg>`;
  const WING = `<svg viewBox="0 0 60 40" width="100%" height="100%"><path d="M58 20C44 4 22 2 2 8C14 10 22 14 26 18C16 16 8 18 4 22C16 22 24 26 28 30C20 30 14 32 12 36C34 38 52 32 58 20Z" fill="#fff" stroke="#8FD3FF" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  const ZIG = (c) => `<svg viewBox="0 0 12 24" width="100%" height="100%"><path d="M2 2L9 8L2 14L9 20" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const spot = (card, html, x, y, sz, css = {}) => FXE(card, html, Object.assign({ left: x + '%', top: y + '%', width: sz + 'em', height: sz + 'em', marginLeft: (-sz / 2) + 'em', marginTop: (-sz / 2) + 'em' }, css));

  // which words are the small setup line and which are the big line
  function duoParts(ph, o) {
    const n = ph.words.length, k = ph.words.indexOf(ph.key);
    if (o.solo || n === 1) return { small: [], big: ph.words.slice() };
    let cut;
    if (o.bigFirst) cut = Math.min(n - 1, Math.max(1, k + 1), Math.max(1, Math.ceil(n * 0.5)));
    else { cut = k >= 1 ? k : Math.max(1, Math.floor(n / 2)); if (n - cut > Math.ceil(n * 0.7)) cut = Math.max(1, Math.floor(n / 2)); }
    return o.bigFirst ? { big: ph.words.slice(0, cut), small: ph.words.slice(cut) } : { small: ph.words.slice(0, cut), big: ph.words.slice(cut) };
  }
  // one big word: gradient fill over a solid outline layer (sp.grad) or a plain coloured word with ring shadows (sp.fill)
  function bigWord(card, w, sp) {
    const s = mk('span', 'w', card, w.text); const drop = `0 ${(sp.ring * 0.9).toFixed(3)}em ${(sp.ring * 1.4).toFixed(3)}em rgba(0,0,0,.45)`;
    if (sp.grad) {
      s.style.color = sp.ringC; s.style.textShadow = RING(sp.ring, sp.ringC) + (sp.glow ? ',' + sp.glow : '') + ',' + drop;
      const f = mk('span', 'f', s, w.text);
      Object.assign(f.style, { position: 'absolute', left: 0, top: '-.3em', padding: '.3em 0', whiteSpace: 'nowrap', color: 'transparent', background: sp.grad, webkitBackgroundClip: 'text', backgroundClip: 'text', webkitTextFillColor: 'transparent', textShadow: 'none' });
    } else {
      s.style.color = sp.fill; s.style.textShadow = (sp.inner ? RING(sp.inner, sp.innerC) + ',' : '') + RING(sp.ring, sp.ringC) + (sp.glow ? ',' + sp.glow : '') + ',' + drop;
    }
    return s;
  }
  const DUO_OPTS = {};
  function duoStyle(id, label, o) {
    DUO_OPTS[id] = o;
    S[id] = {
      label, slack: o.slack || 1.12, group: o.solo ? { maxChars: portrait ? 11 : 20, maxWords: portrait ? 4 : 6 } : { maxChars: portrait ? 13 : 24, maxWords: portrait ? 5 : 8 },
      build(ph, el) {
        const P = duoParts(ph, o); const col = mk('div', 'col', el); col.style.rowGap = ((o.gap ?? 5) * U) + 'px';
        ph.els = []; ph.smalls = []; ph.bigs = []; ph.bigCard = null; ph.decorFn = null; ph.smallHost = null;
        const smallKey = P.small.find((w) => w === ph.key || isEmph(w));
        for (const kind of (o.bigFirst ? ['big', 'small'] : ['small', 'big'])) {
          const ws = P[kind]; if (!ws.length) continue;
          if (kind === 'small') {
            const r = mk('div', 'ln', col); r.style.fontSize = (o.smallEm || 0.78) + 'em'; r.style.lineHeight = '1.1'; let host = r;
            if (o.plate) { host = mk('div', 'card', r); Object.assign(host.style, { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '.28em', padding: '.04em .5em .1em' }, o.plate); }
            ws.forEach((w) => { const s = mk('span', 'w', host, w.text); s.style.color = (w === smallKey && o.smallKey) ? o.smallKey : (o.smallColor || '#fff'); s.style.textShadow = o.plate ? 'none' : (o.smallShadow || OUT(0.08)); ph.els[ph.words.indexOf(w)] = s; ph.smalls.push([w, s]); });
            ph.smallHost = o.plate ? host : null;
          } else {
            const r = mk('div', 'ln', col); r.style.fontSize = (o.bigEm || 1.4) + 'em'; r.style.lineHeight = '1.0'; r.style.fontFamily = DISP; r.style.fontWeight = 400;
            const card = mk('div', 'card', r); Object.assign(card.style, { position: 'relative', isolation: 'isolate', boxSizing: 'border-box', maxWidth: Math.floor(root.clientWidth * 0.9) + 'px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline', columnGap: '.26em', padding: o.pad || '.14em .34em .12em', transformOrigin: '50% 60%' });
            ws.forEach((w) => { const s = bigWord(card, w, o.paint(w, ph)); ph.els[ph.words.indexOf(w)] = s; ph.bigs.push([w, s]); });
            ph.bigCard = card; ph.bigStart = ws[0].start; ph.decorFn = o.decor ? o.decor(ph, card) : null;
          }
        }
      },
      update(ph, t) {
        ph.smalls.forEach(([w, s]) => { const vis = t >= w.start - 0.02; s.style.opacity = vis ? 1 : 0; s.style.transform = `translateY(${vis ? ((1 - easeOut((t - w.start) / en(0.18))) * 0.3).toFixed(3) : 0.3}em)`; });
        if (ph.smallHost && ph.smalls.length) ph.smallHost.style.opacity = t >= ph.smalls[0][0].start - 0.02 ? 1 : 0;
        if (!ph.bigCard) return;
        const bs = ph.bigStart - 0.02, p = (t - bs) / en(0.28), vis = t >= bs;
        ph.bigCard.style.opacity = vis ? 1 : 0;
        const sc = vis ? 0.5 + 0.5 * easeBack(p) : 0.5, rot = (o.rot || 0) + (o.wobble ? Math.sin(t * o.wobble) * 1.2 : 0);
        ph.bigCard.style.transform = `rotate(${rot.toFixed(2)}deg) scale(${sc.toFixed(3)})`;
        if (ph.decorFn) ph.decorFn(t, clamp(p), vis);
      },
    };
  }
  const GOLD = { grad: 'linear-gradient(180deg,#FFF7B8 0%,#FFD21E 48%,#FF9A00 100%)', ringC: '#4A2700', ring: 0.075, glow: '0 0 .3em rgba(255,190,40,.55)' };
  // D1. duo-gold-spark : gold gradient line with twinkling sparkles (key words in the small line turn gold)
  duoStyle('duo-gold-spark', '황금 반짝(작은 줄+큰 줄)', {
    smallKey: '#FFD21E', pad: '.2em .42em .14em', paint: () => GOLD,
    decor(ph, card) { const L = [[2, 22, .34, 0], [98, 16, .26, .4], [96, 90, .3, .7], [6, 96, .2, .2], [50, -2, .22, .55]].map(([x, y, z, f]) => ({ e: spot(card, STAR('#FFF6C6'), x, y, z, { filter: 'drop-shadow(0 0 .08em #FFC53D)', transform: 'scale(0)' }), f })); return (t, p, vis) => L.forEach(({ e, f }) => { const k = vis ? 0.5 + 0.5 * Math.abs(Math.sin((t * 1.7 + f) * Math.PI)) : 0; e.style.transform = `scale(${k.toFixed(3)}) rotate(${((t * 40 + f * 90) % 90).toFixed(1)}deg)`; }); },
  });
  // D2. duo-fire : red-to-yellow line with flickering flames at both ends and behind the text (key word of the small line turns violet)
  duoStyle('duo-fire', '불꽃(작은 줄+큰 줄)', {
    smallKey: '#B79BFF', pad: '.34em .95em .1em', slack: 1.18,
    paint: () => ({ grad: 'linear-gradient(180deg,#FFF06A 0%,#FF8A00 45%,#E01600 100%)', ringC: '#2E0500', ring: 0.08, glow: '0 0 .3em rgba(255,70,0,.6)' }),
    decor(ph, card) { const L = [[4, .8, 1.15, 0], [96, .8, 1.15, 1.3], [26, .6, .9, 2.1], [74, .6, .9, 0.7], [50, .6, .85, 3.2]].map(([x, w, h, f], i) => ({ e: FXE(card, FLAME, { left: x + '%', bottom: '.0em', width: w + 'em', height: h + 'em', marginLeft: (-w / 2) + 'em', transformOrigin: '50% 100%', zIndex: i > 1 ? -1 : 1, opacity: 0, filter: 'drop-shadow(0 0 .1em rgba(255,120,0,.8))' }), f })); return (t, p, vis) => L.forEach(({ e, f }) => { e.style.opacity = vis ? 1 : 0; e.style.transform = `scaleY(${(1 + 0.16 * Math.sin(t * 17 + f)).toFixed(3)}) scaleX(${(1 + 0.08 * Math.sin(t * 13 + f * 2)).toFixed(3)}) skewX(${(6 * Math.sin(t * 9 + f)).toFixed(2)}deg)`; }); },
  });
  // D3. duo-orange-glow : orange gradient line, the small line glows pink
  duoStyle('duo-orange-glow', '주황 글로우(분홍 작은 줄)', {
    smallColor: '#FFD3F1', smallKey: '#fff', smallShadow: `0 0 .35em #FF4FB8,0 0 .12em #FF4FB8,${OUT(0.05, 'rgba(70,0,45,.9)')}`,
    paint: () => ({ grad: 'linear-gradient(180deg,#FFE48A 0%,#FFA11F 55%,#FF6A00 100%)', ringC: '#4F1D00', ring: 0.075, glow: '0 0 .28em rgba(255,120,0,.55)' }),
    decor(ph, card) { const L = [[1, 12, .26, 0.1], [99, 10, .22, 0.6]].map(([x, y, z, f]) => ({ e: spot(card, STAR('#FFE9F8'), x, y, z, { filter: 'drop-shadow(0 0 .08em #FF4FB8)', transform: 'scale(0)' }), f })); return (t, p, vis) => L.forEach(({ e, f }) => { e.style.transform = `scale(${(vis ? 0.5 + 0.5 * Math.abs(Math.sin((t * 1.4 + f) * Math.PI)) : 0).toFixed(3)})`; }); },
  });
  // D4. duo-heart-glow : soft pink glowing line with floating hearts
  duoStyle('duo-heart-glow', '하트 글로우(분홍 큰 줄)', {
    smallKey: '#FFB3DD', pad: '.18em .62em .12em', slack: 1.18,
    paint: () => ({ grad: 'linear-gradient(180deg,#FFFFFF 0%,#FFD6EC 55%,#FF9AD0 100%)', ringC: '#B3125F', ring: 0.06, glow: '0 0 .38em #FF4FB0,0 0 .14em #FF4FB0' }),
    decor(ph, card) { const L = [[3, 20, .46, 0], [98, 32, .34, 1.1], [95, 92, .4, 2.2], [7, 90, .28, 3.3], [54, -6, .3, 4.4]].map(([x, y, z, f]) => ({ e: spot(card, HEART, x, y, z, { filter: 'drop-shadow(0 0 .1em #FF4FB0)', transform: 'scale(0)', zIndex: 1 }), f })); return (t, p, vis) => L.forEach(({ e, f }) => { e.style.transform = `translateY(${(-Math.sin(t * 3 + f) * 0.05).toFixed(3)}em) scale(${(vis ? (1 + 0.14 * Math.sin(t * 8 + f)) * easeBack(p) : 0).toFixed(3)})`; }); },
  });
  // D5. duo-angel-wing : the small line sits on a white plate, the big white-blue glowing line has flapping wings
  duoStyle('duo-angel-wing', '천사 날개(흰 판+파란 글로우)', {
    smallColor: '#23304F', smallEm: 0.8, plate: { background: '#fff', borderRadius: '.28em', boxShadow: '0 .05em .2em rgba(0,0,0,.35)' }, pad: '.14em .8em .12em', slack: 1.18,
    paint: () => ({ grad: 'linear-gradient(180deg,#FFFFFF 0%,#F0FAFF 60%,#CDEBFF 100%)', ringC: '#4C9BFF', ring: 0.06, glow: '0 0 .42em #5AB8FF,0 0 .16em #8FD0FF' }),
    decor(ph, card) { const Lw = FXE(card, WING, { left: '.02em', top: '8%', width: '.72em', height: '.5em', transformOrigin: '50% 60%', filter: 'drop-shadow(0 0 .12em #6CC3FF)', zIndex: 1, opacity: 0 }), Rw = FXE(card, WING, { right: '.02em', top: '8%', width: '.72em', height: '.5em', transformOrigin: '50% 60%', filter: 'drop-shadow(0 0 .12em #6CC3FF)', zIndex: 1, opacity: 0 }); return (t, p, vis) => { const a = Math.sin(t * 7) * 7; Lw.style.opacity = Rw.style.opacity = vis ? 1 : 0; Lw.style.transform = `rotate(${(-a).toFixed(2)}deg) scale(${(0.97 + 0.04 * Math.sin(t * 7)).toFixed(3)})`; Rw.style.transform = `scaleX(-1) rotate(${(-a).toFixed(2)}deg) scale(${(0.97 + 0.04 * Math.sin(t * 7)).toFixed(3)})`; }; },
  });
  // D6. duo-shake-blue : blue-white line that trembles, with shiver marks on both sides (key word of the small line turns yellow)
  duoStyle('duo-shake-blue', '덜덜 파랑(떨리는 큰 줄)', {
    smallKey: '#FFE04A', pad: '.14em .6em .12em', slack: 1.18,
    paint: () => ({ grad: 'linear-gradient(180deg,#FFFFFF 0%,#BFD3FF 55%,#6E96FF 100%)', ringC: '#10246E', ring: 0.07, glow: '0 0 .26em rgba(90,130,255,.55)' }),
    decor(ph, card) { const A = [spot(card, ZIG('#CFE0FF'), 2, 26, .6, { opacity: 0 }), spot(card, ZIG('#CFE0FF'), 98, 26, .6, { opacity: 0, transform: 'scaleX(-1)' })]; return (t, p, vis) => { ph.bigs.forEach(([w, s], i) => { s.style.transform = `translate(${(rnd(i, t, 24) * 0.07).toFixed(3)}em,${(rnd(i + 9, t, 24) * 0.07).toFixed(3)}em)`; }); A.forEach((e, i) => { e.style.opacity = vis && Math.floor(t * 12 + i) % 2 === 0 ? 1 : 0.25; }); }; },
  });
  // D7. duo-plate-gold : small line on a cream plate with a gold border, big gold line with a few sparkles
  duoStyle('duo-plate-gold', '라벨 판+황금 줄', {
    smallColor: '#3B2A10', plate: { background: '#FFF8E6', border: '.05em solid #C79A2B', borderRadius: '.22em', boxShadow: '0 .05em .2em rgba(0,0,0,.4)' }, pad: '.18em .42em .14em',
    paint: () => GOLD,
    decor(ph, card) { const L = [[2, 20, .3, 0], [98, 80, .28, .5], [50, -6, .2, .25]].map(([x, y, z, f]) => ({ e: spot(card, STAR('#FFF6C6'), x, y, z, { filter: 'drop-shadow(0 0 .08em #FFC53D)', transform: 'scale(0)' }), f })); return (t, p, vis) => L.forEach(({ e, f }) => { e.style.transform = `scale(${(vis ? 0.5 + 0.5 * Math.abs(Math.sin((t * 1.5 + f) * Math.PI)) : 0).toFixed(3)})`; }); },
  });
  // D8. duo-sticker : yellow word with a thick white sticker outline, tilted and bouncing (key word of the small line turns violet)
  duoStyle('duo-sticker', '노란 스티커(흰 테두리)', {
    smallKey: '#C9A8FF', rot: -3, wobble: 7, bigEm: 1.5, pad: '.16em .34em .16em',
    paint: () => ({ fill: '#FFE23B', inner: 0.045, innerC: '#3B2A00', ring: 0.14, ringC: '#fff' }),
  });
  // D9. duo-select-box : editor-style selection box (thin blue frame + white corner handles) around the big line
  duoStyle('duo-select-box', '선택 상자(편집기 손잡이)', {
    smallKey: '#FFD21E', bigEm: 1.3, pad: '.2em .5em .4em', slack: 1.1,
    paint: (w, ph) => (w === ph.key ? { fill: '#FFD21E', ring: 0.055, ringC: '#2A1E00' } : { fill: '#fff', ring: 0.055, ringC: 'rgba(8,8,12,.92)' }),
    decor(ph, card) { const box = FXE(card, '', { left: '.14em', right: '.14em', top: '.08em', bottom: '.08em', border: '.035em solid #3D7BFF', boxShadow: '0 0 .12em rgba(61,123,255,.7)', zIndex: 2 }); const H = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b]) => FXE(card, '', { left: a ? 'auto' : '.14em', right: a ? '.14em' : 'auto', top: b ? 'auto' : '.08em', bottom: b ? '.08em' : 'auto', width: '.15em', height: '.15em', marginLeft: a ? 0 : '-.075em', marginRight: a ? '-.075em' : 0, marginTop: b ? 0 : '-.075em', marginBottom: b ? '-.075em' : 0, background: '#fff', border: '.035em solid #3D7BFF', zIndex: 3, opacity: 0 })); return (t, p, vis) => { const q = vis ? easeOut((t - ph.bigStart) / en(0.3)) : 0; box.style.clipPath = `inset(0 ${((1 - q) * 100).toFixed(1)}% 0 0)`; H.forEach((h) => { h.style.opacity = q > 0.75 ? 1 : 0; }); }; },
  });
  // D10. duo-title-pink : headline first (big pink), the setup sentence in small white below it
  duoStyle('duo-title-pink', '분홍 제목+작은 설명', {
    bigFirst: true, smallKey: '#FFD2EE', pad: '.12em .34em .1em',
    paint: () => ({ grad: 'linear-gradient(180deg,#FFE0F3 0%,#FF9BD5 55%,#FF52B2 100%)', ringC: '#4A0A3A', ring: 0.075, glow: '0 0 .3em rgba(255,80,180,.5)' }),
  });
  // D11. paper-strip : words land one by one on a white paper strip that grows as the sentence is spoken
  S['paper-strip'] = {
    label: '종이띠(말하는 만큼 늘어남)', slack: 1.12, group: { maxChars: portrait ? 12 : 22, maxWords: portrait ? 4 : 7 },
    build(ph, el) {
      const ln = mk('div', 'ln', el); const card = mk('div', 'card', ln);
      Object.assign(card.style, { background: '#fff', borderRadius: '.12em', padding: '.06em .34em .12em', boxShadow: '0 .06em .22em rgba(0,0,0,.45)', display: 'flex', flexWrap: 'wrap', columnGap: '.26em', justifyContent: 'center', fontFamily: DISP, fontWeight: 400, fontSize: '1.15em', lineHeight: '1.1', transformOrigin: '50% 60%' });
      ph.card = card; ph.els = ph.words.map((w) => { const s = mk('span', 'w', card, w.text); s.style.color = w === ph.key ? '#E5372B' : '#111'; s.style.textShadow = 'none'; return s; });
    },
    update(ph, t) {
      ph.words.forEach((w, k) => { ph.els[k].style.display = t >= w.start - 0.02 ? 'inline-block' : 'none'; });
      const p = clamp((t - ph.vs) / en(0.2)); ph.card.style.transform = `rotate(${(-2 + Math.sin(t * 5) * 0.4).toFixed(2)}deg) scale(${(0.9 + 0.1 * easeBack(p)).toFixed(3)})`;
    },
  };

  // ======== v1.3 batch E (2026-11-01): showreel one-liners, speech-bubble labels, plates ========
  // Captured from two more public Korean caption-motion demo videos (a dark showreel of looks, and an animated-cartoon cut with
  // speaker-coloured bubbles and tags). One-line (solo) versions of the batch D themes, plus new looks.
  const SOLO = (id, label, o) => duoStyle(id, label, Object.assign({}, o, { solo: true, bigEm: o.bigEm || 1.3 }));
  SOLO('solo-gold', '황금 반짝(한 줄)', DUO_OPTS['duo-gold-spark']);
  SOLO('solo-wing', '천사 날개(한 줄)', Object.assign({}, DUO_OPTS['duo-angel-wing'], { plate: null, pad: '.12em .8em .12em' }));
  SOLO('solo-heart', '하트 글로우(한 줄)', DUO_OPTS['duo-heart-glow']);
  SOLO('solo-pastel', '파스텔 그라데이션', { pad: '.12em .4em .12em', paint: () => ({ grad: 'linear-gradient(90deg,#B9F5CF 0%,#FFF6B0 50%,#B9EAF5 100%)', ringC: '#2B3A38', ring: 0.055, glow: '0 0 .3em rgba(190,255,220,.5)' }) });
  SOLO('solo-sunset', '노을 주황(굵은 테두리)', { pad: '.12em .4em .12em', paint: () => ({ grad: 'linear-gradient(180deg,#FFF3B0 0%,#FFB347 50%,#FF5A2A 100%)', ringC: '#4A1A00', ring: 0.085, glow: '0 0 .3em rgba(255,110,40,.5)' }) });
  SOLO('solo-purple', '보라 테두리', { pad: '.12em .4em .12em', paint: () => ({ grad: 'linear-gradient(180deg,#FFFFFF 0%,#E7D3FF 100%)', ringC: '#5B21B6', ring: 0.08, glow: '0 0 .3em rgba(150,90,255,.6)' }) });
  SOLO('solo-chrome', '크롬 금속(쾅)', {
    pad: '.12em .4em .12em', paint: () => ({ grad: 'linear-gradient(180deg,#FFFFFF 0%,#BFC6D0 44%,#7C8796 52%,#E8EDF3 100%)', ringC: '#1B2A4A', ring: 0.07, glow: '0 0 .22em rgba(150,180,255,.5)' }),
    decor(ph, card) { return (t, p, vis) => { const k = vis ? Math.max(0, 1 - (t - ph.bigStart) / 0.45) : 0; ph.bigs.forEach(([w, s], i) => { s.style.transform = `translate(${(rnd(i, t, 30) * 0.09 * k).toFixed(3)}em,${(rnd(i + 5, t, 30) * 0.09 * k).toFixed(3)}em)`; }); }; },
  });
  SOLO('solo-ice', '얼음 파랑(반짝)', {
    pad: '.12em .6em .12em', paint: () => ({ grad: 'linear-gradient(180deg,#FFFFFF 0%,#CFEFFF 55%,#79C8FF 100%)', ringC: '#0E3A78', ring: 0.06, glow: '0 0 .35em rgba(120,210,255,.65)' }),
    decor(ph, card) { const L = [[1, 20, .3, 0], [99, 30, .24, .4], [92, 96, .26, .7]].map(([x, y, z, f]) => ({ e: spot(card, STAR('#E6F8FF'), x, y, z, { filter: 'drop-shadow(0 0 .1em #7FD3FF)', transform: 'scale(0)' }), f })); return (t, p, vis) => L.forEach(({ e, f }) => { e.style.transform = `scale(${(vis ? 0.4 + 0.6 * Math.abs(Math.sin((t * 1.8 + f) * Math.PI)) : 0).toFixed(3)}) rotate(${((t * 50 + f * 90) % 90).toFixed(1)}deg)`; }); },
  });
  SOLO('solo-night-glint', '새벽 파랑(큰 반짝)', {
    pad: '.12em .75em .14em', paint: () => ({ grad: 'linear-gradient(180deg,#FFFFFF 0%,#C7D7FF 60%,#8FA8FF 100%)', ringC: '#1B2A78', ring: 0.065, glow: '0 0 .4em rgba(120,150,255,.7)' }),
    decor(ph, card) { const L = [[98, 4, .62, 0], [3, 92, .4, .5]].map(([x, y, z, f]) => ({ e: spot(card, STAR('#C9D8FF'), x, y, z, { filter: 'drop-shadow(0 0 .12em #6F8CFF)', transform: 'scale(0)' }), f })); return (t, p, vis) => L.forEach(({ e, f }) => { e.style.transform = `scale(${(vis ? 0.6 + 0.4 * Math.abs(Math.sin((t * 1.2 + f) * Math.PI)) : 0).toFixed(3)}) rotate(${((t * 25 + f * 90) % 90).toFixed(1)}deg)`; }); },
  });
  SOLO('solo-neon-pink', '분홍 네온(작은 반짝)', {
    pad: '.12em .5em .12em', paint: () => ({ grad: 'linear-gradient(180deg,#FFFFFF 0%,#FFC7E6 60%,#FF7FBF 100%)', ringC: '#9B1B6B', ring: 0.045, glow: '0 0 .45em #FF4FB0,0 0 .18em #FF9ACF' }),
    decor(ph, card) { const L = [[2, 16, .24, 0.1], [98, 84, .2, 0.6]].map(([x, y, z, f]) => ({ e: spot(card, STAR('#FFE6F4'), x, y, z, { filter: 'drop-shadow(0 0 .08em #FF4FB0)', transform: 'scale(0)' }), f })); return (t, p, vis) => L.forEach(({ e, f }) => { e.style.transform = `scale(${(vis ? 0.4 + 0.6 * Math.abs(Math.sin((t * 1.6 + f) * Math.PI)) : 0).toFixed(3)})`; }); },
  });
  SOLO('solo-fire', '불꽃 왕관(한 줄)', {
    pad: '.78em .5em .1em', slack: 1.2, paint: () => ({ grad: 'linear-gradient(180deg,#FFF06A 0%,#FF8A00 45%,#E01600 100%)', ringC: '#2E0500', ring: 0.08, glow: '0 0 .3em rgba(255,70,0,.6)' }),
    decor(ph, card) { const L = [[12, .4, .56, 0], [34, .48, .68, 1.4], [58, .48, .68, 2.6], [82, .4, .58, 3.7]].map(([x, w, h, f]) => ({ e: FXE(card, FLAME, { left: x + '%', top: '.04em', width: w + 'em', height: h + 'em', marginLeft: (-w / 2) + 'em', transformOrigin: '50% 100%', zIndex: 1, opacity: 0, filter: 'drop-shadow(0 0 .1em rgba(255,120,0,.8))' }), f })); return (t, p, vis) => L.forEach(({ e, f }) => { e.style.opacity = vis ? 1 : 0; e.style.transform = `scaleY(${(1 + 0.18 * Math.sin(t * 16 + f)).toFixed(3)}) scaleX(${(1 + 0.08 * Math.sin(t * 12 + f * 2)).toFixed(3)}) skewX(${(6 * Math.sin(t * 8 + f)).toFixed(2)}deg)`; }); },
  });

  // card-like labels: oval pill, lavender plate, small colour tags
  function cardStyle(id, label, o) {
    S[id] = {
      label, slack: o.slack || 1.12, group: { maxChars: portrait ? 12 : 22, maxWords: portrait ? 4 : 7 },
      build(ph, el) {
        const ln = mk('div', 'ln', el); const card = mk('div', 'card', ln);
        Object.assign(card.style, { position: 'relative', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '.26em', boxSizing: 'border-box', maxWidth: Math.floor(root.clientWidth * 0.9) + 'px', padding: o.pad || '.06em .55em .12em', background: o.bg, border: o.border, borderRadius: o.radius, boxShadow: o.shadow || 'none', fontSize: (o.em || 1) + 'em', lineHeight: '1.15', transformOrigin: o.origin || '50% 60%', marginBottom: o.tail ? '.3em' : '0' });
        ph.card = card; ph.els = ph.words.map((w) => { const s = mk('span', 'w', card, w.text); s.style.color = (w === ph.key && o.keyColor) ? o.keyColor : o.color; s.style.textShadow = 'none'; if (o.font) { s.style.fontFamily = o.font; s.style.fontWeight = 400; } return s; });
        if (o.tail === 'tail') FXE(card, '', { left: '16%', bottom: '-.17em', width: '.3em', height: '.3em', background: o.bg, borderRight: o.border, borderBottom: o.border, transform: 'rotate(45deg)', zIndex: 0 });
        if (o.tail === 'think') { FXE(card, '', { left: '14%', bottom: '-.22em', width: '.2em', height: '.2em', borderRadius: '50%', background: o.bg, border: o.border }); FXE(card, '', { left: '8%', bottom: '-.4em', width: '.11em', height: '.11em', borderRadius: '50%', background: o.bg, border: o.border }); }
        // v1.4 tails: up (speaker above), down-right, messenger left / right
        if (o.tail === 'up') { card.style.marginTop = '.3em'; card.style.marginBottom = '0'; FXE(card, '', { left: '50%', top: '-.16em', width: '.3em', height: '.3em', marginLeft: '-.15em', background: o.bg, borderLeft: o.border, borderTop: o.border, transform: 'rotate(45deg)' }); }
        if (o.tail === 'down-right') FXE(card, '', { right: '18%', bottom: '-.17em', width: '.3em', height: '.3em', background: o.bg, borderRight: o.border, borderBottom: o.border, transform: 'rotate(45deg)', zIndex: 0 });
        if (o.tail === 'chat-l' || o.tail === 'chat-r') { card.style.marginBottom = '0'; FXE(card, `<svg viewBox="0 0 20 20" width="100%" height="100%"><path d="${o.tail === 'chat-l' ? 'M20 0 C18 10 10 17 0 20 C8 20 16 18 20 14 Z' : 'M0 0 C2 10 10 17 20 20 C12 20 4 18 0 14 Z'}" fill="${o.bg}"/></svg>`, { [o.tail === 'chat-l' ? 'left' : 'right']: '-.16em', bottom: '0', width: '.34em', height: '.34em' }); }
      },
      update(ph, t) {
        const p = easeBack((t - ph.vs) / en(0.24)); ph.card.style.transform = `rotate(${o.rot || 0}deg) scale(${(0.6 + 0.4 * clamp(p, 0, 1.1)).toFixed(3)})`;
        ph.words.forEach((w, k) => { ph.els[k].style.opacity = o.allOn || t >= w.start - 0.02 ? 1 : 0.28; });
      },
    };
    if (o.origin === undefined && o.tail === 'up') S[id].build = ((b) => function (ph, el) { b(ph, el); ph.card.style.transformOrigin = '50% 0%'; })(S[id].build);
  }
  cardStyle('oval-pill', '파란 알약(Q&A·마무리)', { bg: 'linear-gradient(180deg,#EAF2FF,#C9DDFF)', border: '.05em solid #4F7DFF', radius: '99em', color: '#1B3A8A', pad: '.08em .8em .14em', shadow: '0 .05em .2em rgba(40,80,200,.35)' });
  cardStyle('plate-lavender', '연보라 판(빛나는 테두리)', { bg: '#EEE6FF', border: '.05em solid #8A63E6', radius: '.3em', color: '#3A1F7A', shadow: '0 0 .35em rgba(150,110,255,.7)' });
  cardStyle('tag-mint', '민트 태그(작은 라벨)', { bg: '#BDEBDC', border: '.04em solid #2E9A74', radius: '.14em', color: '#0F4D38', em: 0.8, rot: -1.5, pad: '.04em .45em .1em', shadow: '0 .04em .12em rgba(0,0,0,.35)' });
  cardStyle('tag-orange', '주황 태그(작은 라벨)', { bg: '#FFB070', border: '.04em solid #C26A1A', radius: '.14em', color: '#4A2200', em: 0.8, rot: 1.5, pad: '.04em .45em .1em', shadow: '0 .04em .12em rgba(0,0,0,.35)' });
  cardStyle('bubble-blue', '말풍선 파랑(화자 색)', { bg: '#CDEBFF', border: '.05em solid #2B6FB8', radius: '.5em', color: '#123B6B', tail: 'tail', pad: '.06em .5em .12em', shadow: '0 .05em .15em rgba(0,0,0,.35)' });
  cardStyle('bubble-pink', '말풍선 분홍(화자 색)', { bg: '#FFD3DC', border: '.05em solid #D6577A', radius: '.5em', color: '#6B1230', tail: 'tail', pad: '.06em .5em .12em', shadow: '0 .05em .15em rgba(0,0,0,.35)' });
  cardStyle('bubble-mint', '말풍선 민트(화자 색)', { bg: '#CFF3E2', border: '.05em solid #2E9A74', radius: '.5em', color: '#0F4D38', tail: 'tail', pad: '.06em .5em .12em', shadow: '0 .05em .15em rgba(0,0,0,.35)' });
  cardStyle('bubble-thought', '생각 풍선(점 꼬리)', { bg: '#FFFFFF', border: '.045em solid #333', radius: '1em', color: '#222', tail: 'think', em: 0.85, pad: '.06em .6em .12em', shadow: '0 .04em .12em rgba(0,0,0,.3)' });

  // quote-frame : big teal quotation marks around the line, key word yellow
  S['quote-frame'] = {
    label: '따옴표 인용', slack: 1.1, group: { maxChars: portrait ? 13 : 24, maxWords: portrait ? 5 : 8 },
    build(ph, el) {
      const ln = mk('div', 'ln', el); ln.style.alignItems = 'center'; ln.style.columnGap = '.16em';
      const q = (txt) => { const s = mk('span', 'w', ln, txt); Object.assign(s.style, { color: '#35D3B0', fontFamily: DISP, fontWeight: 400, fontSize: '1.5em', lineHeight: '.8', textShadow: OUT(0.05) }); return s; };
      ph.q1 = q('\u201C'); ph.els = ph.words.map((w) => { const s = mk('span', 'w', ln, w.text); s.style.color = w === ph.key ? '#FFD84A' : '#fff'; s.style.textShadow = OUT(0.07); return s; }); ph.q2 = q('\u201D'); ph.q2.style.alignSelf = 'flex-end';
    },
    update(ph, t) { const p = clamp(easeBack((t - ph.vs) / en(0.25)), 0, 1.1); ph.q1.style.transform = ph.q2.style.transform = `scale(${p.toFixed(3)})`; ph.words.forEach((w, k) => { ph.els[k].style.opacity = t >= w.start - 0.02 ? 1 : 0.28; }); },
  };
  // laugh-tiles : repeated ㅋ / ㅎ / ㅠ become coloured tiles that hop in one by one; other words stay plain
  S['laugh-tiles'] = {
    label: 'ㅋㅋ 색 타일', slack: 1.15, group: { maxChars: portrait ? 12 : 22, maxWords: portrait ? 4 : 7 },
    build(ph, el) {
      const ln = mk('div', 'ln', el); const COL = ['#2FD3B0', '#FFD34D', '#FF7FA6', '#6FA8FF']; ph.tiles = [];
      ph.els = ph.words.map((w) => {
        const s = mk('span', 'w', ln);
        if (/^[ㅋㅎㅠㅜㅍ]{2,}[!?~]*$/.test(w.text)) [...w.text].forEach((ch, i) => { const c = mk('span', 'c', s, ch); Object.assign(c.style, { display: 'inline-block', minWidth: '.78em', textAlign: 'center', margin: '0 .05em', padding: '.02em .08em .06em', borderRadius: '.16em', background: COL[i % 4], color: '#fff', fontFamily: DISP, fontWeight: 400, textShadow: '0 .04em 0 rgba(0,0,0,.35)', boxShadow: '0 .05em .15em rgba(0,0,0,.4)' }); ph.tiles.push([w, c, i]); });
        else { s.textContent = w.text; s.style.textShadow = OUT(0.07); if (w === ph.key) s.style.color = '#FFD84A'; }
        return s;
      });
    },
    update(ph, t) {
      ph.words.forEach((w, k) => { ph.els[k].style.opacity = t >= w.start - 0.02 ? 1 : 0.3; });
      ph.tiles.forEach(([w, c, i]) => { const vis = t >= w.start - 0.02, p = clamp(easeBack((t - w.start - i * en(0.05)) / en(0.2)), 0, 1.15); c.style.opacity = vis ? 1 : 0; c.style.transform = `rotate(${[-7, 4, -3, 6][i % 4]}deg) translateY(${(Math.sin(t * 9 + i) * 0.03).toFixed(3)}em) scale(${(vis ? p : 0).toFixed(3)})`; });
    },
  };
  // horror-serif : pale serif words that fade in slowly with a red dot and a faint flicker
  S['horror-serif'] = {
    label: '오싹 명조(괴담)', slack: 1.05, group: { maxChars: portrait ? 11 : 20, maxWords: portrait ? 4 : 6 },
    build(ph, el) {
      const ln = mk('div', 'ln', el); const card = mk('div', 'card', ln); Object.assign(card.style, { position: 'relative', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '.3em', padding: '.14em .3em .12em' });
      ph.card = card; ph.els = ph.words.map((w) => { const s = mk('span', 'w', card, w.text); Object.assign(s.style, { fontFamily: 'CapSerif,CapMain,CapBase,serif', fontWeight: 800, color: '#ECECF2', letterSpacing: '.05em', textShadow: '0 0 .35em rgba(0,0,0,.95),0 .04em .14em rgba(0,0,0,.95)' }); return s; });
      ph.dot = FXE(card, '', { left: '.02em', top: '.04em', width: '.14em', height: '.14em', borderRadius: '50%', background: '#D62A2A', boxShadow: '0 0 .22em #D62A2A' });
    },
    update(ph, t) {
      const fl = 0.86 + 0.14 * Math.abs(Math.sin(t * 7.3) * Math.sin(t * 2.1)); ph.card.style.opacity = clamp((t - ph.vs) / en(0.5)) * fl;
      ph.words.forEach((w, k) => { ph.els[k].style.opacity = t >= w.start - 0.02 ? 1 : 0.35; }); ph.dot.style.opacity = Math.floor(t * 2) % 2 === 0 ? 1 : 0.35;
    },
  };
  // chip-bar : speaker chip. first word = name, a thin divider, the rest smaller (blue glossy bar)
  S['chip-bar'] = {
    label: '이름표 칩(이름 | 말)', slack: 1.12, group: { maxChars: portrait ? 12 : 22, maxWords: portrait ? 4 : 7 },
    build(ph, el) {
      const ln = mk('div', 'ln', el); const card = mk('div', 'card', ln);
      Object.assign(card.style, { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'center', columnGap: '.26em', boxSizing: 'border-box', maxWidth: Math.floor(root.clientWidth * 0.9) + 'px', padding: '.08em .6em .14em', background: 'linear-gradient(180deg,#6AA6FF,#2F6BFF)', border: '.04em solid rgba(255,255,255,.6)', borderRadius: '.34em', boxShadow: '0 0 .3em rgba(70,130,255,.7),0 .05em .15em rgba(0,0,0,.35)', fontSize: '.95em', lineHeight: '1.15', transformOrigin: '0% 60%' });
      ph.card = card; ph.els = ph.words.map((w, k) => { const s = mk('span', 'w', card, w.text); s.style.color = '#fff'; s.style.textShadow = '0 .03em .06em rgba(0,0,0,.35)'; if (k === 0) s.style.fontFamily = DISP, s.style.fontWeight = 400; else s.style.fontSize = '.8em'; if (k === 1) s.style.marginLeft = '.3em'; return s; });
      if (ph.words.length > 1) { const d = mk('i', 'dv', card); Object.assign(d.style, { display: 'inline-block', width: '.04em', height: '.8em', background: 'rgba(255,255,255,.7)', order: 1, alignSelf: 'center' }); ph.els.forEach((s, k) => { s.style.order = k === 0 ? 0 : 2; }); }
    },
    update(ph, t) { const p = clamp(easeBack((t - ph.vs) / en(0.24)), 0, 1.1); ph.card.style.transform = `translateX(${((1 - clamp(p, 0, 1)) * -1.2).toFixed(3)}em) scale(${(0.8 + 0.2 * clamp(p, 0, 1)).toFixed(3)})`; ph.words.forEach((w, k) => { ph.els[k].style.opacity = t >= w.start - 0.02 ? 1 : 0.35; }); },
  };

  // ======== v1.4 batch G (2026-11-21): reels looks, emoji-friendly boxes, speech bubbles, messenger chat, paper / sound-word / glow titles ========
  // Captured from a public Korean caption-motion demo video (frames only: no code, fonts or logos were taken). New font roles from make-captions:
  // CapPen (pen handwriting), CapBrush, CapSfx (sound words), CapCute, CapHeavy (black gothic), CapRound (soft rounded), CapFat (fat display).
  const rowsOf = (ws, maxw) => { const rows = []; let cur = [], n = 0; ws.forEach((w) => { const l = wlen(w.text); if (cur.length && n + l > maxw) { rows.push(cur); cur = []; n = 0; } cur.push(w); n += l + 0.3; }); if (cur.length) rows.push(cur); return rows; };
  const KEYC = ['#5BE37D', '#FFE14D', '#FF7EB6', '#6EC8FF'];
  const appear = (s, w, t, d = 0.16, dy = 0.25) => { const vis = t >= w.start - 0.02, p = easeOut((t - w.start + 0.02) / en(d)); s.style.opacity = vis ? 1 : 0; s.style.transform = `translateY(${vis ? ((1 - p) * dy).toFixed(3) : dy}em)`; };
  const popAt = (el, t0, t, d = 0.24, from = 0.6, pre = '') => { const vis = t >= t0, p = vis ? clamp(easeBack((t - t0) / en(d)), 0, 1.15) : 0; el.style.opacity = vis ? 1 : 0; el.style.transform = `${pre} scale(${(from + (1 - from) * p).toFixed(3)})`; return p; };
  const wordsIn = (host, ph, ws, f, w8, color, shadow) => ws.map((w) => { const s = useF(mk('span', 'w', host, w.text), f, w8); s.style.color = typeof color === 'function' ? color(w) : color; s.style.textShadow = shadow || 'none'; ph.els[ph.words.indexOf(w)] = s; return s; });
  // stacked styles keep the last bubbles of the same style on screen (conversation feel)
  const stackPrev = (ph, n = 2) => { const out = []; let i = phrases.indexOf(ph) - 1, cur = ph; while (i >= 0 && out.length < n) { const p = phrases[i]; if (p.sid !== ph.sid || cur.vs - p.ve > 1.0) break; out.unshift(p); cur = p; i--; } return out; };
  const chainIndex = (ph) => { let n = 0, i = phrases.indexOf(ph) - 1, cur = ph; while (i >= 0) { const p = phrases[i]; if (p.sid !== ph.sid || cur.vs - p.ve > 1.0) break; n++; cur = p; i--; } return n; };
  const phEmoji = (ph, fb) => (ph.emo && ph.emo.e) || (() => { for (const pass of [0, 1]) for (const w of [ph.key, ...ph.words]) { const k = emoMatch(strip(w.text)); if (k && (pass || !EMO_LOW.has(k))) return EMO[k]; } return emoSent(ph.words.map((w) => w.text).join(' '), ph); })() || fb;
  const emoSpan = (parent, e, css) => { const s = mk('span', 'w emo', parent, e); Object.assign(s.style, { fontFamily: EMOF + ',sans-serif', fontWeight: 400, textShadow: 'none', lineHeight: '1', filter: 'drop-shadow(0 .05em .08em rgba(0,0,0,.45))' }, css || {}); return s; };

  // G1. reels-clean : clean white black-gothic words, the key word in a rotating colour (green / yellow / pink / sky), soft shadow
  S['reels-clean'] = {
    label: '릴스 흰 글자(핵심어 색)', slack: 1.06, group: { maxChars: portrait ? 12 : 24, maxWords: portrait ? 4 : 7 },
    build(ph, el) { const ln = mk('div', 'ln', el); ln.style.columnGap = '.24em'; const kc = KEYC[ph.k % KEYC.length]; ph.els = []; wordsIn(ln, ph, ph.words, 'CapHeavy', 900, (w) => (w === ph.key ? kc : '#fff'), `${OUT(0.035, 'rgba(0,0,0,.6)')},0 .05em .25em rgba(0,0,0,.45)`); },
    update(ph, t) { ph.words.forEach((w, k) => appear(ph.els[k], w, t, 0.14, 0.18)); },
  };
  // G2. reels-box-stack : every row on its own white box, rows staggered left / right, the row with the key word in light green
  S['reels-box-stack'] = {
    label: '흰 상자 쌓기(핵심 줄 연두)', slack: 1.08, group: { maxChars: portrait ? 12 : 24, maxWords: portrait ? 5 : 8 },
    build(ph, el) {
      const col = mk('div', 'col', el); col.style.rowGap = '.12em'; ph.els = []; ph.rows = [];
      rowsOf(ph.words, portrait ? 7.5 : 13).forEach((ws, r) => {
        const card = mk('div', 'card', col); Object.assign(card.style, { display: 'flex', columnGap: '.22em', padding: '.04em .3em .08em', background: ws.includes(ph.key) ? '#DDF7C9' : '#FFFFFF', borderRadius: '.06em', boxShadow: '0 .05em .14em rgba(0,0,0,.35)', marginLeft: (r % 2 ? 0.4 : 0) + 'em', marginRight: (r % 2 ? 0 : 0.4) + 'em', lineHeight: '1.12' });
        wordsIn(card, ph, ws, 'CapHeavy', 900, '#111'); ph.rows.push([ws[0], card]);
      });
    },
    update(ph, t) { ph.rows.forEach(([w, c]) => { const vis = t >= w.start - 0.03, p = easeOut((t - w.start + 0.03) / en(0.18)); c.style.opacity = vis ? 1 : 0; c.style.clipPath = `inset(-10% ${((1 - p) * 100).toFixed(1)}% -10% 0)`; }); ph.words.forEach((w, k) => { ph.els[k].style.opacity = t >= w.start - 0.03 ? 1 : 0.35; }); },
  };
  // G3. reels-tint-boxes : rows on pastel boxes (yellow / blue with selection dots / pink), soft rounded font
  const TINTS = [['#FFF1A6', '#3B3000', 0], ['#DCE8FF', '#14306B', 1], ['#FFDDEE', '#5A1838', 0]];
  S['reels-tint-boxes'] = {
    label: '파스텔 상자 줄들', slack: 1.1, group: { maxChars: portrait ? 12 : 24, maxWords: portrait ? 5 : 8 },
    build(ph, el) {
      const col = mk('div', 'col', el); col.style.rowGap = '.16em'; ph.els = []; ph.rows = [];
      rowsOf(ph.words, portrait ? 7.5 : 13).forEach((ws, r) => {
        const [bg, fg, dots] = TINTS[(ph.k + r) % TINTS.length]; const card = mk('div', 'card', col);
        Object.assign(card.style, { position: 'relative', display: 'flex', columnGap: '.24em', padding: '.06em .34em .1em', background: bg, borderRadius: '.08em', boxShadow: '0 .04em .12em rgba(0,0,0,.3)', lineHeight: '1.12', transformOrigin: r % 2 ? '100% 50%' : '0% 50%', marginLeft: (r % 2 ? 0.35 : 0) + 'em' });
        wordsIn(card, ph, ws, 'CapRound', 700, fg);
        if (dots) [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([a, b]) => FXE(card, '', { [a ? 'right' : 'left']: '-.07em', [b ? 'bottom' : 'top']: '-.07em', width: '.14em', height: '.14em', borderRadius: '50%', background: '#3D7BFF', border: '.03em solid #fff' }));
        ph.rows.push([ws[0], card]);
      });
    },
    update(ph, t) { ph.rows.forEach(([w, c]) => popAt(c, w.start - 0.03, t, 0.22, 0.82)); },
  };
  // G4. reels-mint-stack : translucent mint boxes rising one by one, dark green text
  S['reels-mint-stack'] = {
    label: '민트 상자 올라오기', slack: 1.08, group: { maxChars: portrait ? 12 : 24, maxWords: portrait ? 5 : 8 },
    build(ph, el) {
      const col = mk('div', 'col', el); col.style.rowGap = '.14em'; ph.els = []; ph.rows = [];
      rowsOf(ph.words, portrait ? 7.5 : 13).forEach((ws) => { const card = mk('div', 'card', col); Object.assign(card.style, { display: 'flex', columnGap: '.24em', padding: '.05em .32em .09em', background: 'rgba(178,240,220,.94)', borderRadius: '.06em', lineHeight: '1.12', boxShadow: '0 .04em .12em rgba(0,0,0,.25)' }); wordsIn(card, ph, ws, 'CapBase', 800, '#0D4A3A'); ph.rows.push([ws[0], card]); });
    },
    update(ph, t) { ph.rows.forEach(([w, c]) => { const vis = t >= w.start - 0.03, p = easeOut((t - w.start + 0.03) / en(0.2)); c.style.opacity = vis ? p : 0; c.style.transform = `translateY(${((1 - p) * 0.35).toFixed(3)}em)`; }); },
  };
  // G5. reels-pink-outline : soft rounded white letters with a pink outline and glow
  S['reels-pink-outline'] = {
    label: '분홍 테두리 둥근 글자', slack: 1.08, group: { maxChars: portrait ? 12 : 22, maxWords: portrait ? 4 : 7 },
    build(ph, el) { const ln = mk('div', 'ln', el); ph.els = []; wordsIn(ln, ph, ph.words, 'CapRound', 700, '#fff', `${RING(0.06, '#FF5FA2')},0 0 .3em rgba(255,95,162,.6),0 .05em .2em rgba(0,0,0,.35)`); },
    update(ph, t) { ph.words.forEach((w, k) => appear(ph.els[k], w, t, 0.18, 0.22)); },
  };
  // G6. reels-lime-impact : huge lime words with a thick black outline, each word slams in (stacked rows)
  S['reels-lime-impact'] = {
    label: '라임 임팩트(큰 글자 쌓기)', slack: 1.3, fill: 1.2, group: { maxChars: portrait ? 10 : 18, maxWords: portrait ? 4 : 6 },
    build(ph, el) {
      const col = mk('div', 'col', el); col.style.rowGap = '0'; ph.els = [];
      rowsOf(ph.words, portrait ? 4.5 : 9).forEach((ws) => { const ln = mk('div', 'ln', col); ln.style.lineHeight = '1.0'; ln.style.fontSize = '1.25em'; wordsIn(ln, ph, ws, 'CapFat', 400, '#DBFF3B', `${RING(0.085, '#0A0A0A', 20)},0 .1em .2em rgba(0,0,0,.5)`); });
    },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k], vis = t >= w.start - 0.02, p = easeOut((t - w.start + 0.02) / en(0.14)); s.style.opacity = vis ? 1 : 0; s.style.transform = `scale(${vis ? (1.3 - 0.3 * p).toFixed(3) : 1.3}) rotate(${vis ? ((1 - p) * -6).toFixed(2) : -6}deg)`; }); },
  };
  // G7. reels-pink-small : small pink words with a white edge (cute side line)
  S['reels-pink-small'] = {
    label: '작은 분홍 글자', scale: 0.8, slack: 1.06, group: { maxChars: portrait ? 14 : 26, maxWords: portrait ? 6 : 9 },
    build(ph, el) { const ln = mk('div', 'ln', el); ph.els = []; wordsIn(ln, ph, ph.words, 'CapRound', 700, '#FF7DB8', `${RING(0.055, '#fff')},0 0 .25em rgba(255,125,184,.55)`); },
    update(ph, t) { ph.words.forEach((w, k) => appear(ph.els[k], w, t, 0.16, 0.2)); },
  };
  // G8. reels-italic-grad : leaning (italic) green-to-white gradient words with a dark green edge
  S['reels-italic-grad'] = {
    label: '기울인 초록 그라데이션', slack: 1.12, group: { maxChars: portrait ? 11 : 22, maxWords: portrait ? 4 : 7 },
    build(ph, el) { const ln = mk('div', 'ln', el); ln.style.transform = 'skewX(-12deg)'; ln.style.fontSize = '1.1em'; useF(ln, 'CapHeavy', 900); ph.els = ph.words.map((w) => bigWord(ln, w, { grad: 'linear-gradient(180deg,#FFFFFF 0%,#C6F7CB 45%,#3CCB6E 100%)', ringC: '#0B4D25', ring: 0.065, glow: '0 0 .25em rgba(60,203,110,.45)' })); },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k], vis = t >= w.start - 0.02, p = easeOut((t - w.start + 0.02) / en(0.16)); s.style.opacity = vis ? 1 : 0; s.style.transform = `translateX(${vis ? ((1 - p) * -0.4).toFixed(3) : -0.4}em)`; }); },
  };
  // G9. reels-gift-box : white box with a pink border and an emoji sticker sitting on top (the phrase's emoji, else a gift)
  S['reels-gift-box'] = {
    label: '흰 상자+위 이모지 스티커', ownEmoji: true, slack: 1.1, group: { maxChars: portrait ? 13 : 24, maxWords: portrait ? 5 : 8 },
    build(ph, el) {
      const ln = mk('div', 'ln', el); const card = mk('div', 'card', ln); Object.assign(card.style, { position: 'relative', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '.22em', padding: '.06em .36em .1em', background: '#fff', border: '.065em solid #FF7FB3', borderRadius: '.12em', boxShadow: '0 .05em .16em rgba(0,0,0,.35)', marginTop: '.75em', lineHeight: '1.12', maxWidth: Math.floor(root.clientWidth * 0.9) + 'px' });
      ph.card = card; ph.els = []; wordsIn(card, ph, ph.words, 'CapHeavy', 900, '#222');
      ph.stk = emoSpan(card, phEmoji(ph, '🎁'), { position: 'absolute', left: '50%', top: '-.95em', fontSize: '.9em', marginLeft: '-.5em', width: '1em', textAlign: 'center' });
    },
    update(ph, t) { popAt(ph.card, ph.vs, t, 0.26, 0.6); const a = t - ph.vs - 0.12; ph.stk.style.opacity = a > 0 ? 1 : 0; ph.stk.style.transform = `translateY(${(-Math.abs(Math.sin(a * 5)) * 0.08).toFixed(3)}em) rotate(${(Math.sin(a * 6) * 8).toFixed(1)}deg) scale(${a > 0 ? clamp(easeBack(a / 0.25), 0, 1.15).toFixed(3) : 0})`; ph.words.forEach((w, k) => { ph.els[k].style.opacity = t >= w.start - 0.03 ? 1 : 0.3; }); },
  };
  // G10. reels-word-chips : every word on its own dark chip, the key word chip yellow
  S['reels-word-chips'] = {
    label: '단어마다 칩', slack: 1.12, group: { maxChars: portrait ? 12 : 22, maxWords: portrait ? 4 : 7 },
    build(ph, el) { const ln = mk('div', 'ln', el); ln.style.columnGap = '.14em'; ln.style.rowGap = '.14em'; ph.els = ph.words.map((w) => { const s = useF(mk('span', 'w', ln, w.text), 'CapBase', 800); Object.assign(s.style, { background: w === ph.key ? '#FFE14D' : '#2B2F38', color: w === ph.key ? '#1A1A1A' : '#fff', borderRadius: '.18em', padding: '.02em .22em .07em', boxShadow: '0 .04em .12em rgba(0,0,0,.4)', textShadow: 'none' }); return s; }); },
    update(ph, t) { ph.words.forEach((w, k) => popAt(ph.els[k], w.start - 0.02, t, 0.2, 0.5)); },
  };
  // G11. reels-qa : dark box with a Q1 / Q2 badge (A badge when the line is not a question)
  S['reels-qa'] = {
    label: 'Q&A 칸(번호 배지)', slack: 1.08, group: { maxChars: portrait ? 13 : 24, maxWords: portrait ? 5 : 8 },
    build(ph, el) {
      const ln = mk('div', 'ln', el); const card = mk('div', 'card', ln); Object.assign(card.style, { display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: '.22em', padding: '.08em .4em .12em', background: 'rgba(18,20,26,.9)', borderRadius: '.22em', boxShadow: '0 .05em .18em rgba(0,0,0,.4)', lineHeight: '1.15', maxWidth: Math.floor(root.clientWidth * 0.9) + 'px', transformOrigin: '0% 50%' });
      const q = /\?$/.test(ph.words[ph.words.length - 1].text); const n = phrases.filter((p) => p.sid === ph.sid && p.start <= ph.start && /\?$/.test(p.words[p.words.length - 1].text) === q).length;
      const b = mk('span', 'badge', card, (q ? 'Q' : 'A') + n); Object.assign(b.style, { fontFamily: FAM('CapHeavy'), fontSize: '.62em', background: q ? '#fff' : '#FFE14D', color: '#111', borderRadius: '.16em', padding: '.06em .26em .1em', marginRight: '.2em' });
      ph.card = card; ph.els = []; wordsIn(card, ph, ph.words, 'CapBase', 800, '#fff');
    },
    update(ph, t) { const p = easeOut((t - ph.vs) / en(0.22)); ph.card.style.transform = `translateX(${((1 - p) * -0.6).toFixed(3)}em)`; ph.card.style.opacity = clamp(p * 1.5); ph.words.forEach((w, k) => { ph.els[k].style.opacity = t >= w.start - 0.03 ? 1 : 0.3; }); },
  };
  // G12. reels-haze : a soft blurred colour cloud behind white rounded letters (pink / orange / sky / green)
  const HAZE = ['rgba(255,110,185,.8)', 'rgba(255,165,60,.8)', 'rgba(100,175,255,.8)', 'rgba(120,230,160,.75)'];
  S['reels-haze'] = {
    label: '색 번짐(뒤에 흐린 빛)', slack: 1.1, group: { maxChars: portrait ? 12 : 22, maxWords: portrait ? 4 : 7 },
    build(ph, el) { const ln = mk('div', 'ln', el); const card = mk('div', 'card', ln); Object.assign(card.style, { position: 'relative', isolation: 'isolate', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '.26em', padding: '.1em .3em', maxWidth: Math.floor(root.clientWidth * 0.9) + 'px' }); ph.halo = FXE(card, '', { left: '-12%', right: '-12%', top: '-35%', bottom: '-35%', borderRadius: '50%', background: `radial-gradient(ellipse at center, ${HAZE[ph.k % HAZE.length]} 0%, ${HAZE[ph.k % HAZE.length]} 30%, rgba(0,0,0,0) 70%)`, filter: 'blur(.12em)', zIndex: -1, opacity: 0 }); ph.card = card; ph.els = []; wordsIn(card, ph, ph.words, 'CapBase', 800, '#fff', OUT(0.045, 'rgba(0,0,0,.6)')); },
    update(ph, t) { const p = easeOut((t - ph.vs) / en(0.45)); ph.halo.style.opacity = p; ph.halo.style.transform = `scale(${(0.6 + 0.4 * p + 0.04 * Math.sin(t * 3)).toFixed(3)})`; ph.words.forEach((w, k) => appear(ph.els[k], w, t, 0.2, 0.15)); },
  };
  // G13. reels-twotone : a coloured tab with the first word + a light box with the rest (mission / one-line summary)
  S['reels-twotone'] = {
    label: '두 톤 상자(앞말 탭)', slack: 1.08, group: { maxChars: portrait ? 13 : 24, maxWords: portrait ? 5 : 8 },
    build(ph, el) {
      const ln = mk('div', 'ln', el); const card = mk('div', 'card', ln); Object.assign(card.style, { display: 'flex', alignItems: 'stretch', borderRadius: '.16em', overflow: 'hidden', boxShadow: '0 .05em .16em rgba(0,0,0,.35)', lineHeight: '1.15', maxWidth: Math.floor(root.clientWidth * 0.92) + 'px' });
      const tab = mk('div', 'tb', card); Object.assign(tab.style, { background: '#3D7BFF', padding: '.06em .3em .1em', display: 'flex', alignItems: 'center' }); const rest = mk('div', 'rs', card); Object.assign(rest.style, { background: '#EAF1FF', padding: '.06em .34em .1em', display: 'flex', flexWrap: 'wrap', columnGap: '.22em', alignItems: 'center' });
      ph.els = []; const one = ph.words.length === 1; wordsIn(tab, ph, ph.words.slice(0, 1), 'CapHeavy', 900, '#fff'); if (!one) wordsIn(rest, ph, ph.words.slice(1), 'CapBase', 800, '#14306B'); else rest.remove(); ph.card = card; ph.rest = one ? null : rest;
    },
    update(ph, t) { popAt(ph.card, ph.vs, t, 0.22, 0.75); if (ph.rest) ph.rest.style.clipPath = `inset(0 ${((1 - easeOut((t - ph.words[1].start + 0.05) / en(0.25))) * 100).toFixed(1)}% 0 0)`; },
  };
  // G14. emoji-lead : a big emoji pops first at the start of the line, then the words follow
  S['emoji-lead'] = {
    label: '이모지 먼저(큰 이모지+문장)', ownEmoji: true, slack: 1.1, group: { maxChars: portrait ? 11 : 22, maxWords: portrait ? 4 : 7 },
    build(ph, el) { const ln = mk('div', 'ln', el); ln.style.alignItems = 'center'; ph.lead = emoSpan(ln, phEmoji(ph, '✨'), { fontSize: '1.3em', marginRight: '.05em' }); ph.els = []; wordsIn(ln, ph, ph.words, 'CapHeavy', 900, (w) => (w === ph.key ? '#FFE14D' : '#fff'), OUT(0.05)); },
    update(ph, t) { const a = t - ph.vs; ph.lead.style.opacity = a >= 0 ? 1 : 0; ph.lead.style.transform = `rotate(${((1 - clamp(a / 0.35)) * -200 + Math.sin(a * 5) * 6).toFixed(1)}deg) scale(${clamp(easeBack(a / 0.3), 0, 1.2).toFixed(3)})`; ph.words.forEach((w, k) => appear(ph.els[k], w, t, 0.16, 0.2)); },
  };

  // ---- speech bubbles ----
  // G15. bubble-oval-stack : white oval bubbles with handwriting that pile up (the last 2 lines stay above the new one)
  S['bubble-oval-stack'] = {
    label: '타원 말풍선 쌓기(대화)', stack: true, slack: 1.1, group: { maxChars: portrait ? 10 : 18, maxWords: portrait ? 4 : 6 },
    build(ph, el) {
      const col = mk('div', 'col', el); col.style.rowGap = '.22em'; ph.els = []; const all = [...stackPrev(ph), ph];
      all.forEach((p, i) => { const b = mk('div', 'card', col); Object.assign(b.style, { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '.22em', padding: '.3em .85em .36em', background: '#fff', borderRadius: '50%', boxShadow: '0 .06em .22em rgba(0,0,0,.35)', lineHeight: '1.05', marginLeft: ((i % 2) * 0.5) + 'em', marginRight: (((i + 1) % 2) * 0.5) + 'em', transformOrigin: '20% 80%' });
        p.words.forEach((w) => { const s = useF(mk('span', 'w', b, w.text), 'CapPen', 400); s.style.color = '#3B3B3B'; if (p === ph) ph.els[ph.words.indexOf(w)] = s; }); if (p === ph) ph.card = b; });
    },
    update(ph, t) { popAt(ph.card, ph.vs, t, 0.26, 0.4); },
  };
  cardStyle('bubble-tail-up', '꼬리 말풍선(위로)', { bg: '#FFE1EA', border: '.04em solid #FFFFFF', radius: '.6em', color: '#3E1F2B', tail: 'up', pad: '.08em .55em .14em', font: FAM('CapRound'), allOn: true, shadow: '0 .05em .18em rgba(0,0,0,.35)' });
  cardStyle('bubble-sticky', '작은 노랑 말풍선', { bg: '#FFF3A3', border: '.04em solid #E0C64A', radius: '.5em', color: '#3A2E00', tail: 'down-right', em: 0.82, rot: -3, pad: '.06em .5em .12em', font: FAM('CapRound'), allOn: true, shadow: '0 .05em .15em rgba(0,0,0,.35)' });
  cardStyle('bubble-whisper', '속삭임(점선 말풍선)', { bg: 'rgba(255,255,255,.9)', border: '.045em dashed #8A8F99', radius: '.6em', color: '#4A4F59', tail: 'think', em: 0.82, pad: '.06em .6em .12em', font: FAM('CapRound'), shadow: '0 .04em .12em rgba(0,0,0,.25)' });
  cardStyle('chat-left', '메신저 왜쪽(회색)', { bg: '#ECECEF', radius: '.7em', color: '#111', tail: 'chat-l', pad: '.08em .5em .14em', origin: '0% 100%', allOn: true, font: FAM('CapBase'), shadow: '0 .04em .12em rgba(0,0,0,.25)' });
  cardStyle('chat-right', '메신저 오른쪽(파랑)', { bg: '#3F86FF', radius: '.7em', color: '#fff', tail: 'chat-r', pad: '.08em .5em .14em', origin: '100% 100%', allOn: true, font: FAM('CapBase'), shadow: '0 .04em .12em rgba(0,0,0,.25)' });
  cardStyle('chat-yellow', '메신저 노랑', { bg: '#FFE14D', radius: '.7em', color: '#1E1A00', tail: 'chat-r', pad: '.08em .5em .14em', origin: '100% 100%', allOn: true, font: FAM('CapBase'), shadow: '0 .04em .12em rgba(0,0,0,.25)' });
  // G16. chat-thread : a messenger thread. lines alternate left (grey) / right (blue) and the last two stay on screen
  S['chat-thread'] = {
    label: '메신저 대화(좌우 번갈아)', stack: true, slack: 1.06, group: { maxChars: portrait ? 12 : 22, maxWords: portrait ? 5 : 8 },
    build(ph, el) {
      const col = mk('div', 'col', el); Object.assign(col.style, { rowGap: '.2em', width: Math.floor(root.clientWidth * 0.86) + 'px', alignItems: 'stretch' }); ph.els = []; const prev = stackPrev(ph); const base = chainIndex(ph) - prev.length;
      [...prev, ph].forEach((p, i) => { const right = (base + i) % 2 === 1; const b = mk('div', 'card', col); Object.assign(b.style, { position: 'relative', alignSelf: right ? 'flex-end' : 'flex-start', display: 'flex', flexWrap: 'wrap', columnGap: '.22em', padding: '.08em .5em .14em', background: right ? '#3F86FF' : '#ECECEF', borderRadius: '.7em', boxShadow: '0 .04em .12em rgba(0,0,0,.25)', lineHeight: '1.15', maxWidth: '82%', transformOrigin: right ? '100% 100%' : '0% 100%' });
        p.words.forEach((w) => { const s = useF(mk('span', 'w', b, w.text), 'CapBase', 800); s.style.color = right ? '#fff' : '#111'; if (p === ph) ph.els[ph.words.indexOf(w)] = s; });
        FXE(b, `<svg viewBox="0 0 20 20" width="100%" height="100%"><path d="${right ? 'M0 0 C2 10 10 17 20 20 C12 20 4 18 0 14 Z' : 'M20 0 C18 10 10 17 0 20 C8 20 16 18 20 14 Z'}" fill="${right ? '#3F86FF' : '#ECECEF'}"/></svg>`, { [right ? 'right' : 'left']: '-.16em', bottom: '0', width: '.34em', height: '.34em' }); if (p === ph) ph.card = b; });
    },
    update(ph, t) { popAt(ph.card, ph.vs, t, 0.24, 0.55); },
  };
  // G17. bubble-focus-burst : a white glowing circle with manga focus lines around it ("이거다!")
  const FOCUS = (() => { let s = ''; for (let i = 0; i < 56; i++) { const a = (i / 56) * Math.PI * 2, r0 = 70 + ((i * 37) % 11), r1 = 92 + ((i * 53) % 8); s += `<line x1="${(100 + Math.cos(a) * r0).toFixed(1)}" y1="${(100 + Math.sin(a) * r0).toFixed(1)}" x2="${(100 + Math.cos(a) * r1).toFixed(1)}" y2="${(100 + Math.sin(a) * r1).toFixed(1)}"/>`; } return `<svg viewBox="0 0 200 200" width="100%" height="100%"><g stroke="#1a1a1a" stroke-width="2.2" stroke-linecap="round">${s}</g></svg>`; })();
  S['bubble-focus-burst'] = {
    label: '집중선 원(외침)', slack: 1.15, group: { maxChars: portrait ? 6 : 9, maxWords: 3 },
    build(ph, el) {
      const ln = mk('div', 'ln', el); const card = mk('div', 'card', ln); Object.assign(card.style, { position: 'relative', isolation: 'isolate', display: 'inline-flex', width: 'max-content', flexWrap: 'nowrap', justifyContent: 'center', alignItems: 'center', columnGap: '.2em', aspectRatio: '1.6 / 1', padding: '.1em .2em', borderRadius: '50%', background: 'radial-gradient(circle, #FFFFFF 58%, rgba(255,255,255,.75) 66%, rgba(255,255,255,0) 71%)', lineHeight: '1.0' });
      ph.lines = FXE(card, FOCUS.replace('<svg ', '<svg preserveAspectRatio="none" '), { left: '-14%', top: '-14%', width: '128%', height: '128%', zIndex: -1 }); ph.card = card; ph.els = []; wordsIn(card, ph, ph.words, 'CapSfx', 400, '#111');
    },
    update(ph, t) { popAt(ph.card, ph.vs, t, 0.22, 0.3); ph.lines.style.transform = `rotate(${((Math.floor(t * 10) % 4) * 2.5).toFixed(1)}deg) scale(${(1 + 0.03 * Math.sin(t * 20)).toFixed(3)})`; },
  };
  // G18. bubble-spiky : a spiky explosion shape (sky / yellow / pink by turn) with white letters ("헉!")
  const SPIKE = (fill, n = 14, inner = 0.66) => { const pts = []; for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2, r = (i % 2 ? inner + ((i * 7) % 5) * 0.012 : 1 - ((i * 3) % 4) * 0.025) * 98; pts.push(`${(100 + Math.cos(a) * r).toFixed(1)},${(100 + Math.sin(a) * r).toFixed(1)}`); } return `<svg viewBox="0 0 200 200" width="100%" height="100%" preserveAspectRatio="none"><polygon points="${pts.join(' ')}" fill="${fill}" stroke="#fff" stroke-width="5" stroke-linejoin="round"/></svg>`; };
  const SPIKEC = [['#7FD0F5', '#0E3550'], ['#FFD84A', '#5A3B00'], ['#FF8DC0', '#5A0F33']];
  S['bubble-spiky'] = {
    label: '뽰족 터짐(헉!)', slack: 1.32, group: { maxChars: portrait ? 7 : 10, maxWords: 3 },
    build(ph, el) { const [f, d] = SPIKEC[ph.k % SPIKEC.length]; const ln = mk('div', 'ln', el); const card = mk('div', 'card', ln); Object.assign(card.style, { position: 'relative', isolation: 'isolate', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', columnGap: '.2em', padding: '.62em .95em', minWidth: '2.4em', minHeight: '2.2em', lineHeight: '1.0', margin: '.3em 0' }); FXE(card, SPIKE(f), { inset: '0', zIndex: -1, filter: 'drop-shadow(0 .05em .12em rgba(0,0,0,.35))' }); ph.card = card; ph.els = []; wordsIn(card, ph, ph.words, 'CapHeavy', 900, '#fff', RING(0.06, d)); },
    update(ph, t) { const p = popAt(ph.card, ph.vs, t, 0.24, 0.2, `rotate(${(-3 + (1 - clamp((t - ph.vs) / 0.3)) * -12).toFixed(1)}deg)`); if (p >= 1) ph.card.style.transform += ` scale(${(1 + 0.025 * Math.sin(t * 14)).toFixed(3)})`; },
  };
  // G19. bubble-shout : jagged white shout bubble with a black edge and a tail
  S['bubble-shout'] = {
    label: '외침 말풍선(샐족한 검은 테두리)', slack: 1.16, group: { maxChars: portrait ? 8 : 14, maxWords: 4 },
    build(ph, el) { const ln = mk('div', 'ln', el); const card = mk('div', 'card', ln); Object.assign(card.style, { position: 'relative', isolation: 'isolate', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', columnGap: '.2em', padding: '.5em .8em .55em', lineHeight: '1.0', marginBottom: '.35em' }); FXE(card, SPIKE('#fff', 22, 0.84).replace('stroke="#fff" stroke-width="5"', 'stroke="#111" stroke-width="4"'), { inset: '0', zIndex: -1 }); FXE(card, '<svg viewBox="0 0 40 40" width="100%" height="100%"><path d="M4 0 L36 0 L10 38 Z" fill="#fff" stroke="#111" stroke-width="3" stroke-linejoin="round"/><rect x="3" y="-4" width="34" height="6" fill="#fff"/></svg>', { left: '22%', bottom: '-.36em', width: '.5em', height: '.5em', zIndex: -1 }); ph.card = card; ph.els = []; wordsIn(card, ph, ph.words, 'CapHeavy', 900, '#111'); },
    update(ph, t) { popAt(ph.card, ph.vs, t, 0.2, 0.4, `translate(${(rnd(1, t, 24) * 0.03 * clamp(1 - (t - ph.vs) / 0.5)).toFixed(3)}em,0)`); },
  };
  // G20. bubble-hand-ellipse : a hand-drawn loop is drawn around white handwriting (inner thought)
  S['bubble-hand-ellipse'] = {
    label: '속마음 타원(손으로 그린 고리)', slack: 1.12, group: { maxChars: portrait ? 10 : 18, maxWords: 4 },
    build(ph, el) { const ln = mk('div', 'ln', el); const card = mk('div', 'card', ln); Object.assign(card.style, { position: 'relative', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '.22em', padding: '.42em .8em .48em', lineHeight: '1.05' }); ph.loop = FXE(card, `<svg viewBox="0 0 100 60" width="100%" height="100%" preserveAspectRatio="none"><path pathLength="100" d="M52 4 C80 3 98 15 97 31 C96 48 74 57 49 56 C22 56 3 46 4 30 C5 13 25 5 58 7" fill="none" stroke="#fff" stroke-width="${(7 * U).toFixed(1)}" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-dasharray="100" stroke-dashoffset="100"/></svg>`, { inset: '0', filter: 'drop-shadow(0 .03em .06em rgba(0,0,0,.6))' }); ph.path = ph.loop.querySelector('path'); ph.card = card; ph.els = []; wordsIn(card, ph, ph.words, 'CapPen', 400, '#fff', OUT(0.05)); },
    update(ph, t) { ph.path.setAttribute('stroke-dashoffset', (100 * (1 - easeOut((t - ph.vs) / en(0.4)))).toFixed(1)); ph.words.forEach((w, k) => appear(ph.els[k], w, t, 0.18, 0.15)); },
  };
  // G21. bubble-cloud : a cloud-shaped thought bubble with two small puffs
  const CLOUD = '<svg viewBox="0 0 200 120" width="100%" height="100%" preserveAspectRatio="none"><path d="M40 100 C15 100 5 80 18 66 C5 50 20 28 42 34 C48 14 78 8 92 24 C104 8 136 10 144 30 C168 22 192 40 182 62 C198 76 186 102 160 98 C150 114 120 116 106 104 C92 118 58 116 52 102 C48 102 44 101 40 100 Z" fill="#fff" stroke="#2b2b2b" stroke-width="3" vector-effect="non-scaling-stroke"/></svg>';
  S['bubble-cloud'] = {
    label: '구름 생각 풍선', slack: 1.12, group: { maxChars: portrait ? 10 : 18, maxWords: 4 },
    build(ph, el) { const ln = mk('div', 'ln', el); const card = mk('div', 'card', ln); Object.assign(card.style, { position: 'relative', isolation: 'isolate', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', columnGap: '.22em', padding: '.55em .95em .6em', lineHeight: '1.05', marginBottom: '.45em' }); FXE(card, CLOUD, { inset: '0', zIndex: -1, filter: 'drop-shadow(0 .04em .1em rgba(0,0,0,.3))' }); [[18, -0.22, 0.24], [8, -0.48, 0.14]].forEach(([x, b, s]) => FXE(card, '', { left: x + '%', bottom: b + 'em', width: s + 'em', height: s + 'em', borderRadius: '50%', background: '#fff', border: '.03em solid #2b2b2b' })); ph.card = card; ph.els = []; wordsIn(card, ph, ph.words, 'CapCute', 400, '#2b2b2b'); },
    update(ph, t) { popAt(ph.card, ph.vs, t, 0.3, 0.5, `translateY(${(Math.sin(t * 2.4) * 0.03).toFixed(3)}em)`); ph.words.forEach((w, k) => { ph.els[k].style.opacity = t >= w.start - 0.03 ? 1 : 0.3; }); },
  };
  // G22. paper-note : a torn paper note with a strip of tape flies in; first word big, the rest small ("끝! 이제 진짜 잘래요")
  const TORN = (() => { const p = []; for (let i = 0; i <= 20; i++) p.push(`${i * 5}% ${(i % 2 ? 3 : 0) + ((i * 7) % 3)}%`); for (let i = 20; i >= 0; i--) p.push(`${i * 5}% ${100 - (i % 2 ? 4 : 0) - ((i * 5) % 3)}%`); return `polygon(${p.join(',')})`; })();
  S['paper-note'] = {
    label: '찢은 종이 메모(테이프)', slack: 1.14, group: { maxChars: portrait ? 10 : 20, maxWords: portrait ? 4 : 7 },
    build(ph, el) {
      const ln = mk('div', 'ln', el); const wrap = mk('div', 'card', ln); Object.assign(wrap.style, { position: 'relative', filter: 'drop-shadow(0 .06em .14em rgba(0,0,0,.45))', margin: '.3em 0 .35em', transformOrigin: '60% 40%' });
      const paper = mk('div', 'pp', wrap); Object.assign(paper.style, { background: '#F6F6F4', clipPath: TORN, padding: '.3em .6em .34em', display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: '.2em', lineHeight: '1.05' });
      ph.els = []; const [first, ...rest] = ph.words; wordsIn(paper, ph, [first], 'CapPen', 400, '#222').forEach((s) => { s.style.fontSize = '1.35em'; }); wordsIn(paper, ph, rest, 'CapPen', 400, '#333').forEach((s) => { s.style.fontSize = '.86em'; });
      FXE(wrap, '', { left: '50%', top: '-.2em', width: '1.4em', height: '.38em', marginLeft: '-.7em', background: 'rgba(255,214,90,.82)', transform: 'rotate(-4deg)', zIndex: 2 }); ph.card = wrap;
    },
    update(ph, t) { const a = t - ph.vs, p = clamp(easeBack(a / en(0.36)), 0, 1.08); ph.card.style.opacity = a >= 0 ? 1 : 0; ph.card.style.transform = `translateX(${((1 - clamp(p)) * 1.6).toFixed(3)}em) rotate(${(-3 + (1 - clamp(p)) * 14).toFixed(2)}deg)`; ph.words.forEach((w, k) => { ph.els[k].style.opacity = t >= w.start - 0.03 ? 1 : 0; }); },
  };
  // G23. sfx-glow : a glowing hand-lettered sound word ("쓰담쓰담", "탁!"), tilted and bouncing
  S['sfx-glow'] = {
    label: '효과음 빛 글씨', slack: 1.3, group: { maxChars: portrait ? 7 : 10, maxWords: 2 },
    build(ph, el) { const ln = mk('div', 'ln', el); ln.style.transform = 'rotate(-7deg)'; ln.style.fontSize = '1.2em'; ln.style.padding = '.28em .1em'; ph.els = []; wordsIn(ln, ph, ph.words, 'CapSfx', 400, '#fff', `0 0 .14em rgba(255,255,255,.95),0 0 .4em rgba(255,236,170,.85),${OUT(0.03, 'rgba(0,0,0,.55)')}`); },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k], a = t - w.start + 0.03, vis = a >= 0; s.style.opacity = vis ? 1 : 0; s.style.transform = `translateY(${(vis ? -Math.abs(Math.sin(a * 7)) * 0.06 * Math.exp(-a * 2) : 0).toFixed(3)}em) scale(${vis ? clamp(easeBack(a / 0.22), 0, 1.2).toFixed(3) : 0})`; }); },
  };
  // G24. glow-title-hand : big pen-handwriting title rows, the row with the key word glows orange ("자막 하나 / 고르다가 / 새벽 3시")
  S['glow-title-hand'] = {
    label: '손글씨 빛 제목(핵심 줄 주황)', slack: 1.1, group: { maxChars: portrait ? 12 : 22, maxWords: portrait ? 5 : 8 },
    build(ph, el) { const col = mk('div', 'col', el); col.style.rowGap = '0'; ph.els = []; rowsOf(ph.words, portrait ? 5 : 9).forEach((ws) => { const ln = mk('div', 'ln', col); ln.style.fontSize = '1.2em'; ln.style.lineHeight = '1.05'; const hot = ws.includes(ph.key); wordsIn(ln, ph, ws, 'CapPen', 400, hot ? '#FF9A3C' : '#fff', hot ? `0 0 .22em #FF7A1A,0 0 .55em rgba(255,120,30,.65),${OUT(0.05, 'rgba(40,10,0,.9)')}` : OUT(0.06, 'rgba(10,10,20,.9)')); }); },
    update(ph, t) { ph.words.forEach((w, k) => { const s = ph.els[k], vis = t >= w.start - 0.03, p = easeOut((t - w.start + 0.03) / en(0.2)); s.style.opacity = vis ? 1 : 0; s.style.transform = `translateY(${vis ? ((1 - p) * 0.3).toFixed(3) : 0.3}em) rotate(${(Math.sin(t * 2 + k) * 1.5).toFixed(2)}deg)`; }); },
  };
  const V14 = ['reels-clean', 'reels-box-stack', 'reels-tint-boxes', 'reels-mint-stack', 'reels-pink-outline', 'reels-lime-impact', 'reels-pink-small', 'reels-italic-grad', 'reels-gift-box', 'reels-word-chips', 'reels-qa', 'reels-haze', 'reels-twotone', 'emoji-lead', 'bubble-oval-stack', 'bubble-tail-up', 'bubble-sticky', 'bubble-whisper', 'chat-left', 'chat-right', 'chat-yellow', 'chat-thread', 'bubble-focus-burst', 'bubble-spiky', 'bubble-shout', 'bubble-hand-ellipse', 'bubble-cloud', 'paper-note', 'sfx-glow', 'glow-title-hand'];
  V14.forEach((id) => { if (S[id]) S[id].v14 = true; }); window.newStyles = V14;

  // ---------- mix: one style per phrase ----------
  const MIX_BASE = ['block-sweep', 'line-rise', 'chip-label', 'lead-big', 'underline-ink', 'stack-kinetic', 'karaoke-fill', 'mask-slide', 'marker-swipe', 'rise-lines', 'reels-clean', 'reels-box-stack', 'reels-mint-stack', 'reels-tint-boxes'];
  const MIX_KEY = ['hero-key', 'stamp', 'lead-big', 'duo-gold-spark', 'duo-sticker', 'duo-select-box', 'reels-lime-impact', 'reels-italic-grad', 'glow-title-hand'];
  // emotion / sound words -> emotion motion (at most D.fxMax per video, default 4, at least 3 s apart; --fx off turns it off)
  const FX = [
    ['boom-shake', /쾅|펑|충격|반전|미쳤|절대|최악|폭발/],
    ['jolt-pop', /깜짝|헉|헐|대박|놀라|놀랍|놀랐|세상에|어머|와우|우와|대단/],
    ['heart-thump', /설레|두근|심쿵|사랑|반했|좋아해/],
    ['jitter-nerve', /덜덜|무서|긴장|떨려|급해|큰일|위험|어떡/],
    ['droop-sigh', /아쉽|실망|시무룩|슬퍼|슬프|망했|우울|힘들|피곤/],
    ['tilt-wonder', /궁금|갸웃|왜\?|뭐지|이상하|정말\?|진짜\?|일까\?|을까\?|ㄹ까\?|나요\?|인가요\?|어떨까/],
    ['sway-breeze', /살랑|여유|편안|느긋|기분 ?좋|행복|산책|바람/],
    ['duo-heart-glow', /꽁짜|공짜|무료|하트|고마워|감사/],
    ['duo-angel-wing', /처음부터|끝까지|깨끗|순수|천사|맑/],
    ['duo-fire', /불꽃|뜨거|불타|화력|핫해/],
    ['laugh-tiles', /ㅋㅋ|ㅎㅎ|ㅠㅠ/],
    ['horror-serif', /괴담|오싹|소름|귀신|공포/],
    ['solo-ice', /시원|차가|얼음|냉커피|아이스/],
    // v1.4: bubbles / sound words (only short lines, see fxFor)
    ['bubble-focus-burst', /이거다|찾았다|유레카|바로 이거|정답/, 3],
    ['bubble-spiky', /^헉|^헐|^어머|^에에|^허걱/, 3],
    ['bubble-whisper', /쉿|비밀|속삭|몰래/, 5],
    ['bubble-hand-ellipse', /속마음|혼잣말|속으로/, 5],
    ['sfx-glow', /^(쓰담|톡|탁|쾅쾅|뚝딘|사분|두둥|짜잔|뿅|핑)/],
    ['paper-note', /^끝[!.]|마무리|오늘은 여기까지/, 6],
  ];
  let fxUsed = 0, fxLast = -99;
  function fxFor(ph) {
    if (D.fx === 'off' || fxUsed >= (D.fxMax ?? 4) || ph.start - fxLast < 3) return null;
    const txt = ph.words.map((w) => w.text).join(' ');
    for (const [sid, re, mw] of FX) if (re.test(txt) && (!mw || ph.words.length <= mw)) { fxUsed++; fxLast = ph.start; return sid; }
    // sentence endings: a short line ending in ! or ?! is a surprise, a short question is a head-tilt (only short lines, so long sentences stay calm)
    if (ph.words.length <= 3 && /[!]\??$|\?!$/.test(txt)) { fxUsed++; fxLast = ph.start; return 'jolt-pop'; }
    if (ph.words.length <= 3 && /\?$/.test(txt)) { fxUsed++; fxLast = ph.start; return 'tilt-wonder'; }
    return null;
  }
  // --mix-pool a,b,c : mix only picks from these (e.g. the styles you starred in the picker)
  const POOL = (D.mixPool || []).filter((s) => S[s]);
  function planFor(ph, hist) {
    for (const r of D.plan || []) if (ph.start >= r.from && ph.start < r.to && S[r.style]) return r.style;
    const fx = fxFor(ph); if (fx && (!POOL.length || POOL.includes(fx))) return fx;
    let pool;
    if (POOL.length) { const recent = hist.slice(-1); const c = POOL.filter((s) => !recent.includes(s)); return (c.length ? c : POOL)[ph.k % (c.length || POOL.length)]; }
    if (ph.hook && D.hook !== 'off') pool = ['hero-key', 'impact-wide', 'stack-kinetic', 'stamp', 'chorus-zoom', 'neon-flicker', 'duo-gold-spark', 'duo-fire'];
    else if (ph.words.length <= 2) pool = ['pop-word', 'hero-key'];
    else if (ph.hasNum) pool = ['hero-key', 'chip-label', 'num-box', 'count-up', 'duo-orange-glow', 'duo-plate-gold'];
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
  // emoji v2: one emoji per caption at most, spaced by D.emoji.gap seconds (default 2.5) and capped by D.emoji.max; keyword first, then the sentence mood
  const EM = Object.assign({ pos: 'auto', anim: 'auto', gap: 2.5, max: 999 }, D.emoji || {});
  if (DECO.has('emoji')) { let prevE = '', last = -99, n = 0; phrases.forEach((ph) => {
    if (n >= EM.max || ph.start - last < EM.gap) return;
    const order = [ph.key, ...ph.words.filter((w) => w !== ph.key)]; let hit = null;
    // generic time words (오늘, 지금 ...) only win when nothing more specific matched
    for (const pass of [0, 1]) { for (const w of order) { const k = emoMatch(strip(w.text)); if (k && EMO[k] !== prevE && (pass || !EMO_LOW.has(k))) { hit = { e: EMO[k], w }; break; } } if (hit) break; }
    if (!hit) { const s = emoSent(ph.words.map((w) => w.text).join(' '), ph); if (s && s !== prevE) hit = { e: s, w: ph.words[ph.words.length - 1] }; }
    if (!hit) return; ph.emo = { e: hit.e, w: hit.w, at: hit.w.start, k: n }; prevE = hit.e; last = ph.start; n++;
  }); }
  const FXSET = new Set(FX.map((f) => f[0]).concat(['jolt-pop', 'tilt-wonder']));
  // where the emoji goes: end (after the last word, inside the box), top (above the key word), corner (sticker on the box corner),
  // burst (pops above the key word and throws small copies), side (big emoji in front of the line). auto picks by style.
  const emoModeOf = (ph) => { if (S[ph.sid].stack) return 'end'; if (EM.pos === 'corner' && !box.querySelector('.card')) return 'top'; if (EM.pos !== 'auto') return EM.pos; if (FXSET.has(ph.sid)) return 'burst'; if (box.querySelector('.card')) return ph.emo.k % 2 ? 'corner' : 'end'; return ['end', 'top', 'side'][ph.emo.k % 3]; };
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
    if (ph.emo && ph.emoInline) { d.emo = ph.emoInline; d.at = ph.emo.at; d.mode = ph.emoMode; d.base = ''; }
    else if (ph.emo && ph.emoMode) {
      const el = elFor(ph, ph.emo.w); const r = el ? el.getBoundingClientRect() : null; const cx = r ? r.left + r.width / 2 - br.left : (x0 + x1) / 2 - br.left;
      const emoCss = { lineHeight: '1', fontFamily: EMOF + ',sans-serif', fontWeight: 400, filter: 'drop-shadow(0 .05em .08em rgba(0,0,0,.55))', opacity: 0, transformOrigin: '50% 80%' };
      d.at = ph.emo.at; d.mode = ph.emoMode;
      if (ph.emoMode === 'corner') { let cy = 1e9, cr = -1e9; box.querySelectorAll('.card').forEach((c) => { const q = c.getBoundingClientRect(); if (q.width) { cy = Math.min(cy, q.top); cr = Math.max(cr, q.right); } }); if (cy > 1e8) { cy = br.top + parseFloat(getComputedStyle(box).paddingTop); cr = x1; }
        d.emo = mk('span', 'dec', box, ph.emo.e); Object.assign(d.emo.style, emoCss, { left: (cr - br.left) + 'px', top: (cy - br.top) + 'px', fontSize: (1.0 * EF(S[ph.sid])).toFixed(3) + 'em', transformOrigin: '50% 50%' }); d.base = 'translate(-45%,-68%) '; }
      else { d.emo = mk('span', 'dec', box, ph.emo.e); Object.assign(d.emo.style, emoCss, { left: cx + 'px', top: '0', fontSize: (1.45 * EF(S[ph.sid])).toFixed(3) + 'em' }); d.base = 'translate(-50%,0) ';
        if (ph.emoMode === 'burst') d.fly = [0, 1, 2, 3, 4, 5, 6].map((i) => { const f = mk('span', 'dec fly', box, ph.emo.e); Object.assign(f.style, emoCss, { left: cx + 'px', top: '.5em', fontSize: (0.8 * EF(S[ph.sid])).toFixed(3) + 'em' }); return f; }); }
    }
    ph.deco = d;
  }
  // emoji motion: pop / bounce / wiggle / float / spin / pulse (auto: end pop, top bounce, corner wiggle, side pulse, burst flies)
  // emoji size vs text: the default Dongle font draws Hangul small for its em box, so emoji next to it are scaled down to match
  const EF = (sty) => (!sty.v14 && D.fontScale > 1 ? 1 / (D.fontScale * 0.85) : 1);
  const EANIM = { end: 'pop', top: 'bounce', corner: 'wiggle', side: 'pulse', burst: 'pop' };
  function updateDeco(ph, t) {
    const d = ph.deco; if (!d) return;
    if (d.line) { const p = easeOut((t - ph.vs) / 0.4); d.line.style.transform = `scaleX(${p})`; d.dot.style.opacity = p > 0.02 ? 1 : 0; d.dot.style.left = `calc(${(d.line.style.left)} + ${(d.w * p).toFixed(1)}px)`; }
    if (d.emo) {
      const a = t - d.at, vis = a >= -0.01, p = a / 0.28, anim = EM.anim === 'auto' ? EANIM[d.mode] || 'pop' : EM.anim;
      let sc = vis ? 0.35 + 0.65 * easeBack(p) : 0.35, rot = d.mode === 'corner' ? 14 : 0, ty = 0;
      if (anim === 'pop') rot += (1 - clamp(p)) * -22; else if (anim === 'bounce') ty = -Math.abs(Math.sin(Math.max(0, a) * 6)) * 0.16; else if (anim === 'wiggle') rot += Math.sin(Math.max(0, a) * 9) * 12; else if (anim === 'float') ty = -Math.sin(Math.max(0, a) * 2.4) * 0.1 - Math.min(a, 2) * 0.04; else if (anim === 'spin') rot += (1 - easeOut(clamp(a / 0.6))) * 360; else if (anim === 'pulse') sc *= 1 + 0.13 * Math.max(0, Math.sin(Math.max(0, a) * 8));
      d.emo.style.opacity = vis ? 1 : 0; d.emo.style.transform = `${d.base || ''}translateY(${(vis ? ty : 0.3).toFixed(3)}em) scale(${sc.toFixed(3)}) rotate(${rot.toFixed(1)}deg)`;
      if (d.fly) d.fly.forEach((f, i) => { const q = clamp((a - 0.05) / 0.85), ang = (-90 + (i - 3) * 28) * Math.PI / 180, r = 1.5 * easeOut(q); f.style.opacity = a > 0.05 && q < 1 ? (1 - q).toFixed(3) : 0; f.style.transform = `translate(-50%,0) translate(${(Math.cos(ang) * r).toFixed(3)}em,${(Math.sin(ang) * r).toFixed(3)}em) scale(${(0.6 + 0.4 * (1 - q)).toFixed(3)}) rotate(${((i - 3) * 15).toFixed(0)}deg)`; });
    }
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
  // chest spot (portrait): used only when faces are known, as the first place to try when the face covers the usual spots
  // tall spot for stacked bubbles / chat threads: older lines grow upward, the newest sits at the bottom of the caption band
  POS['stack-tall'] = portrait ? { l: .08, r: .90, t: .30, b: Math.max(zb + 0.02, .70), ax: 'c', ay: 'e' } : { l: .06, r: .94, t: .30, b: zb - 0.015, ax: 'c', ay: 'e' };
  if (portrait) POS['low-center'] = { l: .11, r: .89, t: Math.max(zt, zb - 0.14), b: Math.min(0.70, zb + 0.015), ax: 'c', ay: 'e' };
  // PIN (--pin): one fixed spot for every phrase (user's explicit choice; ignores the platform-safe bottom area)
  if (D.pin) { const y = D.pin.y, hh = 0.14, t0 = Math.min(0.98 - hh, Math.max(0.02, y - hh / 2)), l0 = portrait ? 0.07 : 0.05, r0 = portrait ? 0.93 : 0.95, ax = D.pin.x === 'left' ? 'l' : D.pin.x === 'right' ? 'r' : 'c'; POS['pin'] = { l: ax === 'r' ? 0.20 : l0, r: ax === 'l' ? 0.80 : r0, t: t0, b: t0 + hh, ax, ay: 'c' }; }
  const PDEF = portrait ? 'mid-center' : 'bottom-center';
  const PSEQ_ALL = portrait ? ['mid-center', 'upper-left', 'mid-right', 'upper-right', 'mid-left', 'upper-center'] : ['bottom-center', 'upper-left', 'bottom-right', 'upper-right', 'bottom-left', 'mid-right', 'top-center', 'mid-left'];
  const PSEQ = PSEQ_ALL.filter((p) => !(D.posAvoid || []).includes(p));
  const PMODE = D.pos || 'varied';
  phrases.forEach((ph, i) => {
    if (D.pin) { ph.pos = 'pin'; ph.pos0 = 'pin'; return; }
    // stacked styles (oval bubbles, chat thread) keep the previous bubble's spot so the pile does not jump around
    if (S[ph.sid] && S[ph.sid].stack && !(D.posPlan || []).some((r) => ph.start >= r.from && ph.start < r.to)) { ph.pos = 'stack-tall'; ph.pos0 = 'stack-tall'; return; }
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
    root.style.setProperty('--cmax', Math.floor(W * (P.r - P.l) * 0.86) + 'px'); // wrapped cards never fill the whole spot, so pop-in overshoot stays inside
    if (TF) { root.style.transformOrigin = { l: '0% 50%', c: '50% 50%', r: '100% 50%' }[P.ax]; root.style.transform = TF; }
    if (shadeEl) { const a = D.shade || 0, cw = W * (P.r - P.l), ch = H * (P.b - P.t), ex = cw * 0.18, ey = ch * 0.9; const gx = P.ax === 'l' ? 30 : P.ax === 'r' ? 70 : 50, gy = P.ay === 's' ? 38 : P.ay === 'e' ? 62 : 50;
      Object.assign(shadeEl.style, { left: (W * P.l - ex) + 'px', width: (cw + 2 * ex) + 'px', top: (H * P.t - ey) + 'px', height: (ch + 2 * ey) + 'px', background: `radial-gradient(ellipse at ${gx}% ${gy}%, rgba(0,0,0,${a}) 0%, rgba(0,0,0,${(a * 0.85).toFixed(3)}) 42%, rgba(0,0,0,0) 72%)` }); }
  }
  const BEATS = (D.beats || []).slice().sort((a, b) => a - b);
  let mounted = -1, box = null, lastFit = null; window.layoutInfo = () => lastFit;
  const find = (t) => { let f = null; for (const ph of phrases) { if (t >= ph.vs && t < ph.ve) f = ph; } return f; };
  // faces (D.faces = [{t, boxes:[[x0,y0,x1,y1] as fractions]}] from find-faces.py): a caption must not cover a face. Spots are tried until the text is big enough AND clear of every face seen during the phrase.
  const FACES = D.faces || [];
  const facesFor = (ph) => FACES.filter((s) => s.t >= ph.vs - 0.5 && s.t <= ph.ve + 0.5).flatMap((s) => s.boxes.map((b) => { const h = b[3] - b[1]; return [Math.max(0, b[0] - 0.03), Math.max(0, b[1] - 0.03 - 0.35 * h), Math.min(1, b[2] + 0.03), Math.min(1, b[3] + 0.03)]; }));
  function faceHit(fb) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; box.querySelectorAll('.w, .card').forEach((e) => { const r = e.getBoundingClientRect(); if (r.width) { x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); } });
    const area = Math.max(1, (x1 - x0) * (y1 - y0)); let hit = 0;
    for (const f of fb) { const ix = Math.max(0, Math.min(x1, f[2] * W) - Math.max(x0, f[0] * W)), iy = Math.max(0, Math.min(y1, f[3] * H) - Math.max(y0, f[1] * H)); hit += ix * iy; }
    return Math.min(1, hit / area);
  }
  function mount(ph) {
    const fb = FACES.length ? facesFor(ph) : []; const avoid = D.posAvoid || [];
    const order = [ph.pos0]; if (!D.pin && WIDEN[ph.pos0]) order.push(WIDEN[ph.pos0]);
    if (fb.length && !D.pin) { if (POS['low-center'] && !order.includes('low-center')) order.splice(1, 0, 'low-center'); for (const p of Object.keys(POS)) if (!order.includes(p)) order.push(p); }
    const cand = order.filter((p, i) => POS[p] && (i === 0 || !avoid.includes(p)));
    let best = null;
    for (const p of cand) { ph.pos = p; layout(ph); ph.faceHit = fb.length ? faceHit(fb) : 0; const score = (ph.minPx >= MINPX ? 0 : 1) + ph.faceHit * 30; if (!best || score < best.score) best = { p, score }; if (ph.minPx >= MINPX && ph.faceHit <= 0.02) { best = null; break; } }
    if (best && ph.pos !== best.p) { ph.pos = best.p; layout(ph); ph.faceHit = fb.length ? faceHit(fb) : 0; }
    ph.widened = ph.pos !== ph.pos0;
  }
  function layout(ph) {
    const sty = S[ph.sid];
    root.innerHTML = ''; box = mk('div', 'box', root); box.style.willChange = 'opacity';
    applyPos(ph);
    // v1.4 styles use their own fonts (sizes already evened out by size-adjust), so the default Dongle size boost (fontScale) is undone for them
    root.style.fontSize = (FS * (sty.scale || 1) * (sty.v14 && D.fontScale > 1 ? 1 / D.fontScale : 1) * (ph.hook && D.hook !== 'off' ? 1.12 : 1)) + 'px'; box.classList.toggle('v14', !!sty.v14);
    sty.build(ph, box, isMix); mounted = ph.k;
    ph.emoMode = null; ph.emoInline = null;
    if (DECO.has('emoji') && ph.emo && !sty.ownEmoji) {
      ph.emoMode = emoModeOf(ph);
      if (ph.emoMode === 'end' || ph.emoMode === 'side') { // a real inline element, so the auto-fit below counts it
        const ws = ph.words.map((w) => elFor(ph, w)).filter(Boolean); const anchor = ph.emoMode === 'end' ? ws[ws.length - 1] : ws[0];
        if (anchor && anchor.parentNode) { const e = mk('span', 'w emo', null, ph.emo.e); Object.assign(e.style, { fontFamily: EMOF + ',sans-serif', fontWeight: 400, textShadow: 'none', lineHeight: '1', fontSize: ((ph.emoMode === 'side' ? 1.3 : 0.95) * EF(sty)).toFixed(3) + 'em', filter: 'drop-shadow(0 .05em .08em rgba(0,0,0,.45))', opacity: 0, transformOrigin: '50% 70%', marginLeft: ph.emoMode === 'end' ? '.18em' : '0', marginRight: ph.emoMode === 'side' ? '.12em' : '0', verticalAlign: 'middle' });
          if (ph.emoMode === 'end') anchor.appendChild(e); else anchor.parentNode.insertBefore(e, anchor); ph.emoInline = e; } // end: inside the last word so it never wraps onto a line of its own
        else ph.emoMode = 'top';
      }
      if (ph.emoMode === 'top' || ph.emoMode === 'burst') box.style.paddingTop = (1.5 * EF(sty)).toFixed(3) + 'em'; // room for the emoji above the text
      if (ph.emoMode === 'corner') { box.style.paddingTop = (0.7 * EF(sty)).toFixed(3) + 'em'; box.style.paddingRight = (0.6 * EF(sty)).toFixed(3) + 'em'; } // the sticker sticks out of the box's top-right corner
    }
    if (DECO.has('line')) box.style.paddingBottom = '.34em'; // room for the accent line
    // auto-fit: shrink the whole phrase if wider than 90% of the frame (or taller than the portrait band)
    const els = box.querySelectorAll('.w, .card'); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    els.forEach((e) => { const r = e.getBoundingClientRect(); if (!r.width) return; x0 = Math.min(x0, r.left); x1 = Math.max(x1, r.right); y0 = Math.min(y0, r.top); y1 = Math.max(y1, r.bottom); });
    const cw = root.clientWidth, ch = root.clientHeight, bh = box.getBoundingClientRect().height; // box height includes the emoji / line padding
    const slack = sty.slack || 1; let ratio = Math.min(sty.fill || 1, (cw * 0.97) / ((x1 - x0) * slack));
    ratio = Math.min(ratio, (ch * 0.94) / (Math.max(bh, y1 - y0) * slack)); // 6% of the spot's height stays free for pop / swell animations
    box.style.fontSize = (ratio * 100).toFixed(1) + '%'; lastFit = { ratio: +ratio.toFixed(3), cw, ch, bh: +bh.toFixed(1), w: +(x1 - x0).toFixed(1), h: +(y1 - y0).toFixed(1), rootFs: parseFloat(getComputedStyle(root).fontSize) };
    if (D.fontScale > 1) { const padPx = Math.round(parseFloat(getComputedStyle(root).fontSize) * ratio * 0.14); if (curPos.ay === 'e') box.style.marginBottom = padPx + 'px'; else if (curPos.ay === 's') box.style.marginTop = padPx + 'px'; } // pop overshoot grows with the (scaled-up) font size
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
  window.phraseTimes = () => phrases.map((ph) => ({ k: ph.k, vs: ph.vs, ve: ph.ve, sid: ph.sid, text: ph.words.map((w) => w.text).join(' ') }));
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
  // ======== v1.3 batch F (2026-11-01): overlays = name tags, inset pictures, side sound-word text ========
  // Not caption phrases: they live in their own layer (#ov) and follow their own time ranges (D.overlays, made by make-captions --overlays).
  // Every one of them is a pure function of t, like the captions, so parallel workers draw identical frames.
  const OVD = D.overlays || { tags: [], insets: [], sfx: [] };
  let ovLayer = document.getElementById('ov');
  if (!ovLayer) { ovLayer = document.createElement('div'); ovLayer.id = 'ov'; document.body.appendChild(ovLayer); }
  Object.assign(ovLayer.style, { position: 'absolute', left: '0px', top: '0px', width: W + 'px', height: H + 'px', pointerEvents: 'none' });
  const OVLIST = [], OV_PRELOAD = [];
  const OVM = 0.02; // keep every overlay at least 2% inside the frame edge
  const ovClamp = (el) => { const r = el.getBoundingClientRect(); if (!r.width) return; let dx = 0, dy = 0; if (r.left < W * OVM) dx = W * OVM - r.left; if (r.right > W * (1 - OVM)) dx = W * (1 - OVM) - r.right; if (r.top < H * OVM) dy = H * OVM - r.top; if (r.bottom > H * (1 - OVM)) dy = H * (1 - OVM) - r.bottom; if (dx) el.style.left = (parseFloat(el.style.left) + dx) + 'px'; if (dy) el.style.top = (parseFloat(el.style.top) + dy) + 'px'; };

  // 1) name tags: [name | description] chip that pops in and stays (speaker / label above a person)
  const TAGC = {
    blue: { bg: 'linear-gradient(180deg,#6AA6FF,#2F6BFF)', c: '#fff', bd: 'rgba(255,255,255,.65)', sh: '0 0 .35em rgba(70,130,255,.7),0 .06em .2em rgba(0,0,0,.35)' },
    white: { bg: '#FFFFFF', c: '#1F2430', bd: '#D5D9E2', sh: '0 .06em .2em rgba(0,0,0,.35)' },
    yellow: { bg: '#FFD21E', c: '#1F1A00', bd: '#C9A100', sh: '0 .06em .2em rgba(0,0,0,.35)' },
    dark: { bg: 'rgba(25,28,38,.9)', c: '#FFFFFF', bd: 'rgba(255,255,255,.35)', sh: '0 .06em .2em rgba(0,0,0,.4)' },
    mint: { bg: '#35D3B0', c: '#06382D', bd: 'rgba(255,255,255,.6)', sh: '0 .06em .2em rgba(0,0,0,.35)' },
    pink: { bg: '#FF7FA6', c: '#4A0A22', bd: 'rgba(255,255,255,.6)', sh: '0 .06em .2em rgba(0,0,0,.35)' },
  };
  OVD.tags.forEach((g, i) => {
    const cn = TAGC[g.color] || TAGC[['blue', 'white', 'yellow', 'dark', 'mint', 'pink'][i % 6]];
    const el = document.createElement('div');
    Object.assign(el.style, { position: 'absolute', whiteSpace: 'nowrap', display: 'flex', alignItems: 'baseline', gap: '.4em', padding: '.14em .62em .22em', borderRadius: '.5em', fontFamily: 'CapMain,CapBase,sans-serif', fontWeight: 800, fontSize: (FS * (g.size || 0.4)) + 'px', lineHeight: 1.15, background: cn.bg, color: cn.c, border: '.07em solid ' + cn.bd, boxShadow: cn.sh, opacity: 0, transform: 'translate(-50%,-50%)' });
    const nm = document.createElement('span'); nm.textContent = g.name || ''; el.appendChild(nm);
    if (g.desc) { const sp = document.createElement('i'); Object.assign(sp.style, { display: 'inline-block', width: '.07em', height: '.8em', background: cn.c, opacity: .45, alignSelf: 'center' }); el.appendChild(sp); const ds = document.createElement('span'); ds.textContent = g.desc; ds.style.fontSize = '.82em'; ds.style.fontWeight = 700; el.appendChild(ds); }
    const x = g.x ?? (i + 1) / (OVD.tags.length + 1), y = g.y ?? (portrait ? 0.15 : 0.1);
    el.style.left = (x * W) + 'px'; el.style.top = (y * H) + 'px'; ovLayer.appendChild(el); let fixed = false;
    OVLIST.push({ from: g.from, to: g.to, upd(t) {
      const a = t - g.from, b = g.to - t; if (a < 0 || b <= 0) { el.style.opacity = 0; return; }
      if (!fixed) { el.style.opacity = 1; ovClamp(el); fixed = true; }
      const p = clamp(easeBack(a / 0.28), 0, 1.1); el.style.opacity = clamp(a / 0.1) * clamp(b / 0.25); el.style.transform = `translate(-50%,-50%) scale(${(0.7 + 0.3 * p).toFixed(3)})`;
    } });
  });

  // 2) inset pictures: a small reference picture / clip with a blue selection frame and corner handles
  OVD.insets.forEach((g, i) => {
    const wpx = (g.w || (portrait ? 0.42 : 0.26)) * W, hpx = wpx * (g.ah / g.aw);
    const el = document.createElement('div');
    Object.assign(el.style, { position: 'absolute', width: wpx + 'px', height: hpx + 'px', opacity: 0, transform: 'translate(-50%,-50%)', left: ((g.x ?? 0.5) * W) + 'px', top: ((g.y ?? 0.2) * H) + 'px', boxShadow: '0 .1em .35em rgba(0,0,0,.45)' });
    const img = document.createElement('img'); Object.assign(img.style, { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }); el.appendChild(img);
    const fr = g.frame === 'none' ? null : document.createElement('div');
    if (fr) { const bc = g.frame === 'white' ? '#fff' : '#3D7BFF'; const bw = Math.max(2, W * 0.003); Object.assign(fr.style, { position: 'absolute', inset: '0', border: bw + 'px solid ' + bc, boxSizing: 'border-box' }); el.appendChild(fr); const hs = Math.max(10, W * 0.012);
      [[0, 0], [0.5, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [0.5, 1], [1, 1]].forEach(([a, b]) => { const h = document.createElement('i'); Object.assign(h.style, { position: 'absolute', left: (a * 100) + '%', top: (b * 100) + '%', width: hs + 'px', height: hs + 'px', marginLeft: (-hs / 2) + 'px', marginTop: (-hs / 2) + 'px', background: '#fff', border: bw + 'px solid ' + bc, boxSizing: 'border-box' }); el.appendChild(h); }); }
    const srcOf = (k) => `inset/${i}/${String(k + 1).padStart(4, '0')}.${g.ext}`;
    img.src = srcOf(0); OV_PRELOAD.push(img.decode().catch(() => {}));
    ovLayer.appendChild(el); let cur = 0;
    OVLIST.push({ from: g.from, to: g.to, async upd(t) {
      const a = t - g.from, b = g.to - t; if (a < 0 || b <= 0) { el.style.opacity = 0; return; }
      if (g.frames > 1) { let k = Math.floor(a * g.fps); k = g.loop === false ? Math.min(k, g.frames - 1) : k % g.frames; if (k !== cur) { cur = k; img.src = srcOf(k); try { await img.decode(); } catch (e) {} } }
      const p = clamp(easeBack(a / 0.3), 0, 1.1); el.style.opacity = clamp(a / 0.1) * clamp(b / 0.25); el.style.transform = `translate(-50%,-50%) rotate(${((g.rot || 0) * clamp(p, 0, 1)).toFixed(2)}deg) scale(${(0.6 + 0.4 * p).toFixed(3)})`;
    } });
  });

  // 3) side sound-word text ("휘~", "방긋방긋" ...): small tilted words that float beside the caption or a person
  const SFXMAP = [
    [/설레|두근|심쿵|사랑/, '두근두근'], [/깜짝|헉|헐|놀라|놀랍|대박/, '깜짝~'], [/ㅋㅋ|ㅎㅎ|웃|행복|기분 ?좋|신나/, '방긋방긋'],
    [/한숨|피곤|힘들|지쳐|지친/, '휴우…'], [/바람|산책|살랑|시원/, '휘~'], [/사진|찰칵|촬영/, '찰칵'], [/쾅|충격|폭발|반전/, '쾅!'],
    [/궁금|고민|생각|글쎄|왜\?/, '음~?'], [/맛있|먹|냠/, '냠냠'], [/춥|추워|덜덜|무서/, '덜덜'], [/박수|축하|성공|완성|해냈/, '짝짝짝'],
    [/졸려|잠|꿈/, '쿨쿨'], [/급해|서둘|빨리|서두/, '후다닥'], [/좋아|최고|멋/, '반짝'],
  ];
  const sfxList = (OVD.sfx || []).map((s) => Object.assign({}, s));
  if (D.sfxAuto) {
    let last = -99, n = 0; const MAXS = D.sfxMax ?? 6;
    for (const ph of phrases) {
      if (n >= MAXS || ph.start - last < 2.5) continue; const txt = ph.words.map((w) => w.text).join(' ');
      const hit = SFXMAP.find(([re]) => re.test(txt)); if (!hit) continue;
      const w = ph.words.find((x) => hit[0].test(x.text)) || ph.words[0]; const P = POS[ph.pos0] || POS[PDEF];
      const left = P.ax === 'r' ? true : P.ax === 'l' ? false : n % 2 === 0; const x = left ? Math.max(0.12, P.l - 0.02) : Math.min(portrait ? 0.84 : 0.9, P.r + 0.02);
      const y = Math.min(portrait ? 0.7 : 0.7, Math.max(portrait ? 0.12 : 0.08, P.t + (P.b - P.t) * 0.1));
      sfxList.push({ at: Math.max(ph.vs, w.start - 0.05), dur: Math.min(1.4, Math.max(0.7, ph.ve - w.start)), text: hit[1], x, y, rot: left ? -9 : 9 }); last = ph.start; n++;
    }
  }
  sfxList.forEach((g, i) => {
    const el = document.createElement('div'); const dur = g.dur || 1.2;
    Object.assign(el.style, { position: 'absolute', whiteSpace: 'nowrap', fontFamily: 'CapHand,CapMain,CapBase,sans-serif', fontWeight: 700, fontSize: (FS * (g.size || 0.62)) + 'px', color: g.color || '#FFFFFF', textShadow: OUT(0.07), opacity: 0, left: ((g.x ?? 0.84) * W) + 'px', top: ((g.y ?? 0.4) * H) + 'px', transform: 'translate(-50%,-50%)' });
    el.textContent = g.text; ovLayer.appendChild(el); let fixed = false; const rot0 = g.rot ?? 8;
    OVLIST.push({ from: g.at, to: g.at + dur, upd(t) {
      const a = t - g.at, b = g.at + dur - t; if (a < 0 || b <= 0) { el.style.opacity = 0; return; }
      if (!fixed) { el.style.opacity = 1; ovClamp(el); fixed = true; }
      const p = clamp(easeBack(a / 0.22), 0, 1.15); el.style.opacity = clamp(a / 0.08) * clamp(b / 0.25);
      el.style.transform = `translate(-50%,-50%) translateY(${(Math.sin(t * 5 + i) * 0.12 - a * 0.1).toFixed(3)}em) rotate(${(rot0 + Math.sin(t * 9 + i) * 3).toFixed(2)}deg) scale(${(0.5 + 0.5 * p).toFixed(3)})`;
    } });
  });
  // 4) title badge (--title / overlays.titles): a fixed label at the top of the frame, emoji welcome ("자막 모션 v2 🎁")
  const TITC = { white: ['#FFFFFF', '#111', '#D9D9DE'], yellow: ['#FFE14D', '#1E1A00', '#C9A800'], dark: ['rgba(20,22,28,.9)', '#fff', 'rgba(255,255,255,.3)'], pink: ['#FFE1EE', '#5A1838', '#FF8DBE'], mint: ['#CFF5E6', '#0D4A3A', '#35C29A'] };
  (OVD.titles || []).forEach((g) => {
    const [bg, fg, bd] = TITC[g.style] || TITC.white; const el = document.createElement('div');
    Object.assign(el.style, { position: 'absolute', whiteSpace: 'nowrap', padding: '.1em .5em .16em', background: bg, color: fg, border: '.05em solid ' + bd, borderRadius: '.1em', fontFamily: FAM('CapHeavy'), fontWeight: 900, letterSpacing: '-.02em', fontSize: (FS / (D.fontScale || 1) * (g.size || 0.55)) + 'px', lineHeight: 1.15, boxShadow: '0 .05em .16em rgba(0,0,0,.35)', left: ((g.x ?? 0.5) * W) + 'px', top: ((g.y ?? (portrait ? 0.125 : 0.08)) * H) + 'px', transform: 'translate(-50%,-50%)', opacity: 0 });
    el.textContent = g.text; ovLayer.appendChild(el); let fixed = false;
    OVLIST.push({ from: g.from, to: g.to, upd(t) { const a = t - g.from, b = g.to - t; if (a < 0 || b <= 0) { el.style.opacity = 0; return; } if (!fixed) { el.style.opacity = 1; ovClamp(el); fixed = true; } el.style.opacity = clamp(a / 0.2) * clamp(b / 0.25); } });
  });
  const ovActive = (t) => OVLIST.some((o) => t >= o.from && t < o.to);
  const ovUpdate = async (t) => { for (const o of OVLIST) { const r = o.upd(t); if (r && r.then) await r; } };
  window.overlayInfo = () => ({ titles: (OVD.titles || []).length, tags: OVD.tags.length, insets: OVD.insets.length, sfx: sfxList.length, sfxList: sfxList.map((s) => ({ at: +(+s.at).toFixed(2), text: s.text })) });
  // QA for the renderer: every visible overlay must stay inside the frame
  window.overlayBounds = () => [...ovLayer.children].filter((e) => getComputedStyle(e).opacity !== '0').map((e) => { const r = e.getBoundingClientRect(); return { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom }; });
  window.visible = (t) => !!find(t) || ovActive(t);
  window.seek = async (t) => {
    await ovUpdate(t);
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
    const els = root.querySelectorAll('.w, .card, .dec:not(.fly)'); if (!els.length) return null;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    els.forEach((e) => { const r = e.getBoundingClientRect(); if (r.width === 0 || getComputedStyle(e).opacity === '0') return; x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); });
    return x0 > 1e8 ? null : { x0, y0, x1, y1, W, H };
  };
  const FONTS_TO_LOAD = ['800 40px CapBase', '800 40px CapMain', '400 40px CapDisplay', '700 40px CapCalm', '700 40px CapHand', '800 40px CapSerif', '400 40px CapPen', '400 40px CapBrush', '400 40px CapSfx', '400 40px CapCute', '900 40px CapHeavy', '700 40px CapRound', '400 40px CapFat', ...(D.emoji && D.emoji.font ? ['400 40px ' + D.emoji.font] : [])];
  Promise.all(FONTS_TO_LOAD.map((f) => document.fonts.load(f, '가나다ABC😀').catch(() => null))).then(() => Promise.all(OV_PRELOAD)).then(() => {
    window.ready = true;
    // demo mode (picker): loop the caption forever
    if (DEMO != null && P.get('still') == null) { const t0 = performance.now(); let busy = false; const tick = async () => { if (!busy) { busy = true; try { await window.seek(((performance.now() - t0) / 1000) % D.duration); } catch (e) {} busy = false; } requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
    else if (DEMO != null) window.seek(+P.get('still') || 1.2);
  });
})();





