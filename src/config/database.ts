import mongoose from "mongoose";

let isConnected = false;

export const isDbConnected = (): boolean => isConnected;

export const connectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    isConnected = true;
    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    isConnected = false;
    console.error("❌ MongoDB connection failed:", (error as Error).message);
    console.warn("⚠️  Server will continue running without MongoDB. DB-dependent routes will fail.");
  }
};