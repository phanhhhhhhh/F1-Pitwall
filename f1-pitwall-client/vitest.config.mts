import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
    css: false,
    // Node's own experimental `localStorage` global (default-on since Node 24+, see
    // `node --help` -> --no-experimental-webstorage) shadows jsdom's window.localStorage
    // in the test worker, making every localStorage call throw "Cannot read properties of
    // undefined". Disable it so jsdom's implementation is the one tests actually exercise.
    execArgv: ["--no-experimental-webstorage"],
  },
});
