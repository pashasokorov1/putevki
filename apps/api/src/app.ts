import cors from "cors";
import express from "express";
import { apiRouter } from "./routes";

export function createApp() {
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN ?? "*";

  app.use(cors({ origin: corsOrigin }));
  app.use(express.json());
  app.use(apiRouter);

  return app;
}
