import { requireAuth } from '../auth/authGate.js';

const start = async () => {
    const { authenticated } = await requireAuth();
    if (!authenticated) {
        return;
    }

    await import('../init-clean.js');
};

start().catch((error) => {
    console.error('[appBootstrap] Failed to start app:', error);
});
