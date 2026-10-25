# Grok Handoff — Rollin' Board / InTheHole

> **갱신:** 2026-10-11  
> Cursor / Grok 세션용 **단일 컨텍스트 문서**.

**현재 기준:** 플레이·출시 대상 = **웹** — `index.html`, `js/`(Three.js), 규칙 `js/game.js`, UI·메타 `js/main.js`.  
배포: https://hun0823.github.io/Game-Inthehole/ (`.github/workflows/pages.yml`, `main` push).  
**Unity (`unity/InTheHole`)는 일시 중지** (삭제 안 함). `unity/` 수정·동기화 금지. 앱 스토어는 Capacitor 등 웹 래핑을 우선 검토.

---

## 1. 한 줄 정의

**테이블을 기울여 공을 구멍에 넣는** 세로(9:16) 모바일 브레인 퍼즐.  
**프라이머리 빌드 = 웹** (Three.js, GitHub Pages). Unity는 일시 중지.

---

## 2. 상품·레퍼런스

| 항목 | 내용 |
|------|------|
| 디스플레이명 | Rollin' Board (프로젝트 폴더 InTheHole) |
| 비주얼 레퍼런스 | **reference2** — 민트 두꺼운 프레임, 홈 파인 우드 칸, 보석 facet 벽, 구리 공, 청록 구멍, 별 밤하늘 |
| 상업 참고 (메카닉 X) | Block Blast — UX, 세션 길이, 광고 톤, 스크린샷 퀄 |
| 카메라 | Orthographic **~58° pitch**, Phone **1080×1920** |

---

## 3. 코어 로직 (절대 분기 금지)

- **단일 시뮬:** `js/game.js`. Unity `GameSimulation.cs`는 예전 기둥(pillar) 모델 기준이라 **동기 깨짐**.
- **스테이지:** `shared/levels.json` (version 8, edge walls) → `tools/sync_js_levels.py` → `js/levels.js`
- **검증:** `python3 tools/validate_levels.py` (BFS, `tools/tilt_solver.py` = `js/game.js` 규칙)
- **생성:** `python3 tools/generate_edge_levels.py` 등 (`tools/`)
- **132 스테이지:** 11 행성 × 12 (Wood, Desert, Ice, Ocean, Crystal, Toy, Candy, Lava, Jungle, Alien, Machine). Wood 3→7, Desert 4→7, 나머지 5→7. 사탕은 장난감 다음. 상점 공 29종 + goal v3 페어 (`js/balls.js`). 버섯공은 행성 보상이 아니라 별 64개 상점 공
- **별·이동 한도:** `par` = BFS 최적 기울임(버튼 프레스 포함). HUD `moves/par`. 게임오버는 `par + 3`.
- **힌트:** HUD 왼쪽 `?` 는 무제한. `Game.nextMove()` 가 현재 공·유리 스트레스·게이트 상태에서 같은 `slide` 로 BFS 해 다음 최적 행동(기울임 또는 press)을 낸다. 40수 안에 없으면 Retry.
- **조작:** 별 카운터는 왼쪽 위. 스테이지 배너는 중앙(이전/다음 화살표 없음). 일시정지·힌트는 배너 좌우. 기울임은 하단 D-pad. Retry(다시)는 오른쪽 아래 원형 버튼. 스테이지 이동·설명·설정·상점은 일시정지 메뉴.
- **HUD 레이아웃 계약:** `docs/HUD_LAYOUT.md`. 보드는 `.topbar`와 `.controls` 사이. `board3d.js`는 `#playfield` / `.board-wrap` 크기를 읽는다.

### 레벨 포맷 — 엣지 벽

모든 칸은 바닥이다. 벽은 칸을 막지 않고 **인접 칸 사이 변**에 선다. 유리·색 게이트와 같은 좌표.

| 필드 | 의미 |
|------|------|
| `hWalls[]` | `{row, col}` — `row` 행과 `row+1` 행 사이, `col` 열 (`0 ≤ row < size-1`) |
| `vWalls[]` | `{row, col}` — `col` 열과 `col+1` 열 사이, `row` 행 (`0 ≤ col < size-1`) |
| `glassH` / `glassV` | 같은 좌표. hp 2 그대로, 1타 hp 1(금, 여전히 벽), 2타 hp 0(파쇄 후 통과). 인터페이스는 [`GLASS.md`](GLASS.md) |
| `coloredH` / `coloredV` | `{row, col, color}`. 해당 색 버튼을 밟거나 누르기 전에는 통과 불가 |
| `buttons[]` | `{row, col, color}` |
| `ball`, `hole`, `par` | 시작·구멍·최적 기울임 수 |

`pillars`(막힌 칸 → 네 변으로 확장)는 **제거**했다. 그 모델은 칸 안을 도달 불가로 만들고 벽이 박스처럼 보였다. L/T/직선은 변을 이어 붙인 보석 막대다.

---

## 4. 웹 렌더·UI (작업 분담)

| 담당 | 파일 | 내용 |
|------|------|------|
| 개발 봇 | `js/game.js` | 규칙·힌트 BFS |
| 개발 봇 | `js/main.js` | HUD DOM, 일시정지·상점·행성 맵, localStorage, KO/EN |
| 개발 봇 | `shared/levels.json`, `tools/` | 데이터·검증 |
| 디자인 봇 | `js/board3d.js` | Three.js 보드·카메라·픽킹 (`#playfield` 크기 — `HUD_LAYOUT.md`) |
| 디자인 봇 | `js/boardDeco.js`, `js/trickLook.js` | 보드 장식·트릭 연출 |
| 디자인 봇 | `js/sphereMaps.js`, `assets/textures/` | 공·구멍 맵 (`tools/bake_sphere_maps.py`) |

행성 테마 ID: `js/themes.js` (`PLANET_ORDER`). 슬라이드 규칙은 테마를 읽지 않음.

**테스트 해금:** GitHub Pages hostname에서 전 스테이지 해금 (`?unlock=0`/`1`). 로컬·출시는 행성 클리어 진행 (`js/main.js` `planetUnlocked`). 릴리스에서 테스트 해금 OFF 확인 — `PRODUCT_ROADMAP.md`.

---

## 5–8. Unity (일시 중지 — 참고만)

`unity/InTheHole/`는 예전 URP/스프라이트 보드 실험. `GameSimulation.cs`는 기둥(pillar) 레벨 모델이라 **웹과 불일치**.  
재개 시에만 `unity/InTheHole/README.md` 및 에디터 메뉴(Sync Game Art 등) 사용. **Generate Reference Art**는 커스텀 PNG 덮어씀 — 웹 작업과 무관.

---

## 9. 미완료 / 우선순위 (요약)

상세: `docs/PRODUCT_ROADMAP.md`

| P | 작업 |
|---|------|
| P0 | 오디오 (BGM+SFX, 한 시스템, 볼륨/뮤트), 첫 30초 손가락 튜토리얼, 210LAB 스플래시, 저장 강화 |
| P1 | 배틀 모드 (GAME_DESIGN_REFERENCE §5, 로컬 2P 먼저), iPhone 60fps/발열, 텍스처·폰트 용량, 테스트 해금 릴리스 OFF, **Undo 도입 여부 결정** |
| P2 | 출시 경로 (웹/PWA/Capacitor), 광고·애널리틱스, 스토어 에셋, 일일 챌린지 |

---

## 10. 로컬·테스트

```bash
python3 -m http.server 8080
```

| 입력 | 동작 |
|------|------|
| D-pad / 스와이프 | 기울임 |
| Retry | 리셋 |
| 일시정지 메뉴 | 스테이지·설정·상점·맵 |

---

## 11. Grok 작업 시 제약

- **커밋/푸시:** 사용자 요청 시만
- **git config** 변경 금지
- 로컬 Unity는 **paused**; Grok은 웹 `js/`·`tools/`·`shared/` diff 제안
- 대화 전체가 아닌 **이 문서 + 코드**가 진실

---

## 12. 관련 문서

- `docs/GAME_DESIGN_REFERENCE.md` — 기획·메타·PvP
- `docs/PRODUCT_ROADMAP.md` — 출시 로드맵
- `docs/DIFFICULTY_FORMULA.md` — par·난이도
- `tools/chatgpt_rollin_board_art.md` — 탑다운 PNG 13종 ChatGPT 가이드
- `unity/InTheHole/README.md` — Unity (paused, 재개 시만)

---

## 13. Cursor 대화에서만 있던 메모 (요약)

- Game view Scale 0.4 = 에디터 미리보기만, 폰 빌드 무관
- `wall_h.png` / `wall_v.png` — Sync 맵 없음, Unity Art에 직접 넣으면 우선 사용
- 나노바나나2: hole_ring 프롬프트가 거절될 때 “게임 UI 도넛 링” 완화 프롬프트 사용

---

## 14. 텍스처 시험판 (2026-10-10)

공 4종(야구·테니스·수박·오크)과 행성 4종(나무·사막·바다·용암)은
`assets/textures/*.webp` 를 쓴다. 같은 베이커가 나머지 무늬 공과 행성 8개
(얼음·수정·장난감·사탕·정글·외계·기계)도 굽는다. 버섯 행성 맵은 없다. 버섯공은 상점에 남아 굽는다. 젤리는 단색이라 맵을 넣지 않는다.
오크 파일은 `--rebuild` 없이 다시 쓰지 않는다. 재생성은 `python3 tools/bake_sphere_maps.py`.
출처·라이선스·골 색을 바꾼 이유는 `docs/TEXTURE_MAPS.md`.
게임 규칙(`js/game.js`)과 레벨 데이터는 이 작업에서 바꾸지 않는다.
페이지 배포 워크플로는 `assets/` 를 함께 복사한다.

**Grok:** 이 파일을 읽은 뒤 `GROK_START_HERE.md`의 온보딩 규칙을 따르세요.
