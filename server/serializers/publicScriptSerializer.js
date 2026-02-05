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

import config from '../config/index.js';

const serializeOwner = (script) => {
  const owner = script.user || {};
  return {
    id: owner.id || script.userId || null,
    email: owner.email || null
  };
};

const buildCoverUrl = (script) => {
  const attachment = script.coverAttachment;
  if (!attachment || !attachment.asset) {
    return null;
  }
  const variants = attachment.asset.variants || [];
  const preferred = variants.find(variant => variant.kind === 'preview') || variants[0];
  const key = preferred ? preferred.storageKey : attachment.asset.storageKey;
  if (!key) {
    return null;
  }
  const base = config.get('MEDIA_BASE_URL') || '/uploads';
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${normalizedBase}/${key}`;
};

export const serializePublicScript = (script) => {
  if (!script) return null;
  const content = sanitizeContent(script.content);
  return {
    publicId: script.publicId || null,
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
    commentCount: script.commentCount || 0,
    createdAt: script.createdAt,
    updatedAt: script.updatedAt,
    owner: serializeOwner(script),
    coverUrl: buildCoverUrl(script)
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
