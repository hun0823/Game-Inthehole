# In the Hole — 상위권 출시 로드맵 (Unity 3D + 상업 퀄리티)

목표: 스토어 상위권 퍼즐 게임 수준의 **비주얼·손맛·수익화**를 Unity 3D 한 프로젝트에서 달성.

## 전략: 2번 + 3번 믹스

| 축 | 선택 | 이유 |
|----|------|------|
| **엔진** | Unity 2022.3 LTS + URP | 모바일 성능, AdMob/Analytics 생태계, 채용·에셋 풍부 |
| **표현** | **진짜 3D** 테이블 | 기울임·공 굴림·벽 높이를 물리/카메라로 표현 (CSS 착시 X) |
| **규칙** | 기존 `shared/levels.json` + `GameSimulation` | 웹 프로토타입에서 검증된 로직 재사용 |

## 단계별 마일스톤

### Phase 0 — 지금 (1주)
- [x] 웹 프로토타입으로 규칙 검증
- [x] Unity `Assets` 골격 + 공유 레벨 JSON
- [ ] Unity Hub에서 `unity/InTheHole` 열기 → 첫 스테이지 플레이 확인

### Phase 1 — 코어 플레이 (2~3주)

> 상세 기획: [`GAME_DESIGN_REFERENCE.md`](GAME_DESIGN_REFERENCE.md) · 난이도: [`DIFFICULTY_FORMULA.md`](DIFFICULTY_FORMULA.md)
- URP 라이팅 1벌 (방향광 + 환경광)
- 프로시저럴 보드 → 이후 **Prefab + Material** 교체
- 공 굴림: 경로 보간 + 벽 충돌 사운드
- 테이블 `Transform` 기울임 + 관성 느낌 (DOTween 또는 AnimationCurve)
- 5스테이지 + 스테이지 선택 UI

### Phase 2 — 상위권 폴리시 (3~5주)
- **아트**: Low-poly 판 + PBR 타일/벽/구멍 (에셋 스토어 또는 외주 1세트)
- **VFX**: 먼지, 구멍 입장, 클리어 파티클
- **UX**: 튜토리얼 손가락, Undo, 별 3개(최소 이동 수)
- **사운드**: 굴림 루프, 탁, 떨어짐, BGM 1~2곡
- **메타**: 월드맵, 스테이지 30~50+, 난이도 곡선

### Phase 3 — 출시 (2~3주)
- Android/iOS 빌드, 스토어 스크린샷·영상
- **Google AdMob**: 배너 + 전면(스테이지 클리어) + 보상형(힌트/Undo)
- Firebase Analytics, 크래시리틱스
- 소프트 런치 → 리텐션·광고 eCPM 보고 밸런스

### Phase 4 — 상위권 유지 (지속)
- 주간 스테이지 / 시즌 패스
- ASO 키워드·스크린샷 A/B
- LiveOps: 이벤트 맵, 리더보드(최소 이동)

## 퀄리티 기준 (상위권 체크리스트)

- [ ] 60fps (중가 기기) / 배터리 과열 없음
- [ ] 첫 30초 안에 “기울이기 → 구멍” 학습
- [ ] 한 판 15~90초, 실패 시 즉시 재도전
- [ ] 광고는 **자연스러운 쉬는 타이밍**에만 (플레이 중 X)
- [ ] 스토어 1번째 스크린샷에서 3D 테이블이 한눈에 보임

## 기술 스택

```
Unity 2022.3 LTS
Universal RP (URP)
Input System (터치 + 키보드 에디터)
JSON: shared/levels.json
AdMob: Google Mobile Ads Unity Plugin (Phase 3)
```

## 폴더

```
Game_Inthehole/
  shared/levels.json      ← 스테이지 단일 소스 (웹·Unity 공용)
  web/                    ← (선택) 기존 HTML 프로토타입 이동
  unity/InTheHole/        ← 출시용 메인 프로젝트
  docs/PRODUCT_ROADMAP.md ← 이 문서
```

## 웹 프로토타입과의 관계

- **로직**: Unity `GameSimulation` = 웹 `game.js` 동일 규칙
- **레벨**: `shared/levels.json` 수정 시 Unity `Resources/Levels/levels.json` 동기화
- **웹**: 기획·밸런스 테스트용으로 유지 가능 (출시 빌드는 Unity만)
