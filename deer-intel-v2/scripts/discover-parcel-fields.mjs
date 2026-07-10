#!/usr/bin/env node
// Probes every PASDA county parcel service, guesses which fields hold the owner
// name / acreage / parcel id / situs address, and pulls a couple of real
// records to validate the guess. Output is a JSON map the fetch step consumes.
//
// Run with NODE_USE_ENV_PROXY=1 behind the agent proxy.
//   node scripts/discover-parcel-fields.mjs > .parcel-build/fields.json

const ROOT =
  "https://mapservices.pasda.psu.edu/server/rest/services/pasda";

// Heuristics: ordered so the best candidate wins. Matched case-insensitively
// against a field's name (and alias).
const OWNER = [/^full_?owner/i, /owner_?name/i, /^owner$/i, /ownername/i, /^name$/i, /^owner/i, /grantee/i];
const ACRES = [/total_?deed/i, /deed(ed)?_?ac/i, /calc_?ac/i, /gis_?ac/i, /^acres?$/i, /acre/i, /_ac$/i, /^ac_/i];
const PIN = [/control_?nu/i, /^pin$/i, /parcel_?id/i, /^uni_?parc/i, /^upi/i, /map_?num/i, /pin_?num/i, /parcel/i, /^gpin/i];
const SITUS = [/full_?situs/i, /^situs/i, /site_?addr/i, /prop_?addr/i, /^location$/i, /situs/i, /^address/i, /_addr/i];

function pick(fields, patterns) {
  for (const p of patterns) {
    const hit = fields.find(
      (f) => p.test(f.name) || (f.alias && p.test(f.alias)),
    );
    if (hit) return hit.name;
  }
  return null;
}

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data && data.error) throw new Error(data.error.message || "service error");
  return data;
}

async function listCounties() {
  const data = await getJson(`${ROOT}?f=json`);
  return (data.services || [])
    .map((s) => s.name.split("/").pop())
    .filter((n) => /County|Parcels/i.test(n))
    .sort();
}

async function probe(service) {
  const layer = `${ROOT}/${service}/MapServer/0`;
  const meta = await getJson(`${layer}?f=json`);
  const fields = meta.fields || [];
  const mapping = {
    owner: pick(fields, OWNER),
    acres: pick(fields, ACRES),
    pin: pick(fields, PIN),
    situs: pick(fields, SITUS),
  };

  // Validate: pull 2 records and show the chosen values.
  let sample = [];
  let count = null;
  try {
    const q = new URL(`${layer}/query`);
    q.searchParams.set("where", "1=1");
    q.searchParams.set(
      "outFields",
      [mapping.owner, mapping.acres, mapping.pin, mapping.situs]
        .filter(Boolean)
        .join(","),
    );
    q.searchParams.set("returnGeometry", "false");
    q.searchParams.set("resultRecordCount", "2");
    q.searchParams.set("f", "json");
    const res = await getJson(q.toString());
    sample = (res.features || []).map((f) => f.attributes);

    const cq = new URL(`${layer}/query`);
    cq.searchParams.set("where", "1=1");
    cq.searchParams.set("returnCountOnly", "true");
    cq.searchParams.set("f", "json");
    const cres = await getJson(cq.toString());
    count = cres.count ?? null;
  } catch (err) {
    sample = [{ error: err.message }];
  }

  return { service, layerName: meta.name, count, mapping, sample };
}

async function main() {
  const counties = await listCounties();
  const results = [];
  // Small concurrency so we don't hammer PASDA.
  const queue = [...counties];
  const workers = Array.from({ length: 6 }, async () => {
    for (;;) {
      const svc = queue.shift();
      if (!svc) break;
      try {
        results.push(await probe(svc));
        process.stderr.write(`  probed ${svc}\n`);
      } catch (err) {
        results.push({ service: svc, error: err.message });
        process.stderr.write(`  FAILED ${svc}: ${err.message}\n`);
      }
    }
  });
  await Promise.all(workers);
  results.sort((a, b) => a.service.localeCompare(b.service));
  process.stdout.write(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
