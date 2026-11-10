# Rollin' Board / 인더홀 — 게임 바이블

**기준일:** 2026-11-10. `shared/levels.json` version 14. 같은 파일에 `python3 tools/validate_levels.py`를 돌리면 132판이 풀리고 par가 BFS와 일치한다 (exit 0).

화면 제목은 **Rollin' Board** (`index.html`). 저장 키와 폴더 이름은 `inthehole` / InTheHole이다. 예전 작업명은 In the Hole. 이 문서의 한국어 이름 인더홀은 그 작업명을 가리킨다. UI 문자열에 「인더홀」은 없다.

이 문서는 **지금 main에 구현된 웹 게임**의 기준이다. 규칙의 단일 소스는 `js/game.js`다. 스테이지 원본은 `shared/levels.json`이고, `python3 tools/sync_js_levels.py`가 `js/levels.js`로 옮긴다. 플레이어가 도는 보드는 `js/levels.js`다. Python 솔버 `tools/tilt_solver.py`와 필요성 검사 `tools/necessity.py`는 그 규칙을 따라가고, `tools/validate_levels.py`가 캠페인에 적용한다. UI·상점·저장은 `js/main.js`, 문구는 `js/i18n.js`다.

`docs/GAME_DESIGN_REFERENCE.md`의 §0–§8, `docs/DIFFICULTY_FORMULA.md`, `docs/GROK_HANDOFF.md`의 일부 숫자(레벨 version 8, 인게임 별 잔액, 힌트 버튼 위치)는 초안이거나 옛 HUD다. 캠페인 설명은 설계 메모 §9가 가깝다. 어긋나면 이 문서와 `js/game.js`를 따른다. Unity `unity/InTheHole/`는 일시 중지이고 pillar 레벨이라 웹과 규칙이 다르다.

배포는 `main` push → `.github/workflows/pages.yml` → https://hun0823.github.io/Game-Inthehole/ . 사이트에 올라가는 것은 `index.html`, `assets.html`, `css/`, `js/`, `assets/`다.

---

## 1. 핵심 개념

정사각 격자 테이블을 한 방향으로 기울이면 공이 막힐 때까지 미끄러진다. 공을 구멍에 넣으면 그 스테이지를 클리어한다. 막힘은 보드 가장자리, 벽, 닫힌 문, 역방향 일방통행, 현재 위상의 움직이는 벽, 이미 무너진 바닥이다. 유리는 맞는 횟수로 금이 갔다가 사라진다. 용암은 벽이 아니다. 공이 용암 칸을 밟으면 그 판은 진다.

한 칸은 모두 바닥이다. 벽·유리·문·일방통행·움직이는 벽은 **칸과 칸 사이의 변**이다.

| 축 | 좌표 | 의미 |
|----|------|------|
| `h` | `0 ≤ r < size-1`, `0 ≤ c < size` | `r`행과 `r+1`행 사이, 열 `c` |
| `v` | `0 ≤ r < size`, `0 ≤ c < size-1` | `c`열과 `c+1`열 사이, 행 `r` |

JSON(`shared/levels.json`)은 `{row, col}` 객체다. 런타임(`js/levels.js` → `js/game.js`)은 불리언 격자 `hWalls` / `vWalls` / `hGlass` / `vGlass`와 색 격자 `hColored` / `vColored`다. 칸 목록은 `[row, col]`, 일방통행은 `[axis, row, col, dir]`, 순간이동은 `[[r, c], [r, c]]` 쌍, 움직이는 벽은 `[[axis, r, c], [axis, r, c]]`(home, alt), 마그마는 `[row, col, at]`다.

보드 밖은 변이 아니라 슬라이드 표의 `null`이다. `blocked()`가 그 칸을 막는다. 랩어라운드는 없다. 가장자리를 `hWalls` / `vWalls`에 넣지 않는다.

캠페인은 행성 11개 × 12스테이지 = **132판**이다. 보드는 3×3에서 7×7까지다. 7×7을 넘는 판은 없다.

---

## 2. 조작

기울이기 방향은 `up` `down` `left` `right`다.

| 입력 | 동작 |
|------|------|
| 하단 D-pad (`data-dir`) | 그 방향으로 기울임 |
| `#playfield` 스와이프 | 가로가 더 크면 좌우, 아니면 상하. 이동 거리 28px 미만은 탭 |
| 짧은 탭 | `view.pick`이 아직 안 눌린 버튼 메시를 맞추면 `pressButton` |
| 화살표, WASD | 기울임 |
| `R`, 우측 Retry (`#btn-reset`) | `game.reset()` — 그 스테이지를 처음부터 |
| `N` | 다음 스테이지. 레슨이 열려 있거나 연출 중이면 무시. 행성이 잠겨 있으면 맵 |
| `?` | 힌트. `Shift+?`는 이 판의 설명 카드를 다시 연다 |
| Escape | 설정 → 상점 확인/상점 → 일시정지 순으로 닫는다. 행성 맵에서는 아무 것도 안 한다 |

기울임·탭·힌트·Retry는 상점, 맵, 설정, 레슨, 일시정지, 연출, 이미 이긴/진 상태, 이동 한도 오버레이가 올라와 있으면 들어가지 않는다.

제자리 부딪힘(`moved === false`)은 이동 수와 마그마 카운터와 움직이는 벽 위상을 바꾸지 않는다. 이 경우 `handleTilt`는 `applyTiltResult`를 호출하지 않으므로, 버튼 위에 선 채 벽에 부딪혀도 버튼은 눌리지 않는다. 버튼은 공을 그 칸으로 굴려 넣거나, 공이 그 칸에 있을 때 버튼을 탭할 때 열린다.

유리를 맞춰 `moved`가 참이 되면(공이 칸을 안 바꿔도) 그 기울이기는 소모다. 이동 수가 오르고, 마그마 카운터가 오르고, 움직이는 벽이 있으면 위상이 뒤집힌다.

`pressButton()`도 이동 수와 마그마 카운터를 올린다. 위상은 뒤집지 않는다.

---

## 3. 슬라이드

`Game.simulateTilt(direction)`이 한 기울이기를 계산한다. 반환은 `{ path, moved, won, lost, events }`다. 그 다음 `applyTiltResult`가 공 위치, 이동 수, 버튼, 공개 칸, 코인을 확정한다.

`prepareBoard().special`은 얼음, 모래, 무너지는 바닥, 일방통행, 순간이동, 움직이는 벽, 젤리, 마그마가 하나라도 있을 때 참이다. 참이면 `slide()`, 거짓이면 `slideClassic()`이다. 유리, 버튼 문, 포자 안개, 코인만 있는 보드는 classic 경로다. 수정 행성 전체, 장난감 행성 전체, 외계의 유리+안개·문+안개, 기계의 유리+문+안개가 classic이다. classic도 벽, 닫힌 문, 유리를 처리한다. 얼음 위에서의 유리 예외, 모래, 젤리, 용암, 순간이동, 일방통행, 움직이는 벽, 무너지는 바닥은 `slide()`에만 있다.

한 기울이기의 마그마 시각 `tilts`는 **시작 시점 값**으로 슬라이드 내내 고정이다. 카운터는 소모된 뒤에 오른다.

도착 판정 순서 (`slide`가 한 칸 들어간 뒤):

1. 그 칸이 용암이면 `lavaDeath`이고 진다. 구멍보다 먼저다.
2. 구멍이면 이긴다.
3. 모래면 그 칸에서 기울이기가 끝난다.
4. 젤리면 점프를 시도한다.
5. 얼음 런이었다가 얼음이 아닌 칸이면 그 칸에서 멈춘다. 얼음이면 런이 이어진다.

경로는 시작 칸을 포함하고, 실제로 밟은 칸을 순서대로 붙인다. 젤리 점프와 순간이동은 이웃이 아닌 칸이 경로에 이어질 수 있다.

이동이 끝난 뒤 `moved`이면 마지막 칸의 무너지는 바닥도 무너진다. 소모된 기울이기와 버튼 누름은 `tilts`를 1 올린다. 보드에 마그마가 없으면 `magmaCap`이 0이라 카운터는 0에 머문다. 마그마가 있으면 가장 늦은 `at`에서 멈춘다.

색 비트 `COLOR_BIT`: `red` 1, `blue` 2, `green` 4, `purple` 8. 알 수 없는 색 이름은 비트 1이다. 출시 132판의 문과 버튼은 전부 `red`다. 한 색을 활성화하면 그 색의 문 전부가 열린다. 같은 칸에 색이 둘이면 `activateAt` / `tryActivateButton`은 아직 안 열린 첫 버튼만 처리한다.

---

## 4. 타일과 트릭

### 4.1 벽

`hWalls` / `vWalls`. 변을 지날 수 없다. 얼음 위에서도 멈춘다. 렌더러 `userData.kind === "wall"`. 이어 붙인 변은 보드 메시에서 한 막대로 보인다. 한 칸의 네 변이 모두 막히면 검증이 `sealed floor cells`로 거절한다. 공과 구멍이 같은 칸이면 거절한다.

### 4.2 버튼 문

JSON `buttons[]`의 `{row, col, color}`, `coloredH` / `coloredV`의 `{row, col, color}`. 그 색이 열리기 전에는 `blocked()`가 변을 막는다. 공이 버튼 칸에 들어오거나 그 칸에서 시작하면 그 기울이기 **안에서** 색이 열린 뒤 계속 미끄러질 수 있다. 탭은 공이 그 칸에 있을 때만 성공한다.

라이브 상태: `game.activatedColors` (`Set` of color name), `game.hColored` / `game.vColored` (열리면 그 색 칸이 `null`). 솔버는 `packAct()` 비트마스크를 쓴다. 렌더러는 버튼 `userData.spent` / `pendingSpent`와 문 메시의 내려감을 본다. `view.armGateOpen(game)` 뒤에 `view.sync(..., { animateGates: true })`가 열림 연출을 건다.

### 4.3 일방통행 (해류)

런타임 `[axis, row, col, dir]`. `dir`은 `up` `down` `left` `right`. 그 변은 화살 방향으로만 건넌다. 반대쪽에서 부딪히면 하드 블록이다. 얼음도 예외가 없다. 레슨 id는 `oneway`. 바다 행성에서 소개된다.

### 4.4 순간이동 (소용돌이)

쌍으로 연결된다. 한쪽 칸으로 **들어가면** 다른 쪽 칸으로 나오고, 진행 방향은 그대로이며 슬라이드가 이어진다. 출구 칸은 그 스텝에서 다시 순간이동하지 않는다. 출구가 이미 무너진 바닥이면 그 스텝은 입구로 들어가지 않고 입구 앞에서 멈춘다. 경로에는 입구 칸 다음 출구 칸이 들어간다. 입구가 용암이면 출구로 나가기 전에 그 칸에서 진다. 레슨 id는 `teleport`.

### 4.5 얼음

칸 목록. 기울이기가 얼음에서 시작하거나 얼음을 밟으면 그 방향으로 얼음 런이 된다. 얼음이 아닌 첫 칸에서 멈춘다. 그 전에 하드 블록, 모래, 구멍, 용암이면 그쪽이 우선이다. 얼음 칸에서 유리에 첫 타를 맞으면 `glassCrack`은 나고 hp는 1이 되지만 공은 멈추지 않는다. 둘째 타는 `glassShatter`이고 공은 지나간다. 레슨 id는 `ice`.

### 4.6 모래

칸에 들어가는 순간 그 칸에서 기울이기가 끝난다. 얼음 런도 여기서 끊긴다. 구멍 판정보다 뒤다. 레슨 id는 `sand`. 사막 테마의 `storm: true`는 배경 먼지의 움직임일 뿐, 슬라이드 규칙이 아니다 (`js/themes.js`, `js/board3d.js` `layoutMotes`).

### 4.7 유리 (2타)

각 판의 hp는 2(온전) → 1(금, 여전히 벽) → 0(사라짐, 통과)이다. 히트는 다음 한 칸이 그 변을 건너는 슬라이드이고, 벽·닫힌 문·일방통행·움직이는 벽·무너진 바닥이 먼저 공을 세우지 않았을 때다. hp 0은 다시 맞지 않는다. 젤리 점프는 그 사이의 변을 건너뛰고 히트도 이벤트도 없다.

패킹은 판마다 3진 한 자리, 자리값 `POW3[index]`, 숫자 = `2 - hp`. 순서는 가로 변을 행 우선으로 모두 모은 뒤 세로 변이다. `packGlass()` / `applyGlass()`가 `hGlass`·`vGlass`(hp > 0)와 `hGlassStressed`·`vGlassStressed`(hp === 1)에 다시 쓴다. `game.glass[i]`는 `{ axis, r, c, hp }`다.

| 전이 | 이벤트 | 막나 |
|------|--------|------|
| hp 2 → 1 | `{ type: "glassCrack", edge }` | 막는다. 얼음 위에 있으면 예외로 계속 간다 |
| hp 1 → 0 | `{ type: "glassShatter", edge }` | 통과 |

`edge`는 `{ axis: "h"|"v", r, c }`다. `board3d`의 `glassMesh`는 `userData.axis === (edge.axis || edge.kind)` 이고 `r`, `c`가 같으면 그 판이다. 계약 전문은 [`GLASS.md`](GLASS.md).

`main.js`의 `glassRollFx`는 `glassCrack`을 `fx.cracked`, `glassShatter`를 `fx.broken`( `axis`와 `kind` 둘 다)로도 넘긴다. 새 연출은 `events`와 `type`을 본다. `view.roll`이 공이 그 변에 닿는 거리에서 `view.onGlassEvent`를 호출한다. 막는 금은 굴림이 끝날 때다. `window.RB_GLASS`가 같은 함수다.

효과음: `glassCrack` → 큐 `glassCrack`, `glassShatter` → 큐 `glass` (`js/sfxCues.js`).

### 4.8 젤리 (사탕 쿠션)

**굴러 들어가** 밟을 때만 점프한다. 기울이기 시작 때 이미 그 칸에 있으면 점프하지 않는다. 진행 방향으로 한 칸을 건너뛰고 두 칸 앞에 내려 계속 미끄러진다. 그 사이의 벽, 유리, 문, 일방통행, 움직이는 벽은 무시되고 유리는 금 가지 않는다. 건너뛴 칸은 경로에 없고, 무너지는 바닥으로도 밟히지 않는다. 떠날 때 젤리 칸 자신이 무너지는 바닥이면 그 칸은 무너진다.

착지가 보드 밖이거나 이미 무너진 칸이면 공은 젤리 위에 멈추고 기울이기가 끝난다. 얼음 위여도 그렇다. 착지가 용암이면 그 칸에서 진다. 착지가 다시 젤리면 이어서 점프한다. 한 기울이기당 상한은 `size * 2`다. 성공한 착지 뒤에는 구멍, 모래, 얼음 규칙이 그 칸에 적용된다. 레슨 id는 `jelly`.

### 4.9 용암 바닥 (마그마)

각 칸은 `[row, col, at]`이고 바닥으로 시작한다. `tilts`는 이번 기울이기 **시작** 값이다.

| `state` | 조건 | 밟기 |
|---------|------|------|
| `floor` | `tilts < at - 1` | 보통 바닥 |
| `warn` | `tilts === at - 1` | 금이 가도 건넌다 |
| `lava` | `tilts >= at` | 벽이 아니다. 들어가면 그 칸에서 진다 |

`at >= 2`면 시작은 floor, `at === 1`이면 시작부터 warn, `at === 0`이면 시작부터 lava다. 출시 용암 칸 16개의 `at`는 2 이상 12 이하다. 시작부터 warn이거나 lava인 칸은 없다.

| 전이 | 이벤트 |
|------|--------|
| floor → warn | `{ type: "magmaCrack", cell: { r, c } }` |
| warn → lava | `{ type: "magmaCollapse", cell: { r, c } }` |
| 공이 용암을 밟음, 또는 서 있는 칸이 이번 소모로 lava가 됨 | `{ type: "lavaDeath", cell: { r, c } }` |

금과 붕괴 이벤트는 슬라이드가 끝난 뒤 카운터가 오른 다음에 붙는다. 제자리 부딪힘은 카운터가 안 오르므로 일정이 안 간다. 버튼 누름은 오른다. 공이 서 있는 칸이 그 올림으로 lava가 되면 슬라이드 도중이 아니어도 `lavaDeath`다.

`snapshot().magma`는 `{ r, c, at, state }` 목록이고, `applyTiltResult` 이후에는 이미 오른 `tilts`의 상태다. `view.setStage`가 `magmaLook.mount(level.magma, theme, game)`를 하고, `view.sync`가 `magmaLook.sync(game)`을 한다. 퍼지는 중·무너지는 중(`spreading` / `collapsing`)인 칸은 sync가 건너뛴다. `view.roll`은 `magmaCrack` / `magmaCollapse`를 굴림이 끝날 때, `lavaDeath`를 그 칸에 닿는 거리에서 `view.onMagmaEvent`로 보낸다. `window.RB_MAGMA`가 같은 함수다. 계약 전문은 [`MAGMA.md`](MAGMA.md).

패배 오버레이는 `#overlay.is-lose`, 문구 키 `fell` / `fell-note`. 별은 없다. Retry는 `game.reset()`이다.

효과음 큐: `magmaCrack`, `magmaCollapse`, `lavaDeath`.

### 4.10 무너지는 바닥

칸 목록. 공이 그 칸을 **떠나거나**, 소모된 기울이기가 그 칸에서 **끝나면** 무너진다. 무너진 칸은 다시 들어갈 수 없다 (`collapse` 비트마스크, 목록 순서의 `1 << i`). 렌더러 `pits`: 금 메시는 계속 보이고, 구멍 메시는 비트가 켜지면 보인다. 레슨 id는 `collapse`. 용암 9–12에 마그마와 함께 있다.

자바스크립트 비트 연산은 32비트다. 무너지는 칸이 32개 이상이면 비트가 겹친다. 출시 용암 판은 칸이 하나다. 그 이상은 이 캠페인에서 검증하지 않았다.

### 4.11 움직이는 벽 (덩굴)

쌍의 `home` / `alt` 두 변. `phase`가 짝수면 home, 홀수면 alt가 벽을 차지한다. 보드의 모든 쌍이 위상 하나를 공유한다. 공이 움직인 기울이기(유리 히트로 `moved`가 된 경우 포함)가 끝난 뒤 `phase ^ 1`이다. 버튼만 누르거나 제자리 부딪힘은 위상을 그대로 둔다. 레슨 id는 `movers`. 렌더러는 `shiftSlot` 0이 home, 1이 alt이고 `game.phase & 1`과 같은 슬롯만 `ruleVisible`이다.

### 4.12 포자 안개

슬라이드를 바꾸지 않는다. `game.revealed`는 시작 칸으로 시작하고, 경로의 모든 칸이 추가된다. 렌더러는 변의 `fogCells`(그 변이 닿는 두 칸) 중 아직 공개되지 않은 안개 칸이 있으면 그 변을 숨긴다. 벽뿐 아니라 유리, 문, 덩굴 막대도 `fogWalls`에 들어 있어 같은 조건으로 가려진다. 안개 덩어리 자체는 그 칸이 공개되면 걷힌다. 레슨 id는 `smog`. 단독 행성은 없고 외계 1에서 처음 나온다.

필요성 검사는 규칙 플래그가 아니라, 해가 들어간 안개 칸에 닿은 숨은 **벽**을 빼면 par가 2 이상 짧아지는지로 본다.

### 4.13 코인 (캠페인에 없음)

엔진은 경로에서 코인을 모아 `coinsGot`에 넣고, `allCoins()`가 참이면 별 계산에 +1을 더할 수 있다. 구멍에 들어가는 것만이 클리어다. version 14 캠페인에는 코인 칸이 없고, 검증은 코인이 있으면 실패시킨다. 별 보너스 문구 키 `coin-bonus`는 정의만 되어 있고 호출되지 않는다. `showWin`의 `coinBonus`는 저장될 뿐 화면에 안 나온다.

### 4.14 레슨 카드

`LESSON_ORDER`: `sand`, `ice`, `oneway`, `teleport`, `glass`, `gates`, `mixed`, `smog`, `jelly`, `magma`, `collapse`, `movers`. `mixed`는 이 판의 트릭이 둘 이상일 때 붙는다. 트릭이 없으면 일시정지의 설명은 `plain`이다.

자동으로 뜨는 것은, 그 레슨이 **캠페인에서 처음 등장하는 스테이지**이고 `inthehole_lessons`에 아직 없을 때다. 확인하면 id가 저장된다. 첫 혼합은 바다 9(소용돌이+해류)다. 안개의 첫 등장은 외계 1, 무너지는 바닥의 첫 등장은 용암 9다.

문구는 `js/i18n.js`의 `LESSONS`다. 규칙이 이 문서와 다르면 `js/game.js`가 맞다.

---

## 5. 힌트

HUD 오른쪽 `?` (`#btn-hint`). 횟수 제한과 별 소모는 없다.

`Game.hintRoute(limit = 40)`이 현재 공, 유리 hp, 문 비트, `collapse`, `phase`, `tilts`에서 BFS로 최단 행동을 찾는다. 행동은 먼저 `press`, 그 다음 `up`, `down`, `left`, `right`다. 상태 키는 `r,c,gstate,act,collapse,phase,tilts`다. 결과가 `hintCache`에 남고, `reset()` / `loadLevel`이 캐시를 비운다.

BFS는 `moved`가 거짓인 기울이기, `lost`인 기울이기, 다음 카운터 올림이 공 아래 칸을 용암으로 만드는 상태를 확장하지 않는다. 용암에 죽는 줄은 해가 아니다. 깊이 `limit`(기본 40)에 닿으면 그 가지는 멈춘다. 해가 없으면 `null`이다.

`hintRoute`의 재생은 `slide()`를 읽기만 한다. `cells`는 각 슬라이드가 밟는 칸, `stops`는 슬라이드가 끝나는 칸이다. UI는 첫 행동의 D-pad에 `is-hint`를 붙이고, `view.showHint`가 경로 점과 정지 점을 그린다. 점 간격보다 먼 구간(젤리 점프, 순간이동)은 점을 끊는다. 첫 행동이 `press`면 버튼 메시를 강조하고 문구 키 `press`를 보여 준다. 해가 없으면 Retry에 `is-hint`를 붙이고 문구 키 `no-path`다.

캠페인 par 최댓값은 19라, 시작 상태의 최단해는 40 안이다. 헤맨 뒤의 최단해가 40을 넘으면 힌트는 없다고 말한다. 그 상태를 출시 판마다 확인하지는 않았다.

---

## 6. 승패와 별

`par`는 버튼 누름을 포함한 최단 소모 횟수다. HUD는 `moves/par`다. `par <= 0`인 판은 캠페인에 없다. 그 경우 한도는 무한이고, 이동 0이면 별 3, 그 외에는 별 1로 계산한다.

| `moves - par` | 이번 클리어의 별 | HUD 톤 |
|---------------|-----------------|--------|
| ≤ 0 | 3 | 보통 |
| 1 | 2 | `move-warn` |
| 2 | 1 | `move-danger` |
| ≥ 3 | 0. 클리어로 저장되지 않음 | `move-over`, 패배 오버레이 |

한도는 `par + 3`이다. `moves >= par + 3`이면 `handleAfterMove`가 구멍에 들어갔는지를 보기 전에 「이동 횟수 초과」(`out`)를 연다. 그 이동으로 구멍에 들어간 경우에도 `view.roll(..., intoHole)`과 `celebrate`는 이미 재생된 뒤 패배 카드가 덮는다. 클리어 목록과 별은 안 바뀐다. 별 1을 받으려면 그 판을 `par + 2` 이하에 끝내야 한다.

용암 패배(`lost`)는 별이 없고 문구는 `fell` / `fell-note`다. 패배 카드는 Retry 하나만 보인다 (`#overlay-retry`는 `.is-lose`에서 숨는다).

클리어 카드(`cleared`)는 이번 시도의 별을 보여 준다. `moves <= par`이면 `optimal`을 붙인다. 스테이지 번호가 12의 배수(그 행성의 12판)이면 공·골 세트 이미지를 항상 보여 준다. 다음 스테이지로 갈 수 있으면 버튼은 `next`, 아니면 `map-back`이다. Retry는 같은 판을 리셋한다.

저장 별은 스테이지 id마다 최고 기록만 남긴다 (`inthehole_stars_{id}`, 더 높을 때만 기록). 오버레이의 별은 이번 시도이고, 맵과 지갑은 최고 기록이다.

코인이 있는 보드에서 `allCoins()`이면 별 1·2에 +1, 별 3이면 별은 3으로 두고 `coinBonus`만 참이다. 출시 캠페인에서는 이 분기가 열리지 않는다.

---

## 7. 열한 행성

순서 `PLANET_ORDER` (`js/themes.js`). 각 12판. 행성 1(나무)은 처음부터 열린다. 다음 행성은 이전 행성 12판이 모두 `inthehole_cleared`에 있을 때 열린다. 행성 안에서는 스테이지 순서를 잠그지 않는다. 열린 행성의 스테이지 목록에서 12판 중 아무거나 고를 수 있다.

크기 곡선은 검증기가 판마다 검사한다. 나무 3,4,4,4,5,5,6,6,6,7,7,7. 사막 4,4,5,5,5,6,6,6,7,7,7,7. 얼음부터 기계까지 5,5,5,6,6,6,6,7,7,7,7,7.

아래 par는 `levels.json`에 저장된 값이고, 검증기의 BFS와 같다. 평균은 이 12개의 산술평균이다. 막다른 길 평균은 같은 파일에 `budget_dead_ends`를 다시 돌려 소수 둘째 자리까지 낸 값이다. [`GAME_DESIGN_REFERENCE.md`](GAME_DESIGN_REFERENCE.md) §9의 표는 이것을 소수 첫째 자리로 적는다.

막다른 길의 정의는 §8이다. 한 판이 잠시 줄어도 된다. 검증은 「12판 > 1판」과 「7–12판 합 > 1–6판 합」만 본다.

| # | id | 한국어 | 12판이 쓰는 트릭 | 보상 공 | par (1판→12판, 평균) | 막다른 길 평균 |
|---|-----|--------|------------------|---------|----------------------|----------------|
| 1 | `wood` | 나무 | 벽만 | `oak` 참나무 | 4→10, 7.00 | 4.33 |
| 2 | `desert` | 사막 | 모래만 | `dune` 사구 | 6→12, 9.00 | 4.42 |
| 3 | `ice` | 얼음 | 얼음만 | `snow` 눈덩이 | 7→13, 10.00 | 4.58 |
| 4 | `ocean` | 바다 | 아래 문단 | `beach` 비치볼 | 8→14, 11.17 | 3.17 |
| 5 | `crystal` | 수정 | 유리만 | `marble` 구슬 | 9→15, 12.00 | 4.75 |
| 6 | `toy` | 장난감 | 빨간 버튼 문만 | `toy` 장난감공 | 10→16, 13.00 | 4.42 |
| 7 | `candy` | 사탕 | 젤리만 | `gummy` 젤리 | 12→17, 14.92 | 4.92 |
| 8 | `lava` | 용암 | 마그마. 9–12는 무너지는 바닥을 더함 | `meteor` 운석 | 13→17, 15.33 | 22.00 |
| 9 | `jungle` | 정글 | 움직이는 벽만 | `coco` 코코넛 | 14→18, 16.17 | 5.58 |
| 10 | `alien` | 외계 | 트릭 정확히 둘 | `alien` 외계점액 | 15→18, 17.08 | 6.58 |
| 11 | `machine` | 기계 | 트릭 셋 | `gear` 톱니 | 16→19, 18.17 | 16.08 |

바다: 1–2 소용돌이만, 3–8 해류만, 9–12 해류+소용돌이. par는 8,9,9,10,10,11,11,12,12,14,14,14.

용암 par는 13이 세 판 연속인 뒤 15,15,16,16,16,16,17,17,17이다. 무너지는 바닥은 9판부터다.

외계의 두 트릭: 1–3과 7은 안개+움직이는 벽, 4–5와 8과 10–12는 유리+안개, 6은 문+안개, 9는 모래+유리.

기계의 세 트릭: 1과 6은 모래+안개+움직이는 벽, 2·4·9·12는 유리+안개+움직이는 벽, 3·5·8·10은 유리+문+안개, 7과 11은 얼음+안개+움직이는 벽.

행성 사이에서는 1판 par와 평균 par가 이전 행성보다 크다. 행성 안에서는 par가 줄지 않고, 12판 par가 1판 par보다 크다. 같은 par가 이어지는 것은 허용된다.

테마 색과 하늘은 `js/themes.js`의 `THEMES`다. 슬라이드는 테마를 읽지 않는다. 장착한 공과 보드 테마는 별개다. 행성을 깨도 그 공이 자동 장착되지 않는다.

보상 공 라벨은 상점의 `(행성번호-12 해금)`이다. 번호는 위 표의 1부터 11이다. 버섯 행성은 없다.

---

## 8. 검증

`python3 tools/validate_levels.py`가 `shared/levels.json`에 대해 아래를 실패로 만든다. 생성기가 같은 `necessity.py`를 부른다.

구조: 132판, id는 1부터 연속, `pillars` 필드 없음, 변은 범위 안, 벽·유리·색 문이 같은 변을 공유하지 않음, 일방통행과 움직이는 벽도 이미 쓰인 변과 겹치지 않음, 네 변이 막힌 칸 없음, 공과 구멍이 다름, 한 변 3 이상, par는 2 이상이고 BFS 길이와 같고 그 해로 재생하면 구멍에 도착, 코인 없음.

행성: §7의 순서, 크기, 트릭 집합. 나무·사막·얼음·바다는 집합이 정확해야 한다. 수정·장난감·사탕·정글은 그 트릭이 **들어 있으면** 통과하고, 다른 트릭이 더 있어도 이 항목만으로는 거절하지 않는다. 출시 판은 표대로 그 트릭만 있다. 외계는 이름이 정확히 둘, 기계는 셋 이상이다. 출시 기계 판은 모두 정확히 셋이다.

솔버블과 par: `tools/tilt_solver.py`의 `solve`, 상한 60. 힌트와 같은 규칙을 따른다.

필요성 (`necessity.CHECKS`, `GAP = 3`): 최적해가 그 장치를 쓰고, 중화하면 par가 3 이상 벌어지거나 풀 수 없어야 한다. 차이 0과 1은 장식이다. 장치마다의 중화 방법은 [`GAME_DESIGN_REFERENCE.md`](GAME_DESIGN_REFERENCE.md) §9 「필요성 (GAP = 3)」과 `tools/necessity.py` 함수 주석이 같다. 요약만 둔다.

- 모래, 얼음, 순간이동, 유리, 젤리: 빼거나(유리는 전부 벽으로 바꾸거나) 해가 더 나쁘다.
- 일방통행: 변을 여는 경우와 벽으로 막는 경우 둘 다 par가 바뀌고, 큰 변화 ≥ 3, 작은 변화 ≥ 2.
- 문: 색을 잠그면 풀 수 없고, 처음부터 열어 두면 par가 2 이상 준다. 해는 색 변을 건넌다.
- 안개: 들어간 안개 칸에 닿은 벽을 빼면 par가 2 이상 준다.
- 마그마: 분출을 빼면 par가 3 이상 짧아지고, 해는 `at` 전에 그 칸을 건너거나, 분출이 없는 짧은 해가 용암 보드에서 죽는다.
- 무너지는 바닥, 움직이는 벽: 어느 쪽으로든 par가 3 이상 바뀐다.
- 섞인 판: 들어 있는 이름마다 자기 검사를 통과한다.

벽만 있는 판에 대해 「벽을 빼면 par가 2 이상 준다」는 설계 메모에만 있고 `CHECKS`에는 없다.

램프: 행성 안 par는 비감소, 12판 > 1판. 1판 par와 평균 par는 행성마다 엄격히 증가. 막다른 길은 `budget_dead_ends`다. HUD와 같이 깊이 `par + 3`에서 탐색을 멈추고, 그 예산 안에 구멍에 넣을 수 없는 도달 상태를 센다. 용암으로 죽는 상태도 막다른 길이고 더 펼치지 않는다. 12판의 수가 1판보다 크고, 7–12판의 합이 1–6판의 합보다 커야 한다.

중복: `layout_fingerprint`가 크기, 공, 구멍, 벽, 유리, 문, 버튼, 모래, 얼음, 안개, 코인, 무너지는 바닥, 일방통행, 순간이동, 움직이는 벽을 비교한다. 이 지문은 회전을 보지 않고, **젤리와 마그마는 빠진다.** 그 다음 `Gallery`가 이면군 D4(회전 4 × 거울)의 `canonical`이 같으면 `dihedral duplicate`로 거절한다. canonical에는 젤리와 마그마 `at`가 들어간다. 한 변 5 이상에서는 벽만 보는 근사 중복도 거절한다. 어떤 대칭에서 자카드 ≥ 0.85이거나, 벽 해밍 ≤ 2이면서 공과 구멍이 같은 칸이다. 3×3과 4×4는 정확 중복만 거절한다.

이 작성 때 검증기는 exit 0이었다. 막다른 길 정수는 §7의 평균으로 다시 합산했다.

---

## 9. 상점과 별 경제

지갑 `purse()` = 각 스테이지 최고 별의 합 + `inthehole_retired_stars` − `inthehole_stars_spent`. 0 미만은 0이다. 132판×3 = 396이 캠페인 별의 상한이다. 은퇴 별은 그 위에 더해진다. 맵 카드의 `n/36`은 그 행성 12판의 최고 별 합이다.

상점은 맵의 별 칩, 맵의 Shop, 일시정지의 Shop에서 연다. 구매는 확인 카드 뒤에 별을 쓰고, 그 항목을 바로 장착한다. 환불은 없다.

보이는 탭은 `SHOP_TAB_ON`이 참인 **공(`balls`)과 축하(`celes`)** 다. **자국(`trails`)과 배경(`bgs`)은 거짓**이라 탭 버튼이 `hidden`이다. 카탈로그와 저장 키는 남아 있고, 부팅 때 `view.setTrail`과 `paintSky`가 장착 값을 그대로 적용한다. 플래그를 켜면 탭이 돌아온다. 코스메틱은 슬라이드, par, 힌트를 바꾸지 않는다.

기본 장착: 공 `oak`, 자국 `none`, 배경 `planet`, 축하 `burst`. 자국 `none`·배경 `planet`·축하 `burst`는 항상 소유다. 공 `oak`는 가격 0이지만 나무 행성 보상이라 자동 소유가 아니다. `equippedId()`는 소유하지 않은 id가 저장돼 있으면 `oak`를 돌려주므로, 나무를 깨기 전에도 화면의 공은 참나무다. 상점 줄은 잠금이다.

행성 보상 공은 살 수 없다. `canBuy`가 `ballUnlock`이 있는 공을 거절한다. 그 행성 12판이 모두 클리어되면 `grantClearedPlanetBalls`가 소유 목록에 넣는다. 이미 있으면 다시 넣지 않고 토스트도 없다. `testUnlock`은 클리어를 쓰지 않으므로 공을 주지 않는다. 부팅 때마다 이미 클리어된 행성을 다시 지급 시도한다.

해금 토스트 `#unlock-toast`는 `inthehole_unlock_seen`에 없는 새 공만, 약 3.4초, 문구 `unlocked-toast`(`해금: {name}`)다. 상점을 열면 그 공의 「해금」 배지를 본 것으로 지운다.

가격은 `js/balls.js`와 `js/cosmetics.js`다. 행성 보상은 가격 대신 해금 조건으로 보인다.

| id | 한국어 | 가격 | 비고 |
|----|--------|------|------|
| `oak` | 참나무 | 0 | 나무 12 해금. 골 `knot` |
| `dune` | 사구 | 20 | 사막. `oasis` |
| `marble` | 구슬 | 6 | 수정. `crystal` |
| `soccer` | 축구공 | 12 | 상점. `net` |
| `tire` | 타이어 | 18 | 상점. `rim` |
| `slime` | 슬라임 | 24 | 상점. `puddle` |
| `snow` | 눈덩이 | 30 | 얼음. `snowman` |
| `basketball` | 농구공 | 32 | 상점. `hoop` |
| `baseball` | 야구공 | 36 | 상점. `plate` |
| `tennis` | 테니스공 | 40 | 상점. `cup` |
| `beach` | 비치볼 | 42 | 바다. `bucket` |
| `golf` | 골프공 | 46 | 상점. `flag` |
| `bowling` | 볼링공 | 48 | 상점. `pins` |
| `meteor` | 운석 | 54 | 용암. `crater` |
| `toy` | 장난감공 | 56 | 장난감. `pedestal` |
| `mushroom` | 버섯공 | 64 | 상점 전용. `stump`. 옛 버섯 12판을 모두 깬 저장은 구매 없이 소유 |
| `yarn` | 실타래 | 68 | 상점. `spool` |
| `gummy` | 젤리 | 72 | 사탕. `dish` |
| `donut` | 도넛 | 78 | 상점. `mug` |
| `melon` | 수박 | 88 | 상점. `rind` |
| `coco` | 코코넛 | 96 | 정글. `nest` |
| `disco` | 디스코볼 | 108 | 상점. `lamp` |
| `alien` | 외계점액 | 120 | 외계. `glow` |
| `lucky` | 복주머니 | 128 | 상점. `hoard` |
| `cat` | 고양이 털뭉치 | 138 | 상점. `paw` |
| `gear` | 톱니 | 150 | 기계. `cog` |
| `pixel` | 8비트 | 168 | 상점. `pixels` |
| `globe` | 지구본 | 188 | 상점. `rocket` |
| `skull` | 해골공 | 210 | 상점. `cauldron` |

숨은 자국: `none` 0, `rainbow` 8, `hearts` 16, `notes` 22, `footprints` 30. 장착 자국은 공 자체의 자국을 대신한다. 튀기·흔들림·쿵·눈덩이 성장·실타래 수축과 짝 골은 공에 남는다.

숨은 배경: `planet` 0 (스테이지 하늘), `sunset` 10, `blossom` 20, `snow` 26, `station` 40. 행성 맵 하늘은 항상 별밭이다 (`paintSky`가 맵에서 `drawSky(skyEl, null)`).

보이는 축하: `burst` 0 (원래 클리어 반짝임), `fireworks` 14, `confetti` 18, `rainbow` 24, `dance` 36. `dance`는 보드 옆의 작은 캐릭터(`showDancer`, 약 1.5초)다. `celebrate`는 `prefers-reduced-motion`이 뷰를 만들 때 켜져 있으면 축하 종류와 상관없이 작은 `burst`만 내고 돌아간다. 그 경우 춤 캐릭터는 나오지 않는다. 동작 줄이기가 꺼져 있고 장착이 `burst`여도 같은 반짝 분기만 탄다.

공마다 `goal` 문자열이 있다. `dressGoal`은 그 kind로 `mountGoal`을 올리고, 카탈로그 공이 장착된 동안 기본 구멍 그룹 `stockHole`은 숨는다. 상점과 12판 목록과 클리어 카드는 공과 골을 나란히 그린다 (`js/showcase.js`).

---

## 10. 진행, 저장, 테스트 해금

맵은 해금 순서의 행성 11개다. 홀수라 지그재그다 (`js/constellation.js` `mapLayout`). 잠긴 행성은 어둡고 자물쇠가 있으며, 누르면 거절음만 난다. 열린 행성을 누르면 카메라가 다가간 뒤 스테이지 목록이 열린다. PLAY는 포커스 행성(열린 것 중 아직 12판이 아닌 첫 행성, 모두 깼으면 마지막)의 아직 안 깬 첫 판으로 간다.

`#숫자` 또는 `?stage=숫자`는 `loadStage`로 바로 연다. 이 경로는 `planetUnlocked`를 보지 않는다. `N`과 클리어 카드의 다음은 `canStepTo`를 본다. 같은 행성이거나, 목적 행성이 열려 있어야 한다.

### localStorage

| 키 | 내용 |
|----|------|
| `inthehole_cleared` | 클리어한 스테이지 id의 JSON 배열 |
| `inthehole_stars_{id}` | 그 id의 최고 별. 1–3만 기록 |
| `inthehole_stars_spent` | 상점에서 쓴 별의 누적 |
| `inthehole_retired_stars` | 없어진 버섯 판에서 가져 온 별 |
| `inthehole_progress_v` | 캠페인 이전 버전. 현재 `"11"` |
| `inthehole_balls_owned` | 구매·해금한 공 id. 가격 0이면서 행성 보상이 아닌 공은 여기 안 써도 소유로 친다. 지금은 해당 공이 없다 |
| `inthehole_ball_equipped` | 장착 공. 없거나 미소유면 화면은 `oak` |
| `inthehole_trails_owned` / `inthehole_trail_equipped` | 자국. 기본 `none`은 배열에서 뺀다 |
| `inthehole_bgs_owned` / `inthehole_bg_equipped` | 배경. 기본 `planet` |
| `inthehole_celes_owned` / `inthehole_cele_equipped` | 축하. 기본 `burst` |
| `inthehole_unlock_seen` | 해금 토스트를 이미 본 공 |
| `inthehole_lessons` | 확인한 레슨 id |
| `inthehole_lang` | `ko` 또는 `en` |
| `inthehole_audio` | `{ bgm, sfx, mute }`. 기본 0.7 / 0.8 / 거짓 |
| `inthehole_bloom` | `auto` `on` `off` |
| `inthehole_deco` | `on` `off` `auto`. 설정 화면에는 없다. `js/boardDeco.js`가 읽고, 쓰는 곳은 `tools/capture.html`뿐이다 |
| `inthehole_test_unlock` | 테스트 호스트에서 `"0"` 또는 `"1"` |
| `inthehole_fps` | `?fps=` / `?perf=` 오버레이 기억. `"1"`이면 켠다 |

언어가 없으면 `navigator.language`가 `ko`로 시작할 때 한국어, 그 외에는 영어다 (`detectLang`).

### 버섯 캠페인 이전

`js/saveMigrate.js`. `inthehole_progress_v`가 이미 `"11"`이면 아무것도 안 한다. 아니면 옛 12행성 순서를 11행성에 맞춘다. 옛 순서는 나무, 사막, 얼음, 바다, 수정, 장난감, **버섯(id 73–84)**, 사탕, 용암, 정글, 외계, 기계였다. 버섯이 아닌 판은 같은 행성·같은 슬롯의 새 id로 옮긴다. 버섯 클리어는 버린다. 버섯 id에 붙어 있던 별은 0–3으로 잘라 `inthehole_retired_stars`에 더한다. 버섯 슬롯 12개가 모두 클리어였으면 `mushroom` 공을 소유 목록에 넣는다. 끝난 뒤 버전을 `"11"`로 쓴다. 옛 `#id` / `?stage=`도 같은 규칙으로 주소만 고친다. 버섯 번호는 stage 쿼리를 지운다.

### `testUnlock`

`js/testUnlock.js`. 호스트가 `hun0823.github.io`, `localhost`, `127.0.0.1`, `::1`일 때만 본다. 그 호스트의 기본은 켜짐이라 행성 잠금이 풀린다. `?unlock=0`은 끄고 `inthehole_test_unlock`에 `"0"`을 남긴다. `?unlock=1`은 켜고 `"1"`을 남긴다. 쿼리가 없으면 저장값을 따른다. 다른 호스트는 쿼리를 무시하고 항상 잠금 규칙이다. 켠 상태에서도 클리어를 대신 써 주지 않고 보상 공을 주지 않는다. 출시 빌드에서 끄라는 항목은 [`PRODUCT_ROADMAP.md`](PRODUCT_ROADMAP.md)에 있고, 지금 Pages 호스트의 코드 기본값은 켜짐이다.

---

## 11. HUD, 일시정지, 설정

인게임 상단은 한 줄이다. 왼쪽 일시정지, 가운데 스테이지 배너(행성 이름과 번호, 그 아래 별 3개와 `moves/par`), 오른쪽 힌트. 별 지갑은 이 줄에 없다. 맵 칩과 상점 헤더에 있다. 배너 글자는 칸보다 넓으면 14px까지 줄어든다.

보드가 차지하는 사각형, D-pad가 보드를 12px 덮는 계약, 세이프 에어리어는 [`HUD_LAYOUT.md`](HUD_LAYOUT.md)가 수치까지 적는다. `window.RB_LAYOUT.boardRect()`가 `.board-wrap`의 사각형과 `dpadOverlap`을 준다. `.controls`는 `pointer-events: none`이고 D-pad와 Retry만 `auto`라, 겹친 띠의 스와이프는 위 버튼을 제외하면 보드가 받는다.

일시정지 (`#pause-menu`)는 오버레이와 연출이 없을 때 열린다. 항목은 계속(`resume`), 설명(`how`), 스테이지목록(`stage-list`), 상점(`shop`), 설정(`settings`)이다. 바깥을 누르면 닫힌다. 설명은 이 판의 레슨을 순서대로 다시 보여 준다.

스테이지 목록은 그 행성의 12판이다. 각 줄에 크기와, 별이 있으면 `★` 문자다. 12판 줄은 `finale`와 공·골 미리보기다. 이름 줄은 한국어와 영어를 같이 쓴다. 「행성」 버튼은 맵으로 간다.

설정 (`#settings`): 언어 `ko` / `en`, 빛번짐 `auto` / `on` / `off`, 음악 슬라이더, 효과음 슬라이더, 음소거, 닫기. 언어는 `inthehole_lang`에 쓰고 `applyLang`이 HUD와 열린 카드의 문구를 다시 그린다. 빛번짐 설명은 `glow-note`다. 프레임이 밀려 이번 실행에서 꺼졌으면 `glow-held`로 바뀐다.

`?fps=1` 또는 `?perf=1`은 HUD 밖에 1초 평균 FPS, 프레임 시간, 드로우 콜을 띄우고 `inthehole_fps`에 기억한다. `=0`은 끈다. 꺼져 있으면 DOM도 프레임 콜백도 없다 (`js/perf.js`).

---

## 12. 오디오

`js/audio.js` 그래프 하나다. 마스터 아래에 음악 버스와 효과음 버스가 있다. 첫 `pointerup` / `touchend` / `keydown`에서 `AudioContext`를 만들고 재개한다. 탭이 숨으면 BGM만 멈추고, 돌아오면 이어서 재생한다. 효과음은 미리 디코드하고, 동시에 8목소리까지며, 짧은 음정 흔들림이 있다. 설정은 `inthehole_audio`다.

메뉴와 스테이지는 같은 곡이다. Zane Little Music의 Flowerbed Fields [Loop] (CC0, [`CREDITS.md`](../CREDITS.md)). `assets/audio/manifest.json`의 `bgm.menu`와 `bgm.game`가 `bgm/flowerbed_fields.m4a` 다음 `bgm/flowerbed_fields.mp3`를 가리키고 `loopDuration`은 105.931043초다. 먼저 디코드되는 파일을 쓰고, 두 장면이 같은 파일이면 곡을 다시 시작하지 않는다. 소스가 다르면 약 0.7초 크로스페이드한다. 인코더 패딩은 디코드 버퍼에서 찾아 그 길이만 반복한다.

효과음 파라미터는 `tools/sfx/params.json`(jsfxr)이다. `node tools/sfx/bake.mjs`가 `assets/audio/sfx/`의 m4a+ogg와 manifest의 `sfx`만 갱신한다. 큐 id는 `roll`, `bump`, `stop`, `goal`, `clear`, `star`, `switch`, `gate`, `glass`, `glassCrack`, `ice`, `sand`, `teleport`, `jelly`, `magma-warn`, `magma`, `magmaCrack`, `magmaCollapse`, `lavaDeath`, `ui`, `buy`, `denied`다. 기울이기 안에서의 타이밍은 `js/sfxCues.js` `planTilt`가 정한다. 클리어 때는 `clear` 한 번과, 이번에 새로 오른 별 수만큼 `star`다.

iOS 무음 스위치는 페이지 오디오 세션을 따른다. Safari 17+에 `navigator.audioSession`이 있으면 `playback`을 넣는다. 거절되면 ambient라 스위치를 꺼야 들린다. `navigator.vibrate`는 iOS 사파리에 없다. 진동은 효과음이 켜져 있고 브라우저가 지원할 때만 나간다. 음소거이거나 효과음 볼륨 0이면 진동도 없다.

`window.RB_AUDIO`는 `played`, `settings`, `whenReady`, `scene`만 노출한다.

---

## 13. 렌더러 계약과 디자인 원칙

`createView` (`js/board3d.js`)가 플레이 캔버스에 붙는 API다. `main.js`가 쓰는 것은 `resize`, `setStage`, `sync`, `roll`, `nudge`, `bump`, `dipButton`, `pick`, `celebrate`, `showHint`, `clearHint`, `armGateOpen`, `setBall`, `setTrail`, `setCelebration`, `onGlassEvent`, `onMagmaEvent`, `setBloom`, `renderInfo`, `watchRender`, `bloomSuppressed`, `onBloomSuppressed`다.

`sync(game, opts)`의 옵션 기본값: `ready` 참, `animateGates` 거짓, `skipGlass` 거짓, `skipGates` 거짓, `adoptReveal` 참, `skipShift` 거짓. 기울이기 직후의 sync는 마그마 휴면 상태가 연출보다 먼저 lava로 바뀌지 않도록 `skipGlass`, `skipGates`, `adoptReveal: false`, `skipShift: true`다. 유리와 문은 `roll`이 이벤트 시점에 처리한다.

`roll(path, dir, intoHole, fx)`의 `fx`는 `{ cracked, broken, events }`다. 유리 이벤트는 `onGlassEvent`, 마그마 이벤트는 `onMagmaEvent`다. 전역 `window.RB_GLASS`, `window.RB_MAGMA`가 그 함수다. `window.RB_MEASURE`는 `measureGoal()`이다.

트릭 메시의 위치와 어느 변이 막는지는 `board3d.js`가 정하고, 모양과 아이들 루프는 `js/trickLook.js`다. `trickVariant`는 `alien`과 `machine`만 자기 스킨이고 나머지는 `home`이다. 프레임 주변 소품은 `js/boardDeco.js`다. 주석은 「몇 개의 셀 셰이딩 소품. 고드름 없음. 인파 없음」이다. `decoWanted()`는 `inthehole_deco`가 `off`면 끄고, `on`이면 켠다. `auto`(저장 없음)는 `prefers-reduced-motion`, `deviceMemory <= 2`, `hardwareConcurrency <= 2`이면 끈다.

공이 렌더러에 넘기는 필드 (`js/balls.js`): `id`, `price`, `trail`, `motion` (`wobble` `grow` `bounce` `thud` `yarn` 또는 null), `goal`. 텍스처가 없으면 캔버스 재질로 떨어진다. 젤리 공 `gummy`는 맵을 안 굽는다 (`UNMAPPED_BALLS`). 구우려면 `python3 tools/bake_sphere_maps.py`. 출처와 골 색을 고친 이유는 [`TEXTURE_MAPS.md`](TEXTURE_MAPS.md)다.

### 지금 코드에 박혀 있는 원칙

**공과 골은 한 세트다.** 카탈로그의 모든 공에 `goal`이 있고, 상점은 공과 골을 같이 보여 주며, 행성 보상도 그 쌍이다. 자국 코스메틱은 궤적만 바꾸고 골은 공에 남는다.

**골 색은 민트 하나로 고정되어 있지 않다.** 장착 골은 `js/goalV3.js`의 `socketFor(kind)`가 종류마다 립·입구 색을 준다. 아무도 장착하지 않았을 때의 `stockHole`은 `addFloorSocket(theme)`의 행성 바닥 립과 `theme.edge`의 얇은 고리다. 카탈로그 공이 장착되면 이 그룹은 숨는다. 기본 화면은 참나무 옹이 구멍이다.

**연출은 짧게 두고, 폰에서는 빛을 끈다.** 자동 빛번짐은 데스크톱로 볼 만한 기기에서만 켜진다 (`js/quality.js` `deviceCanBloom`: 동작 줄이기 아님, iPhone/iPad/iPod 아님, `deviceMemory`가 있으면 6 이상, 코어 6 이상, 포인터가 coarse가 아님). 켜진 뒤 40프레임 평균이 18.5ms를 넘으면 이번 방문에서는 끈다 (`bloomHeld`). 400ms 이상 끊긴 간격은 샘플에서 뺀다. 평균이 22ms를 두 번 넘으면 `ratioCap`을 0.8배로 낮춰 해상도를 줄인다. 소품 레이어도 동작 줄이기와 아주 약한 기기에서는 빠진다.

**트릭은 장식이면 안 된다.** §8의 GAP 검사. 이 파일에서 검증기는 통과했다.

**같은 맵을 돌리거나 뒤집거나, 큰 보드에서 벽이 거의 같은 판은 넣지 않는다.** §8의 fingerprint와 Gallery. 3×3·4×4는 정확 중복만이다.

**아이폰 사파리 60fps는 목표로 적혀 있고, 이 저장소는 실측했다고 말하지 않는다.** 빛번짐 문구 `glow-note`와 `js/quality.js` 주석이 「아이폰 60fps는 여기서 재지 못했다」고 되어 있다. 자동 모드는 그 기기에서 빛번짐을 끈다. 로드맵의 60fps 체크는 아직 비어 있다. 이 문서는 그 프레임을 달성했다고 적지 않는다.

---

## 14. 알려진 빈틈

코드가 정하지 않았거나, 문서·경로가 서로 다른 것만 적는다.

1. **`layout_fingerprint`에 젤리와 마그마가 없다.** Gallery의 canonical에는 있다. 벽과 나머지 지문이 같고 젤리·마그마만 다른 두 판은 fingerprint가 중복이라고 거절한다. 회전은 fingerprint가 안 보고 Gallery가 본다. 지금 132판은 검증을 통과하므로 그런 쌍은 없다. `validate_levels.py`의 `_band`는 옛 1–70판 구간이고 호출되지 않는다. `_replay`, `_shorter_without`, `_coins_on_par`, `_jumps`, `_collapse_once`, `_shifter_matters`도 호출되지 않으며, 그 `_replay`는 `tilt`에 `tilts`를 넘기지 않는다.

2. **벽만 있는 판의 필요성 검사는 없다.** 설계 메모 §9는 벽을 빼면 par가 2 이상 줄어야 한다고 적는다. `CHECKS`에는 벽 항목이 없다. 나무 행성은 「트릭 이름이 비어 있음」만 검사한다.

3. **막다른 길 BFS는 버튼 누름을 행동으로 넣지 않는다.** 기울이기만 확장한다. 제자리 `press`로만 열리는 상태는 이 지표에 없다. 문 필요성 자체는 `solve`가 press를 포함해 검사한다. 장난감 행성의 막다른 길 수가 이 때문에 어떻게 달라지는지는 여기서 따로 재지 않았다. 검증기는 이 함수가 돌려주는 정수에 §8의 부등식을 적용하고, 그 검사는 통과했다.

4. **`par + 3`째 이동으로 구멍에 들어가면 연출은 클리어, 기록은 패배다.** §6. 별 0인 클리어 저장은 없다.

5. **딥링크는 행성 잠금을 건너뛴다.** `#id`, `?stage=`의 `loadStage`는 `planetUnlocked`를 보지 않는다. 그 판을 깨면 `inthehole_cleared`에 들어가고, 그 행성 12개가 모이면 보상 공도 지급된다. `testUnlock`과 별개의 경로다.

6. **코인 경로는 반쪽이다.** 시뮬과 별 +1과 코인 메시와 i18n 키는 남아 있다. 캠페인은 코인을 거절한다. `coin-bonus` 문자열은 화면에 안 나온다. `showWin`의 `coinBonus`도 문구로 쓰이지 않는다.

7. **기본 구멍에 대한 문서 한 줄이 메시와 다르다.** [`TEXTURE_MAPS.md`](TEXTURE_MAPS.md)는 「stock mint hole은 그대로」라고 적는다. 라이브 `stockHole`의 립은 행성 바닥이고 고리는 `theme.edge`다. 장착 공이 있으면 그 그룹은 숨고, 기본 장착 후보는 `oak`라 플레이어가 보는 구멍은 옹이 골이다.

8. **옛 기획 문서가 지금 HUD·규모와 다르다.** `GAME_DESIGN_REFERENCE.md` §1–§6과 `GROK_HANDOFF.md`의 version 8, 인게임 왼쪽 별 잔액, 힌트 버튼 위치는 현재 `index.html`과 다르다. 난이도 점수식(`DIFFICULTY_FORMULA.md`)은 검증기가 쓰지 않는다. 검증기가 쓰는 것은 par, 크기, 트릭 집합, GAP, 막다른 길 부등식, 중복 거절이다.

9. **빛번짐·60fps.** §13 마지막 문단. 아이폰 실측값은 이 저장소에 없다.

10. **`inthehole_deco`를 바꾸는 설정 UI가 없다.**

11. **힌트 깊이 40 밖의 상태는 `null`이다.** 시작 상태의 par는 19 이하다. 헤맨 뒤 40수를 넘는 최단해가 있는지는 판마다 확인하지 않았다.

12. **무너지는 바닥 비트는 31칸을 넘으면 정의가 깨진다.** 출시 판은 칸이 하나다.

13. **색은 네 가지를 받을 수 있으나 캠페인은 빨강만 쓴다.** 알 수 없는 색 이름은 비트 1(빨강과 같음)이고, 버튼 메시는 `GEM_HEX`에 없으면 빨강으로 그린다. 한 칸에 색이 둘일 때의 두 번째 색은 한 번의 `activateAt`으로는 안 열린다. 그런 판은 132판 안에 없다.

14. **수정·장난감·사탕·정글 검증은 추가 트릭을 막지 않는다.** 출시 데이터는 각 트릭만 들어 있다. 바다·나무·사막·얼음만 집합이 정확해야 한다.

15. **행성 안 스테이지는 순서 잠금이 없다.** 1판을 깨지 않아도 열린 행성의 12판을 목록에서 열 수 있다.

16. **`slide`와 `slideClassic`이 갈린다.** §3. 유리만 있는 판에는 얼음 예외 분기가 그 함수에 없다. 얼음과 유리를 한 판에 넣으면 `special`이 참이 되어 `slide()`로 가고, 그때는 얼음 위 첫 금이 공을 세우지 않는다. 출시 판에서 얼음과 유리는 같이 나오지 않는다. 기계 7·11은 얼음+안개+움직이는 벽이고 유리가 없다. 유리가 있는 외계·기계 판에는 얼음이 없다.

---

## 15. 같이 읽을 문서

| 문서 | 이 바이블에서의 위치 |
|------|----------------------|
| [`GLASS.md`](GLASS.md) | 유리 hp, 이벤트, `view.roll`의 `fx` |
| [`MAGMA.md`](MAGMA.md) | 마그마 상태, `onMagmaEvent`, 패배 오버레이 |
| [`HUD_LAYOUT.md`](HUD_LAYOUT.md) | 상단 바·D-pad·보드 사각형의 픽셀 계약 |
| [`GAME_DESIGN_REFERENCE.md`](GAME_DESIGN_REFERENCE.md) §9 | 필요성 문장, 생성기 이름, 반올림된 막다른 길 표. §0–§8은 초안 |
| [`TEXTURE_MAPS.md`](TEXTURE_MAPS.md) | 텍스처 출처와 골 색을 고친 이유. stock hole 한 줄은 §14.7 |
| [`PRODUCT_ROADMAP.md`](PRODUCT_ROADMAP.md) | 아직 없는 것: 첫 30초 튜토리얼, 스플래시, 저장 강화, 배틀, 출시에서 테스트 해금 끄기, Undo 여부 |
| [`CREDITS.md`](../CREDITS.md) | BGM 저작자 |
| `js/game.js` | 규칙이 이 문서와 다르면 이쪽 |
