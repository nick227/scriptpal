import { requireAuth } from '../auth/authGate.js';

const start = async () => {
    const auth = await requireAuth();
    if (!auth.authenticated) {
        return;
    }

    const { init } = await import('../initScriptPal.js');
    const run = () => init(auth);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        await run();
    }
};

start().catch((error) => {
    console.error('[appBootstrap] Failed to start app:', error);
});
