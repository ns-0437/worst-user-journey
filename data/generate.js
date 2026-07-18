// Deterministic seed generator for the demo.
//
// Everything the demo shows derives from ONE causally-locked hero incident and a
// cohort fanned out around it. Numbers are computed here, never hand-typed in the
// UI, so a judge can ask "where does 184 come from?" and see it fall out of the data.
//
// This is DEMO DATA. It is shaped like real OpenTelemetry / RUM exports but is
// entirely synthetic. Run `npm run seed` (or it runs on postinstall) to (re)generate.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- one clock to rule them all -------------------------------------------
// Deploy c19ab ships, then acts as the boundary. Every session lands after it.
const DEPLOY_ID = "c19ab";
const DEPLOY_AT = Date.parse("2026-07-18T13:52:06.000Z");        // c19ab goes live
const PREV_DEPLOY_ID = "a7f30";
const WINDOW_MS = 98 * 60 * 1000;                                 // ~98 min of traffic
const HERO_AT = Date.parse("2026-07-18T14:32:06.000Z");          // the hero click

// deterministic PRNG so the cohort count is stable across regenerations
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(0xc19ab);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (lo, hi) => lo + rnd() * (hi - lo);
const nanos = (ms) => String(Math.round(ms) * 1_000_000);

const COUNTRIES = ["US", "US", "US", "GB", "DE", "IN", "CA", "FR", "AU", "BR"];
const DEVICES = ["iphone-safari", "android-chrome", "desktop-chrome", "desktop-safari", "desktop-firefox"];

// ---- build one session ----------------------------------------------------
// `frustrated` sessions hit the new pending-mishandling path: the payment call
// returns "pending", the deploy's retry loop silently burns ~6-7s, the UI shows
// no feedback, the user rage-clicks and leaves before the charge resolves.
function buildSession(i, ts, frustrated, hero = false) {
  const traceId = (hero ? "9b1c7f2a" : Math.floor(rnd() * 0xffffffff).toString(16).padStart(8, "0")) +
    "00000000000000000" + DEPLOY_ID;
  const country = pick(COUNTRIES);
  const device = pick(DEVICES);

  if (!frustrated) {
    // clean path: click Pay, brief wait, confirmation shown, done.
    const dur = hero ? 900 : between(600, 1600);
    const events = [
      { t: 0.0, event: "click", target: "#pay-button" },
      { t: +(dur / 1000 * 0.4).toFixed(2), event: "spinner_shown", target: "#pay-status" },
      { t: +(dur / 1000).toFixed(2), event: "confirmation_shown", target: "#pay-status", ok: true },
    ];
    return {
      id: `sess_${String(i).padStart(4, "0")}`,
      traceId,
      startedAt: new Date(ts).toISOString(),
      country, device,
      deploy: DEPLOY_ID,
      payment_status: "succeeded",
      response_ms: Math.round(dur),
      retry_count: 0,
      rage_clicks: 0,
      feedback_shown: true,
      exited_before_resolve: false,
      completed: true,
      events,
    };
  }

  // frustrated path -----------------------------------------------------------
  // scripted hero values; cohort members jitter around them.
  const retryAddedMs = hero ? 6800 : Math.round(between(5200, 7400));
  const baseMs = hero ? 1200 : Math.round(between(900, 1500));
  const totalMs = baseMs + retryAddedMs;              // eventual success duration
  const clicks = hero ? [0.0, 2.1, 4.3, 6.9] : [0.0];
  if (!hero) {
    // 3-5 rage clicks landing inside the silent retry window
    const n = 3 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) clicks.push(+between(1.6, (totalMs / 1000) - 0.6).toFixed(2));
    clicks.sort((a, b) => a - b);
  }
  const exitAt = hero ? 8.2 : +between(clicks[clicks.length - 1] + 0.4, (totalMs / 1000) - 0.2).toFixed(2);
  const rageCount = clicks.filter((t, idx) => idx > 0).length;

  const events = [{ t: 0.0, event: "click", target: "#pay-button" }];
  events.push({ t: 0.3, event: "spinner_shown", target: "#pay-status" });
  clicks.slice(1).forEach((t) => events.push({ t, event: "click", target: "#pay-button", rage: true }));
  events.push({ t: exitAt, event: "page_exit", target: "window", completed: false });

  return {
    id: hero ? "sess_hero" : `sess_${String(i).padStart(4, "0")}`,
    traceId,
    startedAt: new Date(ts).toISOString(),
    country, device,
    deploy: DEPLOY_ID,
    payment_status: "pending",         // <- returned pending, eventually charged
    response_ms: totalMs,
    retry_count: 3,
    retry_added_ms: retryAddedMs,
    rage_clicks: rageCount,
    feedback_shown: false,             // <- the invisible harm: no pending UI
    exited_before_resolve: true,
    completed: false,                  // user left before the (eventual) success
    events,
    hero: hero || undefined,
  };
}

// ---- build spans for a session (OpenTelemetry-ish) ------------------------
function buildSpans(sess) {
  const start = Date.parse(sess.startedAt);
  const spans = [];
  const rootId = sess.traceId.slice(0, 16);

  spans.push({
    traceId: sess.traceId,
    spanId: rootId,
    parentSpanId: "",
    name: "POST /api/payment/charge",
    kind: "SERVER",
    startTimeUnixNano: nanos(start),
    endTimeUnixNano: nanos(start + sess.response_ms),
    attributes: {
      "http.method": "POST",
      "http.route": "/api/payment/charge",
      "http.status_code": 200,                 // <- green. no error.
      "deployment.version": sess.deploy,
      "payment.status": sess.payment_status,
      "retry.count": sess.retry_count,
      ...(sess.retry_added_ms ? { "retry.total_added_ms": sess.retry_added_ms } : {}),
    },
    status: { code: "OK" },                    // <- OK. no alert will fire.
  });

  if (sess.payment_status === "pending") {
    // the retry loop introduced by c19ab: 3 attempts with backoff, all "pending"
    let cursor = start + 120;
    const each = Math.round((sess.retry_added_ms || 6800) / 3);
    for (let a = 1; a <= 3; a++) {
      spans.push({
        traceId: sess.traceId,
        spanId: `${rootId.slice(0, 12)}${String(a).padStart(4, "0")}`,
        parentSpanId: rootId,
        name: "psp.charge.attempt",
        kind: "CLIENT",
        startTimeUnixNano: nanos(cursor),
        endTimeUnixNano: nanos(cursor + each - 40),
        attributes: {
          "deployment.version": sess.deploy,
          "psp.attempt": a,
          "psp.result": "pending",
          "backoff.ms": a === 1 ? 0 : (a - 1) * 800,
        },
        status: { code: "OK" },
      });
      cursor += each;
    }
  }
  return spans;
}

// ---- generate cohort ------------------------------------------------------
const TOTAL = 240;
const sessions = [];
const traces = { deploy: { id: DEPLOY_ID, deployedAt: new Date(DEPLOY_AT).toISOString(), previous: PREV_DEPLOY_ID }, spans: [] };

// hero first, at its exact time
const hero = buildSession(1, HERO_AT, true, true);
sessions.push(hero);
traces.spans.push(...buildSpans(hero));

// then the rest, ~77% frustrated so the computed cohort lands at 184 total
let idx = 2;
for (let n = 0; n < TOTAL - 1; n++) {
  const ts = DEPLOY_AT + Math.floor(between(60_000, WINDOW_MS));
  const frustrated = rnd() < 0.794;
  const s = buildSession(idx++, ts, frustrated);
  sessions.push(s);
  traces.spans.push(...buildSpans(s));
}

sessions.sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));

// ---- write ----------------------------------------------------------------
mkdirSync(__dirname, { recursive: true });
writeFileSync(join(__dirname, "sessions.json"), JSON.stringify(sessions, null, 2));
writeFileSync(join(__dirname, "traces.json"), JSON.stringify(traces, null, 2));

const cohort = sessions.filter(
  (s) => s.payment_status === "pending" && s.rage_clicks >= 3 && s.exited_before_resolve
);
console.log(`seeded ${sessions.length} sessions; ${cohort.length} match the frustration pattern (incl. hero).`);
