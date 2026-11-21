# 바뀐 기록 / Changelog

## 1.4.0 (2026-11-21)

- 새 자막 스타일 30개 / 30 new styles
  - 릴스: reels-clean, reels-box-stack, reels-tint-boxes, reels-mint-stack, reels-pink-outline, reels-pink-small, reels-lime-impact, reels-italic-grad, reels-gift-box, reels-word-chips, reels-qa, reels-haze, reels-twotone, emoji-lead
  - 말풍선·대화: bubble-oval-stack, bubble-tail-up, bubble-sticky, bubble-whisper, chat-left, chat-right, chat-yellow, chat-thread, bubble-focus-burst, bubble-spiky, bubble-shout, bubble-hand-ellipse, bubble-cloud, paper-note
  - 손글씨: sfx-glow, glow-title-hand
- 이모지 v2: 사전 약 330단어(12묶음) + 문장 분위기, 자리 5가지(`--emoji-pos`), 움직임 6가지(`--emoji-anim`), 간격·최대(`--emoji-gap`, `--emoji-max`), Noto Color Emoji 선택(`--emoji-font`) / emoji v2
- 글꼴 34종(`scripts/fonts.mjs list|fetch|measure|sheet`), 글꼴별 크기(size-adjust)·자간·장평·기울기, `--tracking --width --slant`, 역할별 `--fonts` / 34 fonts with per-font profiles
- 고르기 화면 `scripts/picker.mjs` / live style picker
- 편집용 자막별 투명 레이어 `render.mjs final --layers [prores|webm|png]` + FCPXML·Premiere XML·CSV, 원본과 같은 정확한 프레임율 / per-caption layers at the exact source frame rate
- `--look` 분위기 묶음 8개, `--mix-pool`, 제목 배지 `--title`, 디버그 `render.mjs probe` / looks, mix pool, title badge, probe
- mix: 이거다·헉·쉿·속마음·쓰담·끝! 같은 짧은 말에 말풍선·효과음 스타일 자동 배정
- 작업 폴더에는 쓰는 글꼴만 복사

## 1.3.0 (2026-11-01)

- 새 스타일 34개: 작은 줄+큰 줄 임팩트(duo-*), 한 줄 테마(solo-*), 알약·판·태그, 화자 색 말풍선, quote-frame, laugh-tiles, horror-serif, chip-bar, paper-strip
- 오버레이: 이름표(tags), 작은 화면(insets), 옆 의성어(sfx, `--sfx auto`)
- 기본 글꼴 동글 볼드, 무료 글꼴 7종 추가, `--font classic`
- 위치 고정 `--pin`, 방송 자막 `broadcast`, 차분한 `plain`
## 1.2.0 (2026-10-30)

- 새 자막 스타일 30개 (총 72개 + plain + mix) / 30 new styles
  - 가사·키네틱: stagger-center, split-reveal, rubber-stretch, spin-in, blur-focus, slot-roll, echo-trail, swing-hang, drop-letters, skew-slide
  - 예능·뉴스·레트로: variety-outline, alert-bar, vhs-retro, comic-burst, tape-strip, paper-cut, sticker-peel, doodle-circle, pixel-game, retro-shadow
  - 정보·숫자·퀴즈: count-up, check-list, quiz-card, progress-bar, bullet-point, arrow-point, bracket-focus, price-tag, search-bar, percent-ring
- 새 기능: `export-subs.mjs`(SRT·VTT·ASS 노래방), `batch.mjs`(폴더), `sample.mjs`·`start.mjs --sample`(움직이는 샘플), `--preset`/`--save-preset`, 숫자 조각 합치기(`--merge-numbers off`), `--encoder auto`가 videotoolbox·nvenc·qsv·amf 시도, 시안 여러 장 분할
- 고침: start.mjs가 `PYTHON`·`scripts/local.json`으로 파이썬을 찾고 해결법을 알려 줌, `--video`도 받음; 강조 블록이 다 덮은 뒤 글자색이 바뀜; 겹친 얼굴 상자 하나만 남김; 얼굴 상자를 이마까지 넓힘; 큰 얼굴 경고와 가슴 자리; 감정 사전 확장(놀랍·헐·우와, ~일까?/~나요?, 짧은 !·? 문장)

## 1.1.0 (2026-10-29)

- 새 자막 스타일 23개 (총 42개 + plain + mix) / 23 new caption styles
  - 감정·의성어: sway-breeze(살랑), jitter-nerve(덜덜), heart-thump(두근), tilt-wonder(갸웃), jolt-pop(깜짝), droop-sigh(시무룩), boom-shake(쾅)
  - 배치: neon-flicker, duo-tight, rise-lines, num-box, chip-pop, mask-slide, flip-card
  - 장식: glitch-split, script-write, speech-bubble, marker-swipe, bounce-word, wobble-outline, grad-shift, chorus-zoom, ink-seal
- mix: 감정 단어에 감정 모션 자동 배정, 한 영상 최대 4번·3초 간격 (`--fx off`, `--fx-max`)
- 두 줄 자막 행간 옵션 (`--line-ratio`, `--line-gap`)
- 빠른 컷·빠른 말에서 등장 시간 자동 단축 (`--fast off`, `--speed`)
- README 오타 수정(코드 블록, `render.mjs` 이름)

## 1.0.0 (2026-10-24)

- 첫 공개: 19개 스타일 + plain + mix, 안전 구역, 얼굴 피하기, 박자, 병렬 렌더, 글꼴 5종
