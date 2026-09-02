import { Router } from "express";
import { z } from "zod";
import { hotelIdFrom } from "../middleware/auth.js";
import {
  getHousekeepingBoard,
  markRoomCleaned,
  releaseRoomMaintenance,
  setRoomMaintenance,
  startRoomCleaning,
} from "../services/housekeeping.js";
import {
  createZelador,
  deleteZelador,
  listZeladores,
  updateZelador,
} from "../services/zeladores.js";
import {
  createZeladorSchema,
  updateZeladorSchema,
} from "../validators/schemas.js";

export const housekeepingRouter = Router();

const boardQuerySchema = z.object({
  status: z
    .enum(["AVAILABLE", "RESERVED", "OCCUPIED", "CLEANING", "MAINTENANCE"])
    .optional(),
});

/** Zeladores da equipe de limpeza */
housekeepingRouter.get("/zeladores", async (req, res, next) => {
  try {
    res.json(await listZeladores(hotelIdFrom(req)));
  } catch (err) {
    next(err);
  }
});

housekeepingRouter.post("/zeladores", async (req, res, next) => {
  try {
    const data = createZeladorSchema.parse(req.body);
    const zelador = await createZelador(hotelIdFrom(req), data);
    res.status(201).json(zelador);
  } catch (err) {
    next(err);
  }
});

housekeepingRouter.patch("/zeladores/:id", async (req, res, next) => {
  try {
    const data = updateZeladorSchema.parse(req.body);
    const zelador = await updateZelador(hotelIdFrom(req), req.params.id!, data);
    res.json(zelador);
  } catch (err) {
    next(err);
  }
});

housekeepingRouter.delete("/zeladores/:id", async (req, res, next) => {
  try {
    await deleteZelador(hotelIdFrom(req), req.params.id!);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/** Painel de status dos quartos */
housekeepingRouter.get("/", async (req, res, next) => {
  try {
    const query = boardQuerySchema.parse(req.query);
    const board = await getHousekeepingBoard(hotelIdFrom(req), query);
    res.json(board);
  } catch (err) {
    next(err);
  }
});

/** Limpeza concluída → Disponível */
housekeepingRouter.post("/:roomId/ready", async (req, res, next) => {
  try {
    const result = await markRoomCleaned(hotelIdFrom(req), req.params.roomId!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Iniciar limpeza */
housekeepingRouter.post("/:roomId/start-cleaning", async (req, res, next) => {
  try {
    const result = await startRoomCleaning(hotelIdFrom(req), req.params.roomId!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Enviar para manutenção */
housekeepingRouter.post("/:roomId/maintenance", async (req, res, next) => {
  try {
    const result = await setRoomMaintenance(hotelIdFrom(req), req.params.roomId!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Liberar manutenção */
housekeepingRouter.post("/:roomId/release-maintenance", async (req, res, next) => {
  try {
    const result = await releaseRoomMaintenance(
      hotelIdFrom(req),
      req.params.roomId!,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});
