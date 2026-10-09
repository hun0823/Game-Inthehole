# Grok — 이 저장소부터 읽기

Rollin' Board / **InTheHole** Unity 모바일 퍼즐 프로젝트입니다.  
Cursor에서 작업하던 컨텍스트를 이 repo에 옮겼습니다.

## Grok에게 할 일 (사용자 → Grok)

1. **공개 repo URL**을 Grok에 전달 (push 후 `https://github.com/<user>/<repo>`).
2. 아래 **온보딩 프롬프트**를 Grok 새 채팅에 붙여넣기.
3. Grok이 “파일을 직접 clone 못한다”면 → `docs/GROK_HANDOFF.md` 전문 복붙 + `docs/` zip 첨부.

## Grok 온보딩 프롬프트 (복사)

```
GitHub 저장소의 Rollin' Board (InTheHole) 프로젝트를 이어서 개발하는 파트너다.

필독 순서:
1) docs/GROK_HANDOFF.md (전체 컨텍스트)
2) docs/GAME_DESIGN_REFERENCE.md
3) docs/PRODUCT_ROADMAP.md
4) unity/InTheHole/README.md

규칙:
- 게임 규칙은 GameSimulation / shared/levels.json 단일 소스
- Unity 메뉴 "Generate Reference Art" 사용 금지 (커스텀 PNG 덮어씀)
- 아트 동기화: game_asset2 → InTheHole → Sync Game Art
- 커밋/푸시는 사용자가 요청할 때만

먼저 GROK_HANDOFF.md 요약 10줄 + 다음 작업 우선순위 3개만 답하고,
이후 사용자가 "다음"이라고 하면 한 단계씩만 진행해라.
```

## 핵심 경로

| 경로 | 내용 |
|------|------|
| `docs/GROK_HANDOFF.md` | **Handoff 전체** (디자인·로직·아트·미완료·금지사항) |
| `unity/InTheHole/` | 출시용 Unity (URP) |
| `shared/levels.json` | 50 스테이지 데이터 |
| `tools/` | 레벨 생성·아트 sync·검증 스크립트 |

## 로컬 아트 (Git에 없을 수 있음)

커스텀 PNG 원본: `C:\Users\ckdgn\Desktop\Rollin' Board\game_asset2\`  
Unity 반영: `unity/InTheHole/Assets/Resources/Art/`
