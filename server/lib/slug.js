const DEFAULT_SLUG = 'script';
const MAX_SLUG_LENGTH = 80;

export const toSlugBase = (value, maxLength = MAX_SLUG_LENGTH) => {
  const raw = typeof value === 'string' ? value : '';
  const normalized = raw.trim().toLowerCase();
  const stripped = normalized.replace(/[^a-z0-9\s-]/g, '');
  const collapsed = stripped.replace(/[\s-]+/g, '-').replace(/^-+|-+$/g, '');
  const trimmed = collapsed.slice(0, maxLength).replace(/-+$/g, '');
  return trimmed || DEFAULT_SLUG;
};

const withSuffix = (base, suffix, maxLength) => {
  const suffixText = `-${suffix}`;
  const available = Math.max(1, maxLength - suffixText.length);
  const trimmedBase = base.slice(0, available).replace(/-+$/g, '');
  return `${trimmedBase}${suffixText}`;
};

export const generateUniqueSlug = async({
  title,
  isTaken,
  maxLength = MAX_SLUG_LENGTH
}) => {
  const base = toSlugBase(title, maxLength);
  if (!await isTaken(base)) {
    return base;
  }

  let suffix = 2;
  while (await isTaken(withSuffix(base, suffix, maxLength))) {
    suffix += 1;
  }
  return withSuffix(base, suffix, maxLength);
};
