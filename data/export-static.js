// Exports the correlated incident + evidence as static files so the exact same
// UI can run with NO backend (e.g. GitHub Pages). The Express server is still the
// "real" path; this just bakes a snapshot the client can fetch directly.

import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildIncident } from "../lib/correlate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = __dirname;
const PUB = join(__dirname, "..", "client", "public");
const readJSON = (f) => JSON.parse(readFileSync(join(DATA, f), "utf8"));

mkdirSync(PUB, { recursive: true });

const sessions = readJSON("sessions.json");
const traces = readJSON("traces.json");
const diagnosis = readJSON("diagnosis.json");
const incident = buildIncident(sessions, traces, diagnosis);

writeFileSync(join(PUB, "incident.json"), JSON.stringify(incident));
writeFileSync(join(PUB, "diagnosis.json"), JSON.stringify(diagnosis));
copyFileSync(join(DATA, "diff.patch"), join(PUB, "diff.txt"));

console.log(`exported static snapshot to client/public (cohort ${incident.cohort.count}).`);
