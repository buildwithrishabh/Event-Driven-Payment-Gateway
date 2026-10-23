import { logger } from "../config/logger.js";

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(err, req, res, next) {
  logger.error("Request Error", {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  if (err.name === "ZodError" || (err.issues && Array.isArray(err.issues))) {
    return res.status(400).json({
      error: "Validation Error",
      message: err.issues[0]?.message || "Invalid request data",
      details: err.issues.map((i) => ({
        field: i.path.length > 1 ? i.path.slice(1).join(".") : i.path.join("."),
        message: i.message,
      })),
    });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: "Validation Error",
      details: Object.values(err.errors || {}).map((e) => e.message),
    });
  }

  if (err.name === "CastError") {
    return res.status(400).json({ error: `Invalid format for field: ${err.path}` });
  }

  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "Malformed JSON in request body" });
  }

  const status = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);

  res.status(status).json({
    error: status === 500 && process.env.NODE_ENV === "production"
      ? "Internal Server Error"
      : err.message || "Internal Server Error",
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
}