<p align="right"><a href="README.md">English</a> | <b>한국어</b></p>

<p align="center"><img src="docs/styles.png" alt="dynamic-captions: 같은 장면에 자막 스타일 10개 이상을 입힌 비교 시안" width="560"></p>

<p align="center">
<a href="https://github.com/reedodev/dynamic-captions/actions/workflows/test.yml"><img src="https://github.com/reedodev/dynamic-captions/actions/workflows/test.yml/badge.svg" alt="test"></a>
<img src="https://img.shields.io/badge/Claude_Code-skill-2547F4" alt="Claude Code skill">
<img src="https://img.shields.io/badge/license-MIT-black" alt="MIT">
</p>

# 다이나믹 자막 (dynamic-captions): 영상에 자막을 자동으로

**영상을 주면, 말한 내용을 화면에 자막으로 써 줍니다. 모양은 직접 고릅니다.**

영상 편집을 배우거나 시간표를 만질 필요가 없습니다. 도구가 영상을 듣고 말한 단어를 시간과 함께 적은 다음, 같은 장면을 10개 이상의 자막 스타일로 보여 줍니다. 마음에 드는 것을 고르면 자막이 박힌 새 영상을 만들어 줍니다.

Claude Code(Anthropic의 AI 비서로, 내 컴퓨터에서 일합니다)에 붙여 쓰는 "스킬"입니다. 비서와 대화로 쓸 수도 있고, 명령을 직접 입력해도 됩니다. 두 방법을 모두 아래에 적었습니다.

## 나에게 맞을까요?

이런 분께 맞습니다.
- 쇼츠·릴스·틱톡이나 긴 영상을 만드는데, 편집을 배우지 않고 보기 좋은 자막을 넣고 싶은 분
- 뮤직비디오나 가사 영상에 가사를 박자에 맞춰 넣고 싶은 분
- 자막이 방해되지 않기를 바라는 분(얼굴을 가리지 않고, 유튜브가 자체 자막을 띄우는 자리를 피합니다)

## 무엇이 다른가요?

- **10개 이상의 스타일과 "자동 섞기".** 자동 섞기는 문장마다 모양을 바꿔서 영상이 단조롭지 않게 합니다.
- **자막이 왼쪽·오른쪽·위·아래로 돌아가며 나옵니다.** 다만 앱이 버튼이나 자체 자막을 띄우는 자리는 피합니다.
- **얼굴을 피합니다.** 얼굴을 찾아서 자막을 다른 자리에 둡니다.
- **글씨가 너무 작아지지 않습니다.** 너무 작아질 것 같으면 더 넓은 자리로 옮깁니다.
- **노래:** 박자에 맞춰 자막이 살짝 커졌다 돌아오고, 반복되는 후렴은 더 크게 나옵니다.
- **가사 철자가 맞습니다.** 음성 인식은 랩을 자주 잘못 알아듣습니다. 진짜 가사가 있으면 글자는 가사에서, 시간은 소리에서 가져옵니다. 둘이 다른 곳은 그 부분만 짧은 클립으로 잘라서 *사람이* 들어 보게 합니다.
- **빠릅니다.** Chrome 창 여러 개가 동시에 프레임을 그립니다(75초 풀HD 영상: 197초 → 64초).

## 시작하기 전에: 설치할 것

무료 프로그램 4개가 필요합니다. 이미 있으면 건너뛰세요. 터미널(윈도우는 PowerShell, 맥은 터미널)을 열고 "확인" 칸의 명령을 입력하면 설치 여부를 볼 수 있습니다.

| 프로그램 | 무엇에 쓰나요 | 확인하기 | 받는 방법 |
|---|---|---|---|
| **Node.js** 18 이상 | 도구의 스크립트를 실행 | `node -v` | https://nodejs.org (초록색 LTS 버튼) |
| **ffmpeg** | 영상을 읽고 쓰기 | `ffmpeg -version` | 윈도우: `winget install Gyan.FFmpeg` · 맥: `brew install ffmpeg` |
| **Google Chrome**(또는 Chromium) | 자막을 그리기 | Chrome을 한 번 열어 보기 | https://www.google.com/chrome |
| **Python** 3.10 이상 | 소리를 듣고 받아쓰기(Whisper) | `python --version` (윈도우는 `py --version`일 때도 있음) | https://www.python.org |

그다음 파이썬 도구를 설치합니다(한 번만. Whisper 때문에 몇 분 걸리고 용량이 몇 GB입니다).

```bash
pip install openai-whisper numpy
pip install librosa                  # 선택: 노래 박자 검출
pip install opencv-python-headless   # 선택: 얼굴 찾기
```

> **팁:** Claude Code를 쓴다면 *"dynamic-captions에 필요한 걸 다 설치해 줘"*라고 말하면 비서가 위 단계를 하고, 빠진 것이 있으면 알려 줍니다.

NVIDIA 그래픽카드가 있으면 마지막 단계가 더 빠르지만 꼭 필요하지는 않습니다.

## 스킬 설치하기

**제일 쉬운 방법: Claude Code 플러그인.** Claude Code에 아래 두 줄을 입력하세요.

```
/plugin marketplace add reedodev/dynamic-captions
/plugin install dynamic-captions@dynamic-captions
```

**또는 폴더를 직접 복사:**

```bash
git clone https://github.com/reedodev/dynamic-captions.git
cp -r dynamic-captions/skills/dynamic-captions ~/.claude/skills/
```

## 첫 자막 영상 만들기

### 방법 1: 말로 시키기 (초보자에게 추천)

영상을 폴더에 두고 비서에게 이렇게 말하세요.

> "`my-video.mp4`에 dynamic-captions로 자막 넣어 줘. 스타일 시안부터 보여 줘. 한국어야."

> "이 랩 노래야. 가사는 `lyrics.txt`에 있어. 얼굴을 피해서 박자에 맞는 가사 자막을 만들어 줘."

비서가 받아쓰기를 하고, 모든 모양이 한 장에 담긴 **스타일 시안**을 보여 준 뒤 선택을 기다립니다. *"7번으로 해 줘"*, *"핵심 단어가 노랗게 나오는 걸로"*처럼 말하면 됩니다. 그러면 영상을 만들고 파일 위치를 알려 줍니다.

### 방법 2: 명령 한 줄 (그다음 스타일 고르기)

듣기, 작업 폴더, 스타일 시안까지 알아서 해 줍니다.

```bash
node skills/dynamic-captions/scripts/start.mjs my.mp4 --lang ko --out job
```n
job/preview/overview.png 가 만들어지면 멈춥니다. 그림을 열어 스타일을 고른 뒤, 마지막에 나온 명령(ender.mjs final ...)을 실행하세요. 붙일 수 있는 옵션: `--script 가사.txt`(가사로 철자 고치기), `--faces`(얼굴 피하기), `--beat`(박자에 맞춰 살짝 움직이기), `--model small`(빠르게).

### 방법 3: 모든 단계를 직접 입력하기

`my.mp4`를 내 영상 이름으로 바꾸세요. 이 프로젝트를 내려받은 폴더에서 실행합니다. 아래 첫 줄은 맥/리눅스용이고, 윈도우 PowerShell에서는 `$S = "skills/dynamic-captions/scripts"`로 쓰고 나머지 줄은 그대로 둡니다.

**1단계: 말한 단어를 받아 적기** (처음 실행할 때 음성 인식 모델 약 1.5GB를 내려받아 한 번은 오래 걸립니다. 그래픽카드가 없으면 몇 분 걸릴 수 있습니다. `--model small`을 붙이면 더 빠르고 덜 정확합니다)

```bash
S=skills/dynamic-captions/scripts
python $S/transcribe.py my.mp4 --out words.json --lang ko
```

`--lang ko`는 한국어, `en`은 영어, `ja`는 일본어입니다. 결과 `words.json`에 모든 단어와 시작·끝 시간이 들어 있습니다.

**2단계: 작업 폴더 만들기**

```bash
node $S/make-captions.mjs --video my.mp4 --words words.json --out job --scale 1.25 --shade 0.4
```

`--scale`은 글씨 크기, `--shade 0.4`는 글씨 뒤에 부드러운 어두운 띠를 깔아서 밝은 화면에서도 읽히게 합니다.

**3단계: 스타일 시안 보기**

```bash
node $S/render.mjs preview job
```

`job/preview/overview.png`를 여세요. 내 장면이 모든 스타일과 "자동 섞기"로 나옵니다. 마음에 드는 것의 이름(예: `block-sweep`, `mix`)을 적어 두세요.

**4단계: 짧게 맛보기, 그다음 전체**

```bash
node $S/render.mjs final job --style mix --range 0,20      # 앞 20초만
node $S/render.mjs final job --style mix                   # 영상 전체
```

완성된 영상은 `job/out/`에 `captioned-mix.mp4`로 생깁니다. 편집 프로그램에 올릴 투명 자막 파일도 필요하면 `--alpha`, 그래픽카드(NVIDIA, 또는 Apple Silicon 맥의 내장 인코더)를 쓰려면 `--encoder auto`, H.265(HEVC) 파일로 받으려면 `--codec h265`, 컴퓨터가 느려지면 `--workers 1`을 붙이세요.

## 글꼴
`--font` 로 글꼴을 고릅니다. 무료 글꼴 5종(SIL OFL, 상업 영상에도 사용 가능)이 함께 들어 있습니다.

| `--font` 값 | 글꼴 | 어울리는 곳 |
|---|---|---|
| `pretendard` | Pretendard ExtraBold | 깔끔한 고딕, 기본 |
| `black-han` | Black Han Sans | 굵고 큰 제목, 짧은 핵심어 |
| `plex` | IBM Plex Sans KR Bold | 차분한 고딕, 설명 영상 |
| `gaegu` | Gaegu Bold | 손글씨 느낌 |
| `myeongjo` | 나눔명조 ExtraBold | 명조, 시·감성 영상 |

```bash
node $S/make-captions.mjs ... --font myeongjo                 # 전체를 한 글꼴로
node $S/make-captions.mjs ... --font plex --font-key black-han  # 큰 핵심어만 다른 글꼴
node $S/make-captions.mjs ... --font "C:\fonts\MyFont.ttf"     # 내 글꼴 파일(.ttf .otf .woff2)
```
글꼴에 없는 글자는 Pretendard로 그려서 네모가 보이지 않습니다. 이 프로젝트에서 받은 글꼴이 아니라면 이용 조건을 직접 확인하세요. 자세한 설명은 [references/fonts.md](skills/dynamic-captions/references/fonts.md), 내 손글씨를 글꼴로 만드는 방법은 [references/handwriting-font.md](skills/dynamic-captions/references/handwriting-font.md) 에 있습니다.

## 설명 영상용 차분한 자막
`--style plain` 은 어두운 둥근 상자 안에 흰 글자 한 줄이 나옵니다. 색도 단어별 효과도 없어서 강의·튜토리얼에 맞습니다(자동 섞기에는 들어가지 않습니다).

## 스타일, 쉬운 말로

| 이름 | 어떻게 보이나요 |
|---|---|
| `block-sweep` | 말하는 단어 위로 색 블록이 훑고 지나감 |
| `pop-word` | 한두 단어씩 크게 톡 튀어나옴 |
| `karaoke-fill` | 노래방처럼 글자가 색으로 채워짐 |
| `hero-key` | 가장 중요한 단어만 크게, 나머지는 작게 |
| `stack-kinetic` | 크기가 다른 단어들이 날아듦 |
| `underline-ink` | 말하는 단어 밑에 차분하게 선이 그어짐 |
| `glass-card` | 어두운 둥근 카드 위의 글씨, 말하는 단어가 밝아짐 |
| `neon-glow` | 네온사인처럼 단어가 하나씩 켜짐 |
| `lead-big` | 앞말은 작게, 핵심어 하나는 크게 |
| `chip-label` | 숫자·이름을 노란 칩으로 짚어 줌 |
| `stamp` | 핵심어가 빨간 도장처럼 찍힘 |
| `line-rise` | 숨은 줄 아래에서 단어가 올라옴 |
| `hand-note` | 손글씨 느낌, 가벼운 영상에 |
| `line-focus` | 줄이 색 패널 위에 놓이고 말하는 단어가 강조됨 |
| `fill-rise` | 윤곽선 글자가 아래에서부터 차오름 |
| `impact-wide` | 한두 단어를 폭에 꽉 차게 크게 |
| `news-bar` | 뉴스처럼 어두운 띠 |
| `typewriter` | 글자가 한 자씩 나타나고 커서가 깜빡임 |
| `wave` | 말하는 단어의 글자들이 물결처럼 출렁임 |
| `mix` | 문장마다 다른 모양을 골라 줌 (처음이라면 이것부터) |

## 말로 바꾸기

옵션을 외울 필요 없습니다. 원하는 것을 비서에게 말하세요.

| 이렇게 말하면 | 바뀌는 것 |
|---|---|
| "자막을 더 크게 / 작게" | `--scale 1.4` / `--scale 0.9` |
| "자막이 한쪽에만 나오게" | `--pos fixed` 또는 `--pos bottom-left` |
| "배경이 밝아서 안 보여" | `--shade 0.5` |
| "얼굴을 가리지 마" | `find-faces.py` 후 `--faces faces.json` |
| "노래 박자에 맞춰" | `detect-beat.py` 후 `--beat beat.json` |
| "이모지 / 밑줄 넣어 줘" | `--deco emoji,line` (기본은 꺼져 있음) |
| "색을 바꿔 줘" | `--palette mint` (gold, mint, sky, rose, lime) |
| "빨리 만들어 줘" | `--workers 4 --encoder auto` |
| "H.265(HEVC)로 만들어 줘" | `--codec h265` (`--encoder auto`와 같이 쓰면 그래픽카드 사용) |
| "투명 자막 파일도 줘" | `--alpha` |
| "문장마다 모양은 내가 정할게" | `--plan plan.json` |

## 문제가 생겼나요?

| 이런 화면이 나오면 | 뜻과 해결 |
|---|---|
| `Chrome/Chromium not found` | Chrome을 설치하거나 위치를 알려 주세요: `CHROME="C:/경로/chrome.exe"` (맥/리눅스는 `CHROME` 변수에 경로를 지정) |
| `ffmpeg` 또는 `ENOENT`가 들어간 오류 | ffmpeg가 설치되지 않았거나 PATH에 없습니다. 설치한 뒤 터미널을 새로 여세요 |
| `자막이 안전 구역을 벗어났습니다` | 긴 문장이 자기 자리에 안 들어갑니다. 글씨를 조금 줄이고(`--scale 1.0`) `make-captions`를 다시 실행하세요 |
| 단어 철자가 틀림 | 음성 인식이 실수한 것입니다. 진짜 글을 파일로 두고 `align-script.mjs`를 쓰거나 `words.json`을 직접 고치세요 |
| 자막이 얼굴을 가림 | 먼저 `find-faces.py`를 실행하고 `--faces faces.json`을 붙이세요(`faces.preview.png`의 초록 상자가 찾은 얼굴입니다) |
| 렌더 중 컴퓨터가 멈춘 듯함 | `--workers 1`로 하세요 |

## 처음 보는 말

- **받아쓰기(전사):** 말한 내용을 단어마다 시간과 함께 적는 것.
- **스타일 시안(preview):** 오래 걸리는 최종 작업 전에 고를 수 있도록 모든 스타일을 한 장에 담은 그림.
- **안전 구역:** 앱이 이미 무언가를 띄우는 자리(유튜브 자막은 화면 아래, 쇼츠·릴스는 옆쪽 버튼). 자막은 여기에 놓지 않습니다.
- **렌더:** 새 영상 파일을 만드는 마지막 단계. 영상 길이의 몇 배 걸립니다.
- **투명 자막 파일(`.mov`):** 배경이 투명하고 자막만 있는 파일. 편집 프로그램에서 영상 위에 올려 씁니다.

## 솔직한 한계

- AI는 소리를 듣지 못합니다. 가사나 말이 소리와 맞는지는 **사람이** 확인해야 하고, `listen-check.mjs`가 만든 클립(약 1분)을 들어 보면 됩니다.
- 랩·노래의 단어 시간은 Whisper 기반이라 거칩니다(단어 하나를 최대 1.8초로 제한). 한국어 강제 정렬은 아직 없습니다.
- 사람 정면 얼굴만 찾습니다. 만화·동물·뒷모습은 놓칠 수 있고, 손·제품·몸은 피하지 않습니다.
- 시청자가 어떤 스타일을 좋아할지는 검증하지 않았습니다. 시안을 보고 직접 고르세요.

## 시험

`node tests/run.mjs`가 스킬 파일을 검사하고, 가짜 영상으로 자막 만들기·스타일 시안·최종 렌더·병렬 렌더·철자 맞추기·듣기 클립·얼굴 찾기·박자 검출을 실제로 돌립니다. 변경할 때마다 GitHub Actions가 같은 시험을 돌립니다(맨 위 배지). Whisper 자체는 시험에 넣지 않았습니다.

개발자용 자료: [SKILL.md](skills/dynamic-captions/SKILL.md)(비서가 따르는 지침, 한국어), [styles.md](skills/dynamic-captions/references/styles.md)(동작 방식과 측정 수치).

<!-- credits -->
## 출처와 영감

- [JIZURA](https://852wa.github.io/JIZURA/)(MIT)의 가사 타이포 방식의 문장별 스타일 변화를 영감으로 삼았습니다. 코드는 옮기지 않았습니다.
- 아이디어와 수치를 참고한 오픈소스 자막 도구 15곳, 사용한 라이브러리(Whisper, librosa, OpenCV, YuNet 얼굴 모델), 함께 넣은 글꼴 4종(SIL OFL)은 [references/sources.md](skills/dynamic-captions/references/sources.md)에 라이선스와 함께 있습니다.

## 만든 사람

**리도**, AI 좌충우돌 실습 중인 20년차 엔지니어입니다. 매일 영상을 만들다가 막힌 부분을 고쳐 가며 이 스킬을 만들었습니다.
[YouTube @Reedodev](https://www.youtube.com/@Reedodev) · [Threads @reedo.dev](https://www.threads.com/@reedo.dev) · [GitHub @reedodev](https://github.com/reedodev)

MIT 라이선스입니다. 함께 들어 있는 글꼴(SIL OFL 1.1)과 YuNet 모델(MIT)은 각자의 라이선스를 따릅니다.
