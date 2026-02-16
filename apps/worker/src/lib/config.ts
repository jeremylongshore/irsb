import { loadConfigWithDefaults, type WatchtowerConfig } from '@irsb-watchtower/config';

/**
 * Load worker configuration
 *
 * Uses environment variables with defaults for development
 */
export function loadWorkerConfig(): WatchtowerConfig {
  return loadConfigWithDefaults(process.env);
}

/**
 * Singleton config instance
 */
let configInstance: WatchtowerConfig | null = null;

/**
 * Get the singleton config instance
 */
export function getConfig(): WatchtowerConfig {
  if (!configInstance) {
    configInstance = loadWorkerConfig();
  }
  return configInstance;
}
