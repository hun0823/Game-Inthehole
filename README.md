# Rollin' Board (In the Hole)

테이블을 기울여 공을 구멍까지 굴리는 브레인 퍼즐. **프라이머리 빌드 = 웹** (Three.js, GitHub Pages).

**플레이 (테스트):** https://hun0823.github.io/Game-Inthehole/

## 프로젝트 구성

| 경로 | 용도 |
|------|------|
| `index.html`, `css/` | 페이지·DOM HUD (아케이드 레이아웃) |
| `js/game.js` | **게임 규칙 단일 소스** (기울임·유리·게이트·버튼·힌트 BFS) |
| `js/main.js` | UI·진행·상점·행성 맵·저장(localStorage) |
| `js/board3d.js`, `js/boardDeco.js`, `js/trickLook.js`, `js/sphereMaps.js` | Three.js 보드·연출·공/구멍 비주얼 |
| `js/levels.js` | `shared/levels.json`에서 자동 생성 (**직접 수정 금지**) |
| `shared/levels.json` | 스테이지 단일 소스 (132판, 11 행성 × 12) |
| `tools/` | 레벨 생성·`validate_levels.py`·`sync_js_levels.py` 등 |
| `assets/` | 텍스처·이미지 (Pages 배포에 포함) |
| `docs/` | 기획·HUD·Grok 핸드오프 |
| `unity/InTheHole/` | **일시 중지** (삭제 안 함). 앱 스토어는 추후 Capacitor 등 검토 |

## 로컬 실행

저장소 루트에서 정적 서버 (ES modules 필요):

```bash
python3 -m http.server 8080
```

→ http://localhost:8080

## 오디오

BGM과 효과음은 `js/audio.js` 한 그래프입니다. 마스터 게인 아래에 음악 버스와 효과음 버스가 있고, 일시정지 메뉴와 행성 지도의 **설정**에서 각각 슬라이더와 음소거를 바꿉니다. 값은 `localStorage` 키 `inthehole_audio`에 남고, 문구는 `js/i18n.js`의 KO/EN입니다.

첫 `pointerup` / `touchend` / `keydown`에서 `AudioContext`를 만들고 재개합니다. 탭이 숨으면 BGM만 멈추고, 돌아오면 이어서 재생합니다. 효과음은 미리 디코드해 두고, 짧은 음정·음량 흔들림과 동시에 8목소리 한도로 재생하며 프레임 루프를 기다리지 않습니다.

**BGM.** 메뉴와 스테이지는 같은 곡입니다. Zane Little Music의 Flowerbed Fields [Loop] (CC0, [CREDITS.md](CREDITS.md))를 `assets/audio/bgm/`에 두고, `assets/audio/manifest.json`의 `bgm.menu`와 `bgm.game`가 같은 `sources`를 가리킵니다. 먼저 디코드되는 파일을 쓰고 (m4a, 그다음 mp3), 두 화면이 같은 파일이면 곡을 다시 시작하지 않습니다. 소스가 다르면 약 0.7초 크로스페이드합니다. AAC/MP3 패딩은 디코드 버퍼에서 찾고, `loopDuration`초만 `loopStart`/`loopEnd`로 반복합니다.

```json
"menu": {
  "loop": true,
  "loopDuration": 105.931043,
  "sources": ["bgm/flowerbed_fields.m4a", "bgm/flowerbed_fields.mp3"]
}
```

**효과음 다시 굽기.** 파라미터는 `tools/sfx/params.json`(jsfxr)입니다. 합성기는 `tools/sfx/vendor/`(public domain)이고, 굽힌 m4a+ogg는 `assets/audio/sfx/`에 있습니다.

```bash
node tools/sfx/bake.mjs
```

스크립트가 `manifest.json`의 `sfx`만 갱신하고 `bgm`은 그대로 둡니다. 합계는 150KB 아래를 유지합니다.

**iOS.** 무음 스위치는 페이지 오디오 세션을 따릅니다. 기본값은 ambient라 스위치가 켜지면(무음) 웹 오디오도 꺼집니다. Safari 17+의 `navigator.audioSession`이 있으면 `playback`을 요청합니다. 거절되면 스위치를 해제해야 들립니다. `navigator.vibrate`는 iOS 사파리에 없습니다. 진동은 효과음이 켜져 있고 브라우저가 지원할 때만 납니다.

**프레임 오버레이.** `?fps=1`은 HUD 아래 오른쪽에 1초 평균 FPS, 프레임 시간 p50/p95, `renderer.info`의 드로우 콜·삼각형을 띄우고 `inthehole_fps`에 기억합니다. `?fps=0`은 끄고 기억합니다. 꺼져 있으면 DOM도 프레임 콜백도 만들지 않습니다.

## 레벨 편집·검증

1. `shared/levels.json` 수정 (또는 `python3 tools/generate_edge_levels.py` 등 생성기 사용)
2. `python3 tools/sync_js_levels.py` → `js/levels.js` 갱신
3. `python3 tools/validate_levels.py` — BFS·par·유리/게이트 일치 (`tools/tilt_solver.py` = `js/game.js` 규칙)

캠페인 규모: **132 스테이지** — Wood·Desert·Ice·Ocean·Crystal·Toy·Candy·Lava·Jungle·Alien·Machine (각 12). 그리드: Wood 3→7, Desert 4→7, 나머지 5→7.

## 배포 (GitHub Pages)

`main` push 시 [`.github/workflows/pages.yml`](.github/workflows/pages.yml)이 `index.html`, `css/`, `js/`, `assets/`를 `_site`에 모아 배포.

테스트 사이트에서는 hostname 기반 테스트 플래그로 **전 스테이지 해금** (`?unlock=0` / `?unlock=1`로 끄기·켜기). **출시 빌드에서는 테스트 해금이 꺼져 있어야 함** (로드맵 체크).

## 봇 역할 (Grok / Cursor)

| 담당 | 범위 |
|------|------|
| **개발 봇** | `js/game.js`, `shared/levels.json`, `tools/`, 기능·메타·`js/main.js` HUD/플로우, `docs/HUD_LAYOUT.md` 준수 |
| **디자인 봇** | `js/board3d.js`, `js/boardDeco.js`, `js/trickLook.js`, `js/sphereMaps.js`, `assets/`·테마 연출 (규칙 파일은 건드리지 않음) |

## 문서

| 문서 | 내용 |
|------|------|
| [`docs/GROK_START_HERE.md`](docs/GROK_START_HERE.md) | Grok 온보딩 |
| [`docs/GROK_HANDOFF.md`](docs/GROK_HANDOFF.md) | 전체 컨텍스트 |
| [`docs/PRODUCT_ROADMAP.md`](docs/PRODUCT_ROADMAP.md) | 현재 상태·다음 작업 |
| [`docs/GAME_DESIGN_REFERENCE.md`](docs/GAME_DESIGN_REFERENCE.md) | 기획·메타·배틀 모드(§5) |
| [`docs/HUD_LAYOUT.md`](docs/HUD_LAYOUT.md) | DOM HUD ↔ 3D 보드 레이아웃 계약 |
| [`docs/DIFFICULTY_FORMULA.md`](docs/DIFFICULTY_FORMULA.md) | par·난이도 |

Unity 재개 시만 [`unity/InTheHole/README.md`](unity/InTheHole/README.md) 참고 (현재 웹과 레벨/규칙 동기화 안 됨).
