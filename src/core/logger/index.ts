import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '../../config/index';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// Format for Console (Development) - Colorful and readable
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => `${info['timestamp']} ${info.level}: ${info.message}`)
);

// Format for Files (Production/All) - JSON or structured text, uncolored
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json() // Keeps logs structured for parsing tools
);

const transports: winston.transport[] = [
  // Always log to console
  new winston.transports.Console({
    format: consoleFormat,
  }),
];

// Define Rotation settings for Error logs
const errorFileRotateTransport = new DailyRotateFile({
  dirname: 'logs', // Folder name
  filename: 'error-%DATE%.log', // Filename pattern
  datePattern: 'YYYY-MM-DD', // Rotate every day
  zippedArchive: true, // Compress old logs to save space
  maxSize: '20m', // Rotate if file size exceeds 20MB
  maxFiles: '14d', // Keep logs for 14 days
  level: 'error', // Only log errors here
  format: fileFormat,
});

// Define Rotation settings for Combined logs (All levels)
const combinedFileRotateTransport = new DailyRotateFile({
  dirname: 'logs',
  filename: '%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  format: fileFormat,
});

// Add file logging (You can wrap this in `if (config.isProduction)` if you only want files in prod)
transports.push(errorFileRotateTransport);
transports.push(combinedFileRotateTransport);

export const logger = winston.createLogger({
  level: config.logging.level || 'info',
  levels,
  transports,
});
