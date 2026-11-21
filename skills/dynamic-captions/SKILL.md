---
name: "dynamic-captions"
description: "영상(말하는 영상, 랩·노래 가사 영상, 쇼츠, 롱폼)을 주면 말과 가사를 단어 단위로 받아 적고, 같은 장면에 130개가 넘는 자막 스타일(릴스 흰 글자·상자 쌓기·라임 임팩트, 이모지 자막, 말풍선·메신저 대화·집중선·뽰족 터짐, 감정·의성어, 가사·키네틱, 예능·뉴스·레트로, 정보·숫자·퀴즈, 작은 줄+큰 줄 임팩트)과 문장마다 스타일을 바꾸는 자동 섞기(mix) 시안을 먼저 보여 준 뒤, 고른 스타일로 자막이 박힌 mp4, 투명 자막(.mov), 편집 프로그램용 자막별 투명 레이어(FCPXML·Premiere XML)를 만든다. 내 문구를 쳐서 모든 스타일을 움직이는 그대로 보고 고르는 화면(picker), 무료 한글 글꼴 34종과 글꼴별 자간·장평·기울기, 단어에 맞춰 붙는 이모지(5가지 자리·6가지 움직임)를 지원한다. 자막이 왼쪽·오른쪽·위·아래로 돌아가며 나오고, 얼굴을 피하고, 박자에 맞춰 살짝 커지고, 후렴은 크게 나온다. 자막 스타일, 다이나믹 자막, 가사 자막, 자막 효과, 이모지 자막, 말풍선 자막, 자막 글꼴, 자막 시안, 자막 레이어, 쇼츠·릴스 자막 요청에 사용한다."
---

# dynamic-captions (영상 → 자막 스타일 시안 → 최종 자막 영상)

JIZURA(노래 가사 타이포)와 GitHub 오픈소스 자막 스킬들의 아이디어를 모아 만든 도구다. 출처와 라이선스는 `references/sources.md`. 모든 스크립트는 `scripts/` 폴더에 있고, 아래 명령의 `scripts/`는 이 스킬 폴더 기준이다. Python은 `python`(아래 준비물의 패키지가 설치된 것)을 쓴다.

## 준비물 (쓰기 전에 있어야 하는 것)

| 준비물 | 어디에 쓰나요 | 꼭 필요한가요 |
|---|---|---|
| Node.js 18 이상 | 모든 스크립트 | 필수 |
| ffmpeg와 ffprobe (PATH에 있어야 함) | 영상 읽기, 자막 합성 | 필수 |
| Chrome 또는 Chromium (못 찾으면 환경변수 `CHROME`에 경로) | 자막을 그리는 화면 | 필수 |
| Python 3.10 이상 + `pip install openai-whisper numpy` | 말·노래 받아쓰기(`transcribe.py`) | 필수(대본 시간표가 따로 있으면 생략 가능) |
| `pip install librosa` | 노래 박자 검출(`detect-beat.py`) | 선택 |
| `pip install opencv-python-headless` | 얼굴 찾기(`find-faces.py`) | 선택 |
| 자막이 박혀 있지 않은 원본 영상 | 새 자막과 겹치지 않게 | 필수 |
| 대본이나 가사 텍스트 | 철자 맞추기(`align-script.mjs`) | 권장 |
| NVIDIA 그래픽카드 | 빠른 인코딩(`--encoder auto`) | 선택 |

## 바꿔 쓰기: 이렇게 말하세요

| 이렇게 말하면 | 바뀌는 것 |
|---|---|
| "자막을 더 크게 / 작게" | `--scale 1.4` / `--scale 0.9` |
| "자막이 한쪽에만 나오게" | `--pos fixed` 또는 `--pos bottom-left` |
| "자막을 한 자리에 딱 고정해서(방송 자막처럼, 위치가 안 바뀌게)" | `--pin 0.79`(높이 79% 지점, 79도 가능) + `--style broadcast`. 가로 위치는 `--pin-x center|left|right`. 아래 "위치 고정(pin)" 절 |
| "배경이 밝아서 안 보여" | `--shade 0.5` |
| "인물 얼굴을 가리지 마" | `find-faces.py` 후 `--faces faces.json` |
| "노래 박자에 맞춰" | `detect-beat.py` 후 `--beat beat.json` |
| "말하는 사람 이름표 달아줘" | `--overlays overlays.json`의 `tags` (아래 "오버레이" 절) |
| "참고 화면을 작게 띄워줘" | `--overlays`의 `insets` (그림 또는 짧은 영상, 파란 선택 상자 손잡이) |
| "옆에 의성어(휘~, 방긋방긋) 넣어줘" | `--sfx auto`(자동) 또는 `--overlays`의 `sfx`(직접) |
| "이모지 넣어줘 / 릴스처럼" | `--emoji auto`(단어에 맞는 이모지, 2.5초 간격) 또는 `--look reels-pop` |
| "이모지 자리·움직임·횟수 바꿔줘" | `--emoji-pos end\|top\|corner\|burst\|side`, `--emoji-anim pop\|bounce\|wiggle\|float\|spin\|pulse`, `--emoji-gap 2`, `--emoji-max 6`, 내 사전 `--emoji-map` |
| "밑줄 넣어줘" | `--deco line` |
| "말풍선으로 / 대화처럼" | `--style bubble-tail-up`(꼬리), `bubble-oval-stack`(타원 쌓기), `chat-thread`(메신저), `--look talk-bubble` / `--look chat` |
| "글꼴 바꿔줘 / 예쁜 손글씨" | `--font nanumpen`(34종: `node scripts/fonts.mjs list`, 견본 그림 `fonts.mjs sheet`), 역할별 `--fonts hand=nanumbrush,sfx=dokdo-east` |
| "자간 좁게 / 장평 좁게 / 기울여줘" | `--tracking -0.04` / `--width 92` / `--slant -8`(기본은 글꼴마다 정해 둔 값) |
| "위에 제목 띠 고정해줘" | `--title "자막 모션 v2 🎁" --title-style white\|yellow\|dark\|pink\|mint` |
| "내 문구로 스타일을 다 보고 고를래" | `node scripts/picker.mjs <job> --open` (아래 "고르기 화면") |
| "고른 것들로만 섞어줘" | make-captions에 `--mix-pool a,b,c`, render에 `--style mix` |
| "프리미어·파이널컷·다빈치·캡컷에서 자막만 따로 쓸래" | `render.mjs final <job> --style <id> --layers`(자막별 투명 MOV + timeline.fcpxml + timeline-premiere.xml + layers.csv), `--layers webm` / `png` |
| "분위기를 한 번에" | `--look reels-pop\|cute-vlog\|talk-bubble\|chat\|calm-explainer\|variety-show\|lyric-mood\|kids-story` + `--style mix` |
| "색을 바꿔줘" | `--palette mint`(gold, mint, sky, rose, lime) |
| "빨리 만들어줘" | `--workers 4 --encoder auto` |
| "투명 자막 파일도 줘" | `--alpha` |
| "문장마다 스타일을 내가 정할게" | `--plan plan.json` |
| "감정 효과(살랑·덜덜·두근·갸웃·깜짝·시무룩·쾅) 넣어줘" | `--style mix`(기본으로 감정 단어에 자동, 한 영상 최대 4번) 또는 `--style heart-thump` 처럼 직접 |
| "감정 효과는 빼줘" / "2번만" | `--fx off` / `--fx-max 2` |
| "두 줄 자막 줄 사이 좁게" | `--style duo-tight --line-ratio 0.4 --line-gap 4` |
| "컷이 빨라서 자막이 굼떠 보여" | 자동으로 빨라짐. 더 빠르게 `--speed 0.6`, 끄려면 `--fast off` |
| "유튜브 자막 파일(SRT)도 줘" | `node scripts/export-subs.mjs --job <job>` → srt·vtt·ass(노래방) |
| "폴더에 있는 영상 전부" | `node scripts/batch.mjs <폴더> --lang ko` |
| "이 설정 저장해 / 저번 설정으로" | `--save-preset brand.json` / `--preset brand.json` |
| "효과 움직임을 영상으로 보고 싶어" | start.mjs에 `--sample`, 또는 `node scripts/sample.mjs <job> --styles a,b` |
| "네온 제목 / 타자기 / 말풍선 / 형광펜으로" | `--style neon-flicker` / `typewriter` / `speech-bubble` / `marker-swipe` |


## 흐름 (영상 하나당 이 순서)

**파이썬 위치**: `start.mjs`는 `PYTHON` 환경변수 → `scripts/local.json`의 `"python"` → `python`/`python3`/`py` 순서로 Whisper가 깔린 파이썬을 찾는다. 못 찾으면 해결법 3가지를 알려 주고 종료 코드 3으로 멈춘다.

**빠른 시작(한 줄)**: `node scripts/start.mjs <영상> --lang ko [--script 가사.txt] [--faces] [--beat --bpm-hint 88] --out job` 가 아래 2~5단계(받아쓰기, 철자 맞추기+청취 클립, 얼굴, 박자, 작업 폴더, 시안)를 한 번에 하고 `overview.png` 에서 멈춘다. 그 뒤 스타일을 골라 `render.mjs final` 만 실행하면 된다. 단계별로 직접 하고 싶을 때만 아래를 따른다.

1. **입력 확인**: 영상 파일, 말인지 노래인지, 가로(16:9)인지 세로(9:16)인지, 영상에 이미 박힌 자막이 있는지 본다. 이미 박힌 자막이 있으면 새 자막과 겹치므로 사용자에게 알리고 자막 없는 원본을 받는다.
2. **단어 시간표 만들기** (`words.json`)
   - 말소리와 노래 모두 먼저: `python scripts/transcribe.py <영상 또는 음원> --out words.json --lang ko` (Whisper large-v3-turbo, 단어 단위). 빨간 글씨로 나오는 Triton 경고(`Failed to compile`, `Python.h not found`, `falling back to a slower ... implementation`)는 모두 같은 종류이며 결과에 영향이 없으니 무시한다(종료 코드가 0이면 정상). 끝 침묵에서 Whisper가 지어낸 말은 자동으로 버리고, 음표·깨진 글자가 20%를 넘으면 종료 코드 3으로 막는다. 결과에는 `precision`(word-level 또는 cue-level)이 기록된다. 대본·가사가 있으면 `--prompt-file script.txt`로 철자 힌트를 줄 수 있다(시험에서 효과는 작아서 12곳이 11곳으로 줄었다).
   - LRC·SRT만 있고 목소리 시간이 필요 없을 때는 `make-captions`의 `--lrc` / `--srt`를 쓴다. 줄 안 단어 시각은 글자 수 비례 **추정**이라 보고서에 "추정"이라고 적는다. 영상을 오디오 맨 앞이 아니라 중간부터 잘랐다면 `--shift <잘라 낸 초>`를 준다(20초부터 자른 클립은 `--shift 20`).
   - **대본이나 가사가 없으면** 아래 철자 맞추기와 청취 확인 단계는 건너뛴다. 대신 받아쓰기 결과를 눈으로 읽어 이름·숫자·고유명사를 고치고(`words.json`을 직접 고쳐도 된다), 소리와 맞는다고 쓰지 않는다.
   - **대본이나 가사가 있으면 반드시 철자를 맞춘다**: `node scripts/align-script.mjs --words words.json --script script.txt --out words.aligned.json`. 철자는 대본에서, 시간은 목소리에서 가져온다(글자 단위 정렬이라 띄어쓰기가 달라도 된다). 단어 하나의 길이는 최대 1.8초로 자른다(`--max-word`). 일치율이 60% 미만이면 다른 영상이거나 다른 구간이므로 멈춘다. `[Verse]` 같은 태그 줄은 뺀 순수 가사만 `script.txt`에 둔다.
   - **직접 들어 확인할 곳 만들기**: AI는 소리를 못 듣는다. `node scripts/listen-check.mjs --video <영상> --aligned words.aligned.json --out <폴더>`가 가사와 받아쓰기가 다른 곳마다 6초 클립을 잘라 `listen-check.mp4`(+`listen-check.md` 표)로 묶는다. 사용자가 약 1분 들어 보고 어느 단어가 틀렸는지 답하게 한다. 이 확인 전에는 "가사와 소리가 맞다"고 쓰지 않는다.
   - 강조할 단어를 정한다(문장마다 1개 정도, 영상에서 실제 중요한 말만): `--emphasis "단어,단어"` 또는 words.json의 `"emph": true`. 정하지 않으면 숫자, 천천히 말한 단어, 가장 긴 단어 순으로 잡힌다.
3. **작업 폴더 만들기**: `node scripts/make-captions.mjs --video <영상> --words words.aligned.json --out <작업폴더>/job [옵션]`. 프레임 파일이 길이만큼 쌓이므로 디스크 여유가 있는 곳에 둔다. 임시 프레임 폴더는 `--tmp`, 환경변수 `DYNCAP_TMP`, `scripts/local.json`의 `tmp` 순으로 정하고 없으면 시스템 임시 폴더다. 옵션은 아래 "옵션 모음".
4. **스타일 시안 먼저**: `node scripts/render.mjs preview <job>` → `job/preview/overview.png`, `overview-2.png` …(한 장에 세로 16개·가로 12개씩 나눠 담은 전 스타일 비교), `style-<id>.png`(스타일별 4장면), `mix-plan.json`(자동 섞기가 문장마다 고른 스타일과 자리). 시안은 첫 4장면뿐 아니라 **모든 문장**의 자리·크기·얼굴 겹침을 검사한다. **답변 본문에 overview.png를 붙이고 전체 경로를 적는다.** 사용자가 고른 스타일은 `references/choices.md`(없으면 새로 만든다)에 한 줄 적고 다음 영상의 추천 순서에 반영한다. 사용자가 고르기 전에는 전체 렌더를 하지 않는다. 묻지 않는 자동 실행이면 아래 표에서 추천 1개를 고르고 이유를 한 줄 남긴다.
5. **최종 렌더**: `node scripts/render.mjs final <job> --style <id> [--range 시작,끝] [--alpha] [--encoder auto] [--workers 4]`
   - 긴 영상은 먼저 `--range 0,20` 같은 20초 샘플을 보여 주고 승인 후 전체를 돌린다.
   - `--workers N`(기본 3): N개의 Chrome이 프레임을 나눠 그린다. 75초 1080p에서 1개 197초 → 4개 64초(약 3배). 같은 구간을 1개와 4개로 만들어 비교했을 때 프레임 수가 같고 화면은 거의 같았다(PSNR 55.7dB). `--workers 1`이 옛 방식이다.
   - `--encoder auto`: NVIDIA GPU 인코더(h264_nvenc)가 되면 쓰고 아니면 CPU로 돌아간다. 기본은 CPU(libx264).
   - **final이 `구역 경고`로 멈추면**(긴 문장이 자기 자리 밖으로 나감): `make-captions`를 `--scale`만 0.1~0.2 낮춰서 새 폴더에 다시 만들고 final을 다시 돌린다. 시안을 처음부터 다시 볼 필요는 없지만, 글자 크기를 바꾸면 얼굴 겹침 결과도 바뀌니 `얼굴:` 줄을 다시 읽는다. `--allow-overflow`는 이유를 보고할 때만 쓴다.
   - 결과 파일 이름은 `captioned-<스타일>.mp4`(구간을 주면 `captioned-<스타일>-<시작>-<끝>.mp4`), `--name`으로 바꿀 수 있다. `job/out` 폴더는 첫 렌더가 성공해야 만들어진다. 결과: `job/out/<이름>.mp4`(소리 유지), `--alpha`면 투명 자막 `…-alpha.mov`(ProRes 4444, 70초에 244MB라 필요할 때만), 검수 시트 `…-sheet.png`, 결과 기록 `<이름>.json`(스타일, 인코더, 워커 수, 시간 정밀도, 구역 경고, 읽기 속도, 글씨 크기, 문장별 자리).
   - 렌더 시간은 영상 길이의 약 1~3배다(워커·GPU에 따라). 가변 프레임율 영상(AI 영상 내보내기는 60fps 표시지만 실제 약 24fps)은 `make-captions`가 자동으로 실제 프레임율에 맞춘다.
6. **검수 (직접)**: 장면은 `ffmpeg -ss 4.5 -i <최종.mp4> -frames:v 1 scene1.png`처럼 한 장씩 뽑을 수 있다(여러 시각을 한 번에 보려면 `-vf "fps=1/2,scale=480:-2,tile=4x3"`). 시트와 최종 mp4에서 장면 몇 곳을 이미지로 직접 열어 글자 판독, 잘림, 안전 구역, 얼굴 가림, 강조 단어를 본다. 프레임 수·길이·소리 유무는 `ffprobe`로 확인한다. 직접 들은 것이 아니면 들었다고 쓰지 않는다. 산출물은 전체 경로를 적고 가능하면 탐색기에서 파일을 선택해 열어 준다.

## 옵션 모음 (`make-captions.mjs`)

| 옵션 | 뜻 |
|---|---|
| `--palette gold|mint|sky|rose|lime` | 강조색(베이지 계열은 없음) |
| `--scale 1.3` | 글자 크기 배율. 16:9 가사·말 영상은 1.25~1.3부터 시안으로 본다 |
| `--shade 0.4` | 자막 뒤에 부드러운 어두운 띠를 깔아 밝은 화면에서도 읽히게(0~1) |
| `--pos varied|fixed|<자리이름>` | 기본 varied: 문장마다 자리가 왼쪽·오른쪽·위·아래로 바뀜(같은 자리 연속 없음) |
| `--pos-avoid a,b` | 비워 둘 자리. 얼굴 정보(`--faces`)가 있으면 자동으로 피하므로 보통 필요 없음 |
| `--pos-plan plan.json` | `[{"from":0,"to":6,"pos":"upper-left"}]` 구간별 고정 자리 |
| `--faces faces.json` | 자막이 얼굴을 가리지 않게 자리를 고름(아래 "얼굴 피하기") |
| `--beat beat.json` `--beat-strength 0.045` | 노래의 박마다 자막이 살짝 커졌다 돌아옴(아래 "노래 효과") |
| `--hook off` | 후렴(반복되는 줄) 자동 감지를 끔 |
| `--fx off` `--fx-max 4` | mix에서 감정·의성어 단어(좋아·여유 / 급해·무서 / 설레·두근 / 궁금·왜? / 깜짝·헉 / 아쉽·실망 / 쾅·충격)에 감정 모션을 자동으로 붙임. 기본 켜짐, 한 영상 최대 4번, 3초 이상 간격(과하지 않게 2~4번 권장) |
| `--line-ratio 0.45` `--line-gap 6` | duo-tight 두 줄 자막: 작은 줄 크기(큰 줄의 배율, 너무 작으면 최소 글씨 크기를 지키려 0.49배 아래로는 안 내려감), 줄 사이(px, 1080 기준) |
| `--preset brand.json` `--save-preset brand.json` | 모양 옵션(색·크기·그림자·자리·글꼴·장식·감정 효과·행간·속도)을 파일로 저장하고 불러옴. 명령에 직접 쓴 옵션이 우선 |
| `--overlays overlays.json` | 이름표·작은 화면·옆 의성어 글씨(형식은 `references/overlays.example.json`, 시간은 `--shift`를 따라감) |
| `--sfx auto` `--sfx-max 6` | 감정·소리 단어에 옆 의성어 글씨를 자동으로 붙임(두근두근·깜짝~·방긋방긋·휘~·찰칵 등 14종, 2.5초 간격, 최대 6번). 기본은 꺼짐 |
| `--merge-numbers off` | 받아쓰기가 "39" + ",000원"처럼 쪼갠 숫자를 합치는 기능(기본 켜짐)을 끔 |
| `--fast off` `--speed 0.7` | 자막이 빨리 바뀌는 영상(빠른 컷·빠른 말)은 새 스타일의 등장 시간이 자동으로 최대 45% 짧아짐. `--speed`로 직접 정함(1=보통) |
| `--plan plan.json` | mix에서 구간별 스타일 고정: `[{"from":0,"to":8,"style":"hero-key"}]` |
| `--deco emoji,line` | 이모지 / 자막 밑 강조선. **기본 끔**(아래 "선택 장식") |
| `--emoji-map map.json` | `{"단어":"이모지"}` 직접 지정이 기본 목록보다 우선 |
| `--shift N`, `--zone 위,아래`, `--emphasis` | 위 흐름 참고 |

## 오버레이: 이름표·작은 화면·옆 의성어 (1.3.0)

자막 문장과 따로, 자기 시간대에 맞춰 나오는 장식이다(`--overlays overlays.json`). 좌표는 화면 가로·세로의 비율(0~1, 중심 기준)이다. 화면 가장자리에서 2% 안쪽으로 자동으로 밀어 넣고, 세로 영상에서 위 8%·아래 25%에 걸리면 `make-captions`가 주의를 알린다. 자막과 겹치지 않는지는 시안·검수 장면에서 직접 본다(자동 검사 없음).

- **tags(이름표)**: `{"name":"민수","desc":"자막 없음","x":0.28,"y":0.15,"color":"white|blue|yellow|dark|mint|pink","from":0,"to":21}`. 이름 | 설명 모양의 칩이 톡 튀어나와 머무른다. x·y를 안 주면 위쪽에 고르게 놓인다. 화면 속 인물 머리 위에 맞추려면 얼굴 위치(`find-faces.py`)를 보고 직접 정한다.
- **insets(작은 화면 삽입)**: `{"src":"ref.png 또는 clip.mp4","x":0.5,"y":0.3,"w":0.4,"from":3,"to":6,"frame":"blue|white|none","rot":-2,"clipFrom":0,"clipDur":3,"loop":true}`. 그림은 그대로, 영상·GIF는 초당 12장으로 풀어 재생한다(최대 30초). 파란 선택 상자와 8개 손잡이가 붙고, 팝 하며 들어왔다가 사라진다. 소리는 넣지 않는다.
- **sfx(옆 의성어)**: `{"text":"휘~","at":1.0,"dur":1.2,"x":0.84,"y":0.42,"rot":8,"size":0.62,"color":"#FFFFFF"}`. 손글씨체 작은 글자가 살짝 기울어 둥실 떠오른다. `--sfx auto`는 자막 자리의 반대편 옆에 자동으로 놓는다.
- 시간은 `--shift`를 따라 같이 당겨진다. 오버레이만 있는 구간도 렌더 대상이 된다.
- 참고 영상의 '효과음(소리)'은 구현하지 않았다. 소리 효과가 필요하면 별도로 넣는다.

## 위치 고정 (`--pin`, 2026-11-05)

- 모든 자막이 **같은 높이 한 자리**에 나오고 절대 움직이지 않는다(방송·영화 자막 방식). `--pin 0.79`는 자막 중심이 화면 높이의 79%라는 뜻이다. 0.03~0.97 사이. `79`처럼 써도 된다. 가로 맞춤은 `--pin-x center`(기본)|`left`|`right`.
- 켜면 `--pos`, `--pos-plan`, 후렴 가운데 배치, 얼굴 피하기가 모두 꺼진다(자리를 바꾸지 않는 것이 목적). 한 줄 최대 높이는 화면의 14% 띠 안이다.
- **안전 구역을 사용자가 일부러 넘는 옵션**이다. 세로 영상의 아래 약 30%(앱 버튼·설명 글)와 가로 영상의 아래 22%(유튜브 자막 CC)를 비우는 규칙은 pin에서 적용하지 않고(`make-captions`가 주의 문구를 출력, 렌더는 화면 가장자리 밖으로 나가는 것만 막음) 결과 보고에 "pin: 안전 구역에 걸침"이라고 적는다. 안전 구역 안에서 고정하고 싶으면 세로 `--pin 0.60` 안팎, 가로 `--pin 0.70` 안팎을 쓴다. `--preset`에도 저장된다(`pin`, `pin-x`).
- 얼굴을 피하지 않으므로 얼굴·손이 자막 뒤에 오는지 시안(`preview`)과 최종 장면에서 직접 본다. 참고 화면(택시 영상): 세로, 높이 79%, 가운데, 흰 글자 한 줄. `--style broadcast`가 그 모양(흰 굵은 글자+얇은 검은 윤곽, 박스 없음, 한 줄이 한꺼번에 나타남, 글자 높이 약 3%)이고 `mix`에는 섞이지 않는다.
- 시험(2026-11-05, 합성 세로 8초 영상 1080×1920, 4장면 중 2장면 직접 확인): 두 장면의 자막 높이가 같았고 한 줄로 나왔으며 `render final`이 구역 경고 없이 끝났다. 가로 영상·실제 말하는 긴 영상·다른 스타일에서는 아직 확인하지 않았다.

## 1.4.0: 이모지·말풍선·글꼴·고르기 화면·편집용 레이어 (2026-11-21)

공개된 한국어 자막 모션 시연 영상(릴스+이모지, 말풍선, 글꼴별 자간·장평·기울기, 문구를 치면 미리 보기, 자막별 투명 레이어)을 0.5초 간격으로 캡처해 문법만 새로 구현했다. 코드·글꼴·로고·계정명은 가져오지 않았다. 새 스타일 목록은 아래 표의 `v1.4` 표시.

- **이모지 v2** (`--emoji auto`, 기본은 꺼짐): 한국어·영어 약 330단어 사전(감정, 음식, 돈·쇼핑, 시간, 날씨, 기술, 여행·운동, 동물 등 12묶음) + 단어가 없으면 문장 분위기(ㅋㅋ🤣 ㅠㅠ😭 질문🤔 짧은 느낌표✨). 한 자막에 최대 1개, `--emoji-gap`초(기본 2.5) 간격, `--emoji-max`. 자리 5가지: end(끝 단어 안쪽에 붙어 줄바꿈에 혼자 안 남음), top(핵심어 위), corner(상자 오른쪽 위 스티커, 상자 없는 스타일은 top), burst(위에 뜨며 작은 이모지 7개가 퍼짐), side(줄 앞 큰 이모지). auto는 상자 스타일=end/corner, 감정 효과=burst, 나머지=end·top·side 번갈아. 움직임 6가지(pop, bounce, wiggle, float, spin, pulse). Noto Color Emoji(OFL)가 assets/fonts에 있으면 그것을 써서 PC마다 같은 그림(`fonts.mjs fetch noto-emoji`, 없으면 시스템 이모지, `--emoji-font system`으로 강제).
- **글꼴 34종** (모두 Google Fonts OFL, `assets/fonts/fonts.json`): 펜·붓 손글씨, 효과음체, 큐트, 둥근, 굵은 고딕, 통통 디스플레이, 명조·감성 명조 등. `node scripts/fonts.mjs list|fetch|measure|sheet`. 글꼴마다 **크기(size-adjust, 한글 잍크 높이를 프리텐다드에 맞춤)·자간·장평·기울기** 값을 넣어 두었고 `--font <id>`를 고르면 자동 적용, `--tracking/--width/--slant`로 덮어씁니다. 장평·기울기는 자막 덩어리 전체에 걸리므로 상자도 같이 좁아지거나 기욵니다. 새 스타일이 쓰는 역할 글꼴: CapPen(펜), CapBrush(붓), CapSfx(효과음), CapCute, CapHeavy(고딕 A1 블랙), CapRound(고운돋움), CapFat(베이글) → `--fonts pen=..,sfx=..`로 바꿈. 작업 폴더에는 쓰는 글꼴만 복사한다.
- **고르기 화면**: `node scripts/picker.mjs <job> [--text "문구"] [--open]` → `http://127.0.0.1:8765/`(포트가 차 있으면 다음 번호). 내 문구를 치면 모든 스타일 카드가 그 문구로 움직이며(배경은 그 영상의 한 장면), 분류 탭 9개·이모지 켜기·별표 고르기·명령 복사(1개면 `--style`, 여러 개면 `--mix-pool`). 파일을 만들지 않는 미리 보기라, 실제 영상 자리·얼굴 검사는 여전히 `render.mjs preview`로 한다. 후보가 많아 메모리를 쓰므로 화면 밖 카드는 멈춘다.
- **편집용 레이어** (`render.mjs final ... --layers [prores|webm|png]`): 자막 한 문장 = 투명 클립 하나(제목만 있는 구간은 overlay 클립, 0.3초 미만은 앞 클립에 합침). 원본과 **같은 프레임율(29.97=30000/1001 그대로)**, `timeline.fcpxml`(파이널컷·다빈치: 원본 위에 제자리), `timeline-premiere.xml`(V1 원본·V2 자막), `layers.csv`(캡컷 등 손으로 놓을 때 타임코드), `README.txt`. 최종 mp4도 이제 원본의 정확한 프레임율로 그린다.
- **제목 배지**: `--title "문구 🎁"` 또는 overlays.json의 `titles`(text, style, from, to, y). 세로는 위 12.5% 높이(앱 상단 10% 아래), 가로는 8%.
- **분위기 묶음**(`--look`, `assets/looks.json`): reels-pop, cute-vlog, talk-bubble, chat, calm-explainer, variety-show, lyric-mood, kids-story. 스타일 후보·이모지·글꼴·색을 한 번에 채우고 명령에 직접 쓴 옵션이 이긴다. `--style mix`로 렌더해야 후보가 쓰인다.
- **쌓이는 말풍선**(bubble-oval-stack, chat-thread): 같은 스타일이 1초 안에 이어지면 앞의 2줄이 화면에 남고, 새 줄이 아래에 나온다. 자리는 항상 세로 30~70%의 키 큰 자리(stack-tall)라 더미가 뛰지 않는다. chat-thread는 줄마다 왼쪽(회색)·오른쪽(파랑)을 번갈아 쓴다(화자를 직접 정하려면 chat-left / chat-right를 `--plan`으로).
- mix 자동 배정 추가: 이거다·찾았다 → 집중선 원, 헉·헐·어머(맨 앞) → 뽰족 터짐, 쉿·비밀 → 속삭임, 속마음 → 손으로 그린 타원, 쓰담·탁·짜잔 → 효과음 빛 글씨, 끝!·마무리 → 종이 메모(모두 짧은 줄만, `--fx-max` 안에서). 기본 후보에 reels-clean·reels-box-stack·reels-mint-stack·reels-tint-boxes, 강조 후보에 reels-lime-impact·reels-italic-grad·glow-title-hand를 더했다.
- 디버그: `node scripts/render.mjs probe <job> --style <id> --at 3.2 [--expr "JS"]`가 그 순간의 자막 상자·자리·맞춤 비율을 찍는다.

## 자막 자리 (왼쪽·오른쪽·위·아래)

- 가로 8곳: bottom-center, bottom-left, bottom-right, top-center, upper-left, upper-right, mid-left, mid-right, (mid-center는 후렴용). 세로 6곳: mid-center, mid-left, mid-right, upper-center, upper-left, upper-right. 왼쪽 자리는 왼쪽 맞춤, 오른쪽 자리는 오른쪽 맞춤이다.
- 플랫폼 안전 영역은 그대로 지킨다: 가로는 아래 22%를 비우고(유튜브 자막 자리), 세로는 아래 약 30%·위 10%·오른쪽 10%(앱 버튼)를 비운다. 세로 가운데 자리의 좌우는 앱 버튼을 피해 11%~89%만 쓴다. `render.mjs`는 자막이 자기 자리 밖으로 나가면 렌더를 멈춘다(오른쪽 자리에서 크게 튀어나오는 스타일이 화면 밖으로 나가는 문제를 이 검사가 잡았고, 세로 가운데 자리가 오른쪽 버튼 구역을 침범한 것도 이 검사가 잡았다).
- **글씨 크기 보장**: 가장 작은 글자가 1080p 가로에서 40px, 1080×1920 세로에서 50px보다 작아지면 같은 높이대의 넓은 자리(예: upper-left → top-center)로 옮긴다. 그래도 작으면 `글씨 크기: 작은 자막 N개`로 보고한다. 앞말이 작은 스타일(hero-key, lead-big, stamp)의 앞말은 본문 글자의 0.7~0.78배다.

## 얼굴 피하기 (`find-faces.py`)

- 1.2.0: 겹친 얼굴 상자(턱·셔츠를 또 얼굴로 잡은 것)는 하나만 남긴다. 얼굴 상자는 이마·머리까지 위로 넓혀서 계산한다. 세로 영상에서 얼굴이 화면 높이의 25%보다 큰 장면이 30% 이상이면 `make-captions`가 "주의(big faces)"를 먼저 알리고, 얼굴 아래 가슴 자리(low-center)를 먼저 시도한다. 큰 얼굴 클로즈업(16:9를 9:16으로 자른 화면)에서는 빈자리가 없어 여전히 겹칠 수 있다(시험 영상에서 4문장 중 2문장이 이마에 남음). 이럴 때는 얼굴이 작은 원본을 쓰거나 `--scale 0.9`, `--pos-plan`으로 자리를 직접 정한다.

1. `python scripts/find-faces.py <영상> --out faces.json` (초당 2번 얼굴을 찾는다. YuNet 모델(MIT, `assets/models`) 우선, 없으면 OpenCV Haar). `faces.preview.png`에 찾은 얼굴 상자가 그려지니 **먼저 열어 본다**.
2. `make-captions.mjs ... --faces faces.json`. 문장이 나오는 동안(앞뒤 0.5초 포함) 보인 얼굴과 자막 글자 상자가 2% 넘게 겹치면 다른 자리를 차례로 시도한다. `얼굴: 자막이 얼굴을 가리는 묶음 N개` 줄로 결과를 알려 준다.
- 한계: 사람 정면 얼굴 위주다. 만화·동물·용·뒷모습·옆모습·아주 작은 얼굴은 놓칠 수 있다(AI로 만든 사진 속 인물은 100%, 소녀와 용이 나오는 AI 영상은 83% 구간에서 찾았다). 얼굴만 피하고 몸·소품은 피하지 않는다.

## 노래 효과

- **박자 맞춤**: `python scripts/detect-beat.py <음원> --out beat.json --bpm-hint 88`(BPM을 알면 힌트로 준다. 랩은 반/두 배 템포로 잘못 잡히기 쉽다). `confidence`가 0.35 미만이면 쓰지 않는다. `make-captions --beat beat.json`을 주면 박마다 자막이 4.5% 커졌다가 0.4초 안에 돌아온다. 시험(힌트 88인 곡): 89.1BPM, 신뢰도 0.94, 박 간격 0.682초(88BPM과 일치).
- **후렴 자동 판별**: 같은 글자 줄이 2번 이상 나오는 구간(6자 이상)은 후렴으로 보고 글자를 12% 키우고 가운데에 두며 hero-key·impact-wide·stack-kinetic·stamp 중에서 고른다. 후렴이 줄 나눔이 달라도 전체 글에서 찾아서 잡는다.
- 노래·랩 절차: ①음원에서 `transcribe.py` ②가사 줄(태그 줄 제외)을 `script.txt`로 저장해 `align-script.mjs` ③`listen-check.mjs`로 사용자 청취 확인 ④그림 한 장짜리면 ffmpeg zoompan으로 천천히 확대한 배경 영상을 만들어 `make-captions`에 넣는다 ⑤`detect-beat.py` ⑥(사람이 나오면) `find-faces.py`. JIZURA 특유의 큰 가사 타이포·투명 PNG ZIP이 필요하면 [JIZURA](https://852wa.github.io/JIZURA/)(MIT)를 따로 쓴다.

## 글꼴 (`--font`, `--font-key`)

- **기본 글꼴은 동글 볼드(2026-11-01)**. 크기 2.3배·줄 간격 0.8로 맞춰 두었고 팝 때 넘치지 않게 위아래 여백을 더한다. 예전 기본으로는 `--font classic`, 다른 글꼴은 `--font jua|dohyeon|singleday|yeonsung|sunflower|gugi|...`. 동글은 받침이 글자 아래로 길게 내려오므로 받침 많은 글에서 줄 높이가 들쭉날쭉해 보일 수 있다.
- 무료 5종: `pretendard`, `black-han`, `plex`, `gaegu`, `myeongjo` (OFL, 상업 이용 가능). 예: `--font myeongjo`, 큰 핵심어만 `--font-key black-han`, 내 파일은 `--font ./My.ttf`.
- 내 글꼴에 없는 글자는 Pretendard로 자동 대체된다(네모 방지). 굵기는 파일이 정하고 억지로 굵게 만들지 않는다.
- 사용자가 글꼴을 말하지 않으면 지정하지 않는다(스타일마다 기본 글꼴). 남이 만든 글꼴의 영상·상업 이용 조건은 이 스킬이 검사하지 않으니 사용자에게 확인하라고 알린다.
- 자세한 설명: `references/fonts.md`. 손글씨를 글꼴로 만드는 방법: `references/handwriting-font.md`.

## 설명 영상용 차분한 자막 (`--style plain`)
- 어두운 둥근 상자 안의 흰 글자가 한 줄씩 한꺼번에 나타난다. 색·단어별 효과 없음. 설명·강의·튜토리얼에 쓴다(`mix`에는 섞이지 않음). 글씨는 `--scale 0.85` 안팎이 편하다.

## 방송 자막 (--style broadcast)
- 흰 굵은 글자+얇은 검은 윤곽, 박스·색 효과 없음, 한 줄이 한꺼번에 나타남. 기본 글자 높이는 세로 화면 높이의 약 3%(--scale로 조절). 위치를 한 자리에 고정하는 --pin과 함께 쓰는 것이 기본이다(mix에는 섞이지 않음). 한 묶음은 세로 18자·6단어, 가로 34자·11단어까지.

## 선택 장식 (기본 꺼짐)

- 이모지와 밑줄(라인)은 **기본 꺼짐**이다. 사용자가 요청할 때만 `--emoji auto`(또는 예전 방식 `--deco emoji`)와 `--deco line`을 준다. 이모지는 사전(약 330단어)에 있는 단어나 문장 분위기에서만 나온다. 한 글자 키는 단어 맨 앞에서만 맞추고 긴 키가 이긴다. 의미가 안 맞는 이모지는 `--emoji-map`으로 덮어쓰고 시안에서 확인한다. reels-gift-box·emoji-lead는 스타일 자체에 이모지가 들어 있어 `--emoji`와 상관없이 나온다(단어 이모지가 없으면 🎁 / ✨).

## 스타일 고르는 기준 (138개(plain·broadcast 포함) + mix)

| id | 이름 | 어울리는 곳 | 주의 |
|---|---|---|---|
| block-sweep | 색 블록 훑기 | 쇼츠·릴스 설명, 가장 무난한 기본 | 블록 위 글자는 어두운 색 |
| pop-word | 한 단어 팝 | 짧고 빠른 쇼츠, 후킹 문장 | 1~2단어라 긴 설명엔 부적합 |
| karaoke-fill | 노래방 채우기 | 노래·가사, 낭독 | 한 줄이 길면 두 줄 |
| hero-key | 핵심어 히어로 | 결론·숫자·반전 한마디 | 한 화면에 강조 하나 |
| stack-kinetic | 크기 대비 쌓기 | 쇼츠 하이라이트, 후렴 | 짧은 구절에만 |
| underline-ink | 밑줄 짚기 | 롱폼 설명, 차분한 편집 | 가장 조용함 |
| glass-card | 유리 카드 | 롱폼, 밝은 배경 | 글자 수 짧게 |
| neon-glow | 네온 점등 | 어두운 배경, 음악 | 밝은 배경에서 판독 떨어짐 |
| lead-big | 작은말+큰핵심어 | 말하는 얼굴 영상, 브이로그 쇼츠 | 앞말이 길면 두 줄 |
| chip-label | 라벨 칩 | 숫자·조항·고유명사를 노란 칩으로 | 칩은 문장당 하나 |
| stamp | 도장 찍기 | 경고·결론·"이것만" | 가벼운 문장엔 과함 |
| line-rise | 줄마다 올라오기 | 차분한 설명, 롱폼 | 글자 수 많으면 느려 보임 |
| hand-note | 손글씨 메모 | 일상·브이로그 말투 | 정보 많은 문장엔 부적합 |
| line-focus | 줄 패널 강조 | 대화·인터뷰 | 패널이 화면을 더 가림 |
| fill-rise | 윤곽 채움 | 노래 후렴·훅 | 제목체에 없는 글자는 대체 글꼴 |
| impact-wide | 꽉 찬 큰 글씨 | 훅, 제목, 한마디(폭을 가득 채움) | 1~2단어만 |
| news-bar | 뉴스 띠 | 정보 전달, 뉴스 말투 | 띠가 화면을 가림 |
| typewriter | 타자기 | 낭독, 차분한 문장(글자가 한 자씩 나타남) | 빠른 말에는 느려 보임 |
| wave | 출렁 글자 | 노래, 가벼운 말(말하는 단어의 글자가 물결침) | 정보 문장엔 과함 |
| sway-breeze | 살랑 바람 | 여유·기분 좋은 말 (말하는 영상, 브이로그) | 글자가 나뭇잎처럼 살랑살랑 흔들림 |
| jitter-nerve | 덜덜 떨림 | 다급·긴장한 말 (쇼츠) | 글자가 덜덜 떨림 |
| heart-thump | 두근 박동 | 설렘 (쇼츠, 브이로그) | 핵심어가 심장처럼 두 번씩 쿵쿵, 분홍색 |
| tilt-wonder | 갸웃 기울기 | 궁금·의아한 말, 질문 | 문장이 고개를 갸웃 기울이고 물음표가 붙음 |
| jolt-pop | 깜짝 튀기 | 놀람 (쇼츠) | 단어가 크게 톡 튀어나왔다 자리 잡음 |
| droop-sigh | 시무룩 처짐 | 실망·아쉬움 | 글자가 아래로 처지며 회색빛으로 흐려짐 |
| boom-shake | 쾅 충격 | 충격·강한 강조 (쇼츠) | 노란 큰 글자가 쾅 박히며 화면이 흔들림 |
| neon-flicker | 네온 깜빡 | 제목, 어두운 배경 영상 | 형광등처럼 깜빡깜빡 켜진 뒤 고정 |
| duo-tight | 두 줄 촘촘 | 말하는 영상 (작은 줄+큰 줄) | 위는 작은 줄, 아래는 큰 줄, 줄 사이가 좁음 |
| rise-lines | 줄 가림막 올리기 | 차분한 설명 | 두세 단어 줄이 가림막 뒤에서 한 줄씩 올라옴(line-rise와 비슷, 줄 단위) |
| num-box | 숫자 상자 | 가격·날짜·조항 | 숫자·핵심어에 테두리 상자가 그려짐 |
| chip-pop | 칩 팝아웃 | 핵심어 하나 (쇼츠) | 핵심어가 가운데 맞춘 알약 칩에서 톡 튀어나옴 |
| mask-slide | 가림막 밀어 올리기 | 깔끔한 설명, 롱폼 | 단어마다 숨은 칸에서 밀려 올라옴 |
| flip-card | 3D 뒤집기 카드 | 정보 한 줄, 롱폼 | 어두운 카드가 3D로 앞으로 뒤집혀 나옴 |
| glitch-split | 글리치 | 게임·기술 쇼츠 (짧게) | 색이 갈라지며 0.35초 흔들린 뒤 멈춤 |
| script-write | 손글씨 쓰기 | 일상, 감성 | 손글씨가 펜 점과 함께 왼쪽부터 써짐 |
| speech-bubble | 말풍선 | 대사, 인터뷰, 예능 | 꼬리 달린 흰 말풍선이 톡 나옴 |
| marker-swipe | 형광펜 칠하기 | 설명, 핵심어 짚기 | 핵심어에 형광펜이 비스듬히 칠해짐 |
| bounce-word | 통통 튀는 단어 | 밝은 쇼츠 | 단어가 떨어져 통통 튄 뒤 멈춤 |
| wobble-outline | 흔들 윤곽선 | 제목, 장난스러운 영상 | 글자 뒤 두 번째 윤곽선이 빙글빙글 흔들림 |
| grad-shift | 색 흐름 그라데이션 | 음악, 제목 | 글자 속 색이 천천히 흐름 |
| chorus-zoom | 후렴 확대 | 노래 후렴 | 한 줄 전체가 천천히 다가오며 빛남 |
| ink-seal | 도장 꾹 | 결론·"이것만" | 빨간 네모 도장이 핵심어에 꾹 찍힘 |
| stagger-center | 가운데부터 퍼지기 | 가사, 쇼츠 | letters spread out from the middle of the word |
| split-reveal | 위아래 갈라 열기 | 제목, 가사 | the word opens from its centre line like a curtain |
| rubber-stretch | 고무줄 늘이기 | 밝은 쇼츠 | the word lands stretched and snaps back |
| spin-in | 빙글 들어오기 | 가사, 제목 | letters spin into place |
| blur-focus | 흐림에서 선명 | 감성 영상 | the word comes into focus (0.2 s, never a long blur) |
| slot-roll | 슬롯 굴리기 | 숫자, 이벤트 | letters roll up like a slot machine |
| echo-trail | 잔상 겹치기 | 음악, 강조 | two coloured ghosts trail behind and catch up |
| swing-hang | 매달려 흔들 | 가벼운 말 | the line hangs from a pin and swings to rest |
| drop-letters | 글자 비 내리기 | 가사 | letters drop from above one by one |
| skew-slide | 기울어 미끄러지기 | 빠른 쇼츠 | words rush in leaning forward, then stand straight |
| variety-outline | 예능 두꺼운 테두리 | 예능, 리액션 | thick coloured outline, tilted, pops per word |
| alert-bar | 속보 빨간 띠 | 뉴스, 공지 | red breaking-news band with a blinking dot |
| vhs-retro | VHS 레트로 | 레트로, 브이로그 | colour fringe, scan lines and a small wobble |
| comic-burst | 만화 효과음 별 | 효과음, 반응 | the key word in a yellow comic starburst |
| tape-strip | 마스킹 테이프 | 일상, 다이어리 | each word on a strip of tape |
| paper-cut | 색종이 오려 붙이기 | 아이·교육, 콜라주 | words on coloured paper pieces |
| sticker-peel | 스티커 붙이기 | 쇼츠 제목 | thick white sticker outline, slapped on |
| doodle-circle | 낙서 동그라미 | 설명, 핵심어 | a hand-drawn loop around the key word |
| pixel-game | 8비트 게임 | 게임 | pixel text appears in steps in a dark box |
| retro-shadow | 레트로 입체 그림자 | 제목 | long stepped 3D shadow |
| count-up | 숫자 카운트업 | 가격, 통계 | numbers count up to the spoken value (final text is exact) |
| check-list | 체크 표시 | 할 일, 팁 | a check box ticks before the line |
| quiz-card | 퀴즈 카드 | 퀴즈 | the key word is covered until it is said |
| progress-bar | 진행 막대 | 단계 설명 | a thin bar fills while the line is spoken |
| bullet-point | 글머리표 줄 | 목록, 단계 | a bullet pops and the line slides in |
| arrow-point | 화살표 가리키기 | 핵심어 | an arrow points at the key word from the left |
| bracket-focus | 초점 괄호 | 핵심어 | corner brackets close in like a focus frame |
| price-tag | 가격표 | 가격 | the key word hangs on a swinging tag |
| search-bar | 검색창 입력 | 검색어, 사용법 | the line is typed into a search box |
| percent-ring | 원형 게이지 | 퍼센트, 통계 | a ring gauge fills (to the % if the key word has one) |
| duo-gold-spark | 황금 반짝(작은 줄+큰 줄) | 쇼츠 결론·자랑 한마디 | 위: 작은 흰 줄, 아래: 금빛 큰 줄+반짝이. 작은 줄의 핵심어는 노랑 |
| duo-fire | 불꽃 | 개수·기록·"뜨겁다" | 큰 줄이 빨강~노랑 그라데이션, 양옆·뒤에 일렁이는 불꽃. 작은 줄 핵심어는 보라 |
| duo-orange-glow | 주황 글로우 | 업데이트·계속·반복 | 작은 줄은 분홍 빛, 큰 줄은 주황. 반짝이 2개 |
| duo-heart-glow | 하트 글로우 | 공짜·감사·애정 | 큰 줄이 분홍 빛, 하트가 둥실 떠다님 |
| duo-angel-wing | 천사 날개 | 처음부터 끝까지·깨끗·순수 | 작은 줄은 흰 판 위, 큰 줄은 흰-하늘색 빛, 양옆 날개가 퍼덕임 |
| duo-shake-blue | 덜덜 파랑 | 질문·불안·"아직도?" | 큰 줄 글자가 떨리고 옆에 떨림 표시. 작은 줄 핵심어는 노랑 |
| duo-plate-gold | 라벨 판+황금 줄 | 설명 한 줄+결론 | 작은 줄이 연한 판 위, 큰 줄은 금빛 |
| duo-sticker | 노란 스티커 | 마무리 한마디("끝나요!") | 노란 글자+두꺼운 흰 테두리, 살짝 기울어 통통 |
| duo-select-box | 선택 상자 | 편집·제작 도구 설명 | 큰 줄을 파란 선택 상자(모서리 손잡이)가 감쌈. 핵심어는 노랑 |
| duo-title-pink | 분홍 제목+작은 설명 | 제목 먼저, 설명 뒤 | 큰 분홍 줄이 위, 작은 흰 줄이 아래 |
| paper-strip | 종이띠 | 한 줄 자막, 손으로 붙인 느낌 | 흰 종이띠가 말하는 만큼 늘어남, 핵심어는 빨강 |
| solo-gold | 황금 반짝(한 줄) | 한 줄 결론 | 작은 줄 없이 큰 금빛 한 줄 |
| solo-wing | 천사 날개(한 줄) | "마음이 편안해요" 같은 안심 문구 | 양옆 날개 |
| solo-heart | 하트 글로우(한 줄) | 설렘·애정 | 분홍 빛+하트 |
| solo-pastel | 파스텔 그라데이션 | 일상·감성 | 연두~노랑~하늘 그라데이션 |
| solo-sunset | 노을 주황 | 먹방·"이건 못 참지" | 굵은 갈색 테두리 |
| solo-purple | 보라 테두리 | 꿀팁·정보 | 흰-연보라 글자+보라 테두리 |
| solo-chrome | 크롬 금속 | "핵심만 쾅!" | 은빛 글자, 나올 때 짧게 흔들림 |
| solo-ice | 얼음 파랑 | 시원함·여름 | 하늘색 빛+반짝이 |
| solo-night-glint | 새벽 파랑 | 새벽 감성·밤 | 큰 별빛 반짝 |
| solo-neon-pink | 분홍 네온 | 파티·조합 | 분홍 네온+작은 반짝 |
| solo-fire | 불꽃 왕관 | "허걱"·충격 | 글자 위에 불꽃 |
| oval-pill | 파란 알약 | Q&A·마무리 문구 | 하늘색 알약 안에 파란 글자 |
| plate-lavender | 연보라 판 | 코너 제목("오늘의 루틴") | 빛나는 보라 테두리 판 |
| tag-mint / tag-orange | 작은 라벨 태그 | 장면 이름("2차전 START") | 1~3단어 짧은 문구만 |
| bubble-blue / bubble-pink / bubble-mint | 화자 색 말풍선 | 만화·대화 영상 | 사람마다 다른 색으로 --plan 고정 |
| bubble-thought | 생각 풍선 | 속마음 | 점 꼬리 |
| quote-frame | 따옴표 인용 | 다짐·명언 | 청록 큰 따옴표, 핵심어 노랑 |
| laugh-tiles | ㅋㅋ 색 타일 | 웃음 | ㅋㅋ·ㅎㅎ·ㅠㅠ가 색 타일로 튀어 들어옴 |
| horror-serif | 오싹 명조 | 괴담·공포 | 어두운 배경에서 판독, 느리게 나타남 |
| chip-bar | 이름표 칩 | 말하는 사람 표시 | 첫 단어=이름, 그 뒤=말(구분선) |
| reels-clean `v1.4` | 릴스 흰 글자 | 쇼츠·릴스 기본 | 굵은 고딕, 핵심어 색이 초록·노랑·분홍·하늘 차례로 |
| reels-box-stack `v1.4` | 흰 상자 쌓기 | 말하는 쇼츠 | 줄마다 흰 상자, 핵심 줄은 연두, 좌우 엇갈려 쌓임 |
| reels-tint-boxes / reels-mint-stack `v1.4` | 파스텔·민트 상자 | 브이로그·정보 | 노랑·파랑(선택 점)·분홍 / 민트 상자가 줄마다 올라옴 |
| reels-pink-outline / reels-pink-small `v1.4` | 분홍 테두리 / 작은 분홍 | 귀여운 브이로그 | 둥근 글꼴, 얼굴 옆 작은 한마디 |
| reels-lime-impact `v1.4` | 라임 임팩트 | 훅·결론 | 큰 라임 글자+두꺼운 검은 테두리, 단어마다 쾵 |
| reels-italic-grad `v1.4` | 기울인 초록 그라데이션 | 소개·추천 | 기울기 12도 |
| reels-gift-box / emoji-lead `v1.4` | 이모지 스티커 상자 / 이모지 먼저 | 이벤트·선물·릴스 | 스타일에 이모지 포함 |
| reels-word-chips / reels-qa / reels-twotone `v1.4` | 단어 칩 / Q&A 칸 / 두 톤 상자 | 정보·문답·요약 | Q번호는 물음표 줄만, 아니면 A번호 |
| reels-haze `v1.4` | 색 번짐 | 감성·어두운 배경 | 뒤에 흐린 색 구름 |
| bubble-oval-stack `v1.4` | 타원 말풍선 쌓기 | 혼잣말·대화 | 앞 2줄이 남음, 손글씨 |
| bubble-tail-up / bubble-sticky / bubble-whisper `v1.4` | 꼬리(위) / 노랑 작은 / 점선 속삭임 | 인물 옆 대사 | 꼬리 방향은 고정 |
| chat-left / chat-right / chat-yellow / chat-thread `v1.4` | 메신저 | 대화·카톡 느낌 | thread는 좌우 번갈아 쌓임 |
| bubble-focus-burst / bubble-spiky / bubble-shout `v1.4` | 집중선 원 / 뽰족 터짐 / 외침 | 이거다!·헉!·외침 | 1~3단어만(길면 글자가 작아짐) |
| bubble-hand-ellipse / bubble-cloud `v1.4` | 손으로 그린 타원 / 구름 | 속마음·상상 | 타원은 그려지며 나타남 |
| paper-note `v1.4` | 찢은 종이 메모 | 마무리 한마디 | 첫 단어 크게, 테이프 |
| sfx-glow / glow-title-hand `v1.4` | 효과음 빛 글씨 / 손글씨 빛 제목 | 의성어 / 감성 도입 | 핵심 줄은 주황 빛 |
| mix | 자동 섞기 | 말하는 영상 전체 | `mix-plan.json`에서 어색한 문장은 plan으로 고정, `--mix-pool`로 후보 제한 |

- **작은 줄+큰 줄 임팩트 11종**(duo-gold-spark, duo-fire, duo-orange-glow, duo-heart-glow, duo-angel-wing, duo-shake-blue, duo-plate-gold, duo-sticker, duo-select-box, duo-title-pink, paper-strip, 1.3.0)은 공개된 한국어 자막 모션 시연 영상의 화면을 캡처해 그 문법(작은 설정 줄 위, 큰 핵심 줄이 튀어나옴, 테마별 장식)만 새로 구현했다. 코드·글꼴·로고는 가져오지 않았고 색은 테마마다 고정이라 `--palette`가 바뀌지 않는다. 쇼츠 결론 한마디에 아껴 쓴다(한 영상 3~5번). mix가 후렴·강조어·숫자 문장에 자동으로 넣고, 꽁짜·처음부터·불꽃 같은 단어에는 하트·날개·불꽃을 감정 효과처럼 최대 횟수 안에서 넣는다.
- **쇼릴·만화형 23종**(1.3.0 두 번째 묶음, 한 줄 테마 11개·알약/판/태그 4개·말풍선 4개·quote-frame·laugh-tiles·horror-serif·chip-bar)도 공개된 한국어 자막 모션 시연 영상 두 편(어두운 쇼릴, 만화 말풍선 영상)을 캡처해 문법만 새로 구현했다. 화자별 말풍선 색은 자동으로 알 수 없으니 `--plan`으로 구간마다 bubble-blue/pink/mint를 지정한다. mix는 ㅋㅋ·ㅎㅎ(laugh-tiles), 괴담·오싹(horror-serif), 시원·아이스(solo-ice)를 감정 효과 횟수 안에서 자동 배정한다.
- **감정·의성어 7종**(sway-breeze, jitter-nerve, heart-thump, tilt-wonder, jolt-pop, droop-sigh, boom-shake)은 한 영상에 2~4번만 쓴다. 자주 쓰면 효과가 사라진다. mix는 이를 자동으로 지킨다(`--fx-max`).
- 비슷한 것끼리: rise-lines는 line-rise의 줄 단위판, neon-flicker는 neon-glow의 깜빡임판, glitch-split은 짧게 흔들린 뒤 멈추므로 정보 문장에는 쓰지 않는다.
- 설명·실습 롱폼은 차분한 스타일(underline-ink, line-rise, glass-card, line-focus, typewriter)을 우선 추천한다(시청 효과는 미검증). 튀는 효과(pop-word, neon-glow, stack-kinetic, wave, impact-wide)는 짧은 쇼츠·음악에 쓴다.

## 꼭 지킬 규칙

- **안전 구역**: 위 "자막 자리"와 같다. 구역을 벗어나면 렌더가 멈춘다. `--scale`을 줄이거나 `--allow-overflow`로 무시할 수 있지만 무시하려면 이유를 보고한다. 근거: 유튜브 자막(CC)이 화면 아래쪽에 뜨는 자리와 쇼츠·릴스의 앱 버튼 자리를 비우는 규칙이다.
- **글자 판독이 먼저**: 스크램블·강한 글리치·긴 블러 진입 금지, 조각나거나 겹쳐 읽히지 않을 것(JIZURA 실패 기록). 강조는 색 블록·밑줄처럼 글자를 가리지 않는 방식으로 한다.
- **색**: 베이지·크림·아이보리·샌드 계열은 쓰지 않는다. 채널 색 규칙이 있으면 `make-captions.mjs`의 PALETTES 값을 채널 색으로 바꾼다.
- 플랫폼별 영상 규격(릴스·쇼츠는 9:16 등)은 올리는 곳의 규칙을 따른다. 이 스킬은 영상 비율과 음성을 바꾸지 않는다.
- 사용자가 준 영상의 원본 소리·화면은 그대로 두고 자막만 더한다. 이미 공개된 영상은 사용자 요청 없이 고치거나 다시 올리지 않는다.
- 자막 문구는 임의로 바꾸지 않는다(오인식은 대본으로 고치고, 글꼴에 없는 글자는 사용자에게 묻는다).
- 위임할 때는 이 문서와 `references/styles.md`를 함께 전달한다.

## 자동 점검 출력 (preview·final이 찍음)

글씨 크기(최소 허용 px, 작은 자막 수, 자리 옮김 수), 얼굴 가림 수, 읽기 속도(묶음별 자/초, 17 초과 빠름·25 초과 위험은 외국 저장소 기준이라 한글은 참고용), 글꼴에 없는 글자, 자리 이탈 경고, 프레임 수 차이(2 초과 시 경고). 시안을 고른 뒤 영상 파일이 바뀌면 final이 멈춘다(크기·수정 시각 비교).

## 알려진 한계 (정직하게)

- 새 스타일 30개(1.2.0)는 합성 배경 8초 영상(세로·가로) 시안과, 실제 말하는 영상 2개(합성 음성 18초, AI 영상 8초)의 자동 섞기로 확인했다. 효과마다 실제 영상에서 따로 확인하지는 않았다.
- 새 스타일 11개(1.3.0)는 합성 배경 세로 21초 영상으로 시안 구역 검사를 통과시키고 실제 렌더 프레임을 직접 열어 확인했다. 인물 얼굴 위 실제 영상·가로 16:9·노래 영상에서의 어울림은 따로 확인하지 못했다(가로는 시안 검사만). 효과음(소리)은 구현하지 않았다. 오버레이(이름표·작은 화면·옆 의성어)는 합성 영상으로만 확인했고 실제 인물 영상에서 얼굴·자막과 겹치는지는 사람이 본다. 작은 화면은 영상 소리 없이 그림만 나온다.
- 그래픽카드 인코더 자동 선택은 이 PC(NVIDIA)에서만 확인했다. 맥(videotoolbox), 인텔(qsv), AMD(amf)는 시험하지 못했다.
- `export-subs.mjs`의 ASS는 글꼴 이름이 Pretendard라 그 글꼴이 없는 PC에서는 다른 글꼴로 보인다.

- 1.4.0 새 스타일 30개·이모지 5자리·글꼴 34종은 합성 배경 영상(세로 1080×1920 29.97fps, 가로 1920×1080)의 시안 구역 검사를 통과시키고 시안 그림을 직접 열어 봤다. 실제 인물 영상·긴 영상·노래에서의 어울림은 아직 보지 못했다. 편집용 레이어는 파일 형식(프레임율·투명 채널·XML 구조)만 확인했고 프리미어·파이널컷·다빈치·캡컷에서 직접 열어 보지는 못했다. 고르기 화면은 Chrome에서만 확인했다. 장평·기울기는 상자까지 함께 변형된다. 뽰족 터짐·집중선 원은 긴 문장에서 글자가 작아진다(자동 섞기는 3단어 이하만 배정). 기본 동글 글꼴과 새 스타일을 섞으면 글자 크기 느낌이 조금 다르다.
- 새 스타일 23개(1.1.0)는 합성 배경 8초 영상(세로 1080×1920, 가로 1920×1080)의 4장면 시안으로만 확인했다. 실제 인물 영상·긴 영상·노래 영상에서의 어울림은 아직 확인하지 않았다.

- 직접 듣지 못한다. 가사·말과 소리가 맞는지는 시간표와 `listen-check` 클립으로 사용자가 확인해야 한다.
- 랩·노래의 단어 시간은 Whisper 기반이라 거칠다(12곳 불일치, 1.8초 길이 제한으로 보정). 한국어 강제 정렬 모델은 없다.
- 얼굴은 정면 사람 얼굴만 찾는다. 몸·소품·용은 피하지 않는다.
- 글자 위치를 장면 중요도(손, 제품 등)로 정하지 못한다.
- 사람 뒤에 글자를 넣는 효과(인물 분리 필요)와 스크램블 효과는 넣지 않았다.
- 스타일 취향은 사람마다 다르다. 시안으로 사용자가 직접 고르게 한다.

## 문제 해결

- `페이지 오류`가 나오면 `render.mjs`가 보여 준 첫 오류부터 고친다. 스타일 코드는 `scripts/runtime.js` 한 파일이며 렌더 때마다 작업 폴더로 복사된다. 새 스타일은 `S['id'] = { label, group, build(ph, el), update(ph, t) }` 형식으로 추가하면 `preview`에 자동 포함된다(크게 키우고 싶으면 `fill: 배율`).
- 한 줄이 너무 길거나 구역을 벗어나면 해당 스타일의 `group`(한 묶음 글자 수·단어 수)을 줄인다.
- 스타일 구현 메모와 시험 기록은 `references/styles.md`.
