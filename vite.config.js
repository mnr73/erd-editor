import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { URL, fileURLToPath } from "node:url";
import Icons from "unplugin-icons/vite";
import { defineConfig } from "vite";

/** ~icons/* modules have no side effects; without this unused icons end up in the bundle. */
function iconsTreeShaking() {
    return {
        name: "icons-tree-shaking",
        enforce: "post",
        transform(code, id) {
            if (id.includes("~icons/")) {
                return { code, map: null, moduleSideEffects: false };
            }
        },
    };
}

// https://v2.tauri.app/start/frontend/vite/
export default defineConfig({
    plugins: [
        vue(),
        tailwindcss(),
        // No auto-import: icons come only from src/icons.js
        Icons({ compiler: "vue3" }),
        iconsTreeShaking(),
    ],
    resolve: {
        alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    clearScreen: false,
    server: { port: 1421, strictPort: true, host: "127.0.0.1" },
    build: { outDir: "dist", emptyOutDir: true, target: "es2022" },
});
