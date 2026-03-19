import { readFile } from "node:fs/promises";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(async () => {
  const tauriConfig = JSON.parse(
    await readFile(new URL("./src-tauri/tauri.conf.json", import.meta.url), "utf8")
  ) as { version: string };

  return ({
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(tauriConfig.version),
    },

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
      port: 1420,
      strictPort: true,
      watch: {
        // 3. tell vite to ignore watching `src-tauri`
        ignored: ["**/src-tauri/**"],
      },
    },
  });
});
