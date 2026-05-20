const TAG_BLOCK_PATTERN = /<(header|action|speaker|dialog|directions|chapter-break)>[\s\S]*?<\/\1>/g;
const TAG_OPEN_PATTERN = /<(header|action|speaker|dialog|directions|chapter-break)>/g;

const DEFAULT_MAX_LINES = 30;

/**
 * Keep the last N tagged screenplay lines for prompt context (recency bias).
 * @param {string} scriptContent
 * @param {number} maxLines
 * @returns {string}
 */
export const truncateScriptToTail = (scriptContent, maxLines = DEFAULT_MAX_LINES) => {
  if (!scriptContent || typeof scriptContent !== 'string') {
    return '';
  }

  const matches = scriptContent.match(TAG_BLOCK_PATTERN);
  if (!matches || matches.length <= maxLines) {
    return scriptContent;
  }

  let recentLines = matches.slice(-maxLines);
  const firstLine = recentLines[0];

  if (firstLine && (firstLine.startsWith('<dialog>') || firstLine.startsWith('<directions>'))) {
    const cutIndex = matches.length - maxLines;
    if (cutIndex > 0 && matches[cutIndex - 1]?.startsWith('<speaker>')) {
      recentLines = [matches[cutIndex - 1], ...recentLines];
    }
  }

  return recentLines.join('\n');
};

export const countTaggedLines = (scriptContent) => {
  if (!scriptContent || typeof scriptContent !== 'string') {
    return 0;
  }
  const matches = scriptContent.match(TAG_BLOCK_PATTERN);
  return matches ? matches.length : 0;
};

export { TAG_OPEN_PATTERN, TAG_BLOCK_PATTERN };
