import { BaseChain } from '../base/BaseChain.js';
import { promptManager } from '../../prompts/index.js';
import { ERROR_TYPES as _ERROR_TYPES } from '../../constants.js';
import {
  extractContext,
  preprocessScript,
  validateContent,
  getErrorResponse,
  handlePromptFormatting
} from '../helpers/ChainInputUtils.js';
import { validateStructuredResponseStrict } from '../helpers/ChainOutputGuards.js';

export class SceneListChain extends BaseChain {
  constructor(config = {}) {
    super({
      ...config,
      temperature: 0.7 // Higher creativity for scene generation
    });
  }

  validateSceneList(result) {
    return validateStructuredResponseStrict(result, {
      requiredArray: 'scenes',
      requiredFields: ['description', 'setting', 'purpose'],
      requireRationale: true
    });
  }

  async run(input, context = {}) {
    try {
      // Extract context with defaults
      const { scriptId, prompt } = extractContext(context);

      // Get script content - could be an object, string, or null
      let scriptContent = input;

      // If input seems to be the prompt instead of the script content
      if (typeof input === 'string' && input.length < 500 && context.prompt) {
        scriptContent = context.prompt;
      }

      // Process the script
      const processedScript = preprocessScript(scriptContent, {
        includeElements: true,
        elementType: 'scenes'
      });

      // Validate content
      if (!validateContent(processedScript.content)) {
        return getErrorResponse(
          'I couldn\'t find enough script content to identify scenes. Please provide more content or start with a basic story outline.',
          'error_response'
        );
      }

      // Get existing scenes if any
      const existingScenes = processedScript.elements.scenes || [];

      // Format the prompt
      const fallbackPrompt = [{
        role: 'system',
        content: 'You are a skilled script editor specializing in scene structure and dramatic flow.'
      },
      {
        role: 'user',
        content: `Please identify key scenes for this script:\n\n${processedScript.content}`
      }
      ];

      const formattedPrompt = await handlePromptFormatting(
        promptManager,
        'sceneList', {
          content: processedScript.content,
          existingScenes: existingScenes.length > 0 ?
            existingScenes.map(s => s.content).join('\n') : 'No existing scenes found',
          focus: prompt || 'Identify key scenes that drive the story forward'
        },
        fallbackPrompt
      );

      // Execute the chain
      const response = await this.execute(formattedPrompt);

      try {
        // Validate the scene list format
        return await this.validateSceneList(response);
      } catch (validationError) {
        console.error('Scene list validation failed:', validationError);
        return getErrorResponse(
          'I couldn\'t validate the scene list output. Please try again.',
          'error_response'
        );
      }
    } catch (error) {
      console.error('Scene list generation error:', error);
      return getErrorResponse(
        'I\'m sorry, I encountered an error identifying scenes. Please try again with a more detailed script or outline.',
        'error_response'
      );
    }
  }
}
