import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.js";

const host = process.env.DATABASE_HOST ?? "127.0.0.1";

const adapter = new PrismaMariaDb({
  // No Windows, "localhost" pode ir para IPv6 (::1) e travar o pool
  host: host === "localhost" ? "127.0.0.1" : host,
  port: Number(process.env.DATABASE_PORT ?? 3306),
  user: process.env.DATABASE_USER!,
  password: process.env.DATABASE_PASSWORD ?? "",
  database: process.env.DATABASE_NAME!,
  connectionLimit: 10,
  connectTimeout: 20_000,
  acquireTimeout: 20_000,
  allowPublicKeyRetrieval: true,
});

export const prisma = new PrismaClient({ adapter });
