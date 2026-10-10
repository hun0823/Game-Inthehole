/**
 * Bloom stays off unless a desktop-class device is likely to hold 60fps.
 * iPhone is not measured here, so auto mode leaves it off.
 */
const KEY = "inthehole_bloom";

export function bloomPreference() {
  try {
    const value = localStorage.getItem(KEY);
    if (value === "on" || value === "off" || value === "auto") return value;
  } catch {
    /* private mode keeps the session default */
  }
  return "auto";
}

export function setBloomPreference(value) {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* ignore */
  }
}

export function deviceCanBloom() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return false;
  if (navigator.deviceMemory && navigator.deviceMemory < 6) return false;
  if ((navigator.hardwareConcurrency || 2) < 6) return false;
  if (window.matchMedia("(pointer: coarse)").matches) return false;
  return true;
}

export function bloomWanted() {
  const pref = bloomPreference();
  if (pref === "off") return false;
  if (pref === "on") return true;
  return deviceCanBloom();
}
