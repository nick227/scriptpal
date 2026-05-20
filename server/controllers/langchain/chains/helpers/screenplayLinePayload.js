import { VALID_FORMAT_VALUES } from '../../constants.js';

const ALLOWED_TAGS = new Set(VALID_FORMAT_VALUES);

const normalizeTag = (tag) => {
  if (!tag || typeof tag !== 'string') {
    return '';
  }
  const lowered = tag.toLowerCase().trim();
  return ALLOWED_TAGS.has(lowered) ? lowered : '';
};

export const normalizeLineItems = (lines) => {
  if (!Array.isArray(lines)) {
    return [];
  }

  return lines
    .map((line) => {
      if (typeof line === 'string') {
        const match = line.match(/^<([\w-]+)>([\s\S]*?)<\/\1>$/);
        if (match) {
          return { tag: normalizeTag(match[1]), text: match[2].trim() };
        }
        return { tag: '', text: line.trim() };
      }

      const rawTag = line?.tag ?? line?.type ?? '';
      const rawText = line?.text ?? line?.value ?? line?.content ?? '';
      return {
        tag: normalizeTag(rawTag),
        text: typeof rawText === 'string' ? rawText.trim() : String(rawText ?? '').trim()
      };
    })
    .filter((line) => ALLOWED_TAGS.has(line.tag) && line.text.length > 0);
};

export const renderLinesToXml = (lines) =>
  lines.map((line) => `<${line.tag}>${line.text}</${line.tag}>`).join('\n');
