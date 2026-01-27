import scriptModel from '../../models/script.js';
import { verifyScriptOwnership } from '../../middleware/scriptOwnership.js';

export const loadOwnedScript = async({
  scriptId,
  userId,
  allowPublic = false,
  requireEditable = true
} = {}) => {
  if (requireEditable || !allowPublic) {
    await verifyScriptOwnership(userId, scriptId);
    const script = await scriptModel.getScript(scriptId);
    if (!script) {
      throw new Error('Script not found');
    }
    return script;
  }

  const script = await scriptModel.getScript(scriptId);
  if (!script) {
    throw new Error('Script not found');
  }

  if (script.userId === userId || script.visibility === 'public') {
    return script;
  }

  throw new Error('Script not found');
};
