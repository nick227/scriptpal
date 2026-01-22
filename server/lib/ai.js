import { AIClient } from '../services/AIClient.js';
import { logger } from '../utils/logger.js';

// Create singleton instance
export const ai = new AIClient();

/**
 * Initialize AI service
 * Performs health check and logging
 */
export async function initializeAI() {
  try {
    const config = ai.getConfig();
    logger.info('Initializing AI Service', { 
      model: config.model,
      timeout: config.timeout 
    });

    const healthy = await ai.healthCheck();
    if (!healthy) {
      logger.warn('AI Service health check failed on startup');
    } else {
      logger.info('AI Service initialized and healthy');
    }
  } catch (error) {
    logger.error('Failed to initialize AI Service', error);
    // Don't crash, just log - allow retry logic to handle later
  }
}
