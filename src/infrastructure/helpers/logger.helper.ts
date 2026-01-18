import winston from 'winston';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

export interface LogContext {
  [key: string]: unknown;
}

class StructuredLogger {
  private logger: winston.Logger;

  constructor() {
    const logLevel =
      process.env.LOG_LEVEL ||
      (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

    this.logger = winston.createLogger({
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
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaString = Object.keys(meta).length
                ? ` ${JSON.stringify(meta, null, 2)}`
                : '';
              return `${timestamp} [${level}]: ${message}${metaString}`;
            }),
          ),
        }),
      ],
    });

    if (process.env.NODE_ENV === 'production') {
      this.logger.add(
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          format: winston.format.json(),
        }),
      );
      this.logger.add(
        new winston.transports.File({
          filename: 'logs/combined.log',
          format: winston.format.json(),
        }),
      );
    }
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

    this.logger.error(message, meta);
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(message, context);
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(message, context);
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

export { StructuredLogger };
