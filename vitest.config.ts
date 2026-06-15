import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Exclude the vendored ranking-engine snapshot under app/ — it carries its
    // own duplicate *.test.ts files and its own node_modules, which otherwise
    // pollute the run and fail on a missing pg/prisma client.
    exclude: ["**/node_modules/**", "**/dist/**", "app/ranking-engine/**"],
  },
});
