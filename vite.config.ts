import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // En dev, Owlbear charge le manifest depuis un autre domaine.
  // Port fixe, après les fiches (5173), Spellcast FX (5174) et Tempest! (5175), pour les lancer ensemble.
  server: { cors: true, port: 5176, strictPort: true },
  build: {
    rollupOptions: {
      input: { background: resolve("background.html"), panel: resolve("panel.html") },
    },
  },
});
