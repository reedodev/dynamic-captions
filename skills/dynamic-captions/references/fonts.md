# 글꼴 고르기 (무료 한글 글꼴 34종과 내 글꼴 쓰는 법)

자막 글꼴은 `make-captions.mjs`의 `--font` 로 정합니다. **안 정하면 동글 볼드(Dongle Bold, 둥글둥글한 글꼴)가 기본**입니다(2026-11-01 사용자 지정). 동글은 글자가 작게 그려지는 글꼴이라 크기를 2.3배로 키우고 줄 간격을 줄여 맞춰 둡니다. 예전 기본(본문 Pretendard, 큰 글자 Black Han Sans, 손글씨 Gaegu)으로 돌아가려면 `--font classic` 입니다. 손글씨 자리(옆 의성어, 손글씨 메모)는 Single Day를 씁니다.

## 함께 들어 있는 무료 글꼴
모두 SIL Open Font License(OFL) 글꼴이라 영상 자막에 상업적으로 써도 됩니다(글꼴 파일만 따로 파는 것은 안 됩니다). 라이선스 전문은 `assets/fonts/*-OFL.txt` 에 있습니다.

| `--font` 값 | 글꼴 | 어울리는 영상 | 파일 |
|---|---|---|---|
| `pretendard` | Pretendard ExtraBold | 깔끔한 고딕. 거의 모든 영상의 기본 | `Pretendard-ExtraBold.woff2` |
| `black-han` | Black Han Sans | 굵고 큰 제목체. 짧은 핵심어, 쇼츠, 랩 | `BlackHanSans-Regular.ttf` |
| `plex` | IBM Plex Sans KR Bold | 차분한 고딕. 설명·강의 영상 | `IBMPlexSansKR-Bold.ttf` |
| `gaegu` | Gaegu Bold | 손글씨 느낌. 일상·여행·귀여운 영상 | `Gaegu-Bold.ttf` |
| `myeongjo` | 나눔명조 ExtraBold | 명조(바탕체). 시·낭독·감성 영상 | `NanumMyeongjo-ExtraBold.ttf` |
| `dongle` | Dongle Bold(동글) | **기본.** 둥글고 귀여운 예능·일상 자막. 받침이 아래로 길게 내려옴 | `Dongle-Bold.ttf` |
| `jua` | Jua(주아) | 통통한 둥근 제목체. 예능·쇼츠 | `Jua-Regular.ttf` |
| `dohyeon` | Do Hyeon(도현) | 또렷한 굵은 고딕 | `DoHyeon-Regular.ttf` |
| `singleday` | Single Day | 귀여운 손글씨 | `SingleDay-Regular.ttf` |
| `yeonsung` | Yeon Sung(연성) | 붓글씨 느낌 손글씨 | `YeonSung-Regular.ttf` |
| `sunflower` | Sunflower Bold | 단정한 고딕 | `SunFlower-Bold.ttf` |
| `gugi` | Gugi(구기) | 각진 개성체 | `Gugi-Regular.ttf` |
| `classic` | (예전 기본 묶음) | Pretendard·Black Han Sans·IBM Plex·Gaegu | — |

## 쓰는 방법
```bash
# 영상 전체 자막을 한 글꼴로
node scripts/make-captions.mjs --video my.mp4 --words words.json --out job --font myeongjo

# 큰 핵심어만 다른 글꼴로 (hero-key, stamp, impact-wide 같은 스타일의 큰 글자)
node scripts/make-captions.mjs ... --font plex --font-key black-han

# 내가 가진 글꼴 파일로 (.ttf .otf .woff .woff2)
node scripts/make-captions.mjs ... --font "C:\fonts\MyFont.ttf"
```
`start.mjs` 로 시작할 때도 같은 옵션을 붙이면 그대로 넘어갑니다(`node scripts/start.mjs my.mp4 --font gaegu`).

## 알아 둘 점
- **없는 글자는 Pretendard로 채웁니다.** 내 글꼴에 없는 글자(희귀한 한자, 이모지, 쓰지 않은 손글씨 글자)가 나오면 그 글자만 Pretendard로 그려서 네모(□)가 안 보이게 합니다. 그래서 글자 수가 적은 손글씨 글꼴도 쓸 수 있습니다.
- **굵기는 파일이 정합니다.** 파일 하나의 모양만 쓰고, 컴퓨터가 억지로 굵게 만들지 않습니다. 굵은 자막을 원하면 Bold·ExtraBold 파일을 고르세요.
- **글꼴이 바뀌면 글자 폭이 달라집니다.** 시안(`render.mjs preview`)에서 글씨 크기·구역 점검이 다시 돌므로, 경고가 나오면 `--scale` 을 조금 줄이세요.
- **라이선스는 직접 확인하세요.** 남이 만든 글꼴(눈누, Google Fonts, 구매한 글꼴 등)은 영상·상업 이용 조건이 글꼴마다 다릅니다. 이 스킬은 사용 조건을 검사해 주지 않습니다. 이 저장소에 함께 넣어도 되는 것은 위 5종처럼 라이선스가 명확한 것뿐입니다.
- **내 손글씨를 글꼴로** 쓰는 방법은 `references/handwriting-font.md` 에 있습니다(영상에 나오는 글자만 쓰는 방식).

## 설명 영상에는 차분한 자막
설명·강의 영상은 색 블록이나 튀는 효과보다 읽기 편한 자막이 낫습니다. `--style plain` 은 어두운 둥근 상자 안의 흰 글자 한 줄이 한꺼번에 나타나고, 색·단어별 효과가 없습니다(자동 섞기 `mix` 에는 들어가지 않습니다).
```bash
node scripts/make-captions.mjs ... --scale 0.85 --shade 0.3
node scripts/render.mjs final job --style plain
```

## Claude Code에 말로 시키기
명령을 외우지 않아도 됩니다. Claude Code에 영상 주소(파일 위치)를 주고 이 스킬을 지정한 뒤 이렇게 말하면 됩니다.
- "종이처럼 튀고 빠른 비트의 자막과 효과로 만들어 줘"
- "폰트를 이걸로 해줘" + 글꼴 파일 위치 (또는 "명조체로 해줘", "손글씨 느낌으로 해줘")
Claude Code가 위의 `--font` 옵션을 알아서 붙입니다. 어떤 글꼴이 들어갔는지는 시안 그림에서 확인하세요.

## 1.4.0: 글꼴 34종과 글꼴별 자간·장평·기울기 (2026-11-21)

- 목록·설명·수치는 `assets/fonts/fonts.json` 한 곳에 있습니다. `node scripts/fonts.mjs list` 로 보고, 없는 파일은 `node scripts/fonts.mjs fetch <id|all>` 로 Google Fonts 저장소(github.com/google/fonts)에서 받습니다(OFL 라이선스 파일도 함께).
- `node scripts/fonts.mjs sheet out.png --text "내 문구"` : 모든 글꼴을 같은 문구로 한 장에 그립니다(각 글꼴의 자간·장평·기울기 적용).
- **크기 맞춤**: `node scripts/fonts.mjs measure` 가 각 글꼴의 한글 잉크 높이(픽셀로 직접 잼)를 프리텐다드와 비교해 `size`(%)를 저장합니다. `--font <id>` 로 고르면 이 값이 @font-face `size-adjust`로 들어가서, 작게 그려지는 손글씨체(동글 225%, 개구 164%, 나눔펜 145% 등)도 같은 크기로 보입니다. 기본(아무 글꼴도 안 고름) 동글은 예전처럼 fontScale 2.3을 씁니다.
- **자간·장평·기울기**: `tracking`(em, 음수면 좁게), `width`(%, 장평), `slant`(도, 음수면 오른쪽으로 기움). `--font` 로 고른 본문 글꼴의 값이 자동 적용되고 `--tracking -0.04 --width 92 --slant -8` 로 덮어씁니다. 장평·기울기는 자막 덩어리 전체(상자 포함)에 걸립니다.
- **역할 글꼴**(새 스타일용): CapPen=nanumpen, CapBrush=nanumbrush, CapSfx=dokdo-east, CapCute=cute, CapHeavy=gothic-a1, CapRound=gowun-dodum, CapFat=bagel. `--fonts pen=kirang,heavy=black-han` 처럼 바꿉니다. 기존 역할 main·key·calm·hand·serif도 `--fonts`로 바꿀 수 있습니다.

| id | 글꼴 | 느낌 |
|---|---|---|
| nanumpen / nanumbrush | 나눔손글씨 펜 / 붓 | 펜 손글씨 / 붓 손글씨 |
| himelody, poorstory, cute, gamja, kirang | 하이멜로디, 푸어스토리, 큐트, 감자꽃, 기랑해랑 | 귀여운 손글씨 |
| dokdo-east, dokdo | 동해독도, 독도 | 효과음·외침 |
| gowun-dodum / gowun-batang | 고운돋움 / 고운바탕 | 부드러운 돋움 / 바탕 |
| gothic-a1, nanumgothic, stylish, orbit | 고딕 A1 블랙, 나눔고딕 굵게, 스타일리시, 오르빗 | 릴스 굵은 고딕 / 가는 기하 |
| bagel, gasoek, bw-picture, moirai | 베이글 팻, 가석, 흑백사진, 모이라이 | 통통·굵은 제목·장식 |
| songmyung, diphylleia, grandiflora | 송명, 디필레이아, 그랜디플로라 | 옛 명조·감성 명조 |
| noto-emoji | Noto Color Emoji | 이모지(모든 PC에서 같은 그림) |
