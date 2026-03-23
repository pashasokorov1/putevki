import { Router } from "express";
import { reportCards } from "../../../../packages/domain/src";

export const reportRouter = Router();

reportRouter.get("/summary", (_request, response) => {
  response.json(reportCards);
});
