import { loadConfigWithDefaults, type WatchtowerConfig } from '@irsb-watchtower/config';

/**
 * Load API configuration
 *
 * Uses environment variables with defaults for development
 */
export function loadApiConfig(): WatchtowerConfig {
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
    configInstance = loadApiConfig();
  }
  return configInstance;
}
