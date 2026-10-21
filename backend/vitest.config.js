import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,                   // describe, it, expect ko bina import kiye use karo
    environment: "node",             // Node.js backend environment me test run karo
    include: ["tests/**/*.test.js"], // sirf tests folder ke .test.js files run karo
    clearMocks: true,                // har test ke baad mock call history clear karo
    restoreMocks: true,              // har test ke baad original functions restore karo
  },
});

