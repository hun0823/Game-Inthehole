# Rollin' Board — 로드맵 (웹 프라이머리)

**갱신:** 2026-10-11  
**목표:** GitHub Pages 웹 빌드로 캠페인·메타·상점을 완성한 뒤, 출시 경로(PWA / Capacitor / 스토어)와 수익화를 결정.

**라이브:** https://hun0823.github.io/Game-Inthehole/ (`main` → [pages.yml](../.github/workflows/pages.yml))

---

## 현재 상태 (완료)

- [x] Three.js 플레이 (`index.html` + `js/`), 규칙 단일 소스 `js/game.js`
- [x] 144 스테이지 — `shared/levels.json` (12 행성 × 12), `tools/validate_levels.py` + `sync_js_levels.py`
- [x] 행성 맵·진행(행성 클리어 시 다음 해금), KO/EN (`js/i18n.js`)
- [x] 아케이드 HUD — [`HUD_LAYOUT.md`](HUD_LAYOUT.md)
- [x] 상점(별): 공 29종 + goal v3 페어, 트레일·배경·클리어 연출 (`js/cosmetics.js`, `js/balls.js`)
- [x] 행성/공 텍스처 파이프라인 — `tools/bake_sphere_maps.py`, [`TEXTURE_MAPS.md`](TEXTURE_MAPS.md)
- [x] GitHub Pages 자동 배포
- [x] Unity (`unity/InTheHole/`) **일시 중지** — 코드 보존, 웹과 규칙·레벨 포맷 불일치
- [x] 오디오 기반 — `js/audio.js` 버스, 설정 볼륨·뮤트, jsfxr로 구운 SFX. BGM은 Flowerbed Fields [Loop] (Zane Little Music, CC0) — 메뉴·스테이지가 한 곡을 이어서 재생

---

## 다음 작업 (우선순위)

### P0 — 플레이 완성도

| 항목 | 메모 |
|------|------|
| **BGM 선곡** | Flowerbed Fields [Loop]를 `bgm.menu`와 `bgm.game`에 넣음. 패딩을 잘라 루프하고, 맵↔스테이지에서 재시작하지 않음 |
| **첫 30초 튜토리얼** | 손가락 가이드 — 기울이기 → 구멍 |
| **210LAB 로고 스플래시** | 부팅·브랜딩 |
| **저장 강화** | localStorage 이상 — 날아감·동기화 대비 (스키마·export 등) |

### P1 — 모드·성능·출시 준비

| 항목 | 메모 |
|------|------|
| **배틀 모드** | [`GAME_DESIGN_REFERENCE.md` §5](GAME_DESIGN_REFERENCE.md) — **로컬 2P 프로토타입** 먼저 |
| **iPhone 60fps / 발열** | 실기기 측정. `?fps=1` 오버레이(FPS, p50/p95, draw call)로 확인. `js/quality.js`·bloom 튜닝 |
| **텍스처·폰트 용량** | WebP/해상도, HUD 폰트 subset |
| **테스트 해금** | Pages 테스트 hostname 해금; **릴리스에서는 OFF 확인** (`?unlock=` 동작 문서화) |
| **Undo** | 도입 여부 **결정** (현재 없음) |

### P2 — 상용화

| 항목 | 메모 |
|------|------|
| **출시 경로** | 웹 only / PWA / **Capacitor** 래핑 — Unity 대신 후보 |
| **광고·애널리틱스** | 자연스러운 브레이크 포인트 (§0 Block Blast 레퍼런스) |
| **스토어 에셋** | 스크린샷·영상·ASO |
| **일일 챌린지** | [`GAME_DESIGN_REFERENCE.md`](GAME_DESIGN_REFERENCE.md) 메타 |

---

## 퀄리티 체크리스트 (상위권)

- [ ] 중가 iPhone **60fps**, 과열 없음
- [ ] 첫 30초 안에 코어 루프 학습
- [ ] 한 판 15~90초, 실패 후 즉시 재도전
- [ ] 스토어 1스샷에서 보드·공이 한눈에

---

## 기술 스택 (웹)

```
HTML / CSS (HUD)
ES modules + Three.js (js/board3d.js 등)
규칙: js/game.js
데이터: shared/levels.json → js/levels.js
검증: tools/validate_levels.py, tools/tilt_solver.py
배포: GitHub Actions → Pages
```

## 폴더 (요약)

```
Game_Inthehole/
  index.html, css/, js/     ← 출시 빌드
  shared/levels.json
  tools/
  assets/
  docs/PRODUCT_ROADMAP.md   ← 이 문서
  unity/InTheHole/          ← paused
```

## Unity와의 관계

- 웹이 **규칙·레벨의 진실**; Unity `GameSimulation.cs`는 레거시(기둥 모델).
- Unity 재개 전에는 `unity/`를 갱신하지 않음. 앱 패키징은 **Capacitor** 등 웹 래핑을 우선 검토.
