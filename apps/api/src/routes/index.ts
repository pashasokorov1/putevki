import { Router } from "express";
import { catalogRouter } from "./catalog";
import { fuelSheetRouter } from "./fuelSheets";
import { reportRouter } from "./reports";

export const apiRouter = Router();

apiRouter.get("/health", (_request, response) => {
  response.json({ status: "ok", timestamp: new Date().toISOString() });
});

apiRouter.use("/api", catalogRouter);
apiRouter.use("/api", fuelSheetRouter);
apiRouter.use("/api/reports", reportRouter);
