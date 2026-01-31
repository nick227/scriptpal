import userController from './controllers/userController.js';
import scriptController from './controllers/scriptController.js';
import appendPageController from './controllers/appendPageController.js';
import storyElementController from './controllers/storyElementController.js';
import personaController from './controllers/personaController.js';
import systemPromptController from './controllers/systemPromptController.js';
import nextLinesController from './controllers/nextLinesController.js';
import sceneController from './controllers/sceneController.js';
import characterController from './controllers/characterController.js';
import characterIdeaController from './controllers/characterIdeaController.js';
import locationController from './controllers/locationController.js';
import locationIdeaController from './controllers/locationIdeaController.js';
import themeController from './controllers/themeController.js';
import themeIdeaController from './controllers/themeIdeaController.js';
import brainstormBoardController from './controllers/brainstormBoardController.js';
import brainstormPromptController from './controllers/brainstormPromptController.js';
import { validateSession, validateUserAccess } from './middleware/auth.js';
import { requireScriptOwnership } from './middleware/scriptOwnership.js';
import chatController from './controllers/chatController.js';
import publicScriptController from './controllers/publicScriptController.js';
import publicScriptCommentController from './controllers/publicScriptCommentController.js';

const scriptOwnership = [validateSession, requireScriptOwnership({ getScriptId: (req) => Number(req.params.scriptId) })];

const buildIdeaRoutes = ({ basePath, idParam, ideaSlug, handler }) => ([
  {
    path: `${basePath}/:${idParam}/ai/${ideaSlug}`,
    method: 'post',
    handler,
    middleware: scriptOwnership
  },
  {
    path: `${basePath}/ai/${ideaSlug}`,
    method: 'post',
    handler,
    middleware: scriptOwnership
  }
]);

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
  {
    path: '/public/scripts/:id/comments',
    method: 'get',
    handler: publicScriptCommentController.list,
  },
  {
    path: '/public/scripts/:id/comments',
    method: 'post',
    handler: publicScriptCommentController.create,
    middleware: [validateSession]
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
    middleware: [validateSession, requireScriptOwnership()]
  },
  {
    path: '/chat/messages',
    method: 'post',
    handler: chatController.addChatMessage,
    middleware: [validateSession, requireScriptOwnership()]
  },
  {
    path: '/chat/messages/:scriptId',
    method: 'delete',
    handler: chatController.clearChatMessages,
    middleware: [validateSession, requireScriptOwnership()]
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
    middleware: [validateSession, requireScriptOwnership()]
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
    middleware: [validateSession, requireScriptOwnership()]
  },
  {
    path: '/script/:id/append-page',
    method: 'post',
    handler: appendPageController.appendPage,
    middleware: [validateSession, requireScriptOwnership()]
  },
  {
    path: '/script/:scriptId/next-lines',
    method: 'post',
    handler: nextLinesController.trigger,
    middleware: [validateSession, requireScriptOwnership({ getScriptId: (req) => Number(req.params.scriptId) })]
  },
  {
    path: '/script/:id',
    method: 'delete',
    handler: scriptController.deleteScript,
    middleware: [validateSession, requireScriptOwnership()]
  },
  {
    path: '/script/:id/profile',
    method: 'get',
    handler: scriptController.getScriptProfile,
    middleware: [validateSession, requireScriptOwnership()]
  },
  {
    path: '/script/:id/stats',
    method: 'get',
    handler: scriptController.getScriptStats,
    middleware: [validateSession, requireScriptOwnership()]
  },
  {
    path: '/brainstorm/boards',
    method: 'get',
    handler: brainstormBoardController.list,
    middleware: [validateSession]
  },
  {
    path: '/brainstorm/boards/:id',
    method: 'get',
    handler: brainstormBoardController.get,
    middleware: [validateSession]
  },
  {
    path: '/brainstorm/boards',
    method: 'post',
    handler: brainstormBoardController.create,
    middleware: [validateSession]
  },
  {
    path: '/brainstorm/boards/:id',
    method: 'put',
    handler: brainstormBoardController.update,
    middleware: [validateSession]
  },
  {
    path: '/brainstorm/boards/:id/ai/:category',
    method: 'post',
    handler: brainstormPromptController.trigger,
    middleware: [validateSession]
  },
  // Story Elements routes
  {
    path: '/script/:scriptId/elements',
    method: 'get',
    handler: storyElementController.getScriptElements,
    middleware: [validateSession, requireScriptOwnership({ getScriptId: (req) => Number(req.params.scriptId) })]
  },
  {
    path: '/script/:scriptId/elements',
    method: 'post',
    handler: storyElementController.createElement,
    middleware: [validateSession, requireScriptOwnership({ getScriptId: (req) => Number(req.params.scriptId) })]
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
    middleware: [validateSession, requireScriptOwnership({ getScriptId: (req) => Number(req.params.scriptId) })]
  },
  {
    path: '/script/:scriptId/personas',
    method: 'post',
    handler: personaController.createPersona,
    middleware: [validateSession, requireScriptOwnership({ getScriptId: (req) => Number(req.params.scriptId) })]
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
  },
  // Scene routes
  {
    path: '/script/:scriptId/scenes',
    method: 'get',
    handler: sceneController.getScriptScenes,
    middleware: [validateSession, requireScriptOwnership({ getScriptId: (req) => Number(req.params.scriptId) })]
  },
  {
    path: '/script/:scriptId/scenes',
    method: 'post',
    handler: sceneController.createScene,
    middleware: [validateSession, requireScriptOwnership({ getScriptId: (req) => Number(req.params.scriptId) })]
  },
  {
    path: '/script/:scriptId/scenes/reorder',
    method: 'put',
    handler: sceneController.reorderScenes,
    middleware: [validateSession, requireScriptOwnership({ getScriptId: (req) => Number(req.params.scriptId) })]
  },
  {
    path: '/script/:scriptId/scenes/:sceneId',
    method: 'put',
    handler: sceneController.updateScene,
    middleware: [validateSession, requireScriptOwnership({ getScriptId: (req) => Number(req.params.scriptId) })]
  },
  {
    path: '/script/:scriptId/scenes/:sceneId',
    method: 'delete',
    handler: sceneController.deleteScene,
    middleware: [validateSession, requireScriptOwnership({ getScriptId: (req) => Number(req.params.scriptId) })]
  },
  ...buildIdeaRoutes({
    basePath: '/script/:scriptId/scenes',
    idParam: 'sceneId',
    ideaSlug: 'scene-idea',
    handler: sceneController.generateSceneIdea
  }),
  // Character routes
  {
    path: '/script/:scriptId/characters',
    method: 'get',
    handler: characterController.getScriptItems,
    middleware: [validateSession, requireScriptOwnership({ getScriptId: (req) => Number(req.params.scriptId) })]
  },
  {
    path: '/script/:scriptId/characters',
    method: 'post',
    handler: characterController.createItem,
    middleware: [validateSession, requireScriptOwnership({ getScriptId: (req) => Number(req.params.scriptId) })]
  },
  {
    path: '/script/:scriptId/characters/reorder',
    method: 'put',
    handler: characterController.reorderItems,
    middleware: [validateSession, requireScriptOwnership({ getScriptId: (req) => Number(req.params.scriptId) })]
  },
  {
    path: '/script/:scriptId/characters/:characterId',
    method: 'put',
    handler: characterController.updateItem,
    middleware: [validateSession, requireScriptOwnership({ getScriptId: (req) => Number(req.params.scriptId) })]
  },
  {
    path: '/script/:scriptId/characters/:characterId',
    method: 'delete',
    handler: characterController.deleteItem,
    middleware: [validateSession, requireScriptOwnership({ getScriptId: (req) => Number(req.params.scriptId) })]
  },
  ...buildIdeaRoutes({
    basePath: '/script/:scriptId/characters',
    idParam: 'characterId',
    ideaSlug: 'character-idea',
    handler: characterIdeaController
  }),
  // Location routes
  {
    path: '/script/:scriptId/locations',
    method: 'get',
    handler: locationController.getScriptItems,
    middleware: [validateSession, requireScriptOwnership({ getScriptId: (req) => Number(req.params.scriptId) })]
  },
  {
    path: '/script/:scriptId/locations',
    method: 'post',
    handler: locationController.createItem,
    middleware: [validateSession, requireScriptOwnership({ getScriptId: (req) => Number(req.params.scriptId) })]
  },
  {
    path: '/script/:scriptId/locations/reorder',
    method: 'put',
    handler: locationController.reorderItems,
    middleware: [validateSession, requireScriptOwnership({ getScriptId: (req) => Number(req.params.scriptId) })]
  },
  {
    path: '/script/:scriptId/locations/:locationId',
    method: 'put',
    handler: locationController.updateItem,
    middleware: [validateSession, requireScriptOwnership({ getScriptId: (req) => Number(req.params.scriptId) })]
  },
  {
    path: '/script/:scriptId/locations/:locationId',
    method: 'delete',
    handler: locationController.deleteItem,
    middleware: [validateSession, requireScriptOwnership({ getScriptId: (req) => Number(req.params.scriptId) })]
  },
  ...buildIdeaRoutes({
    basePath: '/script/:scriptId/locations',
    idParam: 'locationId',
    ideaSlug: 'location-idea',
    handler: locationIdeaController
  }),
  // Theme routes
  {
    path: '/script/:scriptId/themes',
    method: 'get',
    handler: themeController.getScriptItems,
    middleware: [validateSession, requireScriptOwnership({ getScriptId: (req) => Number(req.params.scriptId) })]
  },
  {
    path: '/script/:scriptId/themes',
    method: 'post',
    handler: themeController.createItem,
    middleware: [validateSession, requireScriptOwnership({ getScriptId: (req) => Number(req.params.scriptId) })]
  },
  {
    path: '/script/:scriptId/themes/reorder',
    method: 'put',
    handler: themeController.reorderItems,
    middleware: [validateSession, requireScriptOwnership({ getScriptId: (req) => Number(req.params.scriptId) })]
  },
  {
    path: '/script/:scriptId/themes/:themeId',
    method: 'put',
    handler: themeController.updateItem,
    middleware: [validateSession, requireScriptOwnership({ getScriptId: (req) => Number(req.params.scriptId) })]
  },
  {
    path: '/script/:scriptId/themes/:themeId',
    method: 'delete',
    handler: themeController.deleteItem,
    middleware: [validateSession, requireScriptOwnership({ getScriptId: (req) => Number(req.params.scriptId) })]
  },
  ...buildIdeaRoutes({
    basePath: '/script/:scriptId/themes',
    idParam: 'themeId',
    ideaSlug: 'theme-idea',
    handler: themeIdeaController
  })
];

export default routes;
