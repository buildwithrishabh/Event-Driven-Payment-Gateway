import { z } from "zod";

/**
 * Universal validation middleware using Zod schemas.
 * Validates request body, query parameters, and URL route params.
 * Sanitizes input (strips unknown fields) and coerces types (e.g. query strings to numbers).
 *
 * @param {z.ZodSchema} schema - The Zod schema to validate against
 * @returns {Function} Express middleware function
 */
export function validate(schema) {
  return async (req, res, next) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Update req objects with validated, stripped, and type-coerced data
      if (parsed.body !== undefined) {
        req.body = parsed.body;
      }
      if (parsed.query !== undefined) {
        req.query = parsed.query;
      }
      if (parsed.params !== undefined) {
        req.params = parsed.params;
      }

      return next();
    } catch (err) {
      if (err instanceof z.ZodError || err.name === "ZodError") {
        const details = err.issues.map((issue) => {
          // Normalize field name: remove top-level 'body.' / 'query.' / 'params.' prefix if present
          const fullPath = issue.path.join(".");
          const field = issue.path.length > 1 ? issue.path.slice(1).join(".") : fullPath;
          return {
            field,
            message: issue.message,
          };
        });

        return res.status(400).json({
          error: "Validation Error",
          message: details.length > 0 ? details[0].message : "Invalid request data",
          details,
        });
      }

      return next(err);
    }
  };
}
