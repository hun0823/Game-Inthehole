/** Korean and English copy. Rules stay in game.js; this file is words only. */

const STR = {
  en: {
    "map-title": "Planet map",
    "map-locked": "Locked",
    "map-open": "Play",
    "map-done": "Cleared",
    "settings": "Settings",
    "language": "Language",
    "glow": "Glow",
    "glow-note": "Auto turns glow on for desktop only. Phones stay off — 60fps was not measured on an iPhone.",
    "glow-held": "Turned off for this visit because frames slipped.",
    "glow-auto": "Auto",
    "glow-on": "On",
    "glow-off": "Off",
    "close": "Close",
    "shop": "Shop",
    "shop-title": "Shop",
    "tab-balls": "Balls",
    "tab-trails": "Trails",
    "tab-bgs": "Backgrounds",
    "tab-celes": "Celebrations",
    "stars": "stars",
    "free": "Free",
    "equipped": "Equipped",
    "equip": "Equip",
    "buy": "Buy",
    "need": "Need",
    "spend": "Spend",
    "not-now": "Not now",
    "spend-on": "Spend {price} stars on {name}?",
    "cleared": "Stage cleared!",
    "out": "Out of moves",
    "next": "Next",
    "optimal": "Perfect!",
    "more-left": "{n} more",
    "play": "PLAY",
    "map-back": "Planets",
    "rounds": "{n}/12 rounds",
    "here": "Here!",
    "stage-count": "Stage {n}/12",
    "unlock-note": "Clear {planet} to unlock",
    "finale": "Final",
    "reward-kicker": "Planet set",
    "restart": "From the start",
    "stages": "Stages",
    "how": "How?",
    "got-it": "Got it",
    "replay": "Tap How? by the question mark to see this again.",
    "hint": "Hint",
    "prev": "Previous stage",
    "retry": "Retry",
    "no-path": "No path — Retry",
    "press": "Press the switch",
    "coin-bonus": "coin bonus",
    "reward": "The {planet} set is yours: {ball}.",
    "lvl": "Lvl.",
    "up": "Up",
    "down": "Down",
    "left": "Left",
    "right": "Right",
    "stage-label": "{planet} {n}",
  },
  ko: {
    "map-title": "행성 지도",
    "map-locked": "잠김",
    "map-open": "플레이",
    "map-done": "클리어",
    "settings": "설정",
    "language": "언어",
    "glow": "빛번짐",
    "glow-note": "자동은 데스크톱에서만 켜요. 아이폰 60fps는 여기서 재지 못해 꺼 둡니다.",
    "glow-held": "프레임이 밀려 이번 실행에서는 껐어요.",
    "glow-auto": "자동",
    "glow-on": "켜기",
    "glow-off": "끄기",
    "close": "닫기",
    "shop": "상점",
    "shop-title": "상점",
    "tab-balls": "공",
    "tab-trails": "자국",
    "tab-bgs": "배경",
    "tab-celes": "축하",
    "stars": "별",
    "free": "무료",
    "equipped": "장착됨",
    "equip": "장착",
    "buy": "구매",
    "need": "부족",
    "spend": "사용",
    "not-now": "나중에",
    "spend-on": "{name}에 별 {price}개를 쓸까요?",
    "cleared": "스테이지 클리어!",
    "out": "이동 횟수 초과",
    "next": "다음",
    "optimal": "최적 이동!",
    "more-left": "{n}개 더",
    "play": "PLAY",
    "map-back": "행성",
    "rounds": "{n}/12 라운드",
    "here": "여기!",
    "stage-count": "스테이지 {n}/12",
    "unlock-note": "{planet} 클리어 시 해금",
    "finale": "마지막",
    "reward-kicker": "행성 세트",
    "restart": "처음부터",
    "stages": "스테이지",
    "how": "설명",
    "got-it": "알겠어요",
    "replay": "물음표 옆 설명으로 다시 볼 수 있어요.",
    "hint": "힌트",
    "prev": "이전 스테이지",
    "retry": "다시",
    "no-path": "길이 없어요 — 다시",
    "press": "스위치를 누르세요",
    "coin-bonus": "코인 보너스",
    "reward": "{planet} 세트를 얻었어요: {ball}.",
    "lvl": "단계",
    "up": "위",
    "down": "아래",
    "left": "왼쪽",
    "right": "오른쪽",
    "stage-label": "{planet} {n}",
  },
};

const PLANETS = {
  en: {
    wood: "Wood",
    desert: "Desert",
    ice: "Ice",
    ocean: "Ocean",
    crystal: "Crystal",
    toy: "Toy",
    mushroom: "Mushroom",
    candy: "Candy",
    lava: "Lava",
    jungle: "Jungle",
    alien: "Alien",
    machine: "Machine",
  },
  ko: {
    wood: "나무",
    desert: "사막",
    ice: "얼음",
    ocean: "바다",
    crystal: "수정",
    toy: "장난감",
    mushroom: "버섯",
    candy: "사탕",
    lava: "용암",
    jungle: "정글",
    alien: "외계",
    machine: "기계",
  },
};

const BALLS = {
  en: {
    oak: ["Oak", "Carved oak ball and a knot-hole goal."],
    dune: ["Dune", "Sand-colored ball. The goal is a clay oasis ring."],
    snow: ["Snowball", "Grows a little as it rolls. The goal is a snowman."],
    beach: ["Beach", "Striped ball. The goal is a bucket."],
    marble: ["Marble", "Glass swirl. The goal is a crystal dish."],
    soccer: ["Soccer", "The hole wears a goal net."],
    tire: ["Tire", "Black tread that stamps the floor. The goal is a rubber ring."],
    slime: ["Slime", "Wobbles along and leaves green splats. The goal is a puddle."],
    mushroom: ["Mushroom", "A cap-colored ball. The goal is a stump."],
    basketball: ["Basketball", "Bounces on the way. The hole becomes a hoop."],
    bowling: ["Bowling", "Lands with a thud. Pins stand at the hole."],
    meteor: ["Meteor", "Flame trail. The goal is a crater."],
    toy: ["Toy", "A bright toy ball on a painted pedestal."],
    gummy: ["Gummy", "A jelly ball. The goal is a candy dish."],
    coco: ["Coconut", "A jungle ball. The goal is a vine nest."],
    alien: ["Alien", "Purple goo. The goal is a glowing ring."],
    gear: ["Gear", "A metal ball. The goal is a toothed ring."],
    baseball: ["Baseball", "Red stitches. The goal is a home plate."],
    tennis: ["Tennis", "Felt that bounces as it rolls. The goal is a cup."],
    golf: ["Golf", "Dimples. The goal is a flag cup."],
    yarn: ["Yarn", "Thread unravels behind it and the ball shrinks. Resets each stage. The goal is a spool."],
    donut: ["Donut", "Sprinkles on the way. The goal is a coffee cup."],
    melon: ["Watermelon", "Seeds drop. It splits with juice at the goal."],
    disco: ["Disco", "Mirror tiles and light flecks. The goal is a tiny mirror ball."],
    lucky: ["Lucky pouch", "Coin sparkles. The goal is a pile of coins."],
    cat: ["Cat furball", "Fur puffs. A paw taps it into the goal."],
    pixel: ["8-bit", "Pixel afterimages. The goal is a stack of blocks."],
    globe: ["Globe", "Continents turn. A small rocket waits at the goal."],
    skull: ["Skull", "Purple smoke. The goal is a cauldron."],
  },
  ko: {
    oak: ["참나무", "깎아 만든 참나무 공과 옹이 구멍 골."],
    dune: ["사구", "모래색 공. 골은 오아시스 흙링."],
    snow: ["눈덩이", "구르면 조금 커져요. 골은 눈사람."],
    beach: ["비치볼", "줄무늬 공. 골은 양동이."],
    marble: ["구슬", "유리 소용돌이. 골은 수정 접시."],
    soccer: ["축구공", "구멍에 골대가 씌워져요."],
    tire: ["타이어", "바닥을 찍는 검은 트레드. 골은 고무 링."],
    slime: ["슬라임", "흔들리며 초록 자국을 남겨요. 골은 웅덩이."],
    mushroom: ["버섯공", "갓 색 공. 골은 그루터기."],
    basketball: ["농구공", "튀며 굴러요. 구멍은 골대가 돼요."],
    bowling: ["볼링공", "쿵 하고 멈춰요. 핀이 구멍에 서 있어요."],
    meteor: ["운석", "불꽃 자국. 골은 크레이터."],
    toy: ["장난감공", "밝은 장난감 공과 받침대 골."],
    gummy: ["젤리", "젤리 공. 골은 사탕 접시."],
    coco: ["코코넛", "정글 공. 골은 덩굴 둥지."],
    alien: ["외계점액", "보라 점액. 골은 빛나는 고리."],
    gear: ["톱니", "금속 공. 골은 톱니 고리."],
    baseball: ["야구공", "빨간 솔기. 골은 홈 플레이트."],
    tennis: ["테니스공", "펠트 공이 튀며 굴러요. 골은 컵."],
    golf: ["골프공", "딤플. 골은 깃발 컵."],
    yarn: ["실타래", "실이 뒤에서 풀리고 공이 조금 작아져요. 스테이지마다 돌아와요. 골은 실실패."],
    donut: ["도넛", "스프링클이 떨어져요. 골은 커피 컵."],
    melon: ["수박", "씨가 떨어져요. 골에서 과즙과 함께 갈라져요."],
    disco: ["디스코볼", "거울 타일과 빛 조각. 골은 작은 미러볼."],
    lucky: ["복주머니", "동전 반짝임. 골은 동전 더미."],
    cat: ["고양이 털뭉치", "털이 흩날려요. 발바닥이 골로 톡 쳐요."],
    pixel: ["8비트", "픽셀 잔상. 골은 블록 탑."],
    globe: ["지구본", "대륙이 돌아요. 골에 작은 로켓."],
    skull: ["해골공", "보라 연기. 골은 가마솥."],
  },
};

const COSMETICS = {
  en: {
    trails: {
      none: ["None", "The ball keeps its own trail."],
      rainbow: ["Rainbow", "A colored streak. Replaces the ball's trail."],
      hearts: ["Hearts", "Pink hearts. Replaces the ball's trail."],
      notes: ["Notes", "Little notes. Replaces the ball's trail."],
      footprints: ["Footprints", "Soft steps. Replaces the ball's trail."],
    },
    bgs: {
      planet: ["Planet", "The stage's own sky."],
      sunset: ["Sunset sea", "Warm water under an orange sky."],
      blossom: ["Cherry blossoms", "Pink petals over a dusk sky."],
      snow: ["Snowy night", "Quiet flakes on a dark blue sky."],
      station: ["Space station", "Windows along a gray hull."],
    },
    celes: {
      burst: ["Spark", "The original clear burst."],
      fireworks: ["Fireworks", "A few small bursts when you clear."],
      confetti: ["Confetti", "Paper bits drift down."],
      rainbow: ["Rainbow", "Colored bursts in an arc."],
      dance: ["Dance", "A small character dances beside the board."],
    },
  },
  ko: {
    trails: {
      none: ["없음", "공 자체의 자국이 나와요."],
      rainbow: ["무지개", "색 줄기. 공의 자국을 대신해요."],
      hearts: ["하트", "분홍 하트. 공의 자국을 대신해요."],
      notes: ["음표", "작은 음표. 공의 자국을 대신해요."],
      footprints: ["발자국", "가벼운 발자국. 공의 자국을 대신해요."],
    },
    bgs: {
      planet: ["행성", "그 스테이지의 하늘."],
      sunset: ["노을 바다", "주황 하늘 아래 따뜻한 바다."],
      blossom: ["벚꽃", "저녁 하늘에 분홍 꽃잎."],
      snow: ["눈 오는 밤", "어두운 푸른 하늘에 눈."],
      station: ["우주 정거장", "회색 선체의 창문."],
    },
    celes: {
      burst: ["반짝", "원래의 클리어 반짝임."],
      fireworks: ["불꽃", "클리어하면 작은 불꽃 몇 발."],
      confetti: ["색종이", "색종이가 내려와요."],
      rainbow: ["무지개", "호를 따라 색 반짝임."],
      dance: ["춤", "작은 캐릭터가 보드 옆에서 춤춰요."],
    },
  },
};

const LESSONS = {
  en: {
    sand: ["Sand", "Sand stops the ball the moment it rolls in. That tilt ends on the sand square."],
    ice: ["Ice", "On ice the ball keeps sliding. It stops on the first normal square after the ice, unless a wall, sand, or the hole stops it sooner."],
    oneway: ["Current", "The arrow is a one-way current. The ball can cross that edge only in the arrow's direction."],
    teleport: ["Whirlpool", "The two whirlpools are a pair. Roll into one and you come out of the other, still moving the same way."],
    glass: ["Glass", "The first hit cracks the pane and stops the ball. Hit it again and it shatters, and the ball rolls through."],
    gates: ["Switches", "Roll onto the button. The wall with the same pattern sinks open. Until you do, that wall blocks the ball."],
    mixed: ["Two tricks", "This board uses more than one trick. Each one has to be part of the way through."],
    smog: ["Spore fog", "Fog hides the walls on that square until the ball rolls through. The path itself does not change."],
    jelly: ["Jelly", "Roll into a jelly cushion and the ball jumps the next square, landing on the one after it, and keeps sliding. Walls and doors in between are ignored, and that glass does not crack. If the landing square is off the board, crumbled, or erupted magma, the ball stops on the jelly."],
    magma: ["Magma", "A marked square erupts after a fixed number of tilts and becomes a block. One tilt before that, it glows — you can still cross. The ball cannot enter crust. Standing on it when it erupts does not bury you. A bump that does not move does not count."],
    collapse: ["Collapsing floor", "A thin square crumbles after the ball leaves it, and also when a tilt ends there. You cannot roll onto it again."],
    movers: ["Swinging vines", "The vine bar switches to its other edge after every tilt that moves the ball. A bump that goes nowhere leaves it where it is."],
  },
  ko: {
    sand: ["모래", "모래 칸에 들어가는 순간 공이 멈춥니다. 그 기울이기는 모래 위에서 끝나요."],
    ice: ["얼음", "얼음 위에서는 계속 미끄러집니다. 얼음 다음의 첫 보통 칸에서 멈추고, 벽·모래·구멍이 더 일찍 막으면 거기서 멈춰요."],
    oneway: ["해류", "화살표는 한쪽 해류입니다. 그 가장자리는 화살 방향으로만 건널 수 있어요."],
    teleport: ["소용돌이", "두 소용돌이는 한 쌍입니다. 한쪽으로 들어가면 다른 쪽으로 나오고, 진행 방향은 그대로예요."],
    glass: ["유리", "첫 충돌은 금을 내고 공을 멈춥니다. 한 번 더 치면 부서지고 공이 지나가요."],
    gates: ["스위치", "버튼 위로 구르면 같은 무늬의 벽이 내려가 열립니다. 그 전에는 막혀 있어요."],
    mixed: ["두 가지 트릭", "이 보드에는 트릭이 둘 이상 있어요. 각각이 길의 일부여야 합니다."],
    smog: ["포자 안개", "안개는 그 칸의 벽을 가립니다. 공이 지나간 칸부터 걷혀요. 길 자체는 변하지 않습니다."],
    jelly: ["젤리", "젤리 칸으로 굴러 들어가면 다음 칸을 뛰어넘어 그 뒤 칸에 내려앉고 계속 미끄러집니다. 그 사이의 벽과 문은 무시되고, 유리는 금 가지 않아요. 착지 칸이 보드 밖이거나 무너졌거나 용암이 터진 칸이면 공은 젤리 위에서 멈춥니다."],
    magma: ["용암", "표시된 칸은 정해진 기울이기 횟수가 되면 터져서 막힙니다. 한 번 전에는 금이 빛날 뿐, 아직 건널 수 있어요. 터진 칸에는 들어갈 수 없습니다. 그 위에 서 있을 때 터져도 공이 묻히지는 않아요. 움직이지 않은 부딪힘은 횟수에 들어가지 않습니다."],
    collapse: ["무너지는 바닥", "얇은 칸은 공이 떠난 뒤, 또는 기울이기가 그 칸에서 끝나면 무너집니다. 다시 올라갈 수 없어요."],
    movers: ["흔들리는 덩굴", "공이 움직인 기울이기마다 덩굴 막대가 반대편 가장자리로 옮겨갑니다. 제자리 부딪힘은 그대로 둡니다."],
  },
};

export function detectLang() {
  try {
    const saved = localStorage.getItem("inthehole_lang");
    if (saved === "ko" || saved === "en") return saved;
  } catch {
    /* fall through */
  }
  const nav = (navigator.language || navigator.userLanguage || "").toLowerCase();
  return nav.startsWith("ko") ? "ko" : "en";
}

export function t(lang, key, vars) {
  const table = STR[lang] || STR.en;
  let text = table[key] || STR.en[key] || key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, value);
    }
  }
  return text;
}

export function planetName(lang, id) {
  return (PLANETS[lang] || PLANETS.en)[id] || PLANETS.en[id] || id;
}

export function ballCopy(lang, id) {
  const row = (BALLS[lang] || BALLS.en)[id] || BALLS.en[id];
  if (!row) return { name: id, blurb: "" };
  return { name: row[0], blurb: row[1] };
}

export function cosmeticCopy(lang, tab, id) {
  const table = (COSMETICS[lang] || COSMETICS.en)[tab] || COSMETICS.en[tab] || {};
  const row = table[id] || (COSMETICS.en[tab] || {})[id];
  if (!row) return { name: id, blurb: "" };
  return { name: row[0], blurb: row[1] };
}

export function lessonCopy(lang, id) {
  const row = (LESSONS[lang] || LESSONS.en)[id] || LESSONS.en[id];
  if (!row) return null;
  return { title: row[0], body: row[1] };
}
