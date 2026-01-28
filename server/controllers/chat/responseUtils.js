import { validateAiResponse } from '../langchain/constants.js';
import { buildAiResponse } from '../aiResponse.js';

export const buildValidatedChatResponse = ({
  intentResult,
  scriptId,
  scriptTitle,
  response,
  validationIntent,
  mode
}) => {
  const validation = validateAiResponse(validationIntent, response);
  if (!validation.valid) {
    return { valid: false, validation };
  }

  const responseWithMetadata = {
    ...response,
    metadata: {
      ...response.metadata,
      contractValidation: validation
    }
  };

  return {
    valid: true,
    validation,
    responsePayload: buildAiResponse({
      intentResult,
      scriptId,
      scriptTitle,
      response: responseWithMetadata,
      validation,
      mode: mode || validationIntent
    })
  };
};
