import { classifyIntent } from '../chains/system/classifyIntent.js';

export class IntentClassifier {
    async classify(prompt) {
        if (!prompt) {
            throw new Error('No prompt provided for classification');
        }
        return await classifyIntent(prompt);
    }
}