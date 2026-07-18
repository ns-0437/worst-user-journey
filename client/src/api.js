// Data layer that works two ways:
//  - full-stack: hits the Express API (/api/*), with live SSE diagnosis
//  - static:     falls back to baked files (./incident.json etc.) with a
//                client-side simulated stream — so the same build runs on
//                GitHub Pages with no backend.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function getIncident() {
  try {
    const r = await fetch("/api/incident");
    if (r.ok) return await r.json();
  } catch {}
  return (await fetch("./incident.json")).json();
}

export async function getDiff() {
  try {
    const r = await fetch("/api/diff");
    const ct = r.headers.get("content-type") || "";
    if (r.ok && ct.includes("text")) return await r.text();
  } catch {}
  return (await fetch("./diff.txt")).text();
}

function dispatch(msg, h) {
  if (msg.type === "meta") h.onMeta?.(msg.source, msg.causeLine);
  else if (msg.type === "chunk") h.onChunk?.(msg.text);
  else if (msg.type === "para_break") h.onBreak?.();
  else if (msg.type === "done") h.onDone?.(msg.fix);
}

async function simulate(diagnosis, h) {
  h.onMeta?.("pre-baked (static)", diagnosis.causeLine);
  for (const p of diagnosis.diagnosis) {
    const words = p.split(" ");
    for (let i = 0; i < words.length; i += 3) {
      h.onChunk?.(words.slice(i, i + 3).join(" ") + " ");
      await sleep(45);
    }
    h.onBreak?.();
    await sleep(120);
  }
  h.onDone?.(diagnosis.fix);
}

export async function streamDiagnose(h) {
  try {
    const res = await fetch("/api/diagnose");
    const ct = res.headers.get("content-type") || "";
    if (res.ok && ct.includes("event-stream")) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop();
        for (const ev of events) {
          const line = ev.replace(/^data: /, "").trim();
          if (!line) continue;
          let msg;
          try { msg = JSON.parse(line); } catch { continue; }
          dispatch(msg, h);
        }
      }
      return;
    }
  } catch {}
  const diagnosis = await (await fetch("./diagnosis.json")).json();
  await simulate(diagnosis, h);
}
