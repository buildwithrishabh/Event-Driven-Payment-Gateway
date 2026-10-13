import winston from "winston";

// Check the environment: "production" vs "development"
const isProduction = process.env.NODE_ENV === "production";

/**
 * 1. Development Format:
 * Easy for humans to read in terminal with colored output and timestamp
 */
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }), // Include stack trace if error is logged
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `[${timestamp}] [${level}]: ${stack || message}`;
  })
);

/**
 * 2. Production Format:
 * Structured JSON format (standard for cloud platforms, Datadog, ELK, AWS CloudWatch)
 */
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Transports: Where logs are sent
 * - In Development: Console only with nice colored formatting
 * - In Production: Console (JSON) + File logs (error.log and combined.log)
 */
const transports = [
  new winston.transports.Console({
    format: isProduction ? prodFormat : devFormat,
  }),
];

// In production, also save logs to files for auditing and debugging
if (isProduction) {
  transports.push(
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      format: prodFormat,
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
      format: prodFormat,
    })
  );
}

// Create the Winston logger instance
export const logger = winston.createLogger({
  // In dev: debug level captures all details
  // In prod: info level filters out verbose debug logs
  level: isProduction ? "info" : "debug",
  transports,
});

export default logger;
