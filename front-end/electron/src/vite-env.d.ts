export {};

declare global {
  interface Window {
    hospeda?: {
      apiBaseUrl: string;
      platform: string;
    };
  }
}
