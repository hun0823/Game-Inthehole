# Rollin' Board — ChatGPT 일괄 아트 생성 가이드

ChatGPT는 **한 번에 PNG 파일 여러 개를 zip으로 주지 않습니다.**  
대신 아래 **시작 프롬프트 1개**를 붙여 넣으면, 챗봇이 **13개를 순서대로** 그려 주고 매번 **다운로드**할 수 있습니다.

---

## 준비

1. [chatgpt.com](https://chatgpt.com) 로그인
2. **이미지 생성 가능한 모델** 선택 (GPT-4o 등, 이미지 생성 ON)
3. (선택) 레퍼런스 스크린샷을 채팅에 **첨부**한 뒤 시작 프롬프트 전송

---

## ① 시작 프롬프트 (전체 복사 → ChatGPT에 붙여넣기)

```
You are helping me create game sprites for a mobile puzzle game called "Rollin' Board".
Style must match a cute casual top-down puzzle: mint green board frame, wooden tiles, candy-colored walls, copper ball, teal vortex hole, dark starry night vibe.

RULES FOR EVERY IMAGE:
- Generate ONE image per message (one asset only, centered).
- Square image, simple background (solid light gray #e8e8e8) so I can remove it later.
- No text, no watermark, no UI, no multiple objects.
- After each image, stop and write exactly:
  DONE: [filename].png — reply "next" for the next asset.

Generate asset 1 of 13 now.

Asset 1/13 — filename: wood_a.png
Prompt: Cute mobile puzzle game asset, soft casual 3D style, top-down view. Single square wooden floor tile, light brown wood grain, rounded corners, one tile only, centered.
```

---

## ② 이후 — 매 이미지 다운로드 후

ChatGPT가 그림을 보여주면:

1. 이미지 **클릭 → 다운로드**
2. 파일 이름을 표에 맞게 변경 (예: `wood_a.png`)
3. 채팅에 **`next`** 만 입력

→ 2번~13번이 자동으로 이어집니다.

---

## ③ 2~13번 (ChatGPT가 멈추면 `next` 대신 해당 줄만 붙여넣기)

| # | 저장 파일명 | next 시 붙여넣을 한 줄 (선택) |
|---|-------------|-------------------------------|
| 2 | `wood_b.png` | `next` 또는: Asset 2/13 wood_b.png — single square wooden floor tile, slightly darker brown, rounded corners, top-down, one tile only |
| 3 | `frame_mint.png` | Asset 3/13 frame_mint.png — mint green glossy rounded horizontal bar, board border segment, capsule shape, one piece only |
| 4 | `wall_coral.png` | Asset 4/13 wall_coral.png — horizontal red candy jelly wall block, glossy rounded ends, puzzle obstacle, one bar only |
| 5 | `wall_blue.png` | Asset 5/13 wall_blue.png — horizontal blue candy jelly wall block, glossy rounded ends |
| 6 | `wall_purple.png` | Asset 6/13 wall_purple.png — horizontal purple candy jelly wall block, glossy rounded ends |
| 7 | `wall_green.png` | Asset 7/13 wall_green.png — horizontal green candy jelly wall block, glossy rounded ends |
| 8 | `ball.png` | Asset 8/13 ball.png — copper orange ball with subtle hex pattern, shiny highlight, top-down, one ball only |
| 9 | `ball_shadow.png` | Asset 9/13 ball_shadow.png — soft dark oval shadow on ground, blurred edges, simple, one shadow only |
| 10 | `hole_ring.png` | Asset 10/13 hole_ring.png — teal green glowing spiral ring vortex, bright edges, dark empty center, one ring only |
| 11 | `hole_core.png` | Asset 11/13 hole_core.png — solid dark black circle, soft edge fade, hole center, one circle only |
| 12 | `bg_gradient.png` | Asset 12/13 bg_gradient.png — vertical night sky gradient navy to deep purple, tiny yellow stars, full background, no objects (this one can have background, no transparency needed) |
| 13 | `star.png` | Asset 13/13 star.png — small yellow twinkle star, simple sparkle icon, one star only |

---

## ④ 배경 제거 (무료)

투명 PNG가 필요한 것: **1~11, 13** (12번 배경만 제외)

1. [remove.bg](https://www.remove.bg) — 월 무료 몇 장
2. 또는 [Photopea](https://www.photopea.com) — 회색 배경 `#e8e8e8` 매직 완드로 지우기 → Export PNG

---

## ⑤ Unity에 넣기

폴더:

`unity/InTheHole/Assets/Resources/Art/`

각 PNG → Inspector → **Texture Type: Sprite (2D and UI)** → **Apply** → Play

---

## 더 빠른 방법 (한 메시지에 13개 목록만 던지기)

ChatGPT가 순서를 스스로 안 지키면, 아래 **전체 블록**을 한 번에 보내고  
「1번부터 하나씩 그려줘. 끝날 때마다 파일명 알려줘」라고 하세요.

```
Rollin' Board game — generate these 13 assets ONE AT A TIME. Same cute mobile puzzle style. Light gray background. No text.

1 wood_a.png — light brown wood floor tile, rounded, top-down
2 wood_b.png — darker brown wood tile, rounded, top-down
3 frame_mint.png — mint green rounded border bar
4 wall_coral.png — red candy wall bar horizontal
5 wall_blue.png — blue candy wall bar
6 wall_purple.png — purple candy wall bar
7 wall_green.png — green candy wall bar
8 ball.png — copper orange ball hex pattern shiny
9 ball_shadow.png — soft oval shadow
10 hole_ring.png — teal spiral vortex ring
11 hole_core.png — dark circle hole center
12 bg_gradient.png — navy purple night sky gradient with stars (full background OK)
13 star.png — small yellow sparkle star

Start with #1 only. I will say "next" after each download.
```

---

## 주의

- ChatGPT **무료**는 이미지 생성 **횟수/일** 제한이 있을 수 있습니다. 13장이 한 번에 안 되면 나눠서 며칠에 걸쳐 받아도 됩니다.
- 마음에 안 드는 장은 **「같은 파일명으로 다시, 더 둥글게 / 색 더 밝게」** 로 재생성하세요.
- 파일명이 코드와 **완전히 같아야** 합니다 (대소문자 포함).
