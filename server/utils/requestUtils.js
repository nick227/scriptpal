import { parseNumericId } from './idUtils.js';

export const requireNumericParam = (req, res, paramName, label) => {
  const raw = req.params?.[paramName];
  const parsed = parseNumericId(raw);
  if (!parsed) {
    res.status(400).json({ error: `Invalid ${label}` });
    return null;
  }
  return parsed;
};
