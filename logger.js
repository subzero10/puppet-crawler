"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const winston = require("winston");
exports.logger = winston.createLogger();
exports.logger.add(new winston.transports.Console({
    format: winston.format.simple()
}));
//# sourceMappingURL=logger.js.map