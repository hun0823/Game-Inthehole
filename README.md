# In the Hole

테이블을 기울여 공을 구멍까지 굴리는 브레인 퍼즐.

## 프로젝트 구성

| 경로 | 용도 |
|------|------|
| `shared/levels.json` | 스테이지 단일 소스 (웹·Unity 공용) |
| `js/`, `index.html` | 웹 프로토타입 (기획·검증) |
| `unity/InTheHole/` | **출시용 Unity 3D** (상위권 목표) |
| `docs/PRODUCT_ROADMAP.md` | 상위권 출시 로드맵 |
| `docs/GAME_DESIGN_REFERENCE.md` | **기획·레퍼런스·난이도·메타·PvP 메모** |
| `docs/DIFFICULTY_FORMULA.md` | 난이도 점수·optimalMoves 치트시트 |
| **`docs/GROK_START_HERE.md`** | **Grok 봇 이어하기 (필독)** |
| `docs/GROK_HANDOFF.md` | Cursor→Grok 전체 컨텍스트 |

## 웹 프로토타입 실행

```bash
python -m http.server 8080
```

→ http://localhost:8080

## Unity 3D (출시)

[unity/InTheHole/README.md](unity/InTheHole/README.md) 참고.

**목표:** Unity 3D + URP + AdMob — 스토어 상위권 퍼즐 퀄리티.
