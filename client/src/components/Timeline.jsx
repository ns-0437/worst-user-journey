import React from "react";

// Reconstructed timeline for the hero session. Two lanes:
//   top    — what the customer did (clicks, rage clicks, exit)
//   bottom — what the system did (trace spans)
// The dashed band between them is the silence: the seconds with no UI feedback.
export default function Timeline({ hero }) {
  const baseMs = hero.response_ms - hero.retry_added_ms;
  const exitS = (hero.events.find((e) => e.event === "page_exit")?.t) ?? hero.response_ms / 1000;
  const maxS = Math.max(hero.response_ms / 1000, exitS) + 0.8;
  const pct = (s) => `${(s / maxS) * 100}%`;

  const silenceStart = baseMs / 1000;
  const silenceEnd = hero.response_ms / 1000;

  const clicks = hero.events.filter((e) => e.event === "click");
  const ticks = Array.from({ length: Math.ceil(maxS) + 1 }, (_, i) => i);

  return (
    <div className="tl">
      <div className="tl-lane-label">the customer</div>
      <div className="tl-track" style={{ marginBottom: 26 }}>
        <div
          className="silence-band"
          style={{ left: pct(silenceStart), width: pct(silenceEnd - silenceStart) }}
        >
          <span className="silence-label" style={{ left: 6 }}>
            {(hero.retry_added_ms / 1000).toFixed(1)}s of no feedback
          </span>
        </div>
        {clicks.map((c, i) => (
          <React.Fragment key={i}>
            <div className={`click-mark ${c.rage ? "rage" : ""}`} style={{ left: pct(c.t) }} />
            {c.rage && <div className="click-dot" style={{ left: pct(c.t) }}>✗</div>}
          </React.Fragment>
        ))}
        <div className="exit-mark" style={{ left: pct(exitS) }} />
        <div className="exit-flag" style={{ left: pct(exitS) }}>left at {exitS.toFixed(1)}s</div>
      </div>

      <div className="tl-lane-label">the system</div>
      <div className="tl-track" style={{ height: 44 }}>
        {hero.spans.map((sp, i) => {
          const isServer = sp.kind === "SERVER";
          return (
            <div
              key={i}
              className={`tl-span ${isServer ? "ok" : "retry"}`}
              style={{
                left: pct(sp.startS),
                width: pct(Math.max(sp.durS, 0.12)),
                top: isServer ? 8 : 8,
                zIndex: isServer ? 1 : 2,
                opacity: isServer ? 1 : 0.92,
              }}
              title={`${sp.name} — ${sp.durS}s — HTTP ${sp.attributes["http.status_code"] ?? "—"} ${sp.status}`}
            >
              {isServer ? `charge · 200 OK · ${sp.durS}s` : `retry ${sp.attributes["psp.attempt"]}`}
            </div>
          );
        })}
      </div>

      <div className="tl-axis">
        {ticks.map((t) => <span key={t}>{t}s</span>)}
      </div>

      <p className="tl-caption">
        The charge returned <b>200 OK</b> after {(hero.response_ms / 1000).toFixed(1)}s — so monitoring
        stayed green. But the retry loop burned <b>{(hero.retry_added_ms / 1000).toFixed(1)} seconds</b> with
        no feedback. The customer clicked Pay <b>{hero.rage_clicks} more times</b> and left before it resolved.
      </p>
    </div>
  );
}
