import userController from './controllers/userController.js';
import scriptController from './controllers/scriptController.js';
import appendPageController from './controllers/appendPageController.js';
import storyElementController from './controllers/storyElementController.js';
import personaController from './controllers/personaController.js';
import systemPromptController from './controllers/systemPromptController.js';
import nextLinesController from './controllers/nextLinesController.js';
import { validateSession, validateUserAccess } from './middleware/auth.js';
import chatController from './controllers/chatController.js';
import publicScriptController from './controllers/publicScriptController.js';

const routes = [

  // Public routes (no auth required)
  {
    path: '/login',
    method: 'post',
    handler: userController.login
  },
  {
    path: '/logout',
    method: 'post',
    handler: userController.logout
  },
  {
    path: '/user',
    method: 'post',
    handler: userController.createUser
  },
  {
    path: '/welcome/buttons',
    method: 'get',
    handler: chatController.getWelcomeButtons
  },
  {
    path: '/public/scripts',
    method: 'get',
    handler: publicScriptController.list
  },
  {
    path: '/public/scripts/slug/:slug',
    method: 'get',
    handler: publicScriptController.getBySlug
  },
  {
    path: '/public/scripts/:id',
    method: 'get',
    handler: publicScriptController.get
  },

  // Protected routes (require auth)
  {
    path: '/chat',
    method: 'post',
    handler: chatController.startChat,
    middleware: [validateSession]
  },
  {
    path: '/chat/messages',
    method: 'get',
    handler: chatController.getChatMessages,
    middleware: [validateSession]
  },
  {
    path: '/chat/messages',
    method: 'post',
    handler: chatController.addChatMessage,
    middleware: [validateSession]
  },
  {
    path: '/chat/messages/:scriptId',
    method: 'delete',
    handler: chatController.clearChatMessages,
    middleware: [validateSession]
  },
  {
    path: '/system-prompts',
    method: 'post',
    handler: systemPromptController.trigger,
    middleware: [validateSession]
  },
  {
    path: '/user/current',
    method: 'get',
    handler: userController.getCurrentUser,
    middleware: [validateSession]
  },
  {
    path: '/user/token-watch',
    method: 'get',
    handler: userController.getTokenWatch,
    middleware: [validateSession]
  },
  {
    path: '/user/:id',
    method: 'get',
    handler: userController.getUser,
    middleware: [validateSession, validateUserAccess]
  },
  {
    path: '/user/:id',
    method: 'put',
    handler: userController.updateUser,
    middleware: [validateSession, validateUserAccess]
  },
  {
    path: '/script/slug/:slug',
    method: 'get',
    handler: scriptController.getScriptBySlug,
    middleware: [validateSession]
  },
  {
    path: '/script/:id',
    method: 'get',
    handler: scriptController.getScript,
    middleware: [validateSession]
  },
  {
    path: '/script',
    method: 'post',
    handler: scriptController.createScript,
    middleware: [validateSession]
  },
  {
    path: '/script',
    method: 'get',
    handler: scriptController.getAllScriptsByUser,
    middleware: [validateSession]
  },
  {
    path: '/script/:id',
    method: 'put',
    handler: scriptController.updateScript,
    middleware: [validateSession]
  },
  {
    path: '/script/:id/append-page',
    method: 'post',
    handler: appendPageController.appendPage,
    middleware: [validateSession]
  },
  {
    path: '/script/:scriptId/next-lines',
    method: 'post',
    handler: nextLinesController.trigger,
    middleware: [validateSession]
  },
  {
    path: '/script/:id',
    method: 'delete',
    handler: scriptController.deleteScript,
    middleware: [validateSession]
  },
  {
    path: '/script/:id/profile',
    method: 'get',
    handler: scriptController.getScriptProfile,
    middleware: [validateSession]
  },
  {
    path: '/script/:id/stats',
    method: 'get',
    handler: scriptController.getScriptStats,
    middleware: [validateSession]
  },
  // Story Elements routes
  {
    path: '/script/:scriptId/elements',
    method: 'get',
    handler: storyElementController.getScriptElements,
    middleware: [validateSession]
  },
  {
    path: '/script/:scriptId/elements',
    method: 'post',
    handler: storyElementController.createElement,
    middleware: [validateSession]
  },
  {
    path: '/element/:id',
    method: 'get',
    handler: storyElementController.getElement,
    middleware: [validateSession]
  },
  {
    path: '/element/:id',
    method: 'put',
    handler: storyElementController.updateElement,
    middleware: [validateSession]
  },
  {
    path: '/element/:id',
    method: 'delete',
    handler: storyElementController.deleteElement,
    middleware: [validateSession]
  },
  // Persona routes
  {
    path: '/script/:scriptId/personas',
    method: 'get',
    handler: personaController.getScriptPersonas,
    middleware: [validateSession]
  },
  {
    path: '/script/:scriptId/personas',
    method: 'post',
    handler: personaController.createPersona,
    middleware: [validateSession]
  },
  {
    path: '/persona/:id',
    method: 'get',
    handler: personaController.getPersona,
    middleware: [validateSession]
  },
  {
    path: '/persona/:id',
    method: 'put',
    handler: personaController.updatePersona,
    middleware: [validateSession]
  },
  {
    path: '/persona/:id',
    method: 'delete',
    handler: personaController.deletePersona,
    middleware: [validateSession]
  }
];

export default routes;
