import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import unocss from "unocss/vite";
import autoImport from "unplugin-auto-import/vite";
import path from "path";
import { execSync } from "child_process";

// Serves the Vercel functions in api/ during `vite dev` and `vite preview`, so
// Siri and music work locally without `vercel dev`. Put GROQ_API_KEY in .env
// (never VITE_-prefixed).
type Middlewares = { use: (fn: (req: any, res: any, next: () => void) => void) => void };
function apiMiddleware(middlewares: Middlewares, load: (file: string) => Promise<any>, logError: (msg: string) => void) {
  middlewares.use(async (req, res, next) => {
    if (!req.url?.startsWith("/api/")) return next();
    const route = req.url.split("?")[0].replace(/\/$/, "");
    try {
      const mod = await load(`${route}.ts`);
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
      logError(String(err));
      res.statusCode = 404;
      res.end();
    }
  });
}

function vercelApiDev(): Plugin {
  return {
    name: "vercel-api-dev",
    configureServer(server) {
      apiMiddleware(server.middlewares, (f) => server.ssrLoadModule(f), (m) => server.config.logger.error(m));
    },
    configurePreviewServer(server) {
      // The preview server has no module loader: borrow one from a headless dev server.
      let loader: Promise<import("vite").ViteDevServer> | null = null;
      const load = async (file: string) => {
        loader ??= import("vite").then(({ createServer }) =>
          createServer({ configFile: false, root: process.cwd(), logLevel: "error", server: { middlewareMode: true, hmr: false }, appType: "custom" })
        );
        return (await loader).ssrLoadModule(file);
      };
      apiMiddleware(server.middlewares, load, (m) => server.config.logger.error(m));
    }
  };
}

// Absolute site URL for Open Graph tags (social previews need absolute URLs).
// Set VITE_SITE_URL for a custom domain; on Vercel the production domain is used.
function siteUrl(): Plugin {
  const url = (
    process.env.VITE_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:5173")
  ).replace(/\/$/, "");
  return {
    name: "site-url",
    // "pre" so it runs before Vite parses (and URL-decodes) the HTML.
    transformIndexHtml: { order: "pre", handler: (html) => html.replace(/%SITE_URL%/g, url) }
  };
}

// Shown in Settings › About. Uses Vercel's env var when git isn't available.
function buildInfo() {
  let commit = "";
  try {
    commit = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7);
  }
  return { commit, builtAt: new Date().toISOString() };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Expose non-VITE_ env vars (GROQ_API_KEY) to the dev API functions only.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  return {
    define: { __BUILD_INFO__: JSON.stringify(buildInfo()) },
    plugins: [
      unocss(),
      react(),
      autoImport({
        imports: ["react"],
        dts: "src/auto-imports.d.ts",
        dirs: ["src/hooks", "src/stores", "src/components/**"]
      }),
      vercelApiDev(),
      siteUrl()
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
