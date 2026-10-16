import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { connectDB } from "./config/db.js";
import { redisClient } from "./config/redis.js";
import { logger } from "./config/logger.js";
import morganMiddleware from "./middleware/morgan.middleware.js";
import merchantsRoutes from "./modules/merchants/merchant.routes.js";
import paymentRoutes from "./modules/payments/payment.routes.js";
import ledgerRoutes from "./modules/ledger/ledger.routes.js";
import { startOutboxRelay } from "./workers/outbox.relay.js";
import "./workers/payment.worker.js";
import "./workers/webhook.worker.js";
import webhookRoutes from "./modules/webhooks/webhook.routes.js";
import { startReconciliationWorker } from "./workers/reconciliation.worker.js";
import checkoutRoutes from "./modules/checkout/checkout.routes.js";

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

async function startServer() {
  await connectDB();
  startOutboxRelay(1500);
  startReconciliationWorker(60000); // check every 60 seconds

  app.listen(PORT, () => {
    logger.info(`🚀 Gateway API running at http://localhost:${PORT}`);
  });
}

startServer();
