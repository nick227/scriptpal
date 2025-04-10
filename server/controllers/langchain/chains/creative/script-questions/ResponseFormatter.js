/**
 * Response formatting and processing
 * Controls how AI responses are formatted and structured
 * 
 * To modify response handling:
 * 1. Adjust formatResponse for different output structures
 * 2. Add new response types in processResponseByType
 * 3. Modify error responses in getErrorResponse
 */

// Constants for response formatting
const MAX_RESPONSE_LENGTH = 50000; // 50KB
const VALID_RESPONSE_TYPES = ['script_question_answer', 'error_response', 'partial_response'];

/**
 * Sanitizes HTML/Markdown from text
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized text
 */
function sanitizeFormatting(text) {
    if (!text) return '';

    try {
        // Remove HTML tags
        text = text.replace(/<[^>]*>/g, '');

        // Remove markdown links
        text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

        // Remove markdown headers
        text = text.replace(/^#{1,6}\s+/gm, '');

        // Remove code blocks
        text = text.replace(/```[\s\S]*?```/g, '');
        text = text.replace(/`([^`]+)`/g, '$1');

        return text.trim();
    } catch (error) {
        console.error('Error sanitizing formatting:', error);
        return text;
    }
}

/**
 * Truncates text to a maximum length while preserving words
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;

    const truncated = text.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace === -1) return truncated + '...';
    return truncated.slice(0, lastSpace) + '...';
}

/**
 * Formats the AI response into a consistent structure
 * @param {string|Object} response - Raw AI response
 * @returns {string} - Formatted response text
 */
export function formatResponse(response) {
    try {
        // Handle string responses
        if (typeof response === 'string') {
            const sanitized = sanitizeFormatting(response);
            return truncateText(sanitized, MAX_RESPONSE_LENGTH);
        }

        // Handle object responses
        if (typeof response === 'object' && response !== null) {
            // Combined answer + supporting info format
            if (response.answer && response.supporting_information) {
                const combined = `${response.answer}\n\n${response.supporting_information}`;
                const sanitized = sanitizeFormatting(combined);
                return truncateText(sanitized, MAX_RESPONSE_LENGTH);
            }

            // Single answer format
            if (response.answer) {
                const sanitized = sanitizeFormatting(response.answer);
                return truncateText(sanitized, MAX_RESPONSE_LENGTH);
            }

            // Generic response format
            if (response.response) {
                const sanitized = sanitizeFormatting(response.response);
                return truncateText(sanitized, MAX_RESPONSE_LENGTH);
            }

            // Handle other object structures
            const combined = Object.entries(response)
                .filter(([key, value]) => typeof value === 'string' && value.trim())
                .map(([key, value]) => sanitizeFormatting(value))
                .join('\n\n');

            return truncateText(combined, MAX_RESPONSE_LENGTH);
        }

        // Handle JSON string responses
        if (typeof response === 'string') {
            try {
                const parsed = JSON.parse(response);
                return formatResponse(parsed);
            } catch {
                const sanitized = sanitizeFormatting(response);
                return truncateText(sanitized, MAX_RESPONSE_LENGTH);
            }
        }

        return 'Unable to format response';
    } catch (error) {
        console.error('Error formatting response:', error);
        return 'Error formatting response';
    }
}

/**
 * Creates a standardized error response
 * @param {string} message - Error message
 * @param {string} type - Error type
 * @returns {Object} - Formatted error response
 */
export function getErrorResponse(message, type = 'error_response') {
    if (!VALID_RESPONSE_TYPES.includes(type)) {
        console.warn(`Invalid response type: ${type}, defaulting to error_response`);
        type = 'error_response';
    }

    return {
        response: sanitizeFormatting(message),
        type: type,
        error: true,
        timestamp: new Date().toISOString()
    };
}

/**
 * Creates the final response object
 * @param {string} formattedResponse - The formatted response text
 * @param {Object} metadata - Response metadata
 * @returns {Object} - Final response object
 */
export function createResponseObject(formattedResponse, metadata) {
    try {
        // Validate response type
        if (!VALID_RESPONSE_TYPES.includes(metadata.type)) {
            console.warn(`Invalid response type: ${metadata.type}, defaulting to script_question_answer`);
            metadata.type = 'script_question_answer';
        }

        // Validate and sanitize response
        const sanitizedResponse = sanitizeFormatting(formattedResponse);
        const truncatedResponse = truncateText(sanitizedResponse, MAX_RESPONSE_LENGTH);

        return {
            response: truncatedResponse,
            type: metadata.type || 'script_question_answer',
            scriptTitle: metadata.scriptTitle,
            metadata: {
                ...metadata.scriptMetadata,
                responseLength: truncatedResponse.length,
                truncated: truncatedResponse.length < sanitizedResponse.length,
                timestamp: new Date().toISOString()
            }
        };
    } catch (error) {
        console.error('Error creating response object:', error);
        return getErrorResponse('Error creating response object');
    }
}