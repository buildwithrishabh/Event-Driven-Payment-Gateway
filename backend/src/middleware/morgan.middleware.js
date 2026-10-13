import morgan from "morgan";
import { logger } from "../config/logger.js";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Custom stream for Morgan:
 * Redirects HTTP request logs from Morgan into our Winston logger.
 */
const stream = {
  write: (message) => {
    // message includes a trailing newline character, so we use trim()
    logger.info(message.trim());
  },
};

/**
 * Format selection:
 * - 'combined': Apache combined log format (IP, user-agent, status, response time) for production
 * - 'dev': Concise, color-coded status output (GET /api 200 12.3ms) for development
 */
const format = isProduction ? "combined" : "dev";

export const morganMiddleware = morgan(format, { stream });

export default morganMiddleware;
