import { ChatOpenAI as _ChatOpenAI } from '@langchain/openai';
import { CHAIN_CONFIG, ERROR_TYPES, COMMON_PROMPT_INSTRUCTIONS } from '../../constants.js';
import chatMessageRepository from '../../../../repositories/chatMessageRepository.js';
import { ai } from '../../../../lib/ai.js';
import { ChainHelper } from '../helpers/ChainHelper.js';
import { QuestionGenerator } from './QuestionGenerator.js';
import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from '@langchain/core/prompts';

export class BaseChain {
  constructor(config) {
    if (!config || !config.type) {
      throw new Error('Chain configuration must include type');
    }

    const { type, temperature = 0.7, modelConfig = {} } = config;
    this.type = type;
    this.temperature = temperature;

    // Merge configurations once
    this.config = {
      ...CHAIN_CONFIG,
      ...modelConfig,
      temperature: temperature
    };

    // Initialize question generator
    this.questionGenerator = new QuestionGenerator();
  }

  validateMessage(msg, source = 'unknown') {
    try {
      if (!msg || typeof msg !== 'object') {
        console.warn(`Invalid message format from ${source}:`, msg);
        return null;
      }

      const validRoles = ['user', 'assistant', 'system'];
      if (!validRoles.includes(msg.role)) {
        console.warn(`Invalid role "${msg.role}" from ${source}, defaulting to user`);
        msg.role = 'user';
      }

      if (typeof msg.content !== 'string') {
        if (msg.content === null || msg.content === undefined) {
          console.warn(`Empty content from ${source}, skipping message`);
          return null;
        }
        msg.content = String(msg.content);
      }

      msg.content = msg.content.trim();
      if (msg.content.length === 0) {
        console.warn(`Empty content after trimming from ${source}, skipping message`);
        return null;
      }

      return msg;
    } catch (error) {
      console.error(`Error validating message from ${source}:`, error);
      return null;
    }
  }

  async getChatHistory(context) {
    try {
      if (!context || !context.userId) return [];

      try {
        const rows = await chatMessageRepository.listByUser(context.userId, null, 3, 0);
        return rows.reverse()
          .flatMap(row => {
            if (!row || typeof row !== 'object') return [];
            const messages = [];
            if (row.role === 'assistant') {
              if (row.metadata && row.metadata.userPrompt) {
                messages.push(this.validateMessage({
                  role: 'user',
                  content: String(row.metadata.userPrompt || '')
                }, 'chat_messages'));
              }
              if (row.content) {
                messages.push(this.validateMessage({
                  role: 'assistant',
                  content: String(row.content || '')
                }, 'chat_messages'));
              }
              return messages;
            }

            if (row.content) {
              messages.push(this.validateMessage({
                role: 'user',
                content: String(row.content || '')
              }, 'chat_messages'));
            }
            return messages;
          })
          .filter(Boolean);
      } catch (dbError) {
        console.error('Database error fetching chat messages:', dbError);
        return [];
      }
    } catch (error) {
      console.error('Error in getChatHistory:', error);
      return [];
    }
  }

  addCommonInstructions(messages) {
    if (typeof messages === 'string') messages = [{ role: 'system', content: messages }];
    if (!Array.isArray(messages)) messages = [messages];

    const systemMessage = messages.find(m => m.role === 'system');
    if (systemMessage) {
      systemMessage.content = `${COMMON_PROMPT_INSTRUCTIONS.SYSTEM_PREFIX}\n\n${systemMessage.content}\n\n${COMMON_PROMPT_INSTRUCTIONS.RESPONSE_GUIDELINES.FORMAT}`;
    } else {
      messages.unshift({
        role: 'system',
        content: COMMON_PROMPT_INSTRUCTIONS.SYSTEM_PREFIX
      });
    }
    return messages;
  }

  validateResponse(response, schema) {
    if (!response) throw new Error(ERROR_TYPES.MISSING_REQUIRED);
    try {
      const parsed = typeof response === 'string' ? JSON.parse(response) : response;
      if (schema.required) {
        for (const field of schema.required) {
          if (!(field in parsed)) throw new Error(`Missing required field: ${field}`);
        }
      }
      return parsed;
    } catch {
      throw new Error(ERROR_TYPES.INVALID_FORMAT);
    }
  }

  extractMetadata(source, fields) {
    const result = {};
    for (const field of fields) {
      result[field] = source[field] ||
                (source.context && source.context[field]) ||
                (source.metadata && source.metadata[field]);
    }
    return result;
  }

  createResponse(content, context, questions = null) {
    const response = {
      response: content,
      type: this.type,
      metadata: {
        ...this.extractMetadata(context, ['scriptId', 'scriptTitle']),
        timestamp: new Date().toISOString()
      }
    };
    if (questions !== null) {
      response.questions = Array.isArray(questions) ? questions : this.getDefaultQuestions();
    }
    return response;
  }

  async run(context, prompt) {
    try {
      const messages = await this.buildMessages(context, prompt);
      const chainConfig = context.chainConfig || {};
      const shouldGenerateQuestions = chainConfig.shouldGenerateQuestions !== undefined ?
        chainConfig.shouldGenerateQuestions : true;

      const enrichedMetadata = {
        ...context,
        ...this.extractMetadata(context, ['scriptId', 'scriptTitle', 'userId']),
        chainConfig,
        modelConfig: this.config
      };

      return this.execute(messages, enrichedMetadata, shouldGenerateQuestions);
    } catch (error) {
      console.error('Error in BaseChain.run:', error);
      throw error;
    }
  }

  async execute(messages, metadata = {}, shouldGenerateQuestions = true) {
    try {
      console.log('BaseChain.execute starting...');
      const processedMessages = this.addCommonInstructions(messages);

      const context = {
        ...metadata,
        ...this.extractMetadata(metadata, ['scriptId', 'scriptTitle', 'userId', 'intent'])
      };

      const lastMessage = messages[messages.length - 1];
      const originalPrompt = lastMessage ? lastMessage.content : '';

      const allMessages = await Promise.race([
        this.buildMessageChain(processedMessages, context),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Message chain build timeout')), 5000);
        })
      ]).catch(error => {
        console.warn('Message chain build failed or timed out:', error);
        return processedMessages;
      });

      console.log('Making API call via AIClient...');
      const chainConfig = context.chainConfig || {};
      const modelConfig = chainConfig.modelConfig || {};

      const completionParams = {
        model: modelConfig.model || this.config.model || 'gpt-4-turbo-preview',
        messages: allMessages,
        temperature: this.temperature,
        max_tokens: 4000,
        ...this.modelConfig,
        ...modelConfig
      };

      const result = await ai.generateCompletion(completionParams);

      if (!result.success) {
        console.error('AIClient completion failed:', result.error);
        throw new Error(`API call failed: ${result.error.message}`);
      }

      console.log('AIClient call successful');
      const responseContent = result.data.choices[0].message.content;

      if (!shouldGenerateQuestions || chainConfig.shouldGenerateQuestions === false) {
        return this.createResponse(responseContent, context);
      }

      try {
        const questions = await this.questionGenerator.generateQuestions(
          context,
          originalPrompt,
          responseContent
        );
        return this.createResponse(responseContent, context, questions);
      } catch (error) {
        return this.createResponse(responseContent, context, this.getDefaultQuestions());
      }
    } catch (error) {
      console.error('Chain execution error:', error);
      throw error;
    }
  }

  async buildMessageChain(currentMessages, context) {
    try {
      if (!Array.isArray(currentMessages)) currentMessages = [currentMessages];
      const history = (context.userId && !context.disableHistory) ?
        await this.getChatHistory(context) : [];

      const validHistory = history.map(msg => this.validateMessage(msg, 'history')).filter(Boolean);
      const validCurrentMessages = currentMessages.map(msg => this.validateMessage(msg, 'current')).filter(Boolean);

      const systemMessages = validCurrentMessages.filter(m => m.role === 'system');
      const nonSystemMessages = validCurrentMessages.filter(m => m.role !== 'system');

      return [...systemMessages, ...validHistory, ...nonSystemMessages];
    } catch (error) {
      console.error('Error building message chain:', error);
      return currentMessages.map(msg => this.validateMessage(msg, 'fallback')).filter(Boolean);
    }
  }

  buildMessages(_context, _prompt) {
    throw new Error('buildMessages() must be implemented by chain class');
  }

  formatResponse(response) {
    return response;
  }

  getDefaultQuestions() {
    return ChainHelper.getDefaultQuestions();
  }
}
