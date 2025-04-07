import db from '../../../../db/index.js';
import { ERROR_TYPES } from '../../constants.js';

export class ChainHelper {
    static preprocessScript(scriptContent, options = {}) {
        const defaults = {
            includeTitle: false,
            includeElements: false,
            elementType: null
        };
        const config = {...defaults, ...options };

        // If scriptContent is a string, use as is
        if (typeof scriptContent === 'string') {
            const base = {
                content: scriptContent
            };

            if (config.includeTitle) {
                base.title = 'Untitled Script';
                base.status = 'Draft';
                base.version_number = '1.0';
            }

            if (config.includeElements) {
                base.elements = {
                    [config.elementType]: []
                };
            }

            return base;
        }

        // If scriptContent is null or undefined
        if (!scriptContent) {
            const base = {
                content: ''
            };

            if (config.includeTitle) {
                base.title = 'Untitled Script';
                base.status = 'Draft';
                base.version_number = '1.0';
            }

            if (config.includeElements) {
                base.elements = {
                    [config.elementType]: []
                };
            }

            return base;
        }

        // Return with defaults for missing fields
        const base = {
            content: scriptContent.content || ''
        };

        if (config.includeTitle) {
            base.title = scriptContent.title || 'Untitled Script';
            base.status = scriptContent.status || 'Draft';
            base.version_number = scriptContent.version_number || '1.0';
        }

        if (config.includeElements) {
            base.elements = scriptContent.elements || {
                [config.elementType]: []
            };
        }

        return base;
    }

    static async saveToDatabase(scriptId, data, options = {}) {
        const defaults = {
            type: 'analysis',
            subtype: 'general',
            processContent: true
        };
        const config = {...defaults, ...options };

        try {
            if (!scriptId) {
                console.log('No scriptId provided, skipping save');
                return;
            }

            const content = config.processContent ?
                (typeof data === 'string' ? data : JSON.stringify(data)) :
                data;

            await db.createElement({
                script_id: scriptId,
                type: config.type,
                subtype: config.subtype,
                content: content
            }).catch(err => console.error(`Error saving ${config.type}:`, err));

        } catch (error) {
            console.error(`Error saving ${config.type}:`, error);
            // Don't throw, just log
        }
    }

    static validateContent(scriptContent) {
        if (!scriptContent || typeof scriptContent !== 'string') {
            return false;
        }
        return scriptContent.trim().length >= 10;
    }

    static getErrorResponse(message, type = 'error_response') {
        return {
            response: message,
            type: type
        };
    }

    static extractContext(context, defaults = {}) {
        return {
            scriptId: context.scriptId || defaults.scriptId || null,
            prompt: context.prompt || defaults.prompt || null,
            target: context.target || defaults.target || null
        };
    }

    static async handlePromptFormatting(promptManager, templateName, data, fallbackPrompt) {
        try {
            return await promptManager.formatPrompt(templateName, data);
        } catch (err) {
            console.error('Error formatting prompt:', err);
            return fallbackPrompt;
        }
    }

    static async validateStructuredResponse(response, options = {}) {
        const defaults = {
            requiredArray: null, // name of required array field (e.g., 'beats', 'scenes')
            alternateArrays: [], // alternate field names to try
            requiredFields: [], // required fields for each item
            defaultValues: {}, // default values for missing fields
            requireRationale: true // whether to require/provide default rationale
        };
        const config = {...defaults, ...options };

        try {
            // Parse if string
            const data = typeof response === 'string' ? JSON.parse(response) : response;

            // Check for main array
            let mainArray = [];
            if (config.requiredArray) {
                if (Array.isArray(data[config.requiredArray])) {
                    mainArray = data[config.requiredArray];
                } else {
                    // Try alternate array names
                    for (const alt of config.alternateArrays) {
                        if (Array.isArray(data[alt])) {
                            mainArray = data[alt];
                            data[config.requiredArray] = mainArray; // normalize to expected field
                            console.log(`Salvaged array from ${alt} field`);
                            break;
                        }
                    }
                    if (mainArray.length === 0) {
                        throw new Error(`No valid ${config.requiredArray} array found`);
                    }
                }
            }

            // Validate and provide defaults for each item
            if (mainArray.length > 0) {
                const validatedItems = mainArray.map((item, index) => {
                    const validated = {...config.defaultValues };
                    for (const [key, value] of Object.entries(item)) {
                        if (value !== null && value !== undefined) {
                            validated[key] = value;
                        }
                    }
                    return validated;
                });
                data[config.requiredArray] = validatedItems;
            }

            // Add rationale if missing and required
            if (config.requireRationale && !data.rationale) {
                data.rationale = `Analysis complete. Review the ${config.requiredArray} for details.`;
            }

            return data;
        } catch (error) {
            console.error('Validation error:', error);
            throw new Error(ERROR_TYPES.INVALID_FORMAT);
        }
    }

    static async saveElements(scriptId, elements, options = {}) {
        const defaults = {
            type: 'element',
            getSubtype: (index) => `element_${index + 1}`,
            processElement: (element) => element
        };
        const config = {...defaults, ...options };

        try {
            if (!scriptId || !Array.isArray(elements)) {
                console.log('Invalid save parameters, skipping save');
                return;
            }

            for (const [index, element] of elements.entries()) {
                const subtype = typeof config.getSubtype === 'function' ?
                    config.getSubtype(index) : config.getSubtype;

                const processedElement = config.processElement(element);

                await this.saveToDatabase(scriptId, processedElement, {
                    type: config.type,
                    subtype: subtype,
                    processContent: true
                });
            }
        } catch (error) {
            console.error(`Error saving ${config.type} elements:`, error);
        }
    }

    static getUnstructuredResponse(response, options = {}) {
        const defaults = {
            type: 'unstructured_response',
            emptyArray: null,
            prefix: "I analyzed the content but couldn't format it properly. Here's what I found: "
        };
        const config = {...defaults, ...options };

        const result = {
            response: config.prefix + (typeof response === 'string' ? response : JSON.stringify(response)),
            type: config.type,
            raw_data: response
        };

        if (config.emptyArray) {
            result[config.emptyArray] = [];
        }

        return result;
    }
}