const ROLE_TO_TYPE = {
  assistant: 'assistant',
  user: 'user'
};

const normalizeMetadata = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (_error) {
      return value;
    }
  }
  return value;
};

const normalizeContent = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && parsed.response) {
      return parsed.response;
    }
  } catch (_error) {
    // Use raw string if parsing fails
  }

  return value;
};

const buildMessage = (row, overrides = {}) => {
  const metadata = overrides.metadata ?? normalizeMetadata(row.metadata);
  const role = overrides.role ?? row.role ?? 'user';
  const prefix = overrides.prefix ?? (role === 'assistant' ? 'assistant_' : 'user_');

  return {
    id: overrides.id ?? `${prefix}${row.id}`,
    role,
    type: overrides.type ?? ROLE_TO_TYPE[role] ?? 'user',
    content: overrides.content ?? normalizeContent(row.content),
    timestamp: overrides.timestamp ?? row.createdAt,
    scriptId: row.scriptId,
    metadata,
    intent: row.intent ?? null,
    promptTokens: row.promptTokens ?? null,
    completionTokens: row.completionTokens ?? null,
    totalTokens: row.totalTokens ?? null,
    costUsd: row.costUsd ?? null,
    userId: row.userId ?? null
  };
};

export const ChatMessageSerializer = {
  toMessage: (row, overrides = {}) => {
    if (!row) {
      return null;
    }
    return buildMessage(row, overrides);
  },

  toMessages: (row) => {
    if (!row) {
      return [];
    }

    if (row.role === 'assistant') {
      const metadata = normalizeMetadata(row.metadata);
      const messages = [];
      if (metadata?.userPrompt) {
        messages.push(buildMessage(row, {
          id: `user_${row.id}`,
          role: 'user',
          type: 'user',
          content: metadata.userPrompt,
          metadata: null
        }));
      }
      messages.push(buildMessage(row, {
        id: `assistant_${row.id}`,
        prefix: 'assistant_',
        metadata
      }));
      return messages;
    }

    return [buildMessage(row, { id: `user_${row.id}` })];
  },

  flattenRows: (rows = []) => {
    return rows
      .filter(Boolean)
      .flatMap((row) => ChatMessageSerializer.toMessages(row));
  }
};
