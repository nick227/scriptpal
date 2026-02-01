export class ScriptAIService {
  constructor(aiClient) {
    this.aiClient = aiClient;
  }

  analyzeScript(scriptContent, options = {}) {
    const messages = [
      {
        role: 'system',
        content: `You are a script analysis AI. Analyze the provided script and provide insights about:
                - Character development
                - Plot structure
                - Dialogue quality
                - Pacing and flow
                - Overall strengths and areas for improvement
                
                Provide a structured analysis in JSON format.`
      },
      {
        role: 'user',
        content: `Please analyze this script:\n\n${scriptContent}`
      }
    ];

    return this.aiClient.generateCompletion({ messages }, options);
  }

  generateSuggestions(scriptContent, prompt, options = {}) {
    const messages = [
      {
        role: 'system',
        content: `You are a creative writing assistant. Based on the current script and user request, provide helpful suggestions for improvement. Focus on:
                - Character development
                - Plot advancement
                - Dialogue enhancement
                - Scene structure
                - Creative alternatives
                
                Provide specific, actionable suggestions.`
      },
      {
        role: 'user',
        content: `Current script:\n${scriptContent}\n\nUser request: ${prompt}`
      }
    ];

    return this.aiClient.generateCompletion({ messages }, options);
  }

  generateEdits(scriptContent, editRequest, options = {}) {
    const messages = [
      {
        role: 'system',
        content: `You are a script editor. Based on the current script and edit request, provide specific line-by-line edits. Return the edits in a structured format with:
                - Line numbers
                - Current content
                - Suggested changes
                - Reasoning for changes
                
                Focus on improving clarity, flow, and impact.`
      },
      {
        role: 'user',
        content: `Current script:\n${scriptContent}\n\nEdit request: ${editRequest}`
      }
    ];

    return this.aiClient.generateCompletion({ messages }, options);
  }
}
