const DEFAULT_TTL_MS = Number(process.env.SESSION_CACHE_TTL_MS || 60000);
const DEFAULT_MAX_ENTRIES = Number(process.env.SESSION_CACHE_MAX_ENTRIES || 5000);

class SessionCache {
  constructor() {
    this.ttlMs = Number.isFinite(DEFAULT_TTL_MS) && DEFAULT_TTL_MS > 0 ? DEFAULT_TTL_MS : 60000;
    this.maxEntries = Number.isFinite(DEFAULT_MAX_ENTRIES) && DEFAULT_MAX_ENTRIES > 0 ? DEFAULT_MAX_ENTRIES : 5000;
    this.store = new Map();
  }

  _now() {
    return Date.now();
  }

  _isExpired(entry, now) {
    if (!entry) return true;
    if (entry.cachedUntil && now >= entry.cachedUntil) return true;
    if (entry.sessionExpiresAt && now >= entry.sessionExpiresAt) return true;
    return false;
  }

  _evictIfNeeded() {
    if (this.store.size < this.maxEntries) {
      return;
    }
    const firstKey = this.store.keys().next().value;
    if (firstKey !== undefined) {
      this.store.delete(firstKey);
    }
  }

  get(token) {
    if (!token) return null;
    const entry = this.store.get(token);
    if (!entry) return null;

    const now = this._now();
    if (this._isExpired(entry, now)) {
      this.store.delete(token);
      return null;
    }

    return {
      userId: entry.userId,
      user: entry.user
    };
  }

  set(token, value = {}) {
    if (!token || !value.userId || !value.user) return;
    this._evictIfNeeded();

    const now = this._now();
    const sessionExpiresAt = value.sessionExpiresAt ? new Date(value.sessionExpiresAt).getTime() : null;
    const ttlUntil = now + this.ttlMs;

    this.store.set(token, {
      userId: value.userId,
      user: value.user,
      sessionExpiresAt: Number.isFinite(sessionExpiresAt) ? sessionExpiresAt : null,
      cachedUntil: ttlUntil
    });
  }

  delete(token) {
    if (!token) return;
    this.store.delete(token);
  }

  deleteByUserId(userId) {
    if (!userId) return;
    for (const [token, entry] of this.store.entries()) {
      if (entry?.userId === userId) {
        this.store.delete(token);
      }
    }
  }

  clear() {
    this.store.clear();
  }
}

const sessionCache = new SessionCache();

export default sessionCache;
