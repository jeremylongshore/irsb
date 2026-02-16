import type { LogLevel, LogFormat } from '@irsb-watchtower/config';
import pino from 'pino';

/**
 * Create a configured logger instance
 */
export function createLogger(level: LogLevel = 'info', format: LogFormat = 'pretty'): pino.Logger {
  const options: pino.LoggerOptions = {
    level,
    ...(format === 'pretty' && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    }),
  };

  return pino(options);
}

/**
 * Default logger instance
 */
export const logger = createLogger();
