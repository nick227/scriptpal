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

export class NarrativeAnalyzerChain extends BaseChain {
  constructor(config = {}) {
    super({
      ...config,
      temperature: 0.5 // Lower temperature for more analytical responses
    });
  }

  validateAnalysis(result) {
    return validateStructuredResponseStrict(result, {
      requiredFields: [
        'narrative_analysis',
        'character_analysis',
        'theme_analysis',
        'pacing_analysis',
        'dialog_analysis',
        'recommendations'
      ],
      requireRationale: true
    });
  }

  async run(input, context = {}) {
    try {
      // Extract context with defaults
      const { scriptId, prompt } = extractContext(context);
      console.log(`Running script analyzer for scriptId: ${scriptId}`);

      // Get script content - could be an object, string, or null
      let scriptContent = input;

      // If input seems to be the prompt instead of the script content
      if (typeof input === 'string' && input.length < 500 && context.prompt) {
        console.log('Input appears to be the prompt, using context as input');
        scriptContent = context.prompt;
      }

      // Process the script
      const processedScript = preprocessScript(scriptContent, {
        includeElements: true,
        elementType: 'analysis'
      });

      // Validate content
      if (!validateContent(processedScript.content)) {
        return getErrorResponse(
          'I couldn\'t find enough script content to analyze. Please provide more content or start with a basic story outline.',
          'error_response'
        );
      }

      // Get existing analysis if any
      const existingAnalysis = processedScript.elements.analysis || [];

      // Format the prompt
      const fallbackPrompt = [{
        role: 'system',
        content: 'You are a skilled script analyst specializing in comprehensive story analysis.'
      },
      {
        role: 'user',
        content: `Please provide a comprehensive analysis of this script:\n\n${processedScript.content}`
      }
      ];

      const formattedPrompt = await handlePromptFormatting(
        promptManager,
        'scriptAnalysis', {
          content: processedScript.content,
          existingAnalysis: existingAnalysis.length > 0 ?
            existingAnalysis.map(a => a.content).join('\n') : 'No existing analysis found',
          focus: prompt || 'Provide a comprehensive analysis of the script'
        },
        fallbackPrompt
      );

      // Execute the chain
      console.log('Executing script analysis chain...');
      const response = await this.execute(formattedPrompt);
      console.log('Script analysis complete, validating format...');

      try {
        // Validate the analysis format
        return await this.validateAnalysis(response);
      } catch (validationError) {
        console.error('Analysis validation failed:', validationError);
        return getErrorResponse(
          'I couldn\'t validate the analysis output. Please try again.',
          'error_response'
        );
      }
    } catch (error) {
      console.error('Script analysis error:', error);
      return getErrorResponse(
        'I\'m sorry, I encountered an error analyzing the script. Please try again with a more detailed script or outline.',
        'error_response'
      );
    }
  }
}
