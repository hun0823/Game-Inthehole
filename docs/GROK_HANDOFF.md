# Grok Handoff — Rollin' Board / InTheHole

> **갱신:** 2026-10-09  
> Cursor Agent 세션에서 Grok으로 이어가기 위한 **단일 컨텍스트 문서**.

**현재 기준:** 플레이 가능한 빌드는 **웹 앱**이다. `index.html` + `js/board3d.js`(Three.js) + `js/game.js`. GitHub Pages 워크플로: `.github/workflows/pages.yml`.  
**Unity (`unity/InTheHole`)는 일시 중지**이며 레벨 포맷이 어긋나 있다. Unity를 고치거나 `unity/`를 갱신하지 말 것. 규칙의 단일 소스는 `js/game.js`다.

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
- **생성:** `python3 tools/generate_edge_levels.py`
- **50 스테이지:** 2×2~7×7, 31–40 유리, 41–50 색 게이트·버튼 (자세한 건 `GAME_DESIGN_REFERENCE.md`)
- **별·이동 한도:** `par` = BFS 최적 기울임(버튼 프레스 포함). HUD `moves/par`. 게임오버는 `par + 3`.
- **힌트:** HUD 왼쪽 `?` 는 무제한. `Game.nextMove()` 가 현재 공·유리 스트레스·게이트 상태에서 같은 `slide` 로 BFS 해 다음 최적 행동(기울임 또는 press)을 낸다. 40수 안에 없으면 Retry.
- **조작:** 스테이지·별은 HUD 중앙. 기울임은 하단 동일 크기 D-pad. Retry 는 오른쪽 아래 원형 버튼.

### 레벨 포맷 — 엣지 벽

모든 칸은 바닥이다. 벽은 칸을 막지 않고 **인접 칸 사이 변**에 선다. 유리·색 게이트와 같은 좌표.

| 필드 | 의미 |
|------|------|
| `hWalls[]` | `{row, col}` — `row` 행과 `row+1` 행 사이, `col` 열 (`0 ≤ row < size-1`) |
| `vWalls[]` | `{row, col}` — `col` 열과 `col+1` 열 사이, `row` 행 (`0 ≤ col < size-1`) |
| `glassH` / `glassV` | 같은 좌표. 1타: 금 가고 정지. 2타: 파괴 후 통과 |
| `coloredH` / `coloredV` | `{row, col, color}`. 해당 색 버튼을 밟거나 누르기 전에는 통과 불가 |
| `buttons[]` | `{row, col, color}` |
| `ball`, `hole`, `par` | 시작·구멍·최적 기울임 수 |

`pillars`(막힌 칸 → 네 변으로 확장)는 **제거**했다. 그 모델은 칸 안을 도달 불가로 만들고 벽이 박스처럼 보였다. L/T/직선은 변을 이어 붙인 보석 막대다.

---

## 4. Unity 런타임 구조

| 시스템 | 파일 |
|--------|------|
| 부트 | `GameBootstrap.cs` — 빈 씬 Play 시 `InTheHole_Root` 생성 |
| 세션 | `GameSession.cs` — LoadStage, 입력, BFS 힌트 |
| 보드 (현재) | `SpriteBoardBuilder.cs` — PNG 스프라이트 2.5D |
| 보드 (대안) | `BoardBuilder.cs` — 큐브 프리미티브 3D (레거시) |
| 공 | `BallPresenter.cs` — **ball.png 있으면 Sprite**, bounds 정규화 스케일 |
| 카메라 | `CameraFit.cs` — rect full screen, GridMargin |
| HUD | `GameHud.cs` |
| 배경 | `SceneBackdrop.cs`, `SceneAtmosphere.cs` |
| 아트 로드 | `SpriteCatalog.cs`, PPU **100** |

`GameVisualMode.MinimalLogicView = false` → 스프라이트 보드 (기본).

---

## 5. 아트 파이프라인 (PNG)

### 동기화

- **우선 소스:** `C:\Users\ckdgn\Desktop\Rollin' Board\game_asset2\`
- **fallback:** `...\game_asset\png\` (removebg-preview 이름)
- **Unity:** `Assets/Resources/Art/`
- **메뉴:** `InTheHole → Sync Game Art (Desktop PNG)` → `Ensure Game Art Imported`
- **코드:** `SyncGameArtMenu.cs`, `GameArtAutoSync.cs`, `tools/sync_rollin_art.ps1`

### game_asset2에 있는 파일 (2026-06)

`wood_a/b`, `frame_mint`, `wall_coral/blue/purple/green`, `hole_ring`, `hole_core`, `ball` (10개)

### 아직 커스텀 없음 (placeholder)

`bg_gradient`, `star`, `ball_shadow` — `Generate Reference Art`로 임시 생성 가능하나 **커스텀 덮어쓰기 주의**

### 금지

- **`InTheHole → Generate Reference Art (Sprites)`** — 커스텀 PNG 덮어씀 (Play 전 sync만)

### ball.png 주의

Sync 시 **ball 자동 생성** 스크립트가 돌 수 있음 → 커스텀 ball은 Sync **후** `Resources/Art/ball.png` 확인.

---

## 6. 디자인 시도 — PNG isometric 결론

1. **Isometric PNG** (나노바나나2) + 바닥 `FloorRot(90,0,0)`  
   - PNG 안에 이미 사선 3D가 그려짐 → **코드로 추가 회전 금지** (`CellFacing` 시도는 **되돌림**)
   - 체크무늬 = **투명 PNG 미처리** (AI export 픽셀) → remove.bg 등 필요

2. **탑다운 PNG** — 구현 쉬움, reference2 100% 동일 어려움 (`tools/chatgpt_rollin_board_art.md`)

3. **권장 다음 방향:** **Blender → GLB/FBX → MeshBoardBuilder** (미구현; `BoardBuilder.cs` 참고)  
   - Rhino는 형상용 OK, 게임 마감은 Blender 권장  
   - Cursor Agent는 Blender **GUI 조작 불가**, `blender --background --python` 스크립트 가능

---

## 7. SpriteBoardBuilder 최근 동작 (중요)

- 우드·구멍: **`FloorRot`** — 바닥 XZ, PNG isometric 각도 유지
- `CellSpriteSize` = `CellFill * 0.94f`
- 민트 프레임: 4변 `ScaleBar` (length/thickness **독립** 스케일, 버그 수정됨)
- 우드 트레이(`CreateWoodTray`) **비활성** (isometric과 충돌)
- 벽: `PlaceCandyWall` **막대 1개** (겹침 없음)

---

## 8. BallPresenter

- `SpriteCatalog.Ball` texture width ≥ 200 → **SpriteRenderer** + 카메라 billboard (`LateUpdate`)
- 스케일: `BallDiameter / sprite.bounds` (1024px PPU100 거대화 버그 수정)
- 그림자: `ball_shadow.png` 있으면 floor sprite, 없으면 cylinder

---

## 9. 미완료 / 우선순위 제안

| P | 작업 |
|---|------|
| P0 | reference2급 **비주얼** — Blender GLB + MeshBoardBuilder **또는** 탑다운 PNG 재제작 + 투명도 |
| P1 | `bg_gradient` 1080×1920, `star`, `ball_shadow` |
| P1 | HUD reference2 (크라운·골드 점수, 하단 Move/Place) |
| P2 | PNG 용량 최적화 (1024→512, 압축) |
| P2 | README / handoff 유지 |

---

## 10. 에디터·테스트

| 키 | 동작 |
|----|------|
| WASD / 스와이프 | 기울임 |
| R | 리셋 |
| N | 다음 스테이지 |

Console 정상: `[SpriteCatalog] Art ready — wood 1024px, ball 1024px`

---

## 11. Grok 작업 시 제약

- **커밋/푸시:** 사용자 요청 시만
- **git config** 변경 금지
- 로컬 Unity/Blender 실행은 **사용자 PC**; Grok은 스크립트·diff 제안
- 대화 전체가 아닌 **이 문서 + 코드**가 진실

---

## 12. 관련 문서

- `docs/GAME_DESIGN_REFERENCE.md` — 기획·메타·PvP
- `docs/PRODUCT_ROADMAP.md` — 출시 로드맵
- `docs/DIFFICULTY_FORMULA.md` — par·난이도
- `tools/chatgpt_rollin_board_art.md` — 탑다운 PNG 13종 ChatGPT 가이드
- `unity/InTheHole/README.md` — Unity 실행

---

## 13. Cursor 대화에서만 있던 메모 (요약)

- Game view Scale 0.4 = 에디터 미리보기만, 폰 빌드 무관
- `wall_h.png` / `wall_v.png` — Sync 맵 없음, Unity Art에 직접 넣으면 우선 사용
- 나노바나나2: hole_ring 프롬프트가 거절될 때 “게임 UI 도넛 링” 완화 프롬프트 사용

---

**Grok:** 이 파일을 읽은 뒤 `GROK_START_HERE.md`의 온보딩 규칙을 따르세요.
