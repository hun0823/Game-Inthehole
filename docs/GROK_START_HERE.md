# Grok — 이 저장소부터 읽기

**Rollin' Board / InTheHole** — Three.js 웹 퍼즐 (GitHub Pages). Unity는 **일시 중지**.

## 사용자 → Grok

1. 공개 repo URL 전달: `https://github.com/hun0823/Game-Inthehole`
2. 아래 **온보딩 프롬프트**를 새 채팅에 붙여넣기.
3. Grok이 clone을 못하면 → `docs/GROK_HANDOFF.md` 전문 + 필요 시 `docs/` zip.

## 온보딩 프롬프트 (복사)

```
GitHub의 Rollin' Board (InTheHole) 웹 빌드를 이어서 개발하는 파트너다.

필독 순서:
1) docs/GROK_HANDOFF.md
2) docs/GAME_DESIGN_REFERENCE.md
3) docs/PRODUCT_ROADMAP.md
4) docs/HUD_LAYOUT.md (HUD/UI 작업 시)

규칙:
- 게임 규칙 단일 소스: js/game.js (Python 검증은 tools/tilt_solver.py)
- 스테이지 단일 소스: shared/levels.json → python3 tools/sync_js_levels.py → js/levels.js
- 레벨 변경 후: python3 tools/validate_levels.py
- unity/InTheHole/ 은 일시 중지 — 수정·동기화하지 말 것
- 커밋/푸시는 사용자가 요청할 때만

역할 분리:
- 개발 봇: game.js, levels, tools, main.js 기능·HUD·메타
- 디자인 봇: board3d.js, boardDeco.js, trickLook.js, sphereMaps.js, assets (규칙 파일 X)

먼저 GROK_HANDOFF.md 요약 10줄 + 다음 작업 우선순위 3개만 답하고,
이후 사용자가 "다음"이라고 하면 한 단계씩만 진행해라.
```

## 핵심 경로

| 경로 | 내용 |
|------|------|
| `docs/GROK_HANDOFF.md` | Handoff 전체 |
| `js/game.js` | 시뮬·힌트 BFS |
| `js/main.js` | UI·상점·맵·저장 |
| `shared/levels.json` | 132 스테이지 |
| `tools/validate_levels.py`, `tools/sync_js_levels.py` | 검증·동기화 |
| `unity/InTheHole/` | **paused** — 참고만 |

## 로컬 실행

```bash
python3 -m http.server 8080
# → http://localhost:8080
```

## 배포

`main` push → `.github/workflows/pages.yml` → https://hun0823.github.io/Game-Inthehole/

테스트 사이트: hostname 기반 전 스테이지 해금, `?unlock=0` / `?unlock=1`. 출시 빌드에서는 해금 OFF 확인 (로드맵).

## 커스텀 아트 (로컬, Git에 없을 수 있음)

데스크톱 원본 PNG 등은 사용자 PC 경로 — 웹은 주로 `assets/textures/` 및 `tools/bake_sphere_maps.py`. Unity Sync 메뉴는 **사용 안 함** (프로젝트 paused).
