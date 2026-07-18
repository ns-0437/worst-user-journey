import React, { useRef, useState } from "react";

export default function GhostCard({ incident, causeLine }) {
  const ref = useRef(null);
  const [copied, setCopied] = useState(false);
  const { cohort, deploy } = incident;

  const cause = causeLine || incident.diagnosis.causeLine;

  const textVersion =
    `${cohort.count} customers tried to pay.\n` +
    `No alert fired.\n` +
    `Deploy ${deploy.id} made success feel like failure.`;

  async function copy() {
    await navigator.clipboard.writeText(textVersion);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function download() {
    if (!window.html2canvas) return;
    const canvas = await window.html2canvas(ref.current, { backgroundColor: "#0b0710", scale: 2 });
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "ghost-story.png";
    a.click();
  }

  return (
    <div>
      <div className="ghost" ref={ref}>
        <div className="kicker">Ghost Story · invisible customer harm</div>
        <div className="lines">
          <div className="l"><span className="hl">{cohort.count}</span> customers tried to pay.</div>
          <div className="l">No alert fired.</div>
          <div className="l">Deploy <code>{deploy.id}</code> made success feel like failure.</div>
        </div>
        <div className="foot">
          <div style={{ display: "flex", gap: 28 }}>
            <div className="stat"><b>{(incident.hero.retry_added_ms / 1000).toFixed(1)}s</b>added by retries</div>
            <div className="stat"><b>{cohort.avgRageClicks}</b>avg rage clicks</div>
            <div className="stat"><b>0</b>alerts fired</div>
          </div>
          <div className="brand">The Internet's Worst<br />User Journey</div>
        </div>
      </div>
      <div className="card-actions">
        <button className="btn" onClick={copy}>{copied ? "Copied ✓" : "Copy text"}</button>
        <button className="btn" onClick={download}>Download PNG</button>
      </div>
    </div>
  );
}
