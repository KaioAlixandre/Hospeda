const { contextBridge, ipcRenderer } = require("electron");

let apiBaseUrl = "http://216.22.5.245:3333";
try {
  apiBaseUrl = require("./config.cjs").apiBaseUrl || apiBaseUrl;
} catch (_) {
  // fallback acima
}

contextBridge.exposeInMainWorld("hospeda", {
  apiBaseUrl,
  platform: process.platform,
  isElectron: true,
  print: {
    getSettings: () => ipcRenderer.invoke("print:get-settings"),
    saveSettings: (settings) =>
      ipcRenderer.invoke("print:save-settings", settings),
    listPrinters: () => ipcRenderer.invoke("print:list-printers"),
    test: (overrides) => ipcRenderer.invoke("print:test", overrides),
    reservation: (payload) =>
      ipcRenderer.invoke("print:reservation", payload),
  },
});
