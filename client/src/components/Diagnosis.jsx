import React, { useState, useRef } from "react";
import { streamDiagnose } from "../api.js";

function DiffBlock({ patch }) {
  return (
    <pre className="diff" style={{ marginTop: 14 }}>
      {patch.split("\n").map((ln, i) => {
        let cls = "";
        if (ln.startsWith("+") && !ln.startsWith("+++")) cls = "add";
        else if (ln.startsWith("-") && !ln.startsWith("---")) cls = "del";
        else if (ln.startsWith("@@")) cls = "hunk";
        else if (ln.startsWith("diff") || ln.startsWith("---") || ln.startsWith("+++")) cls = "meta";
        return <span key={i} className={cls}>{ln || " "}{"\n"}</span>;
      })}
    </pre>
  );
}

export default function Diagnosis({ onCause }) {
  const [state, setState] = useState("idle"); // idle | running | done
  const [paras, setParas] = useState([""]);
  const [source, setSource] = useState("");
  const [fix, setFix] = useState(null);
  const [showFix, setShowFix] = useState(false);
  const parasRef = useRef([""]);

  async function run() {
    setState("running");
    setParas([""]);
    parasRef.current = [""];
    setFix(null);
    setShowFix(false);

    await streamDiagnose({
      onMeta: (source, causeLine) => { setSource(source); onCause?.(causeLine); },
      onChunk: (text) => {
        const cur = parasRef.current.slice();
        cur[cur.length - 1] += text;
        parasRef.current = cur;
        setParas(cur);
      },
      onBreak: () => {
        parasRef.current = [...parasRef.current, ""];
        setParas(parasRef.current);
      },
      onDone: (fix) => {
        setFix(fix);
        setState("done");
      },
    });
  }

  return (
    <div>
      {state === "idle" && (
        <button className="btn primary" onClick={run}>
          ▶ Run diagnosis
        </button>
      )}

      {state !== "idle" && (
        <div className="card">
          <div className="diag-body">
            {paras.map((p, i) => (
              <p key={i} className={state === "running" && i === paras.length - 1 ? "cursor" : ""}>{p}</p>
            ))}
          </div>
          {source && <div className="diag-source">diagnosis source: {source} · seeded demo telemetry</div>}
        </div>
      )}

      {state === "done" && fix && (
        <div style={{ marginTop: 18 }}>
          {!showFix ? (
            <button className="btn fix" onClick={() => setShowFix(true)}>+ Generate fix</button>
          ) : (
            <div className="card">
              <h3 style={{ marginBottom: 6 }}>Suggested fix</h3>
              <p style={{ color: "var(--text-dim)", fontSize: 15 }}>{fix.summary}</p>
              <DiffBlock patch={fix.patch} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
