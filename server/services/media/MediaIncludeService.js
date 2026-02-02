import mediaAttachmentRepository from '../../repositories/mediaAttachmentRepository.js';

const isIncludeMediaEnabled = (query) => {
  if (!query || query.includeMedia === undefined || query.includeMedia === null) {
    return false;
  }
  const value = query.includeMedia;
  return value === true || value === 'true' || value === '1';
};

const buildMediaMap = (attachments) => {
  const map = new Map();
  attachments.forEach(attachment => {
    if (!attachment || !attachment.ownerId || !attachment.asset) {
      return;
    }
    const existing = map.get(attachment.ownerId);
    if (existing) {
      existing.push(attachment);
    } else {
      map.set(attachment.ownerId, [attachment]);
    }
  });
  return map;
};

export const attachMediaToItems = async({ items, userId, ownerType, ownerIdKey = 'id' }) => {
  if (!items || items.length === 0) {
    return items;
  }
  const ownerIds = items
    .map(item => item[ownerIdKey])
    .filter(Boolean);

  if (ownerIds.length === 0) {
    return items;
  }

  const attachments = await mediaAttachmentRepository.listByOwnerIds({
    userId,
    ownerType,
    ownerIds
  });
  const mediaMap = buildMediaMap(attachments);

  return items.map(item => ({
    ...item,
    media: mediaMap.get(item[ownerIdKey]) || []
  }));
};

export const attachMediaToOwner = async({ ownerId, ownerType, userId, owner }) => {
  if (!owner) {
    return owner;
  }
  const attachments = await mediaAttachmentRepository.listByOwnerIds({
    userId,
    ownerType,
    ownerIds: [ownerId]
  });
  const mediaMap = buildMediaMap(attachments);
  return {
    ...owner,
    media: mediaMap.get(ownerId) || []
  };
};

export const shouldIncludeMedia = (req) => {
  return isIncludeMediaEnabled(req && req.query ? req.query : null);
};
