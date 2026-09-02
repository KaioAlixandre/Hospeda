const { contextBridge } = require("electron");
const { apiBaseUrl } = require("./config.cjs");

contextBridge.exposeInMainWorld("hospeda", {
  apiBaseUrl,
  platform: process.platform,
});
