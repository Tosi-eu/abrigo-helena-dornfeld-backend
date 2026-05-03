import winston from 'winston';
import type { SystemConfigDto } from '@domain/dto/system-config.dto';
import { getBuiltinDefaultSystemConfig } from '@services/system-config.defaults';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

export interface LogContext {
  [key: string]: unknown;
}

function buildWinstonLogger(
  logging: SystemConfigDto['logging'],
): winston.Logger {
  const isTest = process.env.NODE_ENV === 'test';
  const logLevel = isTest ? 'silent' : logging.level;

  const consoleFormat =
    logging.format === 'pretty'
      ? winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.errors({ stack: true }),
          winston.format.colorize(),
          winston.format.printf(info => {
            const { timestamp, level, message, ...meta } = info;
            const metaString = Object.keys(meta).length
              ? ` ${JSON.stringify(meta, null, 2)}`
              : '';
            return `${timestamp} [${level}]: ${message}${metaString}`;
          }),
        )
      : winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        );

  const instance = winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    ),
    defaultMeta: {
      service: 'abrigo-backend',
      environment: process.env.NODE_ENV || 'development',
    },
    transports: [
      new winston.transports.Console({
        format: consoleFormat,
      }),
    ],
  });

  if (process.env.NODE_ENV === 'production') {
    instance.add(
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: winston.format.json(),
      }),
    );
    instance.add(
      new winston.transports.File({
        filename: 'logs/combined.log',
        format: winston.format.json(),
      }),
    );
  }

  return instance;
}

class StructuredLogger {
  private inner: winston.Logger;

  constructor() {
    this.inner = buildWinstonLogger(getBuiltinDefaultSystemConfig().logging);
  }

  applyRuntimeLogging(logging: SystemConfigDto['logging']): void {
    try {
      this.inner.end();
    } catch {
      /* ignore */
    }
    this.inner = buildWinstonLogger(logging);
  }

  error(message: string, context?: LogContext, error?: Error): void {
    const meta: LogContext = { ...context };

    if (error) {
      meta.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    }

    this.inner.error(message, meta);
  }

  warn(message: string, context?: LogContext): void {
    this.inner.warn(message, context);
  }

  info(message: string, context?: LogContext): void {
    this.inner.info(message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.inner.debug(message, context);
  }

  logRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: LogContext,
  ): void {
    this.info('HTTP Request', {
      method,
      path,
      statusCode,
      duration: `${duration}ms`,
      ...context,
    });
  }

  logDatabase(query: string, duration?: number, context?: LogContext): void {
    this.debug('Database Query', {
      query,
      duration: duration ? `${duration}ms` : undefined,
      ...context,
    });
  }

  logBusiness(operation: string, context?: LogContext): void {
    this.info(`Business Operation: ${operation}`, context);
  }

  logSecurity(event: string, context?: LogContext): void {
    this.warn(`Security Event: ${event}`, context);
  }

  logPerformance(
    operation: string,
    duration: number,
    context?: LogContext,
  ): void {
    this.info(`Performance: ${operation}`, {
      duration: `${duration}ms`,
      ...context,
    });
  }
}

export const logger = new StructuredLogger();

export function applyRuntimeLogging(logging: SystemConfigDto['logging']): void {
  logger.applyRuntimeLogging(logging);
}

export { StructuredLogger };
