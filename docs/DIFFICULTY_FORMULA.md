# 난이도 수식 & 밸런스 치트시트

`GAME_DESIGN_REFERENCE.md` §2 보조 문서. 레벨 제작·툴 구현 시 사용.

## 난이도 점수 (0~100, 자동 태깅용)

```
difficultyScore =
    12 * gridSize
  + 5  * optimalMoves
  + 25 * wallDensity
  + 8  * pillarCount
  + 15 * (1 - branchingNorm)    // branchingNorm: 0~1, 1=항상 4방향 가능
  + 10 * specialTileRatio
```

- `difficultyScore < 25` → Easy  
- `25 ~ 45` → Normal  
- `45 ~ 65` → Hard  
- `> 65` → Expert  

※ 계수는 5×5 30스테이지 플레이테스트 후 조정.

## optimalMoves 계산 (의사코드)

```
state = (ballRow, ballCol)
queue = BFS from start
each expand: for dir in 4 tilts:
  slide until blocked, new state
goal: ball at hole
return shortest path length in tilts
```

- 유리벽: 엣지 상태 `(hits)` 를 BFS 상태에 포함 → 상태 공간 증가  
- 워프: `(cell, warpUsed)` 등 추가

## 5×5 Phase A 목표 분포 (30스테이지 예)

| 구간 | 스테이지 수 | optimalMoves | wallDensity |
|------|-------------|--------------|-------------|
| Easy | 8 | 4~6 | 0.15~0.22 |
| Normal | 12 | 6~9 | 0.22~0.32 |
| Hard | 8 | 9~12 | 0.30~0.38 |
| Expert | 2 | 11~14 | 0.35~0.42 |

## 플레이어 체감 vs optimalMoves

| 비율 moves/optimal | 체감 |
|--------------------|------|
| 1.0 | “완벽” |
| 1.2 | 약간 헤맴 |
| 1.5+ | 답 찾기 어려움 |
| 2.0+ | 스테이지 설계 재검토 |
