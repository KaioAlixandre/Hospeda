const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("hospeda", {
  apiBaseUrl: process.env.HOSPEDA_API_URL || "http://localhost:3333",
  platform: process.platform,
});
