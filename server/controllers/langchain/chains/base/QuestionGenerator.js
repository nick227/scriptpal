import { ai } from '../../../../lib/ai.js';
import { ChainHelper } from '../helpers/ChainHelper.js';

export class QuestionGenerator {
  constructor() {
    // No model instantiation needed - usage of global ai singleton
  }

  parseJsonResponse(response) {
    try {
      // First try parsing as is
      try {
        return JSON.parse(response);
      } catch {
        // If that fails, try cleaning markdown formatting
        const cleaned = response.replace(/```json\n|\n```|```/g, '').trim();
        return JSON.parse(cleaned);
      }
    } catch (error) {
      console.error('Failed to parse JSON response:', error);
      return null;
    }
  }

  async generateQuestions(context, prompt, responseContent) {
    try {
      const systemTemplate =
                `You are a helpful AI that generates follow-up prompts. 
                
                Generate 4 contextual follow-up prompts that predict what the user might want to explore next.

                Mix of questions and instructions.

                So for example:
                - Question: What is the main character's motivation?
                - Instruction: Add a new character.

Guidelines for prompts:
- Natural conversation continuations
- Mix of questions and instructions
- Under 15 words each
- Specific to current context
- Reference previous details
- Help gather missing information
- Avoid generic instructions

Your response must be a valid JSON object with a "prompts" array containing exactly 4 strings.`;

      const humanMessage =
                `Context:
Script Title: ${context.scriptTitle || 'Untitled'}
Last Message: ${prompt}
Previous Response: ${responseContent}

Generate 4 follow-up prompts based on this context.`;

      console.log('Making completion request for questions...');

      // Execute via AIClient
      const result = await ai.generateCompletion({
        model: 'gpt-4-turbo-preview',
        temperature: 0.8,
        max_tokens: 500,
        response_format: { type: 'json_object' }, // Enforce JSON
        messages: [
          { role: 'system', content: systemTemplate },
          { role: 'user', content: humanMessage }
        ]
      });

      if (!result.success) {
        console.warn('Question generation failed at API level:', result.error);
        return ChainHelper.getDefaultQuestions().map(q => ({ text: q }));
      }

      const content = result.data.choices[0].message.content;

      // Parse the response content
      const parsed = this.parseJsonResponse(content);
      if (!parsed || !parsed.prompts || !Array.isArray(parsed.prompts)) {
        console.warn('Invalid prompts array returned:', content);
        return ChainHelper.getDefaultQuestions().map(q => ({ text: q }));
      }

      const cleanedPrompts = parsed.prompts
        .map(p => typeof p === 'string' ? p.trim() : null)
        .filter(p => p && p.length > 0 && p.split(' ').length <= 15)
        .map(p => ({ text: p }));

      if (cleanedPrompts.length < 4) {
        console.warn('Not enough valid prompts after cleaning:', cleanedPrompts);
        return ChainHelper.getDefaultQuestions().map(q => ({ text: q }));
      }

      const finalPrompts = cleanedPrompts.slice(0, 4);
      console.log('Successfully generated 4 valid follow-up prompts:', finalPrompts);
      return finalPrompts;

    } catch (error) {
      console.error('Question generation error:', error);
      return ChainHelper.getDefaultQuestions().map(q => ({ text: q }));
    }
  }
}
