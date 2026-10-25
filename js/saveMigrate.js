/**
 * One-time map of the 12-planet campaign onto the 11-planet order.
 * Old saves store stage ids 1..144, twelve per planet, with Mushroom at
 * ids 73-84. Later planets keep their planet id and stage slot. Mushroom
 * clears are dropped. Stars earned there stay in a retired purse so the
 * player is not charged for a planet that no longer exists. Clearing all
 * twelve Mushroom stages still keeps the Mushroom ball, which is now a
 * star-priced shop item.
 */

export const LEGACY_PLANETS = Object.freeze([
  "wood", "desert", "ice", "ocean", "crystal", "toy",
  "mushroom", "candy", "lava", "jungle", "alien", "machine",
]);

export const PROGRESS_VERSION = "11";
export const PROGRESS_VERSION_KEY = "inthehole_progress_v";
export const RETIRED_STARS_KEY = "inthehole_retired_stars";

const CLEARED_KEY = "inthehole_cleared";
const STARS_PREFIX = "inthehole_stars_";
const OWNED_KEY = "inthehole_balls_owned";

export function remapLegacyStageId(id, planetOrder) {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) return { kind: "ignore" };
  const index = Math.floor((n - 1) / 12);
  const slot = (n - 1) % 12;
  const planet = LEGACY_PLANETS[index];
  if (!planet) return { kind: "keep", id: n };
  if (planet === "mushroom") return { kind: "mushroom", slot };
  const next = planetOrder.indexOf(planet);
  if (next < 0) return { kind: "ignore" };
  return { kind: "move", id: next * 12 + slot + 1, planet, slot };
}

export function retiredStars(storage) {
  const n = parseInt(storage.getItem(RETIRED_STARS_KEY) || "0", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function storageKeys(storage) {
  if (typeof storage.keys === "function") return [...storage.keys()];
  const keys = [];
  const n = storage.length || 0;
  for (let i = 0; i < n; i++) {
    const key = storage.key(i);
    if (key) keys.push(key);
  }
  return keys;
}

function clampStars(raw) {
  const n = parseInt(raw || "0", 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(3, n);
}

function readList(storage, key) {
  try {
    const raw = JSON.parse(storage.getItem(key) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function migrateCampaignSave(storage, planetOrder) {
  if (storage.getItem(PROGRESS_VERSION_KEY) === PROGRESS_VERSION) {
    return { legacy: false };
  }
  const cleared = readList(storage, CLEARED_KEY);
  const starKeys = storageKeys(storage).filter((key) => /^inthehole_stars_\d+$/.test(key));
  const legacy = cleared.length > 0 || starKeys.length > 0;

  if (legacy) {
    const nextCleared = [];
    const mushroomSlots = new Set();
    for (const id of cleared) {
      const mapped = remapLegacyStageId(id, planetOrder);
      if (mapped.kind === "mushroom") {
        mushroomSlots.add(mapped.slot);
        continue;
      }
      if ((mapped.kind === "move" || mapped.kind === "keep") && !nextCleared.includes(mapped.id)) {
        nextCleared.push(mapped.id);
      }
    }
    const pending = new Map();
    let retired = retiredStars(storage);
    for (const key of starKeys) {
      const id = Number(key.slice(STARS_PREFIX.length));
      const stars = clampStars(storage.getItem(key));
      const mapped = remapLegacyStageId(id, planetOrder);
      storage.removeItem(key);
      if (mapped.kind === "mushroom") {
        retired += stars;
        continue;
      }
      if ((mapped.kind === "move" || mapped.kind === "keep") && stars > 0) {
        pending.set(mapped.id, Math.max(pending.get(mapped.id) || 0, stars));
      }
    }
    for (const [id, stars] of pending) {
      storage.setItem(STARS_PREFIX + id, String(stars));
    }
    if (retired > 0) storage.setItem(RETIRED_STARS_KEY, String(retired));
    storage.setItem(CLEARED_KEY, JSON.stringify(nextCleared));
    if (mushroomSlots.size >= 12) {
      const owned = readList(storage, OWNED_KEY).filter((id) => typeof id === "string");
      if (!owned.includes("mushroom")) {
        owned.push("mushroom");
        storage.setItem(OWNED_KEY, JSON.stringify(owned));
      }
    }
  }

  storage.setItem(PROGRESS_VERSION_KEY, PROGRESS_VERSION);
  return { legacy };
}
