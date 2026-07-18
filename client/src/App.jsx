import React, { useEffect, useState } from "react";
import Timeline from "./components/Timeline.jsx";
import Evidence from "./components/Evidence.jsx";
import Diagnosis from "./components/Diagnosis.jsx";
import GhostCard from "./components/GhostCard.jsx";
import { getIncident, getDiff } from "./api.js";

export default function App() {
  const [incident, setIncident] = useState(null);
  const [diff, setDiff] = useState("");
  const [causeLine, setCauseLine] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    Promise.all([getIncident(), getDiff()])
      .then(([inc, d]) => { setIncident(inc); setDiff(d); })
      .catch((e) => setErr(String(e)));
  }, []);

  if (err) return <div className="wrap"><div className="loading">Failed to load incident: {err}</div></div>;
  if (!incident) return <div className="wrap"><div className="loading">Reconstructing the incident…</div></div>;

  const { hero, cohort, monitoring, deploy } = incident;

  return (
    <div className="wrap">
      <div className="masthead">
        <div>
          <div className="eyebrow">Errors are observable · frustration usually isn't</div>
          <h1 className="title">The Internet's Worst User Journey</h1>
        </div>
        <span className="badge-demo">DEMO DATA · seeded OTel</span>
      </div>
      <p className="subtitle">
        One reconstructed checkout incident where every monitor stayed green — and {cohort.count} customers
        had a terrible time anyway. Evidence is seeded, causally-locked synthetic telemetry.
      </p>

      {/* contrast */}
      <div className="section">
        <div className="section-label">Two realities, same request</div>
        <div className="contrast">
          <div className="card green">
            <div className="side-head">What monitoring saw</div>
            <div className="metric-row"><span className="k">Error rate</span><span className="v ok">{monitoring.errorRate}</span></div>
            <div className="metric-row"><span className="k">HTTP status</span><span className="v ok">{monitoring.httpStatus} OK</span></div>
            <div className="metric-row"><span className="k">Span status</span><span className="v ok">{monitoring.spanStatus}</span></div>
            <div className="metric-row"><span className="k">Alerts fired</span><span className="v ok">{monitoring.alertsFired}</span></div>
          </div>
          <div className="card human">
            <div className="side-head">What the customer felt</div>
            <div className="metric-row"><span className="k">Time waiting</span><span className="v bad">{(hero.response_ms / 1000).toFixed(1)}s</span></div>
            <div className="metric-row"><span className="k">Extra from retries</span><span className="v bad">{(hero.retry_added_ms / 1000).toFixed(1)}s</span></div>
            <div className="metric-row"><span className="k">Rage clicks on Pay</span><span className="v bad">{hero.rage_clicks}</span></div>
            <div className="metric-row"><span className="k">Left before success</span><span className="v bad">Yes</span></div>
          </div>
        </div>
        <p className="dissonance">
          The request <b>succeeded</b>. The customer experienced a <b>failure</b>. That gap is what no dashboard shows.
        </p>
      </div>

      {/* timeline */}
      <div className="section">
        <div className="section-label">Reconstructed timeline · session {hero.id}</div>
        <div className="card"><Timeline hero={hero} /></div>
      </div>

      {/* evidence */}
      <div className="section">
        <div className="section-label">The evidence chain · 3 sources</div>
        <Evidence hero={hero} diff={diff} />
      </div>

      {/* deploy + cohort callout */}
      <div className="section">
        <div className="section-label">Correlation · computed, not hardcoded</div>
        <div className="card">
          <div className="wf-meta" style={{ marginTop: 0 }}>
            <span className="chip">deploy <b>{deploy.id}</b> (was {deploy.previous})</span>
            <span className="chip">sessions in window <b>{cohort.totalSessionsInWindow}</b></span>
            <span className="chip">matched pattern <b>{cohort.count}</b></span>
            <span className="chip">others like the hero <b>{cohort.others}</b></span>
            <span className="chip">avg rage clicks <b>{cohort.avgRageClicks}</b></span>
          </div>
          <p style={{ color: "var(--text-dim)", fontSize: 14, marginTop: 14 }}>
            <code>sessions.filter(payment==="pending" &amp;&amp; rageClicks≥3 &amp;&amp; leftBeforeResolve)</code> →
            {" "}<b style={{ color: "var(--text)" }}>{cohort.count}</b>. The number in the card below is this filter's length,
            not a constant.
          </p>
        </div>
      </div>

      {/* diagnosis + fix */}
      <div className="section">
        <div className="section-label">Codex diagnosis &amp; fix</div>
        <Diagnosis onCause={setCauseLine} />
      </div>

      {/* ghost card */}
      <div className="section">
        <div className="section-label">The shareable output</div>
        <GhostCard incident={incident} causeLine={causeLine} />
      </div>

      <div className="footer-note">
        Demo data — synthetic, causally-locked telemetry shaped like OpenTelemetry / RUM exports. No live
        Datadog/Sentry integration. Built to make invisible customer harm visible.
      </div>
    </div>
  );
}
