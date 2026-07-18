import React, { useState } from "react";

function SessionLog({ hero }) {
  const tagFor = (e) => {
    if (e.event === "page_exit") return ["exit", "page exit"];
    if (e.event === "spinner_shown") return ["spin", "spinner"];
    if (e.rage) return ["rage", "rage click"];
    if (e.event === "click") return ["click", "click"];
    return ["click", e.event];
  };
  return (
    <div className="card">
      <div style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 12 }}>
        session <code>{hero.id}</code> · {hero.device} · {hero.country} · trace <code>{hero.traceId.slice(0, 12)}…</code>
      </div>
      {hero.events.map((e, i) => {
        const [cls, label] = tagFor(e);
        return (
          <div className="evt" key={i}>
            <span className="ts">+{e.t.toFixed(1)}s</span>
            <span><span className={`tag ${cls}`}>{label}</span> <code style={{ color: "var(--text-mute)" }}>{e.target}</code></span>
            <span style={{ color: "var(--text-mute)", fontSize: 13 }}>{e.completed === false ? "not completed" : e.ok ? "ok" : ""}</span>
          </div>
        );
      })}
    </div>
  );
}

function Waterfall({ hero }) {
  const total = hero.response_ms / 1000;
  const t0 = hero.spans[0]?.startS ?? 0;
  return (
    <div className="card">
      {hero.spans.map((sp, i) => {
        const isServer = sp.kind === "SERVER";
        const left = ((sp.startS - t0) / total) * 100;
        const width = Math.max((sp.durS / total) * 100, 1.5);
        return (
          <div className="wf-row" key={i}>
            <span className="wf-name">{sp.name}</span>
            <div className="wf-bar-wrap">
              <div className={`wf-bar ${isServer ? "server" : "attempt"}`} style={{ left: `${left}%`, width: `${width}%` }} />
            </div>
          </div>
        );
      })}
      <div className="wf-meta">
        <span className="chip ok">http.status_code <b>200</b></span>
        <span className="chip ok">span.status <b>OK</b></span>
        <span className="chip">deployment.version <b>{hero.traceId.slice(-5)}</b></span>
        <span className="chip">retry.count <b>{hero.retry_count}</b></span>
        <span className="chip">retry.total_added_ms <b>{hero.retry_added_ms}</b></span>
      </div>
    </div>
  );
}

function Diff({ diff }) {
  const lines = (diff || "").split("\n");
  return (
    <pre className="diff">
      {lines.map((ln, i) => {
        let cls = "";
        if (ln.startsWith("+") && !ln.startsWith("+++")) cls = "add";
        else if (ln.startsWith("-") && !ln.startsWith("---")) cls = "del";
        else if (ln.startsWith("@@")) cls = "hunk";
        else if (ln.startsWith("diff") || ln.startsWith("index") || ln.startsWith("---") || ln.startsWith("+++") || ln.startsWith("commit") || ln.startsWith("Author") || ln.startsWith("Date")) cls = "meta";
        return <span key={i} className={cls}>{ln || " "}{"\n"}</span>;
      })}
    </pre>
  );
}

export default function Evidence({ hero, diff }) {
  const [tab, setTab] = useState("session");
  return (
    <div>
      <div className="tabs">
        <button className={`tab ${tab === "session" ? "active" : ""}`} onClick={() => setTab("session")}>Session behavior</button>
        <button className={`tab ${tab === "trace" ? "active" : ""}`} onClick={() => setTab("trace")}>Trace + deploy</button>
        <button className={`tab ${tab === "diff" ? "active" : ""}`} onClick={() => setTab("diff")}>Code diff · c19ab</button>
      </div>
      {tab === "session" && <SessionLog hero={hero} />}
      {tab === "trace" && <Waterfall hero={hero} />}
      {tab === "diff" && <Diff diff={diff} />}
    </div>
  );
}
