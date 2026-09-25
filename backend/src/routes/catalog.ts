import { Router } from "express";
import { z } from "zod";
import { hasFeature } from "../lib/plans.js";
import { allocateUniqueSlug, ensureHotelSlug } from "../lib/slug.js";
import { prisma } from "../lib/prisma.js";
import { hotelIdFrom } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";
import { requireFeature } from "../middleware/plan.js";

export const catalogRouter = Router();

catalogRouter.use(requireFeature("catalog"));

catalogRouter.get("/", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new AppError(404, "Hotel not found");

    const slug = hotel.slug ?? (await ensureHotelSlug(hotelId, hotel.name));

    const roomTypes = await prisma.roomType.findMany({
      where: { hotelId },
      select: { id: true, name: true, photos: true },
    });
    const withoutPhotos = roomTypes.filter((rt) => {
      const photos = Array.isArray(rt.photos) ? rt.photos : [];
      return photos.length === 0;
    });

    const baseUrl = (
      process.env.CATALOG_PUBLIC_BASE_URL ?? "https://staydesk.com.br"
    ).replace(/\/$/, "");

    res.json({
      catalogEnabled: hotel.catalogEnabled,
      slug,
      publicUrl: slug ? `${baseUrl}/h/${slug}` : null,
      headline: hotel.catalogHeadline,
      rules: hotel.catalogRules,
      roomTypesWithoutPhotos: withoutPhotos.map((rt) => ({
        id: rt.id,
        name: rt.name,
      })),
      canEnable: hasFeature(hotel, "catalog"),
    });
  } catch (err) {
    next(err);
  }
});

catalogRouter.patch("/", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const body = z
      .object({
        catalogEnabled: z.boolean().optional(),
        catalogHeadline: z.string().max(2000).nullable().optional(),
        catalogRules: z.string().max(5000).nullable().optional(),
      })
      .parse(req.body);

    const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new AppError(404, "Hotel not found");

    let slug = hotel.slug;
    if (!slug) {
      slug = await allocateUniqueSlug(hotel.name, hotelId);
    }

    const updated = await prisma.hotel.update({
      where: { id: hotelId },
      data: {
        slug,
        ...(body.catalogEnabled !== undefined
          ? { catalogEnabled: body.catalogEnabled }
          : {}),
        ...(body.catalogHeadline !== undefined
          ? { catalogHeadline: body.catalogHeadline }
          : {}),
        ...(body.catalogRules !== undefined
          ? { catalogRules: body.catalogRules }
          : {}),
      },
    });

    const baseUrl = (
      process.env.CATALOG_PUBLIC_BASE_URL ?? "https://staydesk.com.br"
    ).replace(/\/$/, "");

    res.json({
      catalogEnabled: updated.catalogEnabled,
      slug: updated.slug,
      publicUrl: updated.slug ? `${baseUrl}/h/${updated.slug}` : null,
      headline: updated.catalogHeadline,
      rules: updated.catalogRules,
    });
  } catch (err) {
    next(err);
  }
});
