import chatController from '../../../server/controllers/chat/chat.controller.js';
import { INTENT_TYPES } from '../../../server/controllers/langchain/constants.js';
import { APPEND_SCRIPT_INTENT } from '../../../server/controllers/script-services/AppendPageService.js';

jest.mock('../../../server/controllers/langchain/router/index.js', () => ({
  router: {
    route: jest.fn()
  }
}));

jest.mock('../../../server/controllers/script-services/scriptRequestUtils.js', () => ({
  loadScriptOrThrow: jest.fn()
}));

jest.mock('../../../server/controllers/script/context-builder.service.js', () => ({
  buildPromptContext: jest.fn()
}));

jest.mock('../../../server/controllers/chat/response/validation.js', () => ({
  buildValidatedChatResponse: jest.fn()
}));

jest.mock('../../../server/controllers/chat/intent/heuristics.js', () => ({
  isFullScriptRequest: jest.fn().mockReturnValue(false),
  isNextFiveLinesRequest: jest.fn().mockReturnValue(true),
  isAppendPageRequest: jest.fn().mockReturnValue(false)
}));

jest.mock('../../../server/controllers/chat/orchestrator/ConversationCoordinator.js', () => {
  return {
    ConversationCoordinator: jest.fn().mockImplementation(() => ({
      processMessage: jest.fn().mockResolvedValue({
        success: true,
        response: {
          message: 'General chat response'
        }
      })
    }))
  };
});

describe('next five lines chat route', () => {
  const { router } = jest.requireMock('../../../server/controllers/langchain/router/index.js');
  const { loadScriptOrThrow } = jest.requireMock('../../../server/controllers/script-services/scriptRequestUtils.js');
  const { buildPromptContext } = jest.requireMock('../../../server/controllers/script/context-builder.service.js');
  const { buildValidatedChatResponse } = jest.requireMock('../../../server/controllers/chat/response/validation.js');
  const heuristics = jest.requireMock('../../../server/controllers/chat/intent/heuristics.js');
  const { ConversationCoordinator } = jest.requireMock('../../../server/controllers/chat/orchestrator/ConversationCoordinator.js');

  beforeEach(() => {
    jest.clearAllMocks();
    router.route.mockResolvedValue({
      message: 'Line response',
      script: '<action>Line</action>',
      metadata: {
        generationMode: INTENT_TYPES.NEXT_FIVE_LINES
      }
    });
    buildValidatedChatResponse.mockReturnValue({
      valid: true,
      responsePayload: {
        success: true,
        response: {
          message: 'Line response',
          script: '<action>Line</action>',
          metadata: {
            generationMode: INTENT_TYPES.NEXT_FIVE_LINES
          }
        }
      }
    });
    loadScriptOrThrow.mockResolvedValue({
      scriptId: 2,
      script: {
        id: 2,
        title: 'Test Script'
      }
    });
    buildPromptContext.mockResolvedValue({
      scriptTitle: 'Test Script',
      scriptContent: '',
      scriptCollections: []
    });
    ConversationCoordinator.mockClear();
  });

  it('routes next-five-lines prompts to the dedicated handler', async () => {
    const req = {
      body: {
        prompt: 'Write the next five lines continuing this script.',
        context: {}
      },
      userId: 1,
      headers: {}
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await chatController.startChat(req, res);

    expect(router.route).toHaveBeenCalledWith(
      expect.objectContaining({ intent: INTENT_TYPES.NEXT_FIVE_LINES }),
      expect.any(Object),
      expect.any(String)
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      response: expect.objectContaining({
        message: 'Line response'
      })
    });
  });

  it('passes chatRequestId through handler context', async () => {
    const req = {
      body: {
        prompt: 'Write the next five lines.',
        context: {}
      },
      userId: 1,
      headers: {
        'x-correlation-id': 'cid-123'
      }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await chatController.startChat(req, res);

    const handlerContext = router.route.mock.calls[0][1];
    expect(handlerContext.chatRequestId).toBe('cid-123');
  });

  it('routes append-page prompts through append handler', async () => {
    heuristics.isNextFiveLinesRequest.mockReturnValue(false);
    heuristics.isAppendPageRequest.mockReturnValue(true);

    const req = {
      body: {
        prompt: 'Write the next page.',
        context: {}
      },
      userId: 1,
      headers: {}
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await chatController.startChat(req, res);

    expect(router.route).toHaveBeenCalledWith(
      expect.objectContaining({ intent: APPEND_SCRIPT_INTENT }),
      expect.any(Object),
      expect.any(String)
    );
  });

  it('falls back to general chat when no script intent matches', async () => {
    heuristics.isNextFiveLinesRequest.mockReturnValue(false);
    heuristics.isAppendPageRequest.mockReturnValue(false);
    heuristics.isFullScriptRequest.mockReturnValue(false);

    const req = {
      body: {
        prompt: 'Just chat',
        context: {}
      },
      userId: 1,
      headers: {}
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await chatController.startChat(req, res);

    expect(ConversationCoordinator).toHaveBeenCalledWith(1, 2);
    const instance = ConversationCoordinator.mock.results[0].value;
    expect(instance.processMessage).toHaveBeenCalledWith(
      'Just chat',
      expect.objectContaining({ chatRequestId: expect.any(String) })
    );
  });
});
