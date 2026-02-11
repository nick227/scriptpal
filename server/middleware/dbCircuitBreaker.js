const OPEN_MS = Number(process.env.DB_CIRCUIT_OPEN_MS || 15000);
const RETRY_AFTER_SECONDS = Number(process.env.DB_CIRCUIT_RETRY_AFTER_SECONDS || 5);

const state = {
  openUntil: 0
};

const now = () => Date.now();

const stringContainsAny = (value, patterns = []) => {
  const lower = String(value || '').toLowerCase();
  return patterns.some(pattern => lower.includes(pattern));
};

const DB_ERROR_PATTERNS = [
  'pool timeout',
  'failed to retrieve a connection',
  'failed to create socket',
  'socket has unexpectedly been closed',
  'sqlstate: 08s01',
  'econnreset',
  'enotfound',
  'etimedout',
  'connect timeout',
  'connection timeout'
];

const isDbConnectivityError = (error) => {
  if (!error) return false;
  if (stringContainsAny(error.message, DB_ERROR_PATTERNS)) return true;

  const cause = error.cause || error.originalError || null;
  if (cause && (stringContainsAny(cause.message, DB_ERROR_PATTERNS) || stringContainsAny(cause.originalMessage, DB_ERROR_PATTERNS))) {
    return true;
  }

  const originalCode = cause?.originalCode || error.originalCode || error.code;
  if (String(originalCode) === '45028' || String(originalCode) === '45009') {
    return true;
  }

  return false;
};

const isOpen = () => state.openUntil > now();

const open = () => {
  state.openUntil = now() + (Number.isFinite(OPEN_MS) && OPEN_MS > 0 ? OPEN_MS : 15000);
};

const middleware = () => (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }
  if (!isOpen()) {
    return next();
  }
  res.set('Retry-After', String(Number.isFinite(RETRY_AFTER_SECONDS) && RETRY_AFTER_SECONDS > 0 ? RETRY_AFTER_SECONDS : 5));
  return res.status(503).json({ error: 'Service temporarily unavailable' });
};

const dbCircuitBreaker = {
  middleware,
  isOpen,
  open,
  recordFailure(error) {
    if (isDbConnectivityError(error)) {
      open();
    }
  },
  isDbConnectivityError
};

export default dbCircuitBreaker;
