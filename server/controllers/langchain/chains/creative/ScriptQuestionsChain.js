import { BaseChain } from '../base/BaseChain.js';
import { promptManager as _promptManager } from '../../prompts/index.js';
import { ERROR_TYPES, INTENT_TYPES } from '../../constants.js';
import { preprocessScript } from '../helpers/ChainInputUtils.js';
import prisma from '../../../../db/prismaClient.js';

/**
 * Chain for answering specific questions about scripts
 *
 * Flow Control Points:
 * 1. Question Validation:
 *    - Basic validation in QuestionValidator.js
 *    - Adjust length limits and validation rules
 *
 * 2. Script Processing:
 *    - Control script preprocessing in ScriptProcessor.js
 *    - Modify metadata extraction and formatting
 *
 * 3. Response Formatting:
 *    - Control response structure in ResponseFormatter.js
 *    - Adjust sanitization and truncation rules
 */
export class ScriptQuestionsChain extends BaseChain {
  constructor() {
    super({
      type: INTENT_TYPES.SCRIPT_QUESTIONS,
      temperature: 0.3,
      modelConfig: {
        response_format: { type: 'text' } // Force text response
      }
    });
  }

  /**
     * Extract and validate context from input
     * @param {Object} context - Input context object
     * @returns {Promise<Object>} Processed context
     */
  extractContext(context) {
    try {
      if (!context || !context.scriptContent) {
        throw new Error(`${ERROR_TYPES.MISSING_REQUIRED}: Script content is required`);
      }

      const processedScript = preprocessScript(context.scriptContent);

      return {
        scriptContent: processedScript.content,
        scriptMetadata: {
          title: context.scriptTitle || processedScript.title || 'Untitled Script',
          chars: processedScript.content.length,
          words: processedScript.content.split(/\s+/).length,
          lines: processedScript.content.split('\n').length,
          lastUpdated: (context.scriptMetadata && context.scriptMetadata.lastUpdated) || new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Context extraction error:', error);
      throw new Error(`Failed to extract context: ${error.message}`);
    }
  }

  async run(context, prompt) {
    try {
      // Extract script content and metadata
      const { scriptContent, scriptMetadata } = await this.extractContext(context);

      // Fetch saved elements from database
      const scriptElements = await prisma.scriptElement.findMany({
        where: { scriptId: Number(context.scriptId) }
      });
      const formattedElements = this.formatDatabaseElements(scriptElements);

      // Format the prompt
      const formattedPrompt = [{
        role: 'system',
        content: `You are analyzing a script titled "${scriptMetadata.title}".

Your task is to answer questions about the script content and saved elements.
Format your response using ONLY HTML <h2> and <p> tags.

SCRIPT CONTENT:
${scriptContent}

SAVED DATABASE ELEMENTS:
${formattedElements}

FORMATTING RULES:
    Use <h2> and <p> tags
    Commonly use h2 for brief single line responses.
    Add p tags for longer multi-line responses.
    Keep responses concise and direct.
    Do not use any other HTML tags.
    Do not return any JSON or metadata.
`
      }, {
        role: 'user',
        content: prompt
      }];

      // Execute with preserved metadata
      const enrichedContext = {
        ...context,
        scriptId: context.scriptId,
        scriptTitle: scriptMetadata.title,
        metadata: {
          ...scriptMetadata,
          scriptId: context.scriptId,
          scriptTitle: scriptMetadata.title
        }
      };

      // Get response from model
      const response = await this.execute(formattedPrompt, enrichedContext);

      // Return clean HTML response
      return {
        response: response,
        type: 'script_question_answer',
        metadata: {
          ...scriptMetadata,
          scriptId: context.scriptId,
          scriptTitle: scriptMetadata.title,
          responseLength: response.length,
          truncated: false,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error in ScriptQuestionsChain:', error);
      return {
        response: '<h2>Error</h2><p>I apologize, but I encountered an error analyzing the script. Please try asking your question again.</p>',
        type: 'error_response',
        metadata: {
          error: error.message,
          scriptId: context.scriptId,
          scriptTitle: context.scriptTitle,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  formatDatabaseElements(elements) {
    if (!elements || elements.length === 0) {
      return 'No saved elements found in database.';
    }

    return elements.map(element => {
      const payload = element.payload || {};
      const content = payload.content || '';
      const subtype = payload.subtype || 'unknown';
      return `${element.type} (${subtype}): ${typeof content === 'object' ? JSON.stringify(content) : content}`;
    }).join('\n');
  }
}
