import { BaseChain } from '../base/BaseChain.js';
import { VALID_FORMAT_VALUES } from '../../constants.js';

export const FULL_SCRIPT_INTENT = 'SCRIPT_FULL_SCRIPT';

const MIN_PAGES = 5;
const MAX_PAGES = 6;
const MIN_LINES_PER_PAGE = 12;
const MAX_LINES_PER_PAGE = 22;
const LINE_MIN = MIN_PAGES * MIN_LINES_PER_PAGE;
const LINE_MAX = MAX_PAGES * MAX_LINES_PER_PAGE;
const MAX_ATTEMPTS = 3;

const SYSTEM_INSTRUCTION = `You are a screenplay architect. Continue the current script by adding 5-6 pages of new content that stays true to the characters and tone. Treat each "<chapter-break></chapter-break>" as a page boundary and deliver roughly 12-22 valid script lines per page. Focus on a clear story arc (setup, escalation, turning point, resolution), include beats that cause something meaningful to happen, and keep the arc grounded in the user prompt. Output ONLY XML-style script lines (valid tags: ${VALID_FORMAT_VALUES.join(', ')} and <chapter-break></chapter-break>). Do not rewrite what has already happened; pick up exactly where the script left off. No markdown, commentary, numbering, or prose outside the script tags.`;

export class FullScriptChain extends BaseChain {
  constructor() {
    super({
      type: FULL_SCRIPT_INTENT,
      temperature: 0.45,
      modelConfig: {
        response_format: { type: 'text' }
      }
    });
  }

  buildMessages(context, prompt, retryNote = '') {
    const userPrompt = retryNote ? `${prompt}\n\nCorrection: ${retryNote}` : prompt;
    const scriptContent = context?.scriptContent || '';
    const content = scriptContent
      ? `${userPrompt}\n\nCurrent script:\n${scriptContent}`
      : userPrompt;

    return [{
      role: 'system',
      content: SYSTEM_INSTRUCTION
    }, {
      role: 'user',
      content
    }];
  }

  normalizeScriptText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/<chapter-break\s*\/>/gi, '<chapter-break></chapter-break>')
      .trim();
  }

  sanitizeScriptLines(text) {
    const sanitized = [];
    let invalidTagCount = 0;
    let coercedCount = 0;
    let droppedCount = 0;
    let extractedCount = 0;

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
      if (VALID_FORMAT_VALUES.includes(tag)) {
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
      const fallbackLines = text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
      for (const line of fallbackLines) {
        sanitized.push(`<action>${line}</action>`);
        coercedCount += 1;
      }
    }

    if (invalidTagCount || coercedCount || droppedCount) {
      console.warn('[FullScriptChain] Sanitized AI output', {
        invalidTagCount,
        coercedCount,
        droppedCount,
        extractedCount
      });
    }

    return sanitized;
  }

  validateScriptLines(lines) {
    if (!Array.isArray(lines)) {
      return { ok: false, reason: 'Lines missing' };
    }

    const lineCount = lines.length;
    const chapterBreakCount = lines
      .filter(line => line.toLowerCase().startsWith('<chapter-break'))
      .length;
    const pageCount = chapterBreakCount + 1;

    if (lineCount < LINE_MIN) {
      return { ok: false, reason: `Line count ${lineCount} below minimum ${LINE_MIN}`, lineCount, pageCount };
    }

    if (lineCount > LINE_MAX) {
      return { ok: false, reason: `Line count ${lineCount} above maximum ${LINE_MAX}`, lineCount, pageCount };
    }

    if (pageCount < MIN_PAGES) {
      return { ok: false, reason: `Page count ${pageCount} below minimum ${MIN_PAGES}`, lineCount, pageCount };
    }

    if (pageCount > MAX_PAGES) {
      return { ok: false, reason: `Page count ${pageCount} above maximum ${MAX_PAGES}`, lineCount, pageCount };
    }

    return { ok: true, lineCount, pageCount };
  }

  formatResponse(responseText, context, validation) {
    const metadata = {
      ...this.extractMetadata(context, ['scriptId', 'scriptTitle']),
      fullScript: true,
      timestamp: new Date().toISOString()
    };
    if (validation?.lineCount) {
      metadata.lineCount = validation.lineCount;
    }
    if (validation?.pageCount) {
      metadata.pageCount = validation.pageCount;
    }

    return {
      response: responseText,
      type: FULL_SCRIPT_INTENT,
      metadata
    };
  }

  async run(context, prompt) {
    let lastError = '';
    let lastResponseText = '';

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const retryNote = lastError
        ? `${lastError}. Return exactly ${MIN_PAGES}-${MAX_PAGES} pages separated by <chapter-break></chapter-break> while keeping valid tags (${VALID_FORMAT_VALUES.join(', ')}).`
        : '';
      const messages = await this.buildMessages(context, prompt, retryNote);
      const response = await this.execute(messages, context, false);

      lastResponseText = typeof response === 'string' ? response : response.response || '';
      lastResponseText = this.normalizeScriptText(lastResponseText);
      const sanitizedLines = this.sanitizeScriptLines(lastResponseText);

      if (sanitizedLines.length > LINE_MAX) {
        console.warn('[FullScriptChain] Truncating lines to maximum', {
          originalCount: sanitizedLines.length,
          max: LINE_MAX
        });
      }

      const finalLines = sanitizedLines.slice(0, LINE_MAX);
      const validation = this.validateScriptLines(finalLines);

      if (validation.ok) {
        const finalText = finalLines.join('\n');
        return this.formatResponse(finalText, context, validation);
      }

      lastError = validation.reason || 'Validation failure';
      console.warn('[FullScriptChain] Validation failed', { attempt, reason: lastError });
    }

    throw new Error(`full_script_validation_failed: ${lastError}`);
  }
}
