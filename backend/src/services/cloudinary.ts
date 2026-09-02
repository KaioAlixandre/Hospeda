import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import { AppError } from "../middleware/errorHandler.js";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function assertConfigured() {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME?.trim() ||
    !process.env.CLOUDINARY_API_KEY?.trim() ||
    !process.env.CLOUDINARY_API_SECRET?.trim()
  ) {
    throw new AppError(
      503,
      "Cloudinary não configurado. Defina CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET.",
    );
  }
}

export async function uploadImageBuffer(
  buffer: Buffer,
  folder: string,
): Promise<string> {
  assertConfigured();

  const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (error, uploadResult) => {
        if (error || !uploadResult?.secure_url) {
          reject(error ?? new Error("Falha no upload Cloudinary"));
          return;
        }
        resolve({ secure_url: uploadResult.secure_url });
      },
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });

  return result.secure_url;
}

export async function uploadImageBuffers(
  files: Express.Multer.File[],
  folder: string,
): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    urls.push(await uploadImageBuffer(file.buffer, folder));
  }
  return urls;
}
