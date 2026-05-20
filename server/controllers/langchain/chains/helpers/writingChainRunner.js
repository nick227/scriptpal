import { buildContractMetadata, validateAiResponse } from './ChainOutputGuards.js';
import { normalizeWritingResponse } from './WritingResponseNormalizer.js';

/**
 * Validate canonical writing response and attach contract metadata.
 */
export const finalizeWritingResponse = (formattedResponse, contractKey) => {
  const validation = validateAiResponse(contractKey, formattedResponse);
  if (!validation.valid) {
    throw new Error(`ai_response_invalid: ${validation.errors.join('; ')}`);
  }

  Object.assign(
    formattedResponse.metadata,
    buildContractMetadata(contractKey, formattedResponse)
  );

  return formattedResponse;
};

/**
 * Build canonical writing output from structured model fields.
 */
export const buildWritingOutput = ({
  contractKey,
  type,
  assistantMessage,
  formattedScript,
  metadata = {}
}) => {
  const canonical = normalizeWritingResponse({
    assistantMessage,
    formattedScript,
    metadata,
    type
  });

  return finalizeWritingResponse(canonical, contractKey);
};

/**
 * Retry loop for writing chains (execute → validate → retry with note).
 */
export const runWritingAttemptLoop = async ({
  maxAttempts = 3,
  runAttempt
}) => {
  let lastError = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const isLastAttempt = attempt === maxAttempts;
    const retryNote = lastError
      ? `Previous issue: ${lastError}. Please continue cleanly.`
      : '';

    try {
      const result = await runAttempt({ attempt, retryNote, isLastAttempt });
      if (result) {
        return result;
      }
      lastError = 'empty_result';
    } catch (error) {
      lastError = error?.message || 'writing_attempt_failed';
      if (isLastAttempt) {
        throw error;
      }
    }
  }

  throw new Error(lastError || 'writing_attempt_failed');
};
