export {};

type PrintSettings = {
  printerType: string;
  printerTarget: string;
  paperWidthMm: number;
  contentWidthMm: number;
  fontScalePercent: number;
  fontScale: string;
  lineHeight: number;
  printSecondCopy: boolean;
};

type PrintSettingsResponse = {
  settings: PrintSettings;
  printers: string[];
  platform: string;
};

type ApiConfig = {
  apiBaseUrl: string;
  source: "env" | "file" | "default";
  insecure: boolean;
  editable: boolean;
  configPath: string;
};

declare global {
  interface Window {
    hospeda?: {
      apiBaseUrl: string;
      platform: string;
      isElectron?: boolean;
      apiConfig?: {
        get: () => Promise<ApiConfig>;
        save: (url: string) => Promise<{
          apiBaseUrl: string;
          insecure: boolean;
          restartRequired: boolean;
        }>;
      };
      openExternal?: (url: string) => Promise<{ ok: boolean }>;
      print?: {
        getSettings: () => Promise<PrintSettingsResponse>;
        saveSettings: (
          settings: Partial<PrintSettings>,
        ) => Promise<PrintSettings>;
        listPrinters: () => Promise<string[]>;
        test: (
          overrides?: Partial<PrintSettings> & {
            hotelName?: string;
            hotelCnpj?: string;
          },
        ) => Promise<{
          ok: boolean;
          copies: number;
        }>;
        reservation: (payload: unknown) => Promise<{
          ok: boolean;
          copies: number;
        }>;
      };
    };
  }
}
