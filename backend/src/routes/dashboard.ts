import { Router } from "express";
import { z } from "zod";
import { hotelIdFrom } from "../middleware/auth.js";
import { getAdminDashboard } from "../services/dashboard.js";

export const dashboardRouter = Router();

const querySchema = z.object({
  date: z.string().date().optional(),
});

dashboardRouter.get("/", async (req, res, next) => {
  try {
    const { date } = querySchema.parse(req.query);
    const dashboard = await getAdminDashboard(hotelIdFrom(req), date);
    res.json(dashboard);
  } catch (err) {
    next(err);
  }
});
