import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for the pure hunting-logic helpers (wind, scent, pressure, camera
// patterns). Node environment — these functions never touch the DOM. The `@/`
// alias mirrors tsconfig so tests import modules the same way the app does.
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
