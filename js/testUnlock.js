/**
 * Test-host stage access. On hun0823.github.io and localhost every planet
 * and stage can be opened. Stars, owned balls, and clear rewards stay put.
 * ?unlock=0 / ?unlock=1 is remembered in localStorage. Other hosts ignore it.
 */

const UNLOCK_KEY = "inthehole_test_unlock";
const TEST_HOSTS = new Set(["hun0823.github.io", "localhost", "127.0.0.1", "::1"]);

export function resolveTestUnlock(hostname, search, getItem, setItem) {
  if (!TEST_HOSTS.has(hostname || "")) return false;
  let params;
  try {
    params = new URLSearchParams(search || "");
  } catch {
    params = new URLSearchParams();
  }
  if (params.has("unlock")) {
    const on = params.get("unlock") !== "0";
    try {
      setItem(UNLOCK_KEY, on ? "1" : "0");
    } catch {
      /* private mode still honors this visit */
    }
    return on;
  }
  try {
    const saved = getItem(UNLOCK_KEY);
    if (saved === "0") return false;
    if (saved === "1") return true;
  } catch {
    /* default on for a test host */
  }
  return true;
}
