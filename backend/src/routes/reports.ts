import { Router } from "express";
import { civilDateToUtcMidnight, hotelDayIso, addUtcDays } from "../lib/datetime.js";
import { hotelIdFrom } from "../middleware/auth.js";
import { getTopProducts } from "../services/topProducts.js";

export const reportsRouter = Router();

reportsRouter.get("/top-products", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const toIso =
      typeof req.query.to === "string" && req.query.to
        ? req.query.to
        : hotelDayIso();
    const fromIso =
      typeof req.query.from === "string" && req.query.from
        ? req.query.from
        : addUtcDays(civilDateToUtcMidnight(toIso), -30)
            .toISOString()
            .slice(0, 10);

    const from = civilDateToUtcMidnight(fromIso);
    const toExclusive = addUtcDays(civilDateToUtcMidnight(toIso), 1);

    const items = await getTopProducts(hotelId, from, toExclusive, 20);
    res.json({ from: fromIso, to: toIso, items });
  } catch (err) {
    next(err);
  }
});
