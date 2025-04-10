/**
 * Simple question validation for script analysis
 * Focuses on essential validation without over-engineering
 */

const QUESTION_MIN_LENGTH = 5;
const QUESTION_MAX_LENGTH = 500;

/**
 * Validates a question for basic requirements
 * @param {string} question - The question to validate
 * @returns {Object} - Validation result
 */
export function validateQuestion(question) {
    // Basic validation
    if (!question || typeof question !== 'string') {
        return {
            isValid: false,
            error: "Please provide a question about the script."
        };
    }

    // Length validation
    if (question.length < QUESTION_MIN_LENGTH) {
        return {
            isValid: false,
            error: "Please ask a more detailed question about the script."
        };
    }

    if (question.length > QUESTION_MAX_LENGTH) {
        return {
            isValid: false,
            error: `Please keep your question under ${QUESTION_MAX_LENGTH} characters.`
        };
    }

    // Question mark validation
    if (!question.includes('?')) {
        return {
            isValid: false,
            error: "Please phrase your input as a question."
        };
    }

    return {
        isValid: true,
        question: question.trim()
    };
}

/**
 * Formats the question with script context
 * @param {string} question - The validated question
 * @param {string} scriptTitle - The title of the script
 * @returns {string} - Formatted question with context
 */
export function formatQuestion(question, scriptTitle) {
    return `Regarding the script "${scriptTitle}", please answer the following question:\n${question}`;
}