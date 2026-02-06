import { UI_ELEMENTS } from '../constants.js';
import { AuthWidget } from '../widgets/auth/AuthWidget.js';
import { TokenWatchWidget } from '../widgets/ui/TokenWatchWidget.js';

import { getTopBarElements } from './sharedLayout.js';

export const initAuthWidget = async (api, user, stateManager, eventManager, topBarElements = null) => {
    const sharedElements = topBarElements || getTopBarElements();
    const elements = {
        ...sharedElements,
        messagesContainer: document.querySelector(UI_ELEMENTS.MESSAGES_CONTAINER)
    };

    const requiredKeys = ['formsContainer', 'logoutButton', 'userInfo'];
    const missing = requiredKeys.filter(key => !elements[key]);

    if (missing.length) {
        console.warn('[AuthWidget] Missing elements:', missing);
        return null;
    }

    const authWidget = new AuthWidget(elements, stateManager, user, eventManager);

    await authWidget.initialize(elements);

    window.scriptPalAuth = authWidget;
    return authWidget;
};

export const initTokenWatchWidget = async (container, api, stateManager, eventManager) => {
    if (!container) {
        return null;
    }

    const widget = new TokenWatchWidget({ container }, api, stateManager, eventManager);
    widget.setManagers(stateManager, eventManager);
    await widget.initialize();
    window.scriptPalTokenWatch = widget;
    return widget;
};

export const initSharedTopBarWidgets = async (api, user, stateManager, eventManager, topBarElements = null) => {
    const sharedElements = topBarElements || getTopBarElements();
    const tokenWatchWidget = await initTokenWatchWidget(
        sharedElements.tokenWatchContainer,
        api,
        stateManager,
        eventManager
    );
    const authWidget = await initAuthWidget(api, user, stateManager, eventManager, sharedElements);

    return {
        authWidget,
        tokenWatchWidget,
        elements: sharedElements
    };
};
