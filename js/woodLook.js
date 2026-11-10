/**
 * Optional Wood-planet looks. Absent or unknown `?look=` leaves the
 * shipped renderer untouched. Implementations load only when requested.
 */

const LOADERS = {
  diorama: () => import("./looks/diorama.js"),
  pixel: () => import("./looks/pixel.js"),
  clay: () => import("./looks/clay.js"),
  neon: () => import("./looks/neon.js"),
};

let api = null;

export function woodLookId() {
  try {
    const value = new URLSearchParams(location.search).get("look");
    return Object.prototype.hasOwnProperty.call(LOADERS, value) ? value : null;
  } catch {
    return null;
  }
}

export function loadWoodLook() {
  const id = woodLookId();
  if (!id) return Promise.resolve(null);
  return LOADERS[id]().then((mod) => {
    api = mod.createLook();
    api.id = id;
    return api;
  }).catch((err) => {
    console.error(err);
    api = null;
    return null;
  });
}

export function woodLookFor(planet) {
  if (!api || planet !== "wood") return null;
  return api;
}
