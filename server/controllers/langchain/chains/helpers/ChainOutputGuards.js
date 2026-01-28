import { ERROR_TYPES } from '../../constants.js';
import { validateAiResponse } from '../../../../../shared/langchainConstants.js';

export { validateAiResponse };

const resolveContractKey = (intent) => {
  if (intent === 'SCRIPT_FULL_SCRIPT') {
    return 'FULL_SCRIPT';
  }
  return intent;
};

export const buildContractMetadata = (intent, response) => {
  const contractKey = resolveContractKey(intent);
  const validation = validateAiResponse(contractKey, response);
  return {
    contract: contractKey,
    contractValidation: validation
  };
};

export const validateStructuredResponseStrict = (response, options = {}) => {
  const defaults = {
    requiredArray: null,
    requiredFields: [],
    requireRationale: true
  };
  const config = { ...defaults, ...options };

  try {
    const data = typeof response === 'string' ? JSON.parse(response) : response;
    if (!data || typeof data !== 'object') {
      throw new Error('Response must be an object');
    }

    let mainArray = [];
    if (config.requiredArray) {
      if (!Array.isArray(data[config.requiredArray])) {
        throw new Error(`Missing ${config.requiredArray} array`);
      }
      mainArray = data[config.requiredArray];
    }

    if (config.requiredFields.length > 0 && mainArray.length > 0) {
      mainArray.forEach((item, index) => {
        if (!item || typeof item !== 'object') {
          throw new Error(`Invalid item at index ${index}`);
        }
        config.requiredFields.forEach(field => {
          if (typeof item[field] === 'undefined' || item[field] === null) {
            throw new Error(`Missing field "${field}" at index ${index}`);
          }
        });
      });
    }

    if (config.requireRationale && !data.rationale) {
      throw new Error('Missing rationale');
    }

    return data;
  } catch (error) {
    console.error('Validation error:', error);
    throw new Error(ERROR_TYPES.INVALID_FORMAT);
  }
};
