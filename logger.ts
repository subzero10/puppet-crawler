import * as winston from 'winston';

export const logger = winston.createLogger();
logger.add(new winston.transports.Console({
    format: winston.format.simple()
}));