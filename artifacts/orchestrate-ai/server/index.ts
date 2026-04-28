import express, { type Request, type Response } from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rawPort = process.env.PORT;
if (!rawPort) {
  throw new Error("PORT environment variable is required.");
}
const PORT = Number(rawPort);
if (Number.isNaN(PORT) || PORT <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const isProd = process.env.NODE_ENV === "production";

type GeminiBody = {
  modelId?: string;
  prompt?: string;
  image?: { mimeType: string; data: string } | null;
};

function buildContents(prompt: string, image?: GeminiBody["image"]) {
  const parts: any[] = [{ text: prompt }];
  if (image && image.mimeType && image.data) {
    parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
  }
  return [{ parts }];
}

async function main() {
  const app = express();
  app.use(express.json({ limit: "25mb" }));

  app.post("/api/gemini/stream", async (req: Request, res: Response) => {
    const apiKey = req.header("x-gemini-key");
    const { modelId, prompt, image } = (req.body || {}) as GeminiBody;

    if (!apiKey) {
      res.status(400).json({ error: "Missing x-gemini-key header" });
      return;
    }
    if (!modelId || !prompt) {
      res.status(400).json({ error: "Missing modelId or prompt" });
      return;
    }

    const upstreamUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}` +
      `:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

    const controller = new AbortController();
    req.on("close", () => controller.abort());

    let upstream: Response;
    try {
      upstream = (await fetch(upstreamUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: buildContents(prompt, image) }),
        signal: controller.signal,
      })) as unknown as Response;
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(502).json({ error: `Upstream fetch failed: ${err?.message || err}` });
      }
      return;
    }

    if (!upstream.ok || !upstream.body) {
      let detail = "";
      try {
        detail = await upstream.text();
      } catch {}
      res
        .status(upstream.status || 502)
        .type("text/plain")
        .send(detail || `Gemini upstream ${upstream.status}`);
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const reader = (upstream.body as any).getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) res.write(Buffer.from(value));
      }
    } catch {
      // client aborted or upstream error mid-stream
    } finally {
      try {
        await reader.cancel();
      } catch {}
      res.end();
    }
  });

  app.post("/api/gemini/generate", async (req: Request, res: Response) => {
    const apiKey = req.header("x-gemini-key");
    const { modelId, prompt, image } = (req.body || {}) as GeminiBody;

    if (!apiKey) {
      res.status(400).json({ error: "Missing x-gemini-key header" });
      return;
    }
    if (!modelId || !prompt) {
      res.status(400).json({ error: "Missing modelId or prompt" });
      return;
    }

    const upstreamUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}` +
      `:generateContent?key=${encodeURIComponent(apiKey)}`;

    try {
      const upstream = await fetch(upstreamUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: buildContents(prompt, image) }),
      });
      const text = await upstream.text();
      res.status(upstream.status).type("application/json").send(text);
    } catch (err: any) {
      res.status(502).json({ error: `Upstream fetch failed: ${err?.message || err}` });
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
