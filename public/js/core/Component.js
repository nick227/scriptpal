/**
 * Component - Base class for all game components
 * Follows Single Responsibility Principle
 */
export class Component {
    /**
     *
     * @param name
     */
    constructor (name) {
        this.name = name;
        this.scene = null;
        this.isActive = true;
        this.dependencies = new Set();
    }

    /**
     * Initialize the component
     */
    init () {
        this.onInit();
    }

    /**
     * Update the component
     * @param deltaTime
     */
    update (deltaTime) {
        if (!this.isActive) return;
        this.onUpdate(deltaTime);
    }

    /**
     * Destroy the component
     */
    destroy () {
        this.onDestroy();
        this.scene = null;
    }

    /**
     * Add a dependency
     * @param componentName
     */
    addDependency (componentName) {
        this.dependencies.add(componentName);
    }

    /**
     * Check if dependencies are satisfied
     */
    areDependenciesSatisfied () {
        if (!this.scene) return false;

        for (const dep of this.dependencies) {
            if (!this.scene.getComponent(dep)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Override these methods in subclasses
     */
    onInit () {}
    /**
     *
     * @param deltaTime
     */
    onUpdate (deltaTime) {}
    /**
     *
     */
    onDestroy () {}
}
