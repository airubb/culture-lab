import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function copyLandingFiles(): Plugin {
  return {
    name: "copy-landing-files",
    closeBundle() {
      const distDir = path.resolve(__dirname, "dist");
      const landingAssetsDir = path.resolve(distDir, "assets/landing");

      mkdirSync(landingAssetsDir, { recursive: true });
      copyFileSync(path.resolve(__dirname, "games.json"), path.resolve(distDir, "games.json"));
      copyFileSync(path.resolve(__dirname, "assets/landing/style.css"), path.resolve(landingAssetsDir, "style.css"));
      copyFileSync(path.resolve(__dirname, "assets/landing/main.js"), path.resolve(landingAssetsDir, "main.js"));

      const landingHtml = readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
      writeFileSync(path.resolve(distDir, "index.html"), landingHtml);

      const calculateCurlingDir = path.resolve(__dirname, "games/calculate-curling");
      execFileSync("npm", ["run", "build"], { cwd: calculateCurlingDir, stdio: "inherit" });

      const calculateCurlingDistDir = path.resolve(calculateCurlingDir, "dist");
      const calculateCurlingOutputDir = path.resolve(distDir, "games/calculate-curling");
      rmSync(calculateCurlingOutputDir, { recursive: true, force: true });
      cpSync(calculateCurlingDistDir, calculateCurlingOutputDir, { recursive: true });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: "/culture-lab/",

  plugins: [
    react(),
    tailwindcss(),
    viteSingleFile(),
    copyLandingFiles(),
  ],

  build: {
    rollupOptions: {
      input: path.resolve(__dirname, "games/medal-block-slot/index.html"),
    },
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
