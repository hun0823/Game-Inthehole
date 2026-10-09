# Rollin' Board — Unity 3D (출시용)

> 예전 작업명 *In the Hole*. 코드·저장 키 일부는 `inthehole_` 접두사 유지.

**목표:** 상위권 퍼즐 앱 — Unity 3D 테이블 + URP + AdMob.

## 요구 사항

- Unity Hub + **Unity 6** (6000.x) 또는 2022.3 LTS
- 앱 출시 예정이면 모듈: **Android Build Support** (필수), iOS는 Mac에서 추가

---

## Hub 설치 후 — 프로젝트 열기 (순서)

### 1) 에디터 설치 끝내기

Hub **Get set up** 화면에서 **Unity 6.4** 설치가 **4/4 완료**될 때까지 대기.

- 톱니 → **Add modules**에서 **Android Build Support** 체크 권장 (나중에 APK 빌드용)

### ⚠ 패키지 오류가 났다면

`adaptiveperformance` / `vectorgraphics` 를 찾을 수 없다 → **잘못된 폴더**를 연 경우가 많습니다.

- Hub에서 **`Game_Inthehole` (루트)** 가 아니라 **`unity\InTheHole`** 만 엽니다.
- 루트에 생긴 `Library`, `Packages` 는 Unity가 만든 것 — **게임 코드는 `unity/InTheHole/Assets`** 에 있습니다.

### 2) 프로젝트 추가

1. Hub 왼쪽 **Projects** 클릭  
2. 오른쪽 위 **Add** → **Add project from disk**  
3. 폴더 선택 (**이 경로만** — Cursor 워크스페이스 폴더 X):

   `C:\Users\ckdgn\Cusor\Game_Inthehole\unity\InTheHole`

   ⚠️ Hub에 `c-Users-ckdgn-Cusor-Game-Inthehole` 처럼 보이면 **잘못 추가한 것**입니다.  
   `...\.cursor\projects\...` 가 아니라 위 `Cusor\Game_Inthehole\unity\InTheHole` 입니다.

4. 목록에 **InTheHole** 이 보이면 클릭해 에디터 실행

### 3) 첫 실행 시 팝업

| 메시지 | 선택 |
|--------|------|
| 다른 Unity 버전 / 업그레이드 | **Continue** (6.4로 열기) |
| Input System | **Yes** (새 입력 시스템 사용) |
| URP / 패키지 업데이트 | **Yes** 또는 **Update** |
| Safe Mode | 컴파일 에러 시에만 — Console 확인 |

첫 import는 **5~15분** 걸릴 수 있습니다.

### 4) 게임 실행

1. 상단 **Play** ▶ 클릭  
2. **Game** 뷰**에 3D 테이블·공이 보이면 성공  
3. 조작: **마우스 드래그/스윕**(폰처럼) 또는 **WASD**·방향키 = 기울이기 · **R** = 리셋 · **N** = 다음 스테이지 · 우측 상단 **💡** = 최소 해결 경로 힌트  
4. 기본은 **레퍼런스 스프라이트 보드** (`GameVisualMode.MinimalLogicView = false`). Art 없으면 메뉴로 생성 (아래 비주얼). 로직만 볼 때 `true`  

> 빈 씬이어도 됩니다. `GameBootstrap`이 카메라·보드를 자동으로 만듭니다.

### 5) Game 화면이 **검은색**일 때

가장 흔한 원인: **URP(렌더 파이프라인) 미연결** → 커스텀 셰이더가 안 그려짐.

1. Unity를 한 번 저장·재컴파일하면 `Assets/Settings/UniversalRP.asset` + `UniversalRP_Renderer.asset` 이 자동 생성·연결됩니다.  
2. **Default Renderer is missing** 가 보이면 Console에 `[InTheHole] Fixed missing default renderer` 가 뜨는지 확인.  
3. **Edit → Project Settings → Graphics** → *Scriptable Render Pipeline Settings* 에 `UniversalRP` 가 들어갔는지 확인.  
3. **Game** 탭 선택 · Hierarchy에 `InTheHole_Root` 있는지 확인.  
4. Console 빨간 줄이 있으면 메시지 확인.

---

## 비주얼 (레퍼런스 스타일)

**스프라이트 기반 2.5D** — 큐브 프리미티브 대신 `Resources/Art` 텍스처 사용.

### 처음 한 번 (Unity)

1. 메뉴 **`InTheHole → Generate Reference Art (Sprites)`** 실행  
   (또는 터미널: `python tools/generate_reference_art.py`)
2. Project `Assets/Resources/Art` 선택 → Texture Type **Sprite** 인지 확인
3. **Play** — `SpriteBoardBuilder` + `GameHud` + 그라데이션 배경

### 레퍼런스와 “완전 동일”하게

생성된 PNG는 **임시 아트**입니다. 상용과 동일하려면 디자이너 시안(PNG)을 `Resources/Art`에 교체하면 됩니다 (파일명 동일 유지).

---

## 조작 (에디터)

| 키 | 동작 |
|----|------|
| ↑ / W | 공이 **화면 위**로 굴러감 |
| ↓ / S | **화면 아래** |
| ← / A | **왼쪽** |
| → / D | **오른쪽** |
| R | 스테이지 리셋 |
| N | 다음 스테이지 |

---

## 스테이지 검증 (수동 플레이 불필요)

규칙은 `GameSimulation` 한 곳에만 있습니다. 스테이지마다 Unity에서 직접 깨볼 필요는 없습니다.

| 방법 | 용도 |
|------|------|
| **메뉴** `InTheHole → Validate All Levels (BFS)` | 50스테이지 BFS 검증 |
| **재생성 (1~30)** | `python tools/generate_hard_levels.py` |
| **유리 스테이지 (31~40)** | `python tools/build_glass_stages_fast.py` → `merge_glass_stages.py` |
| **버튼 스테이지 (41~50)** | `python tools/build_button_stages_fast.py` → `merge_button_stages.py` |

### 난이도 설계 (v7, 50스테이지)

- **난이도 = 최소 기울임 횟수** (BFS). 벽(기둥) 개수와 무관.
- **격자 구간**: `1` 2×2 → `2~6` 3×3 → `7~19` 4×4 → `20~24` 5×5 → `25~36` **6×6** → `37~40` **7×7**
- **31~40 유리벽**: 첫 기울임은 막힘(균열) → 두 번째에 파괴·통과. **유리 없을 때보다 최소 기울임이 더 많은** 스테이지만 채택
- **41~50 색상 벽·버튼**: 버튼으로 같은 색 벽 제거. 막힌 길이 있으면 벽을 없애야 통과(우회 가능 스테이지도 있음). 난이도 상향(최적 12~18회대)
- **별·이동 한도 (전 스테이지)**: `par` = BFS 최적 이동 수. `par`회 = ★3, `par+1` = ★2, `par+2` = ★1, **`par+3` 이상 = 게임오버**. HUD `이동 n / limit` 표시. `python tools/annotate_par_moves.py` 로 `levels.json`에 `par` 갱신
- **힌트**: 유리·버튼 활성화 상태를 반영해 경로 표시 (`HintGuidePresenter` + BFS)
- **중복 방지**: 공/구멍·벽·유리·해답 경로 모두 유일
- 동기화: `python tools/sync_js_levels.py` (웹 `js/levels.js`)
| **웹** `index.html` | 규칙·연출 빠른 확인 |
| **`shared/levels.json`** | 데이터 단일 원본 → Unity `Resources/Levels/` 에 복사 |

새 스테이지 추가 후 BFS만 돌려도 “막힘/불가능” 대부분을 잡을 수 있습니다.

---

## 프로젝트 구조

```
Assets/Scripts/Core/     → 게임 규칙 (웹 game.js 와 동일)
Assets/Resources/Levels/ → levels.json
docs/PRODUCT_ROADMAP.md  → 상위권 출시 로드맵
shared/levels.json       → 스테이지 수정 시 Unity 쪽 json 도 동기화
```

---

## In-Editor Tutorial

Hub의 **Complete in-Editor tutorial** 은 Unity 기본 사용법입니다.  
**건너뛰어도 됩니다.** 이 게임은 Play만 누르면 동작합니다.

---

## 웹 프로토타입

`Game_Inthehole/index.html` — 기획용. **스토어 빌드는 Unity만** 사용합니다.
