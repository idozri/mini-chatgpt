import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  const isDev = mode === "development";

  return {
    server: {
      host: "::",
      port: 3000,
    },
    plugins: [
      react(),
      ...(isDev
        ? [
            componentTagger({
              allowedHosts: ["localhost", "mini-chatgpt-frontend.onrender.com"],
            }),
          ]
        : []),
    ],
    define: {
      // This removes tagger code from production bundle
      __ENABLE_LOVABLE_TAGGER__: JSON.stringify(isDev),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    preview: {
      allowedHosts: ["mini-chatgpt-frontend.onrender.com"],
    },
  };
});
