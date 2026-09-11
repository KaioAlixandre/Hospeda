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

declare global {
  interface Window {
    hospeda?: {
      apiBaseUrl: string;
      platform: string;
      isElectron?: boolean;
      print?: {
        getSettings: () => Promise<PrintSettingsResponse>;
        saveSettings: (
          settings: Partial<PrintSettings>,
        ) => Promise<PrintSettings>;
        listPrinters: () => Promise<string[]>;
        test: (overrides?: Partial<PrintSettings> & { hotelName?: string }) => Promise<{
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
