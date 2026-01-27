export const sanitizeScriptLines = (text, validTags = []) => {
  const sanitized = [];
  let invalidTagCount = 0;
  let coercedCount = 0;
  let droppedCount = 0;
  let extractedCount = 0;

  if (!text || typeof text !== 'string') {
    return {
      lines: sanitized,
      stats: { invalidTagCount, coercedCount, droppedCount, extractedCount }
    };
  }

  const tagRegex = /<([\w-]+)\s*\/>|<([\w-]+)>([\s\S]*?)<\/\2>/gi;
  let match = null;

  while ((match = tagRegex.exec(text)) !== null) {
    const selfClosingTag = match[1];
    if (selfClosingTag) {
      const tag = selfClosingTag.toLowerCase();
      if (tag === 'chapter-break') {
        sanitized.push('<chapter-break></chapter-break>');
        extractedCount += 1;
      } else {
        droppedCount += 1;
      }
      continue;
    }

    const tag = (match[2] || '').toLowerCase();
    const content = (match[3] || '').trim();
    if (validTags.includes(tag)) {
      if (content || tag === 'chapter-break') {
        sanitized.push(`<${tag}>${content}</${tag}>`);
        extractedCount += 1;
      } else {
        droppedCount += 1;
      }
    } else {
      invalidTagCount += 1;
      if (content) {
        sanitized.push(`<action>${content}</action>`);
        coercedCount += 1;
        extractedCount += 1;
      } else {
        droppedCount += 1;
      }
    }
  }

  if (extractedCount === 0) {
    const rawLines = text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);
    for (const line of rawLines) {
      sanitized.push(`<action>${line}</action>`);
      coercedCount += 1;
    }
  }

  return {
    lines: sanitized,
    stats: { invalidTagCount, coercedCount, droppedCount, extractedCount }
  };
};
