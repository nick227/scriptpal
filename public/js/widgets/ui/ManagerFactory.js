import { EventManager } from '../../core/EventManager.js';
import { RendererFactory } from '../../renderers.js';

import { AuthUIManager } from './AuthUIManager.js';
import { LoadingManager } from './LoadingManager.js';
import { NavigationManager } from './NavigationManager.js';
import { ViewManager } from './ViewManager.js';

/**
 *
 */
export class ManagerFactory {
    /**
     *
     * @param elements
     * @param dependencies
     */
    static createManagers (elements, dependencies) {
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
