import { Router } from "express";
import { fuelSheets } from "../../../../packages/domain/src";

export const fuelSheetRouter = Router();

fuelSheetRouter.get("/fuel-sheets", (_request, response) => {
  response.json(fuelSheets);
});
