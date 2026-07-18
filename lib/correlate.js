// The correlation engine. NOT ML — a deterministic join + filter.
//
// It reads the three seeded evidence sources and produces one incident object:
//   - the hero session's behavior events and its trace spans on a single timeline
//   - the deploy boundary that explains the regression
//   - the cohort of similar sessions, COUNTED from the data (never hardcoded)

// A session belongs to the "invisible harm" cohort when the payment came back
// pending, the user rage-clicked past our patience threshold, and they left
// before the (eventual) success resolved. This is the pattern the hero shows.
export function matchesFrustrationPattern(s) {
  return (
    s.payment_status === "pending" &&
    s.rage_clicks >= 3 &&
    s.exited_before_resolve === true
  );
}

export function buildIncident(sessions, traces, diagnosis) {
  const hero = sessions.find((s) => s.hero) || sessions[0];
  const cohort = sessions.filter(matchesFrustrationPattern);

  // hero spans, sorted, normalized to seconds-from-first-span
  const heroSpans = traces.spans
    .filter((sp) => sp.traceId === hero.traceId)
    .sort((a, b) => Number(a.startTimeUnixNano) - Number(b.startTimeUnixNano));
  const t0 = heroSpans.length ? Number(heroSpans[0].startTimeUnixNano) : 0;
  const spans = heroSpans.map((sp) => ({
    name: sp.name,
    kind: sp.kind,
    startS: +(((Number(sp.startTimeUnixNano) - t0) / 1e9)).toFixed(2),
    durS: +(((Number(sp.endTimeUnixNano) - Number(sp.startTimeUnixNano)) / 1e9)).toFixed(2),
    attributes: sp.attributes,
    status: sp.status.code,
  }));

  const rootSpan = spans.find((sp) => sp.kind === "SERVER") || spans[0];
  const retryAddedMs = hero.retry_added_ms || 0;

  // averages across the cohort — again, computed
  const avgRage = +(cohort.reduce((a, s) => a + s.rage_clicks, 0) / cohort.length).toFixed(1);
  const avgAddedMs = Math.round(
    cohort.reduce((a, s) => a + (s.retry_added_ms || 0), 0) / cohort.length
  );

  return {
    isDemoData: true,
    deploy: {
      id: traces.deploy.id,
      previous: traces.deploy.previous,
      deployedAt: traces.deploy.deployedAt,
    },
    hero: {
      id: hero.id,
      traceId: hero.traceId,
      startedAt: hero.startedAt,
      country: hero.country,
      device: hero.device,
      events: hero.events,
      spans,
      payment_status: hero.payment_status,
      response_ms: hero.response_ms,
      retry_count: hero.retry_count,
      retry_added_ms: retryAddedMs,
      rage_clicks: hero.rage_clicks,
      exited_before_resolve: hero.exited_before_resolve,
      httpStatus: rootSpan?.attributes?.["http.status_code"],
      spanStatus: rootSpan?.status,
    },
    cohort: {
      count: cohort.length,                 // <- 184, straight from the filter
      others: cohort.length - 1,            // "183 similar sessions"
      avgRageClicks: avgRage,
      avgAddedMs,
      totalSessionsInWindow: sessions.length,
    },
    monitoring: {
      // why nothing fired: every hero span is green
      errorRate: "0.0%",
      httpStatus: rootSpan?.attributes?.["http.status_code"] ?? 200,
      spanStatus: rootSpan?.status ?? "OK",
      alertsFired: 0,
    },
    diagnosis,
  };
}
