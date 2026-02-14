const USERNAME_PATTERN = /^[a-z0-9_]+$/;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 32;
const RESERVED_USERNAMES = new Set([
  'admin',
  'api',
  'auth',
  'login',
  'logout',
  'mine',
  'profile',
  'public',
  'root',
  'scriptpal',
  'settings',
  'support',
  'u',
  'user',
  'users',
  'www'
]);

export const normalizeUsername = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
};

export const validateUsername = (value) => {
  const normalized = normalizeUsername(value);
  if (!normalized) {
    return { valid: false, normalized, error: 'Username is required' };
  }
  if (normalized.length < USERNAME_MIN_LENGTH || normalized.length > USERNAME_MAX_LENGTH) {
    return {
      valid: false,
      normalized,
      error: `Username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters`
    };
  }
  if (!USERNAME_PATTERN.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'Username may contain only lowercase letters, numbers, and underscores'
    };
  }
  if (RESERVED_USERNAMES.has(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'This username is reserved'
    };
  }

  return { valid: true, normalized };
};

export const isReservedUsername = (value) => {
  const normalized = normalizeUsername(value);
  return RESERVED_USERNAMES.has(normalized);
};
