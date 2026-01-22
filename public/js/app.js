/**
 * App - Simplified main application using clean architecture
 * Under 300 lines, focused on orchestrating the application
 */
import { CommandBus } from './application/Commands/CommandBus.js';
import { QueryBus } from './application/Queries/QueryBus.js';
import { AppController } from './core/AppController.js';
import { ChatController } from './presentation/Chat/ChatController.js';
import { EditorController } from './presentation/Editor/EditorController.js';

/**
 *
 */
export class App {
    /**
     *
     */
    constructor () {
        this.appController = new AppController();
        this.commandBus = new CommandBus();
        this.queryBus = new QueryBus();
        this.isInitialized = false;
    }

    /**
     * Initialize the application
     */
    async init () {
        if (this.isInitialized) return;

        const startTime = performance.now();

        try {
            await this.setupCoreSystems();
            await this.setupControllers();

            const endTime = performance.now();

            this.isInitialized = true;
        } catch (error) {
            console.error('ƒ?O Failed to initialize ScriptPal:', error);
            throw error;
        }
    }

    /**
     * Setup core systems
     */
    async setupCoreSystems () {
        this.registerCommandHandlers();
        this.registerQueryHandlers();
    }

    /**
     * Setup controllers
     */
    async setupControllers () {

        const editorController = new EditorController();
        const chatController = new ChatController();

        this.appController.addController('editor', editorController);
        this.appController.addController('chat', chatController);

        this.appController.setActiveView('editor');

    }

    /**
     * Register command handlers
     */
    registerCommandHandlers () {
    }

    /**
     * Register query handlers
     */
    registerQueryHandlers () {
    }

    /**
     * Execute a command
     * @param command
     */
    async executeCommand (command) {
        return await this.commandBus.execute(command);
    }

    /**
     * Execute a query
     * @param query
     */
    async executeQuery (query) {
        return await this.queryBus.execute(query);
    }

    /**
     * Destroy the application
     */
    destroy () {
        if (this.appController) {
            this.appController.destroy();
        }
        this.isInitialized = false;
    }
}
