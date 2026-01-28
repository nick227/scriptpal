import { loadOwnedScript } from './scriptAccessUtils.js';
import { parseNumericId } from '../../utils/idUtils.js';

export const resolveScriptId = (req, { required = false } = {}) => {
  const raw = req.body?.scriptId ?? req.body?.context?.scriptId ?? req.params?.scriptId ?? null;
  if (raw === null || raw === undefined) {
    if (required) {
      return { error: { status: 400, message: 'Script ID is required' } };
    }
    return { scriptId: null };
  }
  const scriptId = parseNumericId(raw);
  if (!scriptId) {
    return { error: { status: 400, message: 'Invalid script ID' } };
  }
  return { scriptId };
};

export const loadScriptOrThrow = async (req, options = {}) => {
  const {
    required = true,
    allowPublic = false,
    requireEditable = true
  } = options;

  const { scriptId, error } = resolveScriptId(req, { required });
  if (error) {
    const err = new Error(error.message);
    err.status = error.status;
    throw err;
  }
  if (!scriptId) {
    return { scriptId: null, script: null };
  }

  const script = await loadOwnedScript({
    scriptId,
    userId: req.userId,
    allowPublic,
    requireEditable
  });

  return { scriptId, script };
};
