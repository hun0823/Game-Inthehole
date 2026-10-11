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
| `shared/levels.json` | 스테이지 단일 소스 (144판, 12 행성 × 12) |
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

## 레벨 편집·검증

1. `shared/levels.json` 수정 (또는 `python3 tools/generate_edge_levels.py` 등 생성기 사용)
2. `python3 tools/sync_js_levels.py` → `js/levels.js` 갱신
3. `python3 tools/validate_levels.py` — BFS·par·유리/게이트 일치 (`tools/tilt_solver.py` = `js/game.js` 규칙)

캠페인 규모: **144 스테이지** — Wood·Desert·Ice·Ocean·Crystal·Toy·Mushroom·Candy·Lava·Jungle·Alien·Machine (각 12). 그리드: Wood 3→7, Desert 4→7, 나머지 5→7.

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
