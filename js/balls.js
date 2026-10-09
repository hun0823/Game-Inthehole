/** Cosmetic balls. Looks and trails never change slide rules, par, or hints. */

export const BALLS = [
  {
    id: "oak",
    name: "Oak",
    price: 0,
    blurb: "The wooden ball. Free, and always yours.",
    trail: null,
    motion: null,
    goal: null,
  },
  {
    id: "marble",
    name: "Marble",
    price: 6,
    blurb: "A glass swirl. Sparkles chase the roll.",
    trail: "sparkle",
    motion: null,
    goal: null,
  },
  {
    id: "soccer",
    name: "Soccer",
    price: 12,
    blurb: "The hole wears a goal net.",
    trail: null,
    motion: null,
    goal: "net",
  },
  {
    id: "tire",
    name: "Tire",
    price: 18,
    blurb: "Black tread that stamps the floor.",
    trail: "tire",
    motion: null,
    goal: null,
  },
  {
    id: "slime",
    name: "Slime",
    price: 24,
    blurb: "Wobbles along and leaves green splats.",
    trail: "splat",
    motion: "wobble",
    goal: null,
  },
  {
    id: "basketball",
    name: "Basketball",
    price: 32,
    blurb: "Bounces on the way. The hole becomes a hoop.",
    trail: null,
    motion: "bounce",
    goal: "hoop",
  },
  {
    id: "bowling",
    name: "Bowling",
    price: 42,
    blurb: "Lands with a thud. Pins stand at the hole.",
    trail: null,
    motion: "thud",
    goal: "pins",
  },
  {
    id: "meteor",
    name: "Meteor",
    price: 54,
    blurb: "A flame trail and scorch marks.",
    trail: "flame",
    motion: null,
    goal: null,
  },
];

export function ballById(id) {
  return BALLS.find((ball) => ball.id === id) || BALLS[0];
}
