import "dotenv/config";
import { createApp } from "./app.js";
import { validateEnv } from "./lib/env.js";

validateEnv();

const port = Number(process.env.PORT ?? 3333);
const host = process.env.HOST ?? "0.0.0.0";
const app = createApp();

app.listen(port, host, () => {
  console.log(`StayDesck API running on http://${host}:${port}`);
});
