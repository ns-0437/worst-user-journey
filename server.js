import express from "express";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildIncident } from "./lib/correlate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "data");

const readJSON = (f) => JSON.parse(readFileSync(join(DATA, f), "utf8"));

// Evidence is seeded on disk. If it's missing (fresh clone), regenerate once.
if (!existsSync(join(DATA, "sessions.json"))) {
  await import("./data/generate.js");
}

const sessions = readJSON("sessions.json");
const traces = readJSON("traces.json");
const diagnosis = readJSON("diagnosis.json");
const diffText = readFileSync(join(DATA, "diff.patch"), "utf8");

const app = express();
app.use(express.json());

// --- API -------------------------------------------------------------------

// The whole reconstructed incident, correlated on demand.
app.get("/api/incident", (_req, res) => {
  res.json(buildIncident(sessions, traces, diagnosis));
});

// Raw evidence, so a judge can watch the cohort count fall out of real objects.
app.get("/api/sessions", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 500, sessions.length);
  res.json({ total: sessions.length, sessions: sessions.slice(0, limit) });
});
app.get("/api/traces", (_req, res) => res.json(traces));
app.get("/api/diff", (_req, res) => res.type("text/plain").send(diffText));

// Streamed diagnosis (Server-Sent Events) so it feels generated live.
// If ANTHROPIC_API_KEY is set we call the model; otherwise we stream the
// pre-baked response. Either way the demo never blocks on the network.
app.get("/api/diagnose", async (_req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const incident = buildIncident(sessions, traces, diagnosis);
  let paragraphs = diagnosis.diagnosis;
  let source = "pre-baked";

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      paragraphs = await liveDiagnose(incident);
      source = "live";
    } catch (e) {
      paragraphs = diagnosis.diagnosis; // fall back, silently, on any error
      source = "pre-baked (live call failed)";
    }
  }

  send({ type: "meta", source, causeLine: diagnosis.causeLine });
  for (const p of paragraphs) {
    const words = p.split(" ");
    for (let i = 0; i < words.length; i += 3) {
      send({ type: "chunk", text: words.slice(i, i + 3).join(" ") + " " });
      await sleep(45);
    }
    send({ type: "para_break" });
    await sleep(120);
  }
  send({ type: "done", fix: diagnosis.fix });
  res.end();
});

async function liveDiagnose(incident) {
  const prompt =
    "You are an incident analyst. Given this correlated checkout incident (seeded demo telemetry), " +
    "explain the causal chain in 4 short plain-language paragraphs: why customers suffered, why no alert fired, " +
    "and what deploy caused it. Return ONLY the paragraphs separated by blank lines.\n\n" +
    JSON.stringify({
      deploy: incident.deploy,
      hero: { retry_added_ms: incident.hero.retry_added_ms, rage_clicks: incident.hero.rage_clicks, httpStatus: incident.hero.httpStatus, spanStatus: incident.hero.spanStatus },
      cohort: incident.cohort,
      monitoring: incident.monitoring,
    });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}`);
  const data = await r.json();
  const text = data.content?.map((c) => c.text).join("") || "";
  const paras = text.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  if (!paras.length) throw new Error("empty");
  return paras;
}

// --- static client ---------------------------------------------------------
const dist = join(__dirname, "client", "dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(join(dist, "index.html")));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`worst-user-journey listening on :${PORT}`));
