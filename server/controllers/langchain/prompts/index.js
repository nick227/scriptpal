import { inspirationTemplate } from './templates/inspirationPrompt.js';
import { scriptAnalysisTemplate } from './templates/scriptAnalysisPrompt.js';
import { scriptQuestionsTemplate } from './templates/scriptQuestionsPrompt.js';
import { writeScriptTemplate } from './templates/writeScriptTemplate.js';
import { INTENT_TYPES } from '../constants.js';

/**
 * Manages prompt templates for different script analysis and generation tasks.
 * Provides a centralized way to register, format, and retrieve prompt templates.
 */
class PromptManager {
  constructor() {
    this.templates = new Map();
    this.registerDefaultTemplates();
  }

  /**
     * Registers the default set of prompt templates
     */
  registerDefaultTemplates() {
    this.registerTemplate(INTENT_TYPES.GET_INSPIRATION, inspirationTemplate);
    this.registerTemplate(INTENT_TYPES.ANALYZE_SCRIPT, scriptAnalysisTemplate);
    this.registerTemplate(INTENT_TYPES.SCRIPT_QUESTIONS, scriptQuestionsTemplate);
    this.registerTemplate(INTENT_TYPES.WRITE_SCRIPT, writeScriptTemplate);
  }

  /**
     * Registers a new prompt template
     * @param {string} name - The name/key for the template
     * @param {PromptTemplate} template - The prompt template instance
     */
  registerTemplate(name, template) {
    this.templates.set(name, template);
  }

  /**
     * Formats a prompt template with the provided variables
     * @param {string} templateName - The name of the template to format
     * @param {Object} variables - Variables to inject into the template
     * @returns {Promise<string>} The formatted prompt
     */
  async formatPrompt(templateName, variables) {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }
    return await template.format(variables);
  }

  /**
     * Retrieves a prompt template by name
     * @param {string} name - The name of the template to retrieve
     * @returns {PromptTemplate|undefined} The prompt template if found
     */
  getTemplate(name) {
    return this.templates.get(name);
  }

  getPrompt(name) {
    const template = this.getTemplate(name);
    if (!template) {
      throw new Error(`Template ${name} not found`);
    }
    return template.template;
  }
}
// Export singleton instance
export const promptManager = new PromptManager();
