const { contextBridge, ipcRenderer } = require("electron");

let apiConfig = { apiBaseUrl: "", source: "default", insecure: false };
try {
  apiConfig = ipcRenderer.sendSync("api:get-config") || apiConfig;
} catch (_) {
  // mantém o objeto vazio; a tela avisa que a API não está configurada
}

contextBridge.exposeInMainWorld("hospeda", {
  apiBaseUrl: apiConfig.apiBaseUrl,
  apiConfig: {
    get: () => ipcRenderer.invoke("api:get-config-async"),
    save: (url) => ipcRenderer.invoke("api:save-config", url),
  },
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
