import ScriptPal from './app.js';
import { ERROR_MESSAGES } from './constants.js';

// Initialize the application
try {

    const scriptPal = new ScriptPal();
} catch (error) {
    console.error('Failed to initialize ScriptPal:', error);
    alert(ERROR_MESSAGES.INIT_ERROR);
}