# 3-minute demo script

**Live:** https://ns-0437.github.io/worst-user-journey/

The whole demo tells **one** story. Don't wander — let the single incident land.

---

### 0:00 — The hook (15s)
> "Errors are observable. Frustration usually isn't. A payment that eventually
> succeeds looks green on every dashboard — but the person who clicked Pay three
> times, waited eight seconds, and left never shows up in an error-rate alert."

Have the live page already open at the top.

### 0:15 — Two realities (30s)
Point at the contrast strip.
> "Same request, two stories. Monitoring saw a 200, status OK, zero alerts. The
> customer waited 8 seconds, 6.8 of them added by retries, rage-clicked Pay, and
> left before it resolved. **The request succeeded. The customer experienced a
> failure.** That gap is the whole product."

### 0:45 — The reconstructed timeline (35s)
Point at the silence band.
> "Top lane is the customer, bottom lane is the system. The charge span is green
> the entire time. But look at this band — 6.8 seconds of no UI feedback. Three
> rage-clicks land right inside it, then they leave at 8.2s."

### 1:20 — The evidence chain (35s)
Click through the three tabs.
> "Three independent sources agree. Session behavior: click, spinner, three rage
> clicks, exit. Trace and deploy: HTTP 200, status OK, deploy c19ab, retry count
> 3. And the code diff — deploy c19ab added an unbounded retry loop with no UI
> state."

### 1:55 — Correlation is real, not mocked (20s)
Point at the correlation row.
> "This number isn't hardcoded. It's `sessions.filter(pending & rage-clicks & left
> early).length` over the seeded data — 184. Change the data, the number changes."

### 2:15 — Diagnosis + fix (30s)
Click **Run diagnosis**, let it stream, then click **Generate fix**.
> "Codex reads the correlated incident and explains the chain in plain language —
> then generates the precise fix: cap the retries and render a pending state so
> success stops feeling like failure."

### 2:45 — The Ghost Story (15s)
Scroll to the card.
> "And the output isn't a dashboard. It's a shareable Ghost Story: 184 customers
> tried to pay, no alert fired, deploy c19ab made success feel like failure.
> That's the card you drop in the incident channel."

---

### Backup plan
- If the network is flaky, the site is **static** — it works offline once loaded.
- Screenshot the Ghost Story card beforehand (the card has a **Download PNG**
  button) and keep it open in another tab.
- Say up front the telemetry is **seeded demo data** — honesty reads as
  confidence, and the causal chain is the point, not a live Datadog hookup.

### The one line to remember
> Start with invisible customer harm, not machine errors — then make the evidence
> emotionally and visually undeniable.
