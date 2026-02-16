export function createPosCacheStore({ keyPrefix, log } = {}) {
  const prefix = String(keyPrefix || "");
  const _log = typeof log === "function" ? log : () => {};
  const _debug = (() => {
    try {
      const raw = String(typeof process !== "undefined" ? process?.env?.FDV_POSCACHE_DEBUG : "").trim();
      if (!raw) return false;
      return /^(1|true|yes|y|on)$/i.test(raw);
    } catch {
      return false;
    }
  })();

  const _memByOwner = (() => {
    try {
      const g = typeof globalThis !== "undefined" ? globalThis : null;
      if (g) {
        if (!g.__fdvPosCacheStoreMem || typeof g.__fdvPosCacheStoreMem !== "object") {
          g.__fdvPosCacheStoreMem = new Map();
        }
        return g.__fdvPosCacheStoreMem;
      }
    } catch {}
    return new Map();
  })();

  function _now() {
    return Date.now();
  }

  function _getMem(ownerPubkeyStr) {
    const k = `${prefix}${String(ownerPubkeyStr || "")}`;
    if (!_memByOwner.has(k)) {
      _memByOwner.set(k, {
        raw: null,
        obj: null,
        lastLoadLogAt: 0,
        lastSaveLogAt: 0,
        lastListLogAt: 0,
        lastRemoveLogAt: 0,
      });
    }
    return _memByOwner.get(k);
  }

  function _throttledLog(ownerPubkeyStr, key, msg, level) {
    if (!_debug) return;
    const mem = _getMem(ownerPubkeyStr);
    const now = _now();
    const lastKey = `last${String(key || "")}LogAt`;
    const last = Number(mem?.[lastKey] || 0);
    // Default: at most once per 5s per owner per log type.
    if (now - last < 5000) return;
    mem[lastKey] = now;
    _log(msg, level);
  }

  function _key(ownerPubkeyStr) {
    return prefix + String(ownerPubkeyStr || "");
  }

  function loadPosCache(ownerPubkeyStr) {
    const k = _key(ownerPubkeyStr);
    if (localStorage.getItem(k) === null) {
      localStorage.setItem(k, JSON.stringify({}));
    }
    try {
      const mem = _getMem(ownerPubkeyStr);
      const raw = localStorage.getItem(k) || "{}";
      if (mem.raw === raw && mem.obj) {
        _throttledLog(
          ownerPubkeyStr,
          "Load",
          `Loaded position cache for ${String(ownerPubkeyStr || "").slice(0, 4)}… with ${Object.keys(mem.obj).length} entries.`
        );
        return mem.obj;
      }

      const obj = JSON.parse(raw) || {};
      mem.raw = raw;
      mem.obj = obj;
      _throttledLog(
        ownerPubkeyStr,
        "Load",
        `Loaded position cache for ${String(ownerPubkeyStr || "").slice(0, 4)}… with ${Object.keys(obj).length} entries.`
      );
      return obj;
    } catch {
      return {};
    }
  }

  function savePosCache(ownerPubkeyStr, data) {
    const k = _key(ownerPubkeyStr);
    try {
      const mem = _getMem(ownerPubkeyStr);
      const nextObj = data || {};
      const nextRaw = JSON.stringify(nextObj);
      if (mem.raw === nextRaw) {
        return;
      }
      localStorage.setItem(k, nextRaw);
      mem.raw = nextRaw;
      mem.obj = nextObj;
      _throttledLog(
        ownerPubkeyStr,
        "Save",
        `Saved position cache for ${String(ownerPubkeyStr || "").slice(0, 4)}… with ${Object.keys(nextObj).length} entries.`
      );
    } catch {
      _log(`Failed to save position cache for ${String(ownerPubkeyStr || "").slice(0, 4)}…`, "err");
    }
  }

  function updatePosCache(ownerPubkeyStr, mint, sizeUi, decimals) {
    if (!ownerPubkeyStr || !mint) return;
    const k = _key(ownerPubkeyStr);
    if (localStorage.getItem(k) === null) {
      localStorage.setItem(k, JSON.stringify({}));
    }
    const cache = loadPosCache(ownerPubkeyStr);

    const uiAmt = Number(sizeUi);
    if (!(Number.isFinite(uiAmt) && uiAmt > 0)) return;

    const dec = Number.isFinite(decimals) ? decimals : 6;
    const dustUiEps = (() => {
      const v = Number(typeof process !== "undefined" ? process?.env?.FDV_DUST_UI_EPS : 0);
      return Number.isFinite(v) && v > 0 ? v : 1e-6;
    })();
    const dustRawMax = (() => {
      const v = Number(typeof process !== "undefined" ? process?.env?.FDV_DUST_RAW_MAX : 0);
      return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 1;
    })();

    const rawApprox = (Number.isFinite(uiAmt) && Number.isFinite(dec) && dec >= 0 && dec <= 12)
      ? Math.round(uiAmt * Math.pow(10, dec))
      : null;
    // Dust if it's tiny in UI terms OR tiny in raw terms.
    // Using only rawApprox breaks for high-decimal tokens where a very small UI amount can still be > 1 raw.
    const uiCmpEps = Math.max(1e-12, dustUiEps * 1e-6);
    const isDustUi = uiAmt <= (dustUiEps + uiCmpEps);
    const isDustRaw = Number.isFinite(rawApprox) && rawApprox !== null ? rawApprox <= dustRawMax : false;
    const isDust = isDustUi || isDustRaw;

    if (isDust) {
      if (cache[mint]) {
        delete cache[mint];
        savePosCache(ownerPubkeyStr, cache);
      }
      return;
    }

    cache[mint] = { sizeUi: uiAmt, decimals: dec };
    savePosCache(ownerPubkeyStr, cache);
    // Intentionally not logging every update: this is called in hot loops.
  }

  function removeFromPosCache(ownerPubkeyStr, mint) {
    if (!ownerPubkeyStr || !mint) return;
    const cache = loadPosCache(ownerPubkeyStr);
    const existed = !!cache[mint];
    if (existed) {
      delete cache[mint];
      savePosCache(ownerPubkeyStr, cache);
    }
    if (existed) {
      _throttledLog(
        ownerPubkeyStr,
        "Remove",
        `Removed from position cache for ${String(ownerPubkeyStr).slice(0, 4)}… mint ${String(mint).slice(0, 4)}…`
      );
    }
  }

  function cacheToList(ownerPubkeyStr) {
    const cache = loadPosCache(ownerPubkeyStr);
    const list = Object.entries(cache)
      .map(([mint, v]) => ({
        mint,
        sizeUi: Number(v?.sizeUi || 0),
        decimals: Number.isFinite(v?.decimals) ? v.decimals : 6,
      }))
      .filter((x) => x.mint && x.sizeUi > 0);
    _throttledLog(
      ownerPubkeyStr,
      "List",
      `Position cache to list for ${String(ownerPubkeyStr).slice(0, 4)}… ${list.length} entries.`
    );
    return list;
  }

  return {
    loadPosCache,
    savePosCache,
    updatePosCache,
    removeFromPosCache,
    cacheToList,
  };
}
