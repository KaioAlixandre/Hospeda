import { Router } from "express";
import multer from "multer";
import { uploadImageBuffers } from "../services/cloudinary.js";
import { AppError } from "../middleware/errorHandler.js";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 8;

const ALLOWED_FOLDERS = new Set(["hotel-rooms", "hotel-room-types"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_FILES },
  fileFilter(_req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
      cb(new AppError(400, "Apenas arquivos de imagem são permitidos"));
      return;
    }
    cb(null, true);
  },
});

export const uploadsRouter = Router();

uploadsRouter.post("/images", (req, res, next) => {
  upload.array("images", MAX_FILES)(req, res, async (err) => {
    try {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          throw new AppError(413, "Imagem muito grande. Máximo 10MB por arquivo.");
        }
        if (err.code === "LIMIT_FILE_COUNT") {
          throw new AppError(400, `Máximo de ${MAX_FILES} imagens por envio.`);
        }
        throw new AppError(400, err.message);
      }
      if (err) throw err;

      const files = req.files as Express.Multer.File[] | undefined;
      if (!files?.length) {
        throw new AppError(400, "Nenhuma imagem enviada");
      }

      const folderRaw =
        typeof req.query.folder === "string"
          ? req.query.folder
          : typeof req.body?.folder === "string"
            ? req.body.folder
            : "hotel-rooms";

      if (!ALLOWED_FOLDERS.has(folderRaw)) {
        throw new AppError(400, "Pasta de upload inválida");
      }

      const urls = await uploadImageBuffers(files, folderRaw);
      res.status(201).json({ urls });
    } catch (error) {
      next(error);
    }
  });
});
