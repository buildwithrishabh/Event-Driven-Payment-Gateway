import mongoose from "mongoose";
import { logger } from "./logger.js";

export async function connectDB() {
  try {
    const uri =
      process.env.MONGODB_URI ||
      "mongodb://127.0.0.1:27017/payment_gateway?directConnection=true&retryWrites=false";
    await mongoose.connect(uri);
  } catch (error) {
    logger.error(`MongoDB connection failed: ${error.message}`);
    throw error;
  }
}

mongoose.connection.on("error", (error) => {
  logger.error(`MongoDB error: ${error.message}`);
});

mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB disconnected");
});

mongoose.connection.on("connected", () => {
  logger.info("MongoDB connected");
});