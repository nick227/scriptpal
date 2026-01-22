import { debugLog } from './logger.js';

/**
 * Controller - Base class for UI controllers
 * Manages lifecycle and component registration
 */
export class Controller {
    /**
     *
     * @param name
     */
    constructor (name) {
        this.name = name;
        this.app = null;
        this.eventManager = null;
        this.components = new Map();
        this.isActive = false;
    }

    /**
     * Enter the controller
     */
    enter () {
        debugLog(`[Controller] Entering ${this.name}`);
        this.isActive = true;
        this.onEnter();
    }

    /**
     * Exit the controller
     */
    exit () {
        debugLog(`[Controller] Exiting ${this.name}`);
        this.isActive = false;
        this.onExit();
    }

    /**
     * Add a component to the controller
     * @param name
     * @param component
     */
    addComponent (name, component) {
        this.components.set(name, component);
        component.controller = this;

        if (component.init) {
            component.init();
        }
    }

    /**
     * Remove a component from the controller
     * @param name
     */
    removeComponent (name) {
        const component = this.components.get(name);
        if (component && component.destroy) {
            component.destroy();
        }
        this.components.delete(name);
    }

    /**
     * Get a component by name
     * @param name
     */
    getComponent (name) {
        return this.components.get(name);
    }

    /**
     * Publish an event
     * @param event
     * @param data
     */
    emit (event, data) {
        if (this.eventManager) {
            this.eventManager.publish(event, data);
        }
    }

    /**
     * Override these methods in subclasses
     */
    onEnter () {}
    /**
     *
     */
    onExit () {}
}
