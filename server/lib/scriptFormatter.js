const VALID_TAGS = new Set([
  'header',
  'action',
  'speaker',
  'dialog',
  'directions',
  'chapter-break'
]);

const FORMAT_RULES = [
  { prefix: 'HEADER:', tag: 'header', offset: 7 },
  { prefix: 'SPEAKER:', tag: 'speaker', offset: 8 },
  { prefix: 'DIALOG:', tag: 'dialog', offset: 7 },
  { prefix: 'ACTION:', tag: 'action', offset: 7 },
  { prefix: 'DIRECTIONS:', tag: 'directions', offset: 11 }
];

const escape = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const wrapWithTag = (tag, content = '') => `<${tag}>${escape(content.trim())}</${tag}>`;

const isValidTagLine = (line) => {
  if (!line || typeof line !== 'string') return false;
  const trimmed = line.trim();
  if (!trimmed.startsWith('<') || !trimmed.endsWith('>')) return false;
  const match = trimmed.match(/^<([a-zA-Z-]+)>[\s\S]*<\/\1>$/);
  return Boolean(match) && VALID_TAGS.has(match[1].toLowerCase());
};

const standardizeLines = (content) => {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
};

const cleanMarkup = (content) => {
  let normalized = content
    .replace(/<\?xml[^>]*\?>/gi, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<chapter-break\s*\/>/gi, '<chapter-break></chapter-break>')
    .replace(/>\s+</g, '>\n<')
    .trim();

  const lines = standardizeLines(normalized);
  return lines.join('\n');
};

const formatPlainText = (content) => {
  const lines = standardizeLines(content);

  return lines
    .map(line => {
      if (line === '---') {
        return wrapWithTag('chapter-break', '');
      }

      const rule = FORMAT_RULES.find(rule => line.toUpperCase().startsWith(rule.prefix));
      if (rule) {
        return wrapWithTag(rule.tag, line.substring(rule.offset));
      }

      // default to action
      return wrapWithTag('action', line);
    })
    .join('\n');
};

const hasMarkup = (content) => {
  return content
    .split('\n')
    .some(line => /^<([a-zA-Z-]+)>[\s\S]*<\/\1>$/.test(line.trim()));
};

const normalizeFormattedScript = (value) => {
  if (!value && value !== 0) {
    return '';
  }

  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }

  const candidate = hasMarkup(trimmed) ? cleanMarkup(trimmed) : formatPlainText(trimmed);
  const lines = standardizeLines(candidate);

  const validated = lines.every(isValidTagLine);
  if (validated) {
    return lines.join('\n');
  }

  // fallback to plain text formatting if validation fails
  return formatPlainText(trimmed);
};

export {
  normalizeFormattedScript
};
