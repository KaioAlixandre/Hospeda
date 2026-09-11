const { app, BrowserWindow, shell, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const { printReservation } = require("./print/print_reservation");

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

const PRINT_SIZE_LIMITS = {
  paperWidthMm: { min: 40, max: 120, def: 80 },
  contentWidthMm: { min: 30, max: 120 },
  fontScalePercent: { min: 60, max: 200, def: 100 },
  lineHeight: { min: 1, max: 2.2, def: 1.35 },
};

const LEGACY_FONT_SCALE_PERCENT = { small: 85, normal: 100, large: 120 };

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function fontScaleFromPercent(percent) {
  if (percent <= 92) return "small";
  if (percent >= 112) return "large";
  return "normal";
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function getPrintSettingsPath() {
  return path.join(app.getPath("userData"), "print-settings.json");
}

function normalizePrintSettings(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const lim = PRINT_SIZE_LIMITS;

  const paperWidthMm = Math.round(
    clampNumber(
      src.paperWidthMm,
      lim.paperWidthMm.min,
      lim.paperWidthMm.max,
      lim.paperWidthMm.def,
    ),
  );

  let contentWidthMm = clampNumber(src.contentWidthMm, 0, lim.contentWidthMm.max, 0);
  if (contentWidthMm > 0) {
    contentWidthMm = Math.round(
      Math.min(paperWidthMm, Math.max(lim.contentWidthMm.min, contentWidthMm)),
    );
  }

  const percentSource =
    src.fontScalePercent !== undefined && src.fontScalePercent !== null
      ? src.fontScalePercent
      : (LEGACY_FONT_SCALE_PERCENT[String(src.fontScale || "normal")] ??
        lim.fontScalePercent.def);
  const fontScalePercent = Math.round(
    clampNumber(
      percentSource,
      lim.fontScalePercent.min,
      lim.fontScalePercent.max,
      lim.fontScalePercent.def,
    ),
  );

  const lineHeight =
    Math.round(
      clampNumber(
        src.lineHeight,
        lim.lineHeight.min,
        lim.lineHeight.max,
        lim.lineHeight.def,
      ) * 100,
    ) / 100;

  return {
    printerType: "windows_spooler",
    printerTarget: String(src.printerTarget || ""),
    paperWidthMm,
    contentWidthMm,
    fontScalePercent,
    fontScale: fontScaleFromPercent(fontScalePercent),
    lineHeight,
    printSecondCopy: src.printSecondCopy === true,
  };
}

function loadPrintSettings() {
  return normalizePrintSettings(readJsonSafe(getPrintSettingsPath()));
}

function savePrintSettings(settings) {
  const next = normalizePrintSettings(settings);
  fs.writeFileSync(getPrintSettingsPath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

function listWindowsPrinters() {
  return new Promise((resolve) => {
    if (process.platform !== "win32") {
      resolve([]);
      return;
    }
    const ps = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "Get-Printer | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress",
      ],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    ps.stdout.on("data", (d) => {
      out += String(d || "");
    });
    ps.on("error", () => resolve([]));
    ps.on("close", () => {
      try {
        const parsed = JSON.parse(out.trim() || "[]");
        resolve(Array.isArray(parsed) ? parsed : parsed ? [parsed] : []);
      } catch {
        resolve([]);
      }
    });
  });
}

function applyPrintEnv(printSettings) {
  const userDataPath = app.getPath("userData");
  process.env.HOSPEDA_PRINTER_TYPE = "windows_spooler";
  process.env.HOSPEDA_PRINTER_TARGET = printSettings.printerTarget || "";
  process.env.HOSPEDA_PAPER_WIDTH_MM = String(printSettings.paperWidthMm || 80);
  process.env.HOSPEDA_CONTENT_WIDTH_MM = String(printSettings.contentWidthMm || 0);
  process.env.HOSPEDA_FONT_SCALE = printSettings.fontScale || "normal";
  process.env.HOSPEDA_FONT_SCALE_PERCENT = String(
    printSettings.fontScalePercent || 100,
  );
  process.env.HOSPEDA_LINE_HEIGHT = String(printSettings.lineHeight || 1.35);
  process.env.HOSPEDA_USER_DATA = userDataPath;
  process.env.HOSPEDA_PRINTS_DIR = path.join(userDataPath, "prints");

  // Compatível com o helper portado do Mira-Printer
  process.env.MIRA_PRINTER_TYPE = process.env.HOSPEDA_PRINTER_TYPE;
  process.env.MIRA_PRINTER_TARGET = process.env.HOSPEDA_PRINTER_TARGET;
  process.env.MIRA_PAPER_WIDTH_MM = process.env.HOSPEDA_PAPER_WIDTH_MM;
  process.env.MIRA_CONTENT_WIDTH_MM = process.env.HOSPEDA_CONTENT_WIDTH_MM;
  process.env.MIRA_FONT_SCALE = process.env.HOSPEDA_FONT_SCALE;
  process.env.MIRA_FONT_SCALE_PERCENT = process.env.HOSPEDA_FONT_SCALE_PERCENT;
  process.env.MIRA_LINE_HEIGHT = process.env.HOSPEDA_LINE_HEIGHT;
  process.env.MIRA_USER_DATA = process.env.HOSPEDA_USER_DATA;
  process.env.MIRA_PRINTS_DIR = process.env.HOSPEDA_PRINTS_DIR;
}

async function runReservationPrint(payload, settingsOverride) {
  const printSettings = normalizePrintSettings({
    ...loadPrintSettings(),
    ...(settingsOverride && typeof settingsOverride === "object"
      ? settingsOverride
      : {}),
  });

  if (!printSettings.printerTarget) {
    throw new Error(
      "Nenhuma impressora configurada. Vá em Configurações → Impressão.",
    );
  }

  applyPrintEnv(printSettings);

  const copies = printSettings.printSecondCopy ? 2 : 1;
  for (let i = 0; i < copies; i += 1) {
    await printReservation(payload, printSettings);
  }

  return { ok: true, copies };
}

function sampleReservationPayload(hotelName) {
  return {
    id: "test",
    code: "HSP-TEST",
    statusLabel: "Confirmada",
    hotel: { name: hotelName || "Hospeda" },
    guest: {
      name: "Maria Silva",
      phone: "(11) 99999-0000",
      cpf: "000.000.000-00",
      email: "maria@email.com",
    },
    checkInDate: "2026-09-20",
    checkOutDate: "2026-09-23",
    guests: 2,
    nights: 3,
    plannedNights: 3,
    roomSelection: [
      {
        roomNumber: "12",
        roomTypeName: "Suíte Standard",
        guests: 2,
        nightlyRate: 280,
      },
    ],
    roomType: { name: "Suíte Standard" },
    charges: [
      { type: "MINIBAR", description: "Frigobar", amount: 35 },
    ],
    payments: [
      { method: "PIX", methodLabel: "PIX", amount: 500, status: "CONFIRMED" },
    ],
    bill: {
      roomNights: 840,
      consumption: 35,
      services: 0,
      discounts: 0,
      total: 875,
      paid: 500,
      balance: 375,
    },
    notes: "Chegada prevista após 18h.",
  };
}

function resolveAppIcon() {
  const candidates = [
    path.join(__dirname, "../build/icon.ico"),
    path.join(__dirname, "../assets/icon.png"),
    path.join(__dirname, "../assets/app-icon.png"),
    path.join(__dirname, "../icon.ico"),
  ];
  return candidates.find((file) => fs.existsSync(file));
}

function createWindow() {
  const icon = resolveAppIcon();
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: "Hospeda",
    backgroundColor: "#0f2a2e",
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // Preciso para o preload carregar config/print via require local.
      sandbox: false,
    },
  });

  win.setMenuBarVisibility(false);

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function registerPrintIpc() {
  ipcMain.handle("print:get-settings", async () => {
    const settings = loadPrintSettings();
    const printers = await listWindowsPrinters();
    return { settings, printers, platform: process.platform };
  });

  ipcMain.handle("print:save-settings", (_event, settings) => {
    return savePrintSettings(settings);
  });

  ipcMain.handle("print:list-printers", async () => {
    return listWindowsPrinters();
  });

  ipcMain.handle("print:test", async (_event, overrides) => {
    const hotelName =
      overrides && typeof overrides === "object" ? overrides.hotelName : undefined;
    return runReservationPrint(sampleReservationPayload(hotelName), overrides);
  });

  ipcMain.handle("print:reservation", async (_event, payload) => {
    if (!payload || typeof payload !== "object") {
      throw new Error("Dados da reserva inválidos.");
    }
    return runReservationPrint(payload);
  });
}

app.whenReady().then(() => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.hospeda.app");
  }

  registerPrintIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
