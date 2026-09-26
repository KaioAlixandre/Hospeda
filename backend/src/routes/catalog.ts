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

const timeSchema = z
  .string()
  .regex(/^\d{1,2}:\d{2}$/, "Use o formato HH:MM")
  .nullable()
  .optional();

const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Use cor hexadecimal #RRGGBB")
  .nullable()
  .optional();

function presentCatalogSettings(
  hotel: {
    catalogEnabled: boolean;
    slug: string | null;
    catalogHeadline: string | null;
    catalogRules: string | null;
    coverPhotoUrl: string | null;
    galleryPhotos: unknown;
    checkInTime: string | null;
    checkOutTime: string | null;
    brandColor: string | null;
  },
  roomTypesWithoutPhotos: Array<{ id: string; name: string }>,
  canEnable: boolean,
) {
  const baseUrl = (
    process.env.CATALOG_PUBLIC_BASE_URL ?? "https://staydesk.com.br"
  ).replace(/\/$/, "");
  const gallery = Array.isArray(hotel.galleryPhotos)
    ? hotel.galleryPhotos.filter((u): u is string => typeof u === "string")
    : [];

  return {
    catalogEnabled: hotel.catalogEnabled,
    slug: hotel.slug,
    publicUrl: hotel.slug ? `${baseUrl}/h/${hotel.slug}` : null,
    headline: hotel.catalogHeadline,
    rules: hotel.catalogRules,
    coverPhotoUrl: hotel.coverPhotoUrl,
    galleryPhotos: gallery,
    checkInTime: hotel.checkInTime,
    checkOutTime: hotel.checkOutTime,
    brandColor: hotel.brandColor,
    roomTypesWithoutPhotos,
    canEnable,
  };
}

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

    res.json(
      presentCatalogSettings(
        { ...hotel, slug },
        withoutPhotos.map((rt) => ({ id: rt.id, name: rt.name })),
        hasFeature(hotel, "catalog"),
      ),
    );
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
        coverPhotoUrl: z.string().url().nullable().optional(),
        galleryPhotos: z.array(z.string().url()).max(12).optional(),
        checkInTime: timeSchema,
        checkOutTime: timeSchema,
        brandColor: hexColorSchema,
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
        ...(body.coverPhotoUrl !== undefined
          ? { coverPhotoUrl: body.coverPhotoUrl }
          : {}),
        ...(body.galleryPhotos !== undefined
          ? { galleryPhotos: body.galleryPhotos }
          : {}),
        ...(body.checkInTime !== undefined
          ? { checkInTime: body.checkInTime }
          : {}),
        ...(body.checkOutTime !== undefined
          ? { checkOutTime: body.checkOutTime }
          : {}),
        ...(body.brandColor !== undefined
          ? { brandColor: body.brandColor }
          : {}),
      },
    });

    const roomTypes = await prisma.roomType.findMany({
      where: { hotelId },
      select: { id: true, name: true, photos: true },
    });
    const withoutPhotos = roomTypes.filter((rt) => {
      const photos = Array.isArray(rt.photos) ? rt.photos : [];
      return photos.length === 0;
    });

    res.json(
      presentCatalogSettings(
        updated,
        withoutPhotos.map((rt) => ({ id: rt.id, name: rt.name })),
        hasFeature(updated, "catalog"),
      ),
    );
  } catch (err) {
    next(err);
  }
});
