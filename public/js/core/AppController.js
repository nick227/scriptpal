/**
 * AppController - Owns lifecycle and controller switching
 */
import { EventManager } from './EventManager.js';

/**
 *
 */
export class AppController {
    /**
     *
     */
    constructor () {
        this.controllers = new Map();
        this.currentController = null;
        this.eventManager = new EventManager();
    }

    /**
     * Register a controller
     * @param name
     * @param controller
     */
    addController (name, controller) {
        this.controllers.set(name, controller);
        controller.app = this;
        controller.eventManager = this.eventManager;
    }

    /**
     * Switch active controller
     * @param name
     */
    setActiveView (name) {
        if (this.currentController) {
            this.currentController.exit();
        }

        this.currentController = this.controllers.get(name);
        if (this.currentController) {
            this.currentController.enter();
        }
    }

    /**
     * Shutdown controllers
     */
    destroy () {
        if (this.currentController) {
            this.currentController.exit();
        }
        this.controllers.clear();
    }
}
