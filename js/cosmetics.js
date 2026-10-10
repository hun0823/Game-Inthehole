/**
 * Shop cosmetics. They never change slide rules, par, or hints.
 *
 * Trail rule: an equipped trail replaces the ball's built-in trail.
 * Motion (bounce, wobble, thud, snow grow, yarn shrink) and the matched
 * goal stay with the ball. "None" shows the ball's own trail again.
 * Background "planet" leaves the stage sky alone. Celebration "burst"
 * is the original clear burst.
 */

export const TRAILS = [
  { id: "none", price: 0, kind: null },
  { id: "rainbow", price: 8, kind: "rainbow" },
  { id: "hearts", price: 16, kind: "hearts" },
  { id: "notes", price: 22, kind: "notes" },
  { id: "footprints", price: 30, kind: "footprints" },
];

export const BACKGROUNDS = [
  { id: "planet", price: 0, sky: null },
  {
    id: "sunset",
    price: 10,
    sky: { id: "sunset", sky0: "#ff9a62", sky1: "#d24b6a", sky2: "#2c1848", motif: "sunset" },
  },
  {
    id: "blossom",
    price: 20,
    sky: { id: "blossom", sky0: "#f8c4dc", sky1: "#c45b8c", sky2: "#3a1844", motif: "blossom" },
  },
  {
    id: "snow",
    price: 26,
    sky: { id: "snow", sky0: "#243e68", sky1: "#12243c", sky2: "#070e18", motif: "snow" },
  },
  {
    id: "station",
    price: 40,
    sky: { id: "station", sky0: "#3a4558", sky1: "#1a202c", sky2: "#080a10", motif: "station" },
  },
];

export const CELEBRATIONS = [
  { id: "burst", price: 0 },
  { id: "fireworks", price: 14 },
  { id: "confetti", price: 18 },
  { id: "rainbow", price: 24 },
  { id: "dance", price: 36 },
];

export function trailById(id) {
  return TRAILS.find((item) => item.id === id) || TRAILS[0];
}

export function backgroundById(id) {
  return BACKGROUNDS.find((item) => item.id === id) || BACKGROUNDS[0];
}

export function celebrationById(id) {
  return CELEBRATIONS.find((item) => item.id === id) || CELEBRATIONS[0];
}

export function catalogFor(tab) {
  if (tab === "trails") return TRAILS;
  if (tab === "bgs") return BACKGROUNDS;
  if (tab === "celes") return CELEBRATIONS;
  return null;
}
