# 바뀐 기록 / Changelog

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
