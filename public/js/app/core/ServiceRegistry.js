export class ServiceRegistry {
    #services = new Map();

    register (name, instance) {
        this.#services.set(name, instance);
    }

    get (name) {
        return this.#services.get(name);
    }

    has (name) {
        return this.#services.has(name);
    }
}
