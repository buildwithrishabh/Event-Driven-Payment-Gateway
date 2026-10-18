import "dotenv/config";
import dns from "dns";

// Restrict custom DNS override to non-production environments
if (process.env.NODE_ENV !== "production") {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

import express from "express";
import helmet from "helmet";
import cors from "cors";
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
import "./workers/payment.worker.js";
import "./workers/webhook.worker.js";
import "./workers/refund.worker.js";
import webhookRoutes from "./modules/webhooks/webhook.routes.js";
import { startReconciliationWorker } from "./workers/reconciliation.worker.js";
import checkoutRoutes from "./modules/checkout/checkout.routes.js";
import refundRoutes from "./modules/refunds/refund.routes.js";
import mongoose from "mongoose";

const app = express();

const PORT = process.env.PORT || 3000;

// security and parsing middleware
app.use(helmet());
app.use(cors());
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

      // 3. Close database and redis connection
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

startServer();
