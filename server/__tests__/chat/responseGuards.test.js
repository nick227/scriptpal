import { describe, expect, it } from '@jest/globals';
import { buildAiResponse, createIntentResult } from '../../controllers/common/ai-response.service.js';
import { looksLikeStructuredPayload } from '../../../shared/langchainConstants.js';
import {
  normalizeWritingResponse,
  rejectNonScreenplayScriptOutput,
  stripStructuredScriptOutput
} from '../../controllers/langchain/chains/helpers/WritingResponseNormalizer.js';
import { resolveOutcome } from '../../controllers/chat/intent/resolveOutcome.js';
import { CHAT_OUTCOME } from '../../controllers/chat/intent/outcomes.js';
import { validateAiResponse } from '../../../shared/langchainConstants.js';

describe('response guards — JSON must not reach script or chat', () => {
  const collectionsJson = JSON.stringify({
    assistantResponse: 'Here are scenes',
    collections: [{ type: 'scenes', items: [{ title: 'A', description: 'B' }] }]
  });

  it('detects structured JSON payloads', () => {
    expect(looksLikeStructuredPayload(collectionsJson)).toBe(true);
    expect(looksLikeStructuredPayload('<action>Hello</action>')).toBe(false);
  });

  it('detects malformed script array JSON', () => {
    const malformed = JSON.stringify({
      script: ['INT. WAREHOUSE - NIGHT', 'SARAH', 'Hello.']
    });
    expect(looksLikeStructuredPayload(malformed)).toBe(true);
  });

  it('strips JSON from writing normalizer script output', () => {
    const result = normalizeWritingResponse({
      assistantMessage: collectionsJson,
      formattedScript: collectionsJson
    });
    expect(result.script).toBe('');
    expect(result.message).not.toContain('"collections"');
  });

  it('rejects non-screenplay append output', () => {
    const rejected = rejectNonScreenplayScriptOutput({
      message: 'ok',
      script: collectionsJson,
      metadata: {}
    });
    expect(rejected.script).toBe('');
    expect(rejected.metadata.scriptRejected).toBe(true);
  });

  it('buildAiResponse clears JSON script and message for append intent', () => {
    const payload = buildAiResponse({
      intentResult: createIntentResult('APPEND_SCRIPT'),
      scriptId: 1,
      response: {
        message: collectionsJson,
        script: collectionsJson,
        metadata: {}
      },
      mode: 'APPEND_SCRIPT'
    });
    expect(payload.response.script).toBeFalsy();
    expect(payload.response.message).not.toContain('"collections"');
  });

  it('validateAiResponse rejects JSON in script field for APPEND_SCRIPT', () => {
    const validation = validateAiResponse('APPEND_SCRIPT', {
      message: 'Done.',
      script: collectionsJson
    });
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('JSON'))).toBe(true);
  });

  it('routes collection correction prompts to DISCUSS_SCENES not write append', () => {
    const result = resolveOutcome('no those are too obvious, delete all those and try again', {
      scriptId: 42
    });
    expect(result.outcome).toBe(CHAT_OUTCOME.DISCUSS_SCENES);
    expect(result.editorOperation).toBeNull();
  });
});
