import "dotenv/config";
import dns from "dns";

// Restrict custom DNS override to non-production environments
if (process.env.NODE_ENV !== "production") {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

import express from "express";
import helmet from "helmet";
import cors from "cors";
import {
  register,
  httpRequestDuration,
  updateQueueMetrics,
} from "./config/metrics.js";
import { connectDB } from "./config/db.js";
import { redisClient } from "./config/redis.js";
import { logger } from "./config/logger.js";
import morganMiddleware from "./middleware/morgan.middleware.js";
import {
  notFoundHandler,
  errorHandler,
} from "./middleware/error.middleware.js";
import merchantsRoutes from "./modules/merchants/merchant.routes.js";
import paymentRoutes from "./modules/payments/payment.routes.js";
import ledgerRoutes from "./modules/ledger/ledger.routes.js";
import { startOutboxRelay } from "./workers/outbox.relay.js";
import { paymentWorker } from "./workers/payment.worker.js";
import { webhookWorker } from "./workers/webhook.worker.js";
import { refundWorker } from "./workers/refund.worker.js";
import webhookRoutes from "./modules/webhooks/webhook.routes.js";
import { startReconciliationWorker } from "./workers/reconciliation.worker.js";
import checkoutRoutes from "./modules/checkout/checkout.routes.js";
import refundRoutes from "./modules/refunds/refund.routes.js";
import mongoose from "mongoose";

const app = express();

const PORT = process.env.PORT || 3000;

// security and parsing middleware
app.use(helmet());

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.FRONTEND_URL, // e.g. https://your-actual-app.vercel.app
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
  }),
);

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  }),
);

// HTTP request logging
app.use(morganMiddleware);

// Health Check Endpoints
app.get("/health", async (req, res) => {
  const redisStatus = redisClient.status === "ready" ? "OK" : "DEGRADED";
  res.json({
    status: "OK",
    timeStamp: new Date().toISOString(),
    service: {
      api: "UP",
      redis: redisStatus,
    },
  });
});

app.use((req, res, next) => {
  if (req.path === "/metrics" || req.path === "/health") {
    return next();
  }

  const end = httpRequestDuration.startTimer();
  res.on("finish", () => {
    const route = req.route ? req.baseUrl + req.route.path : req.path;
    end({ method: req.method, route, status_code: res.statusCode });
  });
  next();
});

app.get("/metrics", async (req, res) => {
  try {
    await updateQueueMetrics();
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

app.use("/v1/merchants", merchantsRoutes);
app.use("/v1/payments", paymentRoutes);
app.use("/v1/ledger", ledgerRoutes);
app.use("/v1/webhooks", webhookRoutes);
app.use("/v1/checkout", checkoutRoutes);
app.use("/v1/refunds", refundRoutes);

// Catch-all 404 handler for undefined routes
app.use(notFoundHandler);

// Global Error Handler for unhandled exceptions
app.use(errorHandler);

async function startServer() {
  await connectDB();
  const outboxTimer = startOutboxRelay(1500);
  const reconciliationTimer = startReconciliationWorker(60000); // check every 60 seconds

  const server = app.listen(PORT, () => {
    logger.info(`🚀 Gateway API running at http://localhost:${PORT}`);
  });

  const timers = { outboxTimer, reconciliationTimer };

  // Listen for termination signals (Ctrl+C, Docker stop, PM2 restart)
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM", server, timers));
  process.on("SIGINT", () => gracefulShutdown("SIGINT", server, timers));
}

async function gracefulShutdown(signal, server, timers) {
  logger.info(`Received ${signal}. Starting graceful shutdown`);

  // 1. Stop taking new request
  server.close(async () => {
    try {
      // 2. Clear background polling timers
      if (timers.outboxTimer) clearInterval(timers.outboxTimer);
      if (timers.reconciliationTimer) clearInterval(timers.reconciliationTimer);

      // 3. Gracefully close BullMQ workers so active in-flight jobs finish cleanly
      logger.info("Closing background workers...");
      await Promise.allSettled([
        paymentWorker.close(),
        webhookWorker.close(),
        refundWorker.close(),
      ]);
      logger.info("All BullMQ workers stopped");

      // 4. Close database and redis connection
      await mongoose.connection.close(false);
      logger.info("MongoDB connection closed");

      await redisClient.quit();
      logger.info("Redis connection closed");

      logger.info("Graceful shutdown completed successfully.");
      process.exit(0);
    } catch (err) {
      logger.error("Error during graceful shutdown:", err);
      process.exit(1);
    }
  });

  // Force close if it takes too long (e.g. 15 seconds max)
  setTimeout(() => {
    logger.error(
      "Could not close connections in time, forcefully shutting down",
    );
    process.exit(1);
  }, 15000);
}

// Global crash shield: Log unhandled promise rejections without crashing the server
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection:", { reason, promise });
});

// Global crash shield: Log uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", {
    error: error.message,
    stack: error.stack,
  });
});

startServer();
