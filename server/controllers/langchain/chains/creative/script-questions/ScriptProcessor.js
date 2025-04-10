/**
 * Script processing and metadata extraction
 * Controls how scripts are preprocessed and analyzed before question answering
 * 
 * To modify script processing:
 * 1. Adjust preprocessScript for different metadata defaults
 * 2. Modify extractMetadata for different statistics
 * 3. Add custom content processors in processContent
 */

// Constants for script processing
const MAX_SCRIPT_LENGTH = 1000000; // 1MB
const SCRIPT_CACHE = new Map();

/**
 * Sanitizes script content
 * @param {string} content - Raw script content
 * @returns {string} - Sanitized content
 */
function sanitizeContent(content) {
    if (!content) return '';

    try {
        // Remove null and other problematic chars
        content = content.replace(/\0/g, '')
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');

        // Normalize line endings
        content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // Remove excessive blank lines
        content = content.replace(/\n{3,}/g, '\n\n');

        return content.trim();
    } catch (error) {
        console.error('Error sanitizing content:', error);
        return content || '';
    }
}

/**
 * Preprocesses script content with metadata
 * @param {string|Object} scriptContent - Raw script content or script object
 * @returns {Object} - Processed script with metadata
 */
export function preprocessScript(scriptContent) {
    try {
        // Handle string input
        if (typeof scriptContent === 'string') {
            const sanitized = sanitizeContent(scriptContent);
            if (sanitized.length > MAX_SCRIPT_LENGTH) {
                throw new Error(`Script content exceeds maximum length of ${MAX_SCRIPT_LENGTH}`);
            }
            return {
                title: 'Untitled Script',
                status: 'Draft',
                version_number: '1.0',
                content: sanitized
            };
        }

        // Handle null/undefined
        if (!scriptContent) {
            return {
                title: 'Untitled Script',
                status: 'Draft',
                version_number: '1.0',
                content: ''
            };
        }

        // Process object input
        const sanitized = sanitizeContent(scriptContent.content);
        if (sanitized.length > MAX_SCRIPT_LENGTH) {
            throw new Error(`Script content exceeds maximum length of ${MAX_SCRIPT_LENGTH}`);
        }

        return {
            title: scriptContent.title || 'Untitled Script',
            status: scriptContent.status || 'Draft',
            version_number: scriptContent.version_number || '1.0',
            content: sanitized
        };
    } catch (error) {
        console.error('Error preprocessing script:', error);
        throw error;
    }
}

/**
 * Safely executes a regex pattern
 * @param {string} content - Content to search
 * @param {RegExp} pattern - Pattern to use
 * @param {any} defaultValue - Default value if regex fails
 * @returns {any} - Match result or default value
 */
function safeRegexMatch(content, pattern, defaultValue) {
    try {
        return (content.match(pattern) || defaultValue);
    } catch (error) {
        console.error(`Regex error with pattern ${pattern}:`, error);
        return defaultValue;
    }
}

/**
 * Extracts metadata from script content
 * @param {string} content - The script content
 * @returns {Object} - Script metadata
 */
export function extractMetadata(content) {
    // Check cache first
    const cacheKey = content.slice(0, 100) + content.length; // Simple cache key
    if (SCRIPT_CACHE.has(cacheKey)) {
        return SCRIPT_CACHE.get(cacheKey);
    }

    try {
        const metadata = {
            chars: content.length,
            words: content.split(/\s+/).length,
            lines: content.split('\n').length,
            lastUpdated: new Date().toISOString()
        };

        // Cache the result
        SCRIPT_CACHE.set(cacheKey, metadata);

        // Clean cache if too large
        if (SCRIPT_CACHE.size > 100) {
            const oldestKey = SCRIPT_CACHE.keys().next().value;
            SCRIPT_CACHE.delete(oldestKey);
        }

        return metadata;
    } catch (error) {
        console.error('Error extracting metadata:', error);
        return {
            chars: content.length,
            words: 0,
            lines: 0,
            error: error.message
        };
    }
}

/**
 * Formats script content for display
 * @param {Object} script - Processed script with metadata
 * @param {Object} metadata - Extracted metadata
 * @returns {string} - Formatted script content
 */
export function formatScriptContent(script, metadata) {
    try {
        return `📄 "${script.title}" (${script.status} v${script.version_number})
📊 Stats: ${metadata.chars}c ${metadata.words}w ${metadata.lines}l 

${script.content}`;
    } catch (error) {
        console.error('Error formatting script content:', error);
        return script.content || '';
    }
}

/**
 * Processes script input and extracts all necessary information
 * @param {string|Object} input - Raw script input
 * @returns {Object} - Processed script with metadata
 */
export function processScriptInput(input) {
    try {
        const processedScript = preprocessScript(input);
        const metadata = extractMetadata(processedScript.content);
        const formattedContent = formatScriptContent(processedScript, metadata);

        return {
            processedScript,
            metadata,
            formattedContent
        };
    } catch (error) {
        console.error('Error processing script input:', error);
        throw error;
    }
}