import { ViewManager } from './ViewManager.js';
import { EventManager } from '../core/EventManager.js';
import { LoadingManager } from './LoadingManager.js';
import { AuthUIManager } from './AuthUIManager.js';
import { RendererFactory } from '../renderers.js';
import { NavigationManager } from './NavigationManager.js';

export class ManagerFactory {
    static createManagers(elements, dependencies) {
        return {
            loading: new LoadingManager(elements),
            auth: new AuthUIManager(elements, dependencies.userRenderer),
            view: new ViewManager(elements),
            events: new EventManager(dependencies.handlers),
            messageRenderer: RendererFactory.createMessageRenderer(elements.messagesContainer, dependencies.chat),
            navigation: new NavigationManager(elements)
        };
    }
}