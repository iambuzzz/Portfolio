import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import unocss from "unocss/vite";
import autoImport from "unplugin-auto-import/vite";
import path from "path";

// Serves the Vercel functions in api/ during `vite dev`, so Siri works locally
// without `vercel dev`. Put GROQ_API_KEY in .env (never VITE_-prefixed).
function vercelApiDev(): Plugin {
  return {
    name: "vercel-api-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        const route = req.url.split("?")[0].replace(/\/$/, "");
        try {
          const mod = await server.ssrLoadModule(`${route}.ts`);
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const request = new Request(`http://${req.headers.host}${req.url}`, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.concat(chunks)
          });
          const response: Response = await mod.default(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          server.config.logger.error(String(err));
          res.statusCode = 404;
          res.end();
        }
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Expose non-VITE_ env vars (GROQ_API_KEY) to the dev API functions only.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  return {
    plugins: [
      unocss(),
      react(),
      autoImport({
        imports: ["react"],
        dts: "src/auto-imports.d.ts",
        dirs: ["src/hooks", "src/stores", "src/components/**"]
      }),
      vercelApiDev()
    ],
    resolve: {
      alias: {
        "~/": `${path.resolve(__dirname, "src")}/`
      }
    },
    build: {
      rollupOptions: {
        output: {
          // Stable vendor chunks cache well across deploys.
          manualChunks: {
            react: ["react", "react-dom"],
            motion: ["framer-motion"]
          }
        }
      }
    }
  };
});
