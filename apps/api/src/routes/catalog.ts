import { Router } from "express";
import { drivers, vehicles } from "../../../../packages/domain/src";

export const catalogRouter = Router();

catalogRouter.get("/vehicles", (_request, response) => {
  response.json(vehicles);
});

catalogRouter.get("/drivers", (_request, response) => {
  response.json(drivers);
});
