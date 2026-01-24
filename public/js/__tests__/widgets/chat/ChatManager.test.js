/**
 * Tests for ChatManager AI Chat Interface
 */

import { MESSAGE_TYPES, ERROR_MESSAGES } from '../../../constants.js';
import { ChatManager } from '../../../widgets/chat/ChatManager.js';
import { StateManager } from '../../../core/StateManager.js';

const defaultScript = { id: 'script-1', title: 'My Script', versionNumber: 1 };
const defaultUser = { id: 'user-1', name: 'Test User' };

describe('Requirement #6: AI Script Discussion', () => {
    let chatManager;
    let mockStateManager;
    let stateStorage;
    let mockApi;
    let mockEventManager;
    let mockElements;
    let mockRenderer;

    beforeEach(() => {
        stateStorage = {
            [StateManager.KEYS.CURRENT_SCRIPT]: { ...defaultScript },
            [StateManager.KEYS.USER]: { ...defaultUser },
            [StateManager.KEYS.CURRENT_SCRIPT_ID]: defaultScript.id,
            [StateManager.KEYS.EDITOR_READY]: true,
            [StateManager.KEYS.LOADING]: false,
            [StateManager.KEYS.ERROR]: null
        };

        mockStateManager = {
            subscribe: jest.fn((key, listener) => {
                if (typeof listener === 'function') {
                    listener(stateStorage[key]);
                }
                return () => {};
            }),
            setState: jest.fn((key, value) => {
                stateStorage[key] = value;
            }),
            getState: jest.fn((key) => stateStorage[key])
        };

        // Create mock API
        mockApi = {
            getChatResponse: jest.fn().mockResolvedValue({
                response: 'Test AI response',
                intent: 'GENERAL'
            })
        };

        // Create mock event manager
        mockEventManager = {
            publish: jest.fn(),
            subscribe: jest.fn().mockReturnValue(() => {})
        };

        // Create mock elements
        mockElements = {
            messagesContainer: document.createElement('div'),
            inputField: document.createElement('input'),
            sendButton: document.createElement('button')
        };

        // Create mock renderer
        mockRenderer = {
            render: jest.fn().mockResolvedValue(true),
            renderButtons: jest.fn(),
            clear: jest.fn(),
            container: mockElements.messagesContainer
        };

        // Create chat manager
        chatManager = new ChatManager(mockStateManager, mockApi, mockEventManager);
    });

    afterEach(() => {
        chatManager.destroy();
    });

    describe('Initialization', () => {
        test('should initialize with required dependencies', () => {
            expect(chatManager.stateManager).toBe(mockStateManager);
            expect(chatManager.api).toBe(mockApi);
            expect(chatManager.eventManager).toBe(mockEventManager);
            expect(chatManager.isProcessing).toBe(false);
        });

        test('should require API and EventManager', () => {
            expect(() => {
                new ChatManager(mockStateManager, null, mockEventManager);
            }).toThrow('API and EventManager are required for ChatManager');

            expect(() => {
                new ChatManager(mockStateManager, mockApi, null);
            }).toThrow('API and EventManager are required for ChatManager');
        });

        test('should initialize with renderer', () => {
            chatManager.initialize(mockElements);
            expect(chatManager.renderer).toBeDefined();
        });
    });

    describe('Requirement #6: AI Script Discussion', () => {
        test('should allow users to discuss the script with AI', async () => {
            const userMessage = 'What do you think about the character development in this script?';

            mockApi.getChatResponse.mockResolvedValue({
                response: 'The character development shows good progression, but I think we could strengthen the emotional arc in the second act.',
                intent: 'ANALYZE_SCRIPT'
            });

            await chatManager.handleSend(userMessage);

            expect(mockApi.getChatResponse).toHaveBeenCalledWith(
                userMessage,
                expect.objectContaining({
                    scriptContent: expect.any(String),
                    scriptTitle: expect.any(String)
                })
            );
        });

        test('should provide context-aware responses about the script', async () => {
            const userMessage = 'How can I improve the dialogue in scene 3?';

            mockApi.getChatResponse.mockResolvedValue({
                response: 'Looking at scene 3, the dialogue could be more natural. Consider adding more subtext and character-specific speech patterns.',
                intent: 'ANALYZE_SCRIPT'
            });

            await chatManager.handleSend(userMessage);

            expect(mockApi.getChatResponse).toHaveBeenCalledWith(
                userMessage,
                expect.objectContaining({
                    scriptContent: expect.any(String),
                    scriptTitle: expect.any(String)
                })
            );
        });

        test('should handle script analysis discussions', async () => {
            const userMessage = 'Analyze the structure of my script';

            mockApi.getChatResponse.mockResolvedValue({
                response: 'Your script follows a three-act structure well. The inciting incident is clear, but the midpoint could use more tension.',
                intent: 'ANALYZE_SCRIPT'
            });

            await chatManager.handleSend(userMessage);

            expect(mockApi.getChatResponse).toHaveBeenCalled();
            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'CHAT:MESSAGE_ADDED',
                expect.objectContaining({
                    message: expect.objectContaining({
                        content: userMessage,
                        type: MESSAGE_TYPES.USER
                    })
                })
            );
        });

        test('should provide creative feedback and suggestions', async () => {
            const userMessage = 'I need help with the ending of my script';

            mockApi.getChatResponse.mockResolvedValue({
                response: 'For a stronger ending, consider tying up the character arcs and providing a satisfying resolution that feels earned.',
                intent: 'GET_INSPIRATION'
            });

            await chatManager.handleSend(userMessage);

            expect(mockApi.getChatResponse).toHaveBeenCalled();
        });

        test('should handle script writing advice discussions', async () => {
            const userMessage = 'How do I write better action lines?';

            mockApi.getChatResponse.mockResolvedValue({
                response: 'Action lines should be concise, visual, and written in present tense. Focus on what the audience can see and hear.',
                intent: 'GENERAL'
            });

            await chatManager.handleSend(userMessage);

            expect(mockApi.getChatResponse).toHaveBeenCalled();
        });

        test('should maintain conversation context across multiple messages', async () => {
            const messages = [
                'What do you think about my main character?',
                'How can I make her more compelling?',
                'What about her relationship with the antagonist?'
            ];

            for (const message of messages) {
                mockApi.getChatResponse.mockResolvedValue({
                    response: `Response to: ${message}`,
                    intent: 'ANALYZE_SCRIPT'
                });

                await chatManager.handleSend(message);
            }

            expect(mockApi.getChatResponse).toHaveBeenCalledTimes(3);
        });

        test('should handle script-specific questions with proper context', async () => {
            const userMessage = 'Is the pacing too slow in the first act?';

            mockApi.getChatResponse.mockResolvedValue({
                response: 'The first act pacing is actually quite good. You establish the world and characters effectively without dragging.',
                intent: 'ANALYZE_SCRIPT'
            });

            await chatManager.handleSend(userMessage);

            // Should include script context in the API call
            expect(mockApi.getChatResponse).toHaveBeenCalledWith(
                userMessage,
                expect.objectContaining({
                    scriptContent: expect.any(String),
                    scriptTitle: expect.any(String)
                })
            );
        });
    });

    describe('Message Processing', () => {
        beforeEach(() => {
            chatManager.initialize(mockElements);
            chatManager.renderer = mockRenderer;
            mockRenderer.render.mockClear();
            mockRenderer.renderButtons.mockClear();
            mockRenderer.clear.mockClear();
        });

        test('should process and render user messages', async () => {
            const message = 'Hello, AI!';

            await chatManager.processAndRenderMessage(message, MESSAGE_TYPES.USER);

            expect(mockRenderer.render).toHaveBeenCalledWith(message, MESSAGE_TYPES.USER);
        });

        test('should process string responses', async () => {
            const response = 'Hello, user!';

            const result = await chatManager.processAndRenderMessage(response, MESSAGE_TYPES.ASSISTANT);

            expect(result).toBe(response);
            expect(mockRenderer.render).toHaveBeenCalledWith(response, MESSAGE_TYPES.ASSISTANT);
        });

        test('should process JSON responses', async () => {
            const jsonResponse = {
                response: 'Hello, user!',
                questions: ['What can I help with?']
            };

            const result = await chatManager.processAndRenderMessage(jsonResponse, MESSAGE_TYPES.ASSISTANT);

            expect(result).toBe('Hello, user!');
            expect(mockRenderer.render).toHaveBeenCalledWith('Hello, user!', MESSAGE_TYPES.ASSISTANT);
        });

        test('should handle malformed JSON gracefully', async () => {
            const malformedJson = '{"response": "Hello, user!"';

            const result = await chatManager.processAndRenderMessage(malformedJson, MESSAGE_TYPES.ASSISTANT);

            expect(result).toBe(malformedJson);
            expect(mockRenderer.render).toHaveBeenCalledWith(malformedJson, MESSAGE_TYPES.ASSISTANT);
        });

        test('should process question buttons', async () => {
            const responseWithQuestions = {
                response: 'Hello, user!',
                questions: ['What can I help with?', 'Need assistance?']
            };

            await chatManager.processAndRenderMessage(responseWithQuestions, MESSAGE_TYPES.ASSISTANT);

            expect(mockRenderer.renderButtons).toHaveBeenCalledWith(['What can I help with?', 'Need assistance?']);
        });

        test('should handle null or undefined responses', async () => {
            const result1 = await chatManager.processAndRenderMessage(null, MESSAGE_TYPES.ASSISTANT);
            const result2 = await chatManager.processAndRenderMessage(undefined, MESSAGE_TYPES.ASSISTANT);

            expect(result1).toBe('');
            expect(result2).toBe('');
        });
    });

    describe('Message Sending', () => {
        beforeEach(() => {
            chatManager.initialize(mockElements);
            chatManager.renderer = mockRenderer;
            mockRenderer.render.mockClear();
            mockRenderer.renderButtons.mockClear();
            mockRenderer.clear.mockClear();
        });

        test('should send message and process response', async () => {
            const message = 'Hello, AI!';
            const apiResponse = {
                response: 'Hello, user!',
                intent: 'GENERAL'
            };

            mockApi.getChatResponse.mockResolvedValue(apiResponse);

            const result = await chatManager.handleSend(message);

            expect(mockApi.getChatResponse).toHaveBeenCalledWith(
                message,
                expect.objectContaining({
                    scriptContent: expect.any(String),
                    scriptTitle: expect.any(String)
                })
            );
            expect(mockRenderer.render).toHaveBeenCalledWith(message, MESSAGE_TYPES.USER);
            expect(mockRenderer.render).toHaveBeenCalledWith('Hello, user!', MESSAGE_TYPES.ASSISTANT);
            expect(mockEventManager.publish).toHaveBeenCalled();
            expect(result).toEqual(apiResponse);
        });

        test('should handle API errors gracefully', async () => {
            const message = 'Hello, AI!';
            const error = new Error('API Error');

            mockApi.getChatResponse.mockRejectedValue(error);

            await expect(chatManager.handleSend(message)).rejects.toThrow('API Error');
            expect(mockRenderer.render).toHaveBeenCalledWith(ERROR_MESSAGES.API_ERROR, MESSAGE_TYPES.ERROR);
        });

        test('should validate message before sending', async () => {
            // Test invalid messages
            await expect(chatManager.handleSend(null)).resolves.toBeNull();
            await expect(chatManager.handleSend('')).resolves.toBeNull();
            await expect(chatManager.handleSend(123)).resolves.toBeNull();

            expect(mockApi.getChatResponse).not.toHaveBeenCalled();
        });

        test('should prevent concurrent message processing', async () => {
            const message = 'Hello, AI!';

            // Start first message
            const firstPromise = chatManager.handleSend(message);

            // Try to send second message while first is processing
            const secondPromise = chatManager.handleSend('Second message');

            await expect(secondPromise).resolves.toBeNull();
            await firstPromise;
        });

        test('should handle script edit intent', async () => {
            const message = 'Edit my script';
            const apiResponse = {
                response: {
                    response: 'Script edited',
                    content: '<script><action>New content</action></script>',
                    version_number: 2
                },
                intent: 'EDIT_SCRIPT'
            };

            mockApi.getChatResponse.mockResolvedValue(apiResponse);

            // Mock script orchestrator
            const mockOrchestrator = {
                handleScriptEdit: jest.fn().mockResolvedValue(true)
            };
            chatManager.setScriptOrchestrator(mockOrchestrator);

            await chatManager.handleSend(message);

            expect(mockOrchestrator.handleScriptEdit).toHaveBeenCalledWith({
                content: '<script><action>New content</action></script>',
                isFromEdit: true,
                versionNumber: 2
            });
        });
    });

    describe('Chat History Management', () => {
        beforeEach(() => {
            chatManager.initialize(mockElements);
            chatManager.renderer = mockRenderer;
            mockRenderer.render.mockClear();
            mockRenderer.renderButtons.mockClear();
            mockRenderer.clear.mockClear();
        });

        test('should load chat history', async () => {
            const messages = [
                { content: 'Hello', type: 'user' },
                { content: 'Hi there!', type: 'assistant' }
            ];

            await chatManager.loadChatHistory(messages);

            expect(mockRenderer.clear).toHaveBeenCalled();
            expect(mockRenderer.render).toHaveBeenCalledWith('Hello', MESSAGE_TYPES.USER);
            expect(mockRenderer.render).toHaveBeenCalledWith('Hi there!', MESSAGE_TYPES.ASSISTANT);
        });

        test('should handle empty chat history', async () => {
            await chatManager.loadChatHistory([]);

            expect(mockRenderer.clear).toHaveBeenCalled();
            expect(mockRenderer.render).not.toHaveBeenCalled();
        });

        test('should validate chat history format', async () => {
            await chatManager.loadChatHistory(null);
            await chatManager.loadChatHistory('invalid');

            expect(mockRenderer.clear).not.toHaveBeenCalled();
        });

        test('should determine message types correctly', () => {
            const userMessage = { content: 'Hello', type: 'user' };
            const assistantMessage = { content: 'Hi!', type: 'assistant' };
            const roleMessage = { content: 'Hello', role: 'user' };
            const defaultMessage = { content: 'Hello' };

            expect(chatManager.determineMessageType(userMessage)).toBe(MESSAGE_TYPES.USER);
            expect(chatManager.determineMessageType(assistantMessage)).toBe(MESSAGE_TYPES.ASSISTANT);
            expect(chatManager.determineMessageType(roleMessage)).toBe(MESSAGE_TYPES.USER);
            expect(chatManager.determineMessageType(defaultMessage)).toBe(MESSAGE_TYPES.USER);
        });
    });

    describe('Script Change Handling', () => {
        beforeEach(() => {
            chatManager.initialize(mockElements);
            chatManager.renderer = mockRenderer;
            mockRenderer.render.mockClear();
            mockRenderer.renderButtons.mockClear();
            mockRenderer.clear.mockClear();
        });

        test('should handle script changes', () => {
            const script = { id: 'script-1', title: 'My Script' };

            chatManager.handleScriptChange(script);

            expect(mockRenderer.render).toHaveBeenCalledWith('Now chatting about: My Script', MESSAGE_TYPES.ASSISTANT);
        });

        test('should not add title message for same script', () => {
            const script = { id: 'script-1', title: 'My Script' };

            // Keep the current script in state and mark it as selected
            stateStorage[StateManager.KEYS.CURRENT_SCRIPT] = script;
            chatManager.currentScriptId = script.id;

            chatManager.handleScriptChange(script);

            expect(mockRenderer.render).not.toHaveBeenCalled();
        });

        test('should handle null script gracefully', () => {
            chatManager.handleScriptChange(null);

            expect(mockRenderer.render).not.toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            chatManager.initialize(mockElements);
            chatManager.renderer = mockRenderer;
            mockRenderer.render.mockClear();
            mockRenderer.renderButtons.mockClear();
            mockRenderer.clear.mockClear();
        });

        test('should handle renderer errors gracefully', async () => {
            const message = 'Hello, AI!';
            const renderError = new Error('Renderer error');

            mockRenderer.render.mockRejectedValue(renderError);

            const result = await chatManager.processAndRenderMessage(message, MESSAGE_TYPES.USER);

            expect(result).toBe(message);
            expect(mockStateManager.setState).toHaveBeenCalledWith('error', {
                context: 'renderMessage',
                error: 'Renderer error'
            });
        });

        test('should handle API timeout errors', async () => {
            const message = 'Hello, AI!';
            const timeoutError = new Error('Request timeout');

            mockApi.getChatResponse.mockRejectedValue(timeoutError);

            await expect(chatManager.handleSend(message)).rejects.toThrow('Request timeout');
            expect(mockRenderer.render).toHaveBeenCalledWith(ERROR_MESSAGES.API_ERROR, MESSAGE_TYPES.ERROR);
        });

        test('should handle network errors', async () => {
            const message = 'Hello, AI!';
            const networkError = new Error('Network error');

            mockApi.getChatResponse.mockRejectedValue(networkError);

            await expect(chatManager.handleSend(message)).rejects.toThrow('Network error');
            expect(mockRenderer.render).toHaveBeenCalledWith(ERROR_MESSAGES.API_ERROR, MESSAGE_TYPES.ERROR);
        });
    });

    describe('State Management', () => {
        beforeEach(() => {
            chatManager.initialize(mockElements);
            chatManager.renderer = mockRenderer;
            mockRenderer.render.mockClear();
            mockRenderer.renderButtons.mockClear();
            mockRenderer.clear.mockClear();
        });

        test('should set loading state during message processing', async () => {
            const message = 'Hello, AI!';

            mockApi.getChatResponse.mockImplementation(async () => {
                // Check loading state is set
                expect(mockStateManager.setState).toHaveBeenCalledWith('loading', true);
                return { response: 'Hello, user!' };
            });

            await chatManager.handleSend(message);

            expect(mockStateManager.setState).toHaveBeenCalledWith('loading', false);
        });

        test('should clear chat when updating', () => {
            const newChat = { api: mockApi };

            chatManager.updateChat(newChat);

            expect(chatManager.api).toBe(mockApi);
            expect(mockRenderer.clear).toHaveBeenCalled();
        });

        test('should handle invalid chat update', () => {
            expect(() => {
                chatManager.updateChat(null);
            }).toThrow('Invalid chat object provided for update');
        });
    });

    describe('Button Handling', () => {
        beforeEach(() => {
            chatManager.initialize(mockElements);
            chatManager.renderer = mockRenderer;
            mockRenderer.render.mockClear();
            mockRenderer.renderButtons.mockClear();
            mockRenderer.clear.mockClear();
        });

        test('should handle button clicks', async () => {
            const buttonText = 'What can you do?';

            mockApi.getChatResponse.mockResolvedValue({ response: 'I can help with scripts!' });

            await chatManager.handleButtonClick(buttonText);

            expect(mockApi.getChatResponse).toHaveBeenCalledWith(
                buttonText,
                expect.objectContaining({
                    scriptContent: expect.any(String),
                    scriptTitle: expect.any(String)
                })
            );
        });

        test('should handle empty button text', () => {
            chatManager.handleButtonClick('');
            chatManager.handleButtonClick(null);

            expect(mockApi.getChatResponse).not.toHaveBeenCalled();
        });
    });

    describe('Cleanup', () => {
        test('should destroy properly', () => {
            chatManager.initialize(mockElements);
            chatManager.renderer = mockRenderer;

            chatManager.destroy();

            expect(mockRenderer.clear).toHaveBeenCalled();
        });
    });
});
