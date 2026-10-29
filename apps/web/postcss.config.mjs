import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('postcss-load-config').Config} */
const configPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "tailwind.config.ts");
const config = {
  plugins: {
    tailwindcss: { config: configPath },
  },
};

export default config;
