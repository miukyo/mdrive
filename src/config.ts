import dotenv from "dotenv";

dotenv.config();

export const config = {
  DATABASE_URL: process.env.DATABASE_URL,
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",
  PORT: parseInt(process.env.PORT || "3002", 10),
  TELEGRAM_API_ID: parseInt(process.env.TELEGRAM_API_ID || "0", 10),
  TELEGRAM_API_HASH: process.env.TELEGRAM_API_HASH || "",
};
