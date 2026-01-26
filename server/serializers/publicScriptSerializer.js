const PUBLIC_SUMMARY_LENGTH = 220;

const sanitizeContent = (content) => {
  if (typeof content !== 'string') {
    return '';
  }
  return content.trim();
};

const createSummary = (content) => {
  const sanitized = sanitizeContent(content).replace(/\s+/g, ' ');
  if (!sanitized) return '';
  if (sanitized.length <= PUBLIC_SUMMARY_LENGTH) return sanitized;
  return `${sanitized.slice(0, PUBLIC_SUMMARY_LENGTH).trim()}…`;
};

const serializeOwner = (script) => {
  const owner = script.user || {};
  return {
    id: owner.id || script.userId || null,
    email: owner.email || null
  };
};

export const serializePublicScript = (script) => {
  if (!script) return null;
  const content = sanitizeContent(script.content);
  return {
    id: script.id,
    slug: script.slug || null,
    title: script.title || 'Untitled Script',
    author: script.author || '',
    description: script.description || '',
    status: script.status || 'draft',
    visibility: script.visibility || 'private',
    versionNumber: script.versionNumber || 1,
    content,
    summary: createSummary(content),
    createdAt: script.createdAt,
    updatedAt: script.updatedAt,
    owner: serializeOwner(script)
  };
};

export const serializePublicScriptListItem = (script) => {
  const serialized = serializePublicScript(script);
  if (!serialized) return null;
  return {
    ...serialized,
    content: undefined
  };
};
