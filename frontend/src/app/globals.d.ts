// src/globals.d.ts
export {};

declare global {
  interface Window {
    electronAPI: {
      getServerConfig: () => { server_host: string; server_port: number } | null;
    };
  }
}
