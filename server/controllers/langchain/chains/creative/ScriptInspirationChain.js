import { BaseChain } from '../base/BaseChain.js';
import { promptManager } from '../../prompts/index.js';
import { ERROR_TYPES, INTENT_TYPES } from '../../constants.js';
import { preprocessScript } from '../helpers/ChainInputUtils.js';
import prisma from '../../../../db/prismaClient.js';
import scriptModel from '../../../../models/script.js';

export class ScriptInspirationChain extends BaseChain {
  constructor() {
    super({
      type: INTENT_TYPES.GET_INSPIRATION,
      temperature: 0.7, // Higher temperature for more creative responses
      modelConfig: {
        response_format: { type: 'text' } // Force text response instead of JSON
      }
    });
  }

  formatFallbackPrompt(scriptMetadata, scriptContent, formattedElements) {
    return [{
      role: 'system',
      content: 'You are a BRIEF clever writing assistant specializing in generating fresh ideas. Be short and concise. Listing at most 3 very short ideas. Maximum 100 words.'
    }, {
      role: 'user',
      content: [
        'Please generate creative ideas for this script:',
        '',
        `Title: ${scriptMetadata.title}`,
        '',
        'Content:',
        scriptContent,
        '',
        'Existing Elements:',
        formattedElements
      ].join('\n')
    }];
  }

  async extractContext(input) {
    try {
      if (!input || !input.scriptId) {
        throw new Error(`${ERROR_TYPES.MISSING_REQUIRED}: Script ID is required`);
      }

      // Fetch script content and metadata from database
      const script = await scriptModel.getScript(input.scriptId);
      if (!script || !script.content) {
        throw new Error(`${ERROR_TYPES.NOT_FOUND}: Script not found`);
      }

      // Process the script input for analysis
      const processedScript = preprocessScript(script.content);

      // Fetch saved elements from database
      const scriptElements = await prisma.scriptElement.findMany({
        where: { scriptId: Number(input.scriptId) }
      });
      const formattedElements = this.formatElements(scriptElements);

      // Calculate script metrics
      const content = processedScript.content || script.content;
      const words = content.split(/\s+/).length;
      const lines = content.split('\n').length;

      return {
        scriptContent: content,
        scriptMetadata: {
          id: script.id,
          title: script.title || processedScript.title || 'Untitled Script',
          status: script.status || processedScript.status || 'Draft',
          elements: formattedElements,
          words,
          lines,
          lastUpdated: script.updatedAt || new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Context extraction error:', error);
      throw new Error(`Failed to extract context: ${error.message}`);
    }
  }

  formatElements(scriptElements) {
    if (!scriptElements || scriptElements.length === 0) {
      return 'No saved elements found.';
    }
    return scriptElements.map(element => {
      if (element.payload) {
        return `${element.type}: ${JSON.stringify(element.payload)}`;
      }
      return `${element.type}: {}`;
    }).join('\n');
  }

  async run(input, _context = {}) {
    try {
      console.log('Starting ScriptInspirationChain.run...');
      const { scriptContent, scriptMetadata } = await this.extractContext(input);
      console.log('Context extracted:', { hasContent: !!scriptContent, title: scriptMetadata.title });

      // Get the template from promptManager
      console.log('Getting template...');
      const template = promptManager.getTemplate(INTENT_TYPES.GET_INSPIRATION);
      if (!template) {
        console.log('No template found, using fallback...');
        // Fallback to basic prompt if template not found
        const messages = this.formatFallbackPrompt(scriptMetadata, scriptContent, scriptMetadata.elements);
        console.log('Executing with fallback prompt...');
        return this.execute(messages, {
          scriptId: scriptMetadata.id,
          scriptTitle: scriptMetadata.title,
          metadata: {
            scriptId: scriptMetadata.id,
            title: scriptMetadata.title,
            timestamp: new Date().toISOString()
          }
        });
      }

      // Format the prompt using the template
      console.log('Formatting prompt with template...');
      const messages = await template.format({
        title: scriptMetadata.title,
        script: scriptContent,
        elements: scriptMetadata.elements,
        words: scriptMetadata.words,
        lines: scriptMetadata.lines,
        lastUpdated: scriptMetadata.lastUpdated
      });

      // Execute with context
      console.log('Executing formatted template prompt...');
      return this.execute(messages, {
        scriptId: scriptMetadata.id,
        scriptTitle: scriptMetadata.title,
        metadata: {
          scriptId: scriptMetadata.id,
          title: scriptMetadata.title,
          words: scriptMetadata.words,
          lines: scriptMetadata.lines,
          lastUpdated: scriptMetadata.lastUpdated,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error in ScriptInspirationChain:', error);
      return {
        response: `Error generating inspiration: ${error.message}`,
        type: 'error',
        timestamp: new Date().toISOString()
      };
    }
  }
}
