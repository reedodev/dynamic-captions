# 출처와 라이선스 / Credits and licenses

이 스킬의 코드는 새로 작성했고, 아래 프로젝트의 코드를 그대로 복사하지 않았습니다. 아이디어·규칙·수치만 참고했습니다. 사용한 라이브러리와 글꼴은 각자의 라이선스를 따릅니다.

## 영감을 준 것

| 출처 | 라이선스 | 참고한 것 |
|---|---|---|
| [JIZURA](https://852wa.github.io/JIZURA/) ([852wa/JIZURA](https://github.com/852wa/JIZURA)) | MIT | 노래 가사 타이포 방식, 읽히지 않던 설정(스크램블·강한 글리치)을 피하는 기준 |
| [iart-ai/kinetic-typography-skills](https://github.com/iart-ai/kinetic-typography-skills) | MIT | 글자·단어·줄 쪼개기 단위와 등장 시차 수치 |
| [francozanardi/pycaps](https://github.com/francozanardi/pycaps) | MIT | 줄 패널 강조(`line-focus`), 단어 3상태(안 말함·말하는 중·말함) |
| [ItisShikhar/captioncat](https://github.com/ItisShikhar/captioncat) | MIT | 화면 폭을 채우는 큰 글씨(`impact-wide`), 쉼에 따른 줄 바꿈 아이디어 |
| [neutral-Stage/remotion-captioneer](https://github.com/neutral-Stage/remotion-captioneer) | MIT | 느리게 말한 단어를 강조 후보로 삼기, 읽기 속도 점검(초당 17자) |
| [nicolaigaina/ai-video-captions](https://github.com/nicolaigaina/ai-video-captions) | MIT | 언어별 글자 폭으로 한 줄 길이 계산 |
| [glenwrhodes/KillerSubtitles](https://github.com/glenwrhodes/KillerSubtitles) | MIT | 글자 크기를 영상 높이 비율로 정하기 |
| [ybaler/capkit-lite](https://github.com/ybaler/capkit-lite) | MIT | 한 묶음 3단어·20자·쉼 0.55초 같은 묶음 규칙 |
| [naive-kun/naive-video-skill](https://github.com/naive-kun/naive-video-skill) | MIT | 단어 시간 정밀도를 기록하고 가짜 시간을 만들지 않기, 영상이 바뀌면 승인 무효 |
| [kurbaitaev/ghost-editor](https://github.com/kurbaitaev/ghost-editor) | MIT | 한 단어만 남는 줄 없애기, 얼굴을 피하는 자막 배치 |
| [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | Apache-2.0 | 끝 침묵에서 Whisper가 지어낸 말 버리기, 대본 철자와 소리 시간을 분리하는 방식 |
| [Kimeur/motion-launch-videos](https://github.com/Kimeur/motion-launch-videos) | MIT | 자막 최소 표시 0.7초, 글꼴에 없는 글자 검사 |
| [kajisho5/ffmpeg-skill](https://github.com/kajisho5/ffmpeg-skill) | MIT | 한글을 글자 단위 1em 폭으로 계산, 글꼴에 없는 글자가 조용히 네모로 나오는 함정 |
| [revfactory/showreel](https://github.com/revfactory/showreel) | MIT | 화면이 시간 t만으로 정해지는 구조(병렬 렌더가 가능한 이유) |

## 사용한 도구와 모델

| 이름 | 라이선스 | 쓰는 곳 |
|---|---|---|
| [openai/whisper](https://github.com/openai/whisper) | MIT | `transcribe.py` 단어 단위 받아쓰기 |
| [librosa](https://librosa.org/) | ISC | `detect-beat.py` 박자 검출 |
| [OpenCV](https://opencv.org/) | Apache-2.0 | `find-faces.py` |
| [YuNet 얼굴 검출 모델](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet) (`assets/models/face_detection_yunet_2023mar.onnx`) | MIT | `find-faces.py` (파일을 그대로 넣었습니다) |
| FFmpeg, Chrome/Chromium | 각자의 라이선스 | 합성·인코딩, 자막 그리기(저장소에 포함하지 않음) |

## 글꼴 (`assets/fonts`, 모두 SIL Open Font License 1.1, 원문은 같은 폴더의 `*-OFL.txt`)

| 글꼴 | 저작권자 |
|---|---|
| [Pretendard](https://github.com/orioncactus/pretendard) | Kil Hyung-jin |
| [Black Han Sans](https://github.com/zesstype/Black-Han-Sans) | The Black Han Sans Project Authors |
| [IBM Plex Sans KR](https://github.com/IBM/plex) | IBM Corp. |
| [Gaegu](https://fonts.google.com/specimen/Gaegu) | The Gaegu Project Authors |

글꼴은 수정하지 않은 원본 파일입니다. 이 저장소의 MIT 라이선스는 글꼴과 모델 파일에는 적용되지 않으며 각자의 라이선스를 따릅니다.

## 1.1.0 새 스타일

- 새 스타일 23개(감정·의성어 7종, 두 줄 행간, 네온, 줄 올라오기, 숫자 상자, 칩, 글리치, 손글씨, 말풍선, 형광펜 등)는 이 저장소에서 새로 쓴 코드입니다. 다른 프로젝트의 코드를 복사하지 않았습니다. 자주 쓰이는 자막 연출(키네틱 타이포, 예능 자막, 네온 간판, 형광펜 강조)을 개념으로 삼았습니다.
- 새 글꼴은 추가하지 않았습니다(기존 OFL 글꼴 5종만 사용).

## 1.2.0 새 스타일·기능

- 새 스타일 30개와 기능은 이 저장소에서 새로 쓴 코드입니다. 다른 프로젝트의 코드는 복사하지 않았습니다.

| 참고한 곳 | 라이선스 | 참고한 것 |
|---|---|---|
| [anime.js](https://github.com/juliangarnier/anime) | MIT | 글자를 가운데부터 순서대로 움직이는 방식(stagger from center) 개념만 |
| [Motion Canvas](https://github.com/motion-canvas/motion-canvas) | MIT | 목소리에 맞춰 정보 그래픽을 움직이는 방식 개념만 |
| [Animate.css](https://github.com/animate-css/animate.css) | Hippocratic 2.1 (MIT 아님) | 효과 이름의 분류만 참고, 코드는 쓰지 않음 |
| [auto-caption](https://github.com/sebetancurch/auto-caption), [auto-subs](https://github.com/mateusz-kow/Auto-Subs), [Capite](https://github.com/muneebkhan08/Capite)(MIT), [karaoke-subs](https://github.com/DorXmoon/karaoke-subs) | 각 저장소 README | 자막 도구에서 자주 쓰는 기능 목록(SRT·VTT·ASS 노래방 내보내기, 여러 영상 처리, 설정 파일, NVENC 인코딩). 코드는 보지 않고 README의 기능 목록만 참고 |
