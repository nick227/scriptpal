import { CHAIN_CONFIG, ERROR_TYPES, COMMON_PROMPT_INSTRUCTIONS } from '../../constants.js';
import chatMessageRepository from '../../../../repositories/chatMessageRepository.js';
import { ai } from '../../../../lib/ai.js';
import { getDefaultQuestions } from '../helpers/ChainInputUtils.js';
import { QuestionGenerator } from './QuestionGenerator.js';

export class BaseChain {
  constructor(config) {
    if (!config || !config.type) {
      throw new Error('Chain configuration must include type');
    }

    const {
      type,
      temperature = 0.7,
      modelConfig = {},
      applyCommonInstructions = true
    } = config;
    this.type = type;
    this.temperature = temperature;
    this.applyCommonInstructions = applyCommonInstructions;
    this.enablePromptHistory = false;

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
        const rows = await chatMessageRepository.listByUser(
          context.userId,
          context.scriptId ?? null,
          3,
          0
        );
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
      const prefixMarker = COMMON_PROMPT_INSTRUCTIONS.SYSTEM_PREFIX.trim();
      const formatMarker = COMMON_PROMPT_INSTRUCTIONS.RESPONSE_GUIDELINES.FORMAT.trim();
      let content = systemMessage.content || '';
      if (!content.includes(prefixMarker)) {
        content = `${COMMON_PROMPT_INSTRUCTIONS.SYSTEM_PREFIX}\n\n${content}`;
      }
      if (!content.includes(formatMarker)) {
        content = `${content}\n\n${formatMarker}`;
      }
      systemMessage.content = content;
    } else {
      messages.unshift({
        role: 'system',
        content: COMMON_PROMPT_INSTRUCTIONS.SYSTEM_PREFIX
      });
    }
    return messages;
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

  createResponse(content, context, questions = null, extraMetadata = {}) {
    const response = {
      response: content,
      type: this.type,
      metadata: {
        ...this.extractMetadata(context, ['scriptId', 'scriptTitle']),
        timestamp: new Date().toISOString(),
        ...extraMetadata
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
      const ctx = {
        ...metadata,
        ...this.extractMetadata(metadata, ['scriptId', 'scriptTitle', 'userId', 'intent'])
      };
      console.log('BaseChain.execute starting...', {
        chain: this.type,
        chatRequestId: ctx.chatRequestId
      });
      const processedMessages = this.applyCommonInstructions
        ? this.addCommonInstructions(messages)
        : (Array.isArray(messages) ? messages : [messages]);

      const lastMessage = messages[messages.length - 1];
      const constructedPrompt = lastMessage ? lastMessage.content : '';
      const userPromptToSave = metadata?.originalUserPrompt ?? metadata?.prompt ?? constructedPrompt;

      const allMessages = await Promise.race([
        this.buildMessageChain(processedMessages, ctx),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Message chain build timeout')), 5000);
        })
      ]).catch(error => {
        console.warn('Message chain build failed or timed out:', error);
        return processedMessages;
      });

      console.log('[BaseChain] prepared messages', {
        count: allMessages.length,
        preview: allMessages.map(m => ({
          role: m.role,
          content: typeof m.content === 'string'
            ? m.content
            : undefined,
          function_call: m.function_call
        }))
      });

      if (!allMessages.length) {
        throw new Error('No messages to send to model');
      }

      console.log('Making API call via AIClient...', {
        chain: this.type,
        chatRequestId: ctx.chatRequestId
      });
      const chainConfig = ctx.chainConfig || {};
      const modelConfig = chainConfig.modelConfig || {};

      const completionParams = {
        messages: allMessages,
        ...this.config,
        ...modelConfig
      };
      const completionOptions = {
        chatRequestId: ctx.chatRequestId
      };

      const result = await ai.generateCompletion(completionParams, completionOptions);

      if (!result.success) {
        console.error('AIClient completion failed:', result.error);
        throw new Error(`API call failed: ${result.error.message}`);
      }

      console.log('AIClient call successful', {
        chain: this.type,
        chatRequestId: ctx.chatRequestId
      });
      console.log('[BaseChain] raw AI output', {
        choice: result.data.choices?.[0]
      });
      const aiMessage = result.data.choices?.[0]?.message || {};
      const isFunctionCall = Boolean(aiMessage.function_call);
      const responseContent = isFunctionCall
        ? JSON.stringify(aiMessage.function_call.arguments || {})
        : (aiMessage.content || '');
      const usage = result.data.usage || {};
      const aiUsage = {
        promptTokens: Number(usage.prompt_tokens ?? 0),
        completionTokens: Number(usage.completion_tokens ?? 0),
        totalTokens: Number(usage.total_tokens ?? (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0)),
        costUsd: Number(result.metrics?.cost ?? 0),
        responseTime: Number(result.metrics?.responseTime ?? 0)
      };

      const shouldPersist = chainConfig.persistResponse !== false;
      let loggedUsage = false;
      if (shouldPersist && ctx?.userId && !isFunctionCall) {
        try {
          await chatMessageRepository.create({
            userId: ctx.userId,
            scriptId: ctx.scriptId ?? null,
            role: 'assistant',
            content: responseContent,
            intent: ctx.intent ?? null,
            metadata: {
              userPrompt: userPromptToSave,
              chainType: this.type
            },
            promptTokens: aiUsage.promptTokens,
            completionTokens: aiUsage.completionTokens,
            totalTokens: aiUsage.totalTokens,
            costUsd: aiUsage.costUsd
          });
          loggedUsage = true;
        } catch (error) {
          console.error('[BaseChain] Failed to log chat usage', error);
        }
      }

      if (loggedUsage) {
        aiUsage.loggedByBaseChain = true;
      }

      const buildChainResponse = (content, questions = null) => {
        const payload = this.createResponse(content, ctx, questions, { aiUsage });
        payload.aiMessage = aiMessage;
        payload.raw = result;
        if (isFunctionCall && shouldPersist && ctx?.userId) {
          payload._persistContext = {
            userId: ctx.userId,
            scriptId: ctx.scriptId ?? null,
            intent: ctx.intent ?? null,
            userPrompt: userPromptToSave,
            aiUsage
          };
        }
        return payload;
      };

      if (!shouldGenerateQuestions || chainConfig.shouldGenerateQuestions === false) {
        return buildChainResponse(responseContent);
      }

      try {
        const questions = await this.questionGenerator.generateQuestions(
          ctx,
          constructedPrompt,
          responseContent
        );
        return buildChainResponse(responseContent, questions);
      } catch (error) {
        return buildChainResponse(responseContent, this.getDefaultQuestions());
      }
    } catch (error) {
      console.error('Chain execution error:', error);
      throw error;
    }
  }

  persistAssistantMessage(rawResponse, displayContent) {
    const ctx = rawResponse?._persistContext;
    if (!ctx?.userId || !displayContent) return;
    const { userId, scriptId, intent, userPrompt, aiUsage } = ctx;
    chatMessageRepository.create({
      userId,
      scriptId,
      role: 'assistant',
      content: typeof displayContent === 'string' ? displayContent : String(displayContent),
      intent,
      metadata: { userPrompt, chainType: this.type },
      promptTokens: aiUsage?.promptTokens ?? 0,
      completionTokens: aiUsage?.completionTokens ?? 0,
      totalTokens: aiUsage?.totalTokens ?? 0,
      costUsd: aiUsage?.costUsd ?? 0
    }).catch((err) => console.error('[BaseChain] persistAssistantMessage failed', err));
  }

  /** Mark aiUsage as logged so HistoryManager.saveInteraction skips. Call after persistAssistantMessage. */
  attachPersistedFlag(result, rawResponse) {
    const aiUsage = rawResponse?.metadata?.aiUsage ?? rawResponse?._persistContext?.aiUsage;
    if (aiUsage) {
      aiUsage.loggedByBaseChain = true;
      if (result.metadata) {
        result.metadata.aiUsage = aiUsage;
      } else {
        result.aiUsage = aiUsage;
      }
    }
    return result;
  }

  async buildMessageChain(currentMessages, context) {
    try {
      if (!Array.isArray(currentMessages)) currentMessages = [currentMessages];
      const shouldUsePromptHistory = this.enablePromptHistory && context.userId && !context.disableHistory;
      const history = shouldUsePromptHistory ? await this.getChatHistory(context) : [];

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

  ensureCanonicalResponse(result) {
    if (!result || typeof result !== 'object') {
      throw new Error('Chain must return canonical response shape');
    }
    const { message, script, metadata } = result;
    if (
      typeof message !== 'string' ||
      typeof script !== 'string' ||
      !metadata ||
      typeof metadata !== 'object'
    ) {
      throw new Error('Chain must return canonical response shape');
    }
    return Object.freeze(result);
  }

  extractMessage(response) {
    if (response?.aiMessage) {
      return response.aiMessage;
    }
    return response;
  }

  getPayloadText(message) {
    if (typeof message === 'string') {
      return message;
    }
    return message?.function_call?.arguments || message?.content || '';
  }

  safeParseJson(value) {
    if (!value) {
      return null;
    }
    if (typeof value === 'object') {
      return value;
    }
    try {
      return JSON.parse(value);
    } catch {
      const start = value.indexOf('{');
      const end = value.lastIndexOf('}');
      if (start !== -1 && end > start) {
        try {
          return JSON.parse(value.slice(start, end + 1));
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  expectsFunctionCall(schema) {
    return Boolean(schema?.required?.length);
  }

  parseFunctionPayload(response, schema, errorMessage = 'Invalid JSON payload from function call') {
    const message = this.extractMessage(response);
    const payloadText = this.getPayloadText(message);
    let parsed = typeof payloadText === 'object'
      ? payloadText
      : this.safeParseJson(payloadText);

    const functionCallArgs =
      response?.aiMessage?.function_call?.arguments ??
      response?.function_call?.arguments;

    if (!parsed && functionCallArgs) {
      parsed = this.safeParseJson(functionCallArgs);
    }

    if (this.expectsFunctionCall(schema) && !message?.function_call) {
      if (!parsed) {
        const rawArgs = payloadText;
        let lengthInfo = 0;
        if (typeof rawArgs === 'string') {
          lengthInfo = rawArgs.length;
        } else if (rawArgs) {
          try {
            lengthInfo = JSON.stringify(rawArgs).length;
          } catch {
            lengthInfo = 0;
          }
        }
        console.warn(`[${this.type}] parseFunctionPayload failed (length=${lengthInfo})`, rawArgs);
        throw new Error(`[${this.type}] function_call missing despite schema expectation`);
      }
      console.warn(`[${this.type}] function_call missing despite schema expectation; parsed inline JSON payload`);
    }

    if (!parsed) {
      const rawArgs = functionCallArgs ?? payloadText;
      let lengthInfo = 0;
      if (typeof rawArgs === 'string') {
        lengthInfo = rawArgs.length;
      } else if (rawArgs) {
        try {
          lengthInfo = JSON.stringify(rawArgs).length;
        } catch {
          lengthInfo = 0;
        }
      }
      console.warn(`[${this.type}] parseFunctionPayload failed (length=${lengthInfo})`, rawArgs);
      throw new Error(`[${this.type}] ${errorMessage}`);
    }
    if (parsed && typeof parsed !== 'object') {
      throw new Error(`[${this.type}] Parsed payload is not an object`);
    }
    if (schema?.required) {
      for (const field of schema.required) {
        if (!(field in parsed)) {
          throw new Error(ERROR_TYPES.MISSING_REQUIRED);
        }
      }
    }
    return parsed;
  }

  resolveQuestions(response) {
    if (response && Array.isArray(response.questions) && response.questions.length > 0) {
      return response.questions;
    }
    return this.getDefaultQuestions();
  }

  getDefaultQuestions() {
    return getDefaultQuestions();
  }
}
