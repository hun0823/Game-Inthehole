# Rollin' Board UI 폰트 가이드

레퍼런스 게임의 폰트는 **상용 라이선스 커스텀 폰트**인 경우가 많아 동일 파일을 그대로 구하기는 어렵습니다.  
대신 비슷한 톤의 **무료 폰트**를 쓰는 것을 권장합니다.

## 1. 추천 무료 폰트 (레퍼런스와 비슷한 캐주얼 산세리프)

| 폰트 | 느낌 | 다운로드 |
|------|------|----------|
| **Nunito Bold** | 둥근 모바일 퍼즐 UI (1순위) | [Google Fonts – Nunito](https://fonts.google.com/specimen/Nunito) |
| **Baloo 2 Bold** | 통통한 캐주얼 게임 타이틀 | [Google Fonts – Baloo 2](https://fonts.google.com/specimen/Baloo+2) |
| **Varela Round** | 부드러운 라운드 UI | [Google Fonts – Varela Round](https://fonts.google.com/specimen/Varela+Round) |
| **Fredoka SemiBold** | 굵고 친근한 버튼/숫자 | [Google Fonts – Fredoka](https://fonts.google.com/specimen/Fredoka) |

## 2. Unity에 적용하는 방법

1. Google Fonts에서 **Download family** 클릭
2. 압축 해제 후 원하는 굵기 선택 (예: `Nunito-Bold.ttf`)
3. 파일을 아래 경로에 복사하고 이름을 **`UiSans.ttf`** 로 변경:

```
unity/InTheHole/Assets/Resources/Fonts/UiSans.ttf
```

4. Unity로 돌아가면 자동 Import → **Play** 시 `UiFont.cs`가 이 파일을 사용합니다.

> `Resources/Fonts/UiSans.ttf`가 없으면 OS 폰트(Segoe UI / 맑은 고딕) → LegacyRuntime 순으로 fallback 합니다.

## 3. ChatGPT / AI로 폰트를 만들 수 있나?

- **폰트 파일(.ttf) 자체**는 ChatGPT가 안정적으로 만들기 어렵습니다.
- 대신 **PNG UI 스프라이트**(숫자, Lv., ? 버튼)는 AI 이미지로 만들 수 있지만,  
  이동 수·스테이지처럼 **동적으로 바뀌는 텍스트**에는 TTF 폰트가 더 적합합니다.

## 4. 상용 레퍼런스와 거의 동일하게 맞추고 싶다면

1. WhatTheFont / Fontspring Matcherator에 레퍼런스 스크린샷 업로드 → 유사 폰트 검색
2. [Google Fonts](https://fonts.google.com), [Fontshare](https://www.fontshare.com)에서 무료 대안 확인
3. 유료 폰트(예: Montserrat, Poppins, Gilroy 계열)는 라이선스 구매 후 `UiSans.ttf`로 넣기

## 5. Import 설정 (선택)

`UiSans.ttf` 선택 → Inspector:

- **Character**: Dynamic
- **Rendering Mode**: Smooth
- **Sample point size**: 48~64
