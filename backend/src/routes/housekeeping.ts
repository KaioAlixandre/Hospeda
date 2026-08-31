import { Router } from "express";
import { z } from "zod";
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
housekeepingRouter.get("/zeladores", async (_req, res, next) => {
  try {
    res.json(await listZeladores());
  } catch (err) {
    next(err);
  }
});

housekeepingRouter.post("/zeladores", async (req, res, next) => {
  try {
    const data = createZeladorSchema.parse(req.body);
    const zelador = await createZelador(data);
    res.status(201).json(zelador);
  } catch (err) {
    next(err);
  }
});

housekeepingRouter.patch("/zeladores/:id", async (req, res, next) => {
  try {
    const data = updateZeladorSchema.parse(req.body);
    const zelador = await updateZelador(req.params.id!, data);
    res.json(zelador);
  } catch (err) {
    next(err);
  }
});

housekeepingRouter.delete("/zeladores/:id", async (req, res, next) => {
  try {
    await deleteZelador(req.params.id!);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/** Painel de status dos quartos */
housekeepingRouter.get("/", async (req, res, next) => {
  try {
    const query = boardQuerySchema.parse(req.query);
    const board = await getHousekeepingBoard(query);
    res.json(board);
  } catch (err) {
    next(err);
  }
});

/** Limpeza concluída → Disponível */
housekeepingRouter.post("/:roomId/ready", async (req, res, next) => {
  try {
    const result = await markRoomCleaned(req.params.roomId!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Iniciar limpeza */
housekeepingRouter.post("/:roomId/start-cleaning", async (req, res, next) => {
  try {
    const result = await startRoomCleaning(req.params.roomId!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Enviar para manutenção */
housekeepingRouter.post("/:roomId/maintenance", async (req, res, next) => {
  try {
    const result = await setRoomMaintenance(req.params.roomId!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Liberar manutenção */
housekeepingRouter.post("/:roomId/release-maintenance", async (req, res, next) => {
  try {
    const result = await releaseRoomMaintenance(req.params.roomId!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
