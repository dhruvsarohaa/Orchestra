import express, { type Request, type Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { generateLLM, providerFromHeader, streamLLM, writeSseHeaders } from "@workspace/provider-proxy";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rawPort = process.env.PORT || "5173";
const PORT = Number(rawPort);
if (Number.isNaN(PORT) || PORT <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const isProd = process.env.NODE_ENV === "production";

type GeminiBody = {
  providerId?: "google" | "groq" | "openrouter" | "anthropic" | "together";
  modelId?: string;
  prompt?: string;
  image?: { mimeType: string; data: string } | null;
  temperature?: number;
  maxTokens?: number;
};

async function main() {
  const app = express();
  app.use(express.json({ limit: "25mb" }));

  app.use((req, _res, next) => {
    req.setTimeout(60000);
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ ok: true, service: "orchestrateai" });
  });

  app.post("/api/llm/stream", async (req: Request, res: Response) => {
    const { modelId, prompt, image, temperature, maxTokens, providerId } = (req.body || {}) as GeminiBody;
    const provider = providerFromHeader(providerId || req.header("x-provider-id") || "google");
    const apiKey = req.header("x-provider-key") || process.env[`${provider.toUpperCase()}_API_KEY`];
    if (!apiKey || !modelId || !prompt) {
      res.status(400).json({ error: { code: "bad_request", message: "Missing provider key, modelId, or prompt" } });
      return;
    }
    const controller = new AbortController();
    req.on("close", () => controller.abort());
    writeSseHeaders(res);
    try {
      const stream = streamLLM({
        provider,
        modelId,
        prompt,
        image: image ?? null,
        apiKey,
        temperature,
        maxTokens,
        signal: controller.signal,
      });
      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
      }
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Stream failed";
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
  });

  app.post("/api/llm/generate", async (req: Request, res: Response) => {
    const { modelId, prompt, image, temperature, maxTokens, providerId } = (req.body || {}) as GeminiBody;
    const provider = providerFromHeader(providerId || req.header("x-provider-id") || "google");
    const apiKey = req.header("x-provider-key") || process.env[`${provider.toUpperCase()}_API_KEY`];
    if (!apiKey || !modelId || !prompt) {
      res.status(400).json({ error: { code: "bad_request", message: "Missing provider key, modelId, or prompt" } });
      return;
    }
    try {
      const text = await generateLLM({
        provider,
        modelId,
        prompt,
        image: image ?? null,
        apiKey,
        temperature,
        maxTokens,
      });
      res.status(200).json({ text });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Generate failed";
      res.status(502).json({ error: { code: "upstream_error", message } });
    }
  });

  if (isProd) {
    const distPath = path.resolve(__dirname, "..", "dist", "public");
    app.use(express.static(distPath));
    app.get(/.*/, (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      configFile: path.resolve(__dirname, "..", "vite.config.ts"),
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`OrchestrateAI server listening on http://0.0.0.0:${PORT} (${isProd ? "production" : "development"})`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
