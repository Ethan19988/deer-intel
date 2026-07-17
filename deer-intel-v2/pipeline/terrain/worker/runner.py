#!/usr/bin/env python3
"""Terrain worker: claim 1 m read jobs from Supabase, run the pipeline, store
the result.

Loop: call the `claim_terrain_job` RPC (atomic, SKIP LOCKED) with the
service-role key; if it returns a job, run fetch_dem -> fetch_roads ->
terrain_derivatives -> scout_rules (clipped to the drawn outline), upsert the
resulting set into `terrain_sets`, and mark the job done. On failure the job is
marked error with the message. Runs one job at a time (the pipeline is
memory-bound); scale out by running more replicas.

Env:
  SUPABASE_URL                 e.g. https://xxxx.supabase.co
  SUPABASE_SERVICE_ROLE_KEY    service-role key (server-only, bypasses RLS)
  WORKER_ID                    optional label (defaults to the hostname)
  POLL_SECONDS                 idle poll interval (default 20)
"""
from __future__ import annotations

import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone

import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
WORKER_ID = os.environ.get("WORKER_ID") or socket.gethostname()
POLL_SECONDS = float(os.environ.get("POLL_SECONDS", "20"))

# pipeline/terrain — the scripts live one level up from this file.
PIPELINE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

REST = f"{SUPABASE_URL}/rest/v1"
HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def claim_job() -> dict | None:
    r = requests.post(
        f"{REST}/rpc/claim_terrain_job",
        headers=HEADERS,
        json={"p_worker": WORKER_ID},
        timeout=30,
    )
    r.raise_for_status()
    rows = r.json()
    return rows[0] if rows else None


def update_job(job_id: str, fields: dict) -> None:
    r = requests.patch(
        f"{REST}/terrain_jobs?id=eq.{job_id}",
        headers={**HEADERS, "Prefer": "return=minimal"},
        json=fields,
        timeout=30,
    )
    r.raise_for_status()


def upsert_set(row: dict) -> None:
    r = requests.post(
        f"{REST}/terrain_sets",
        headers={**HEADERS, "Prefer": "resolution=merge-duplicates,return=minimal"},
        json=row,
        timeout=60,
    )
    r.raise_for_status()


def safe_name(property_id: str) -> str:
    """A stable, filesystem-safe work name per property, so downloaded LiDAR
    tiles and derivatives are reused when a read is regenerated."""
    slug = re.sub(r"[^a-z0-9]+", "-", property_id.lower()).strip("-")
    return f"prop-{slug or 'x'}"


def run(cmd: list[str]) -> str:
    print(f"[worker] $ {' '.join(cmd)}", flush=True)
    p = subprocess.run(cmd, cwd=PIPELINE_DIR, capture_output=True, text=True)
    if p.returncode != 0:
        tail = (p.stdout or "")[-1500:] + (p.stderr or "")[-1500:]
        raise RuntimeError(f"{cmd[1]} failed (rc={p.returncode}): {tail}")
    return p.stdout or ""


def stage(job_id: str, label: str) -> None:
    """Best-effort progress label for the UI; never fail the job over it."""
    try:
        update_job(job_id, {"stage": label})
    except Exception as e:  # noqa: BLE001
        print(f"[worker] stage update failed: {e}", flush=True)


def process(job: dict) -> None:
    name = safe_name(job["property_id"])
    work = os.path.join(PIPELINE_DIR, "work", name)
    os.makedirs(work, exist_ok=True)
    jid = job["id"]

    # 1. The drawn outline (clip target) as a FeatureCollection.
    outline_path = os.path.join(work, "outline.geojson")
    with open(outline_path, "w") as f:
        json.dump(
            {"type": "FeatureCollection",
             "features": [{"type": "Feature", "properties": {}, "geometry": job["outline"]}]},
            f,
        )

    # 2. DEM for the outline's bbox [minLng, minLat, maxLng, maxLat]. Tiles land
    #    in the shared cache (TILE_CACHE_DIR), so overlapping tracts reuse them.
    stage(jid, "fetching elevation")
    bbox = [str(v) for v in job["bbox"]]
    run(["python3", "fetch_dem.py", "--name", name, "--bbox", *bbox])

    # 3. Roads (best-effort — Overpass sometimes 504s; the read still works
    #    without the security band).
    stage(jid, "fetching roads")
    roads = os.path.join(work, "roads.geojson")
    try:
        run(["python3", "fetch_roads.py", "--name", name])
    except Exception as e:  # noqa: BLE001
        print(f"[worker] roads unavailable, continuing: {e}", flush=True)

    # 4. Derivatives (WhiteboxTools) and rules, clipped to the outline.
    stage(jid, "terrain derivatives")
    run(["python3", "terrain_derivatives.py", "--name", name])

    stage(jid, "reading terrain")
    out_dir = tempfile.mkdtemp(prefix="terrain-out-")
    # tile_rules is a drop-in for scout_rules that auto-tiles tracts too big to
    # run in one pass, so an 8 GB worker never swaps. WORKER_MAX_CELLS tunes the
    # per-tile size to the host's RAM (default 35M ≈ a few GB per tile).
    rules = ["python3", "tile_rules.py", "--name", name, "--out", out_dir,
             "--focus-geojson", outline_path, "--area-name", job.get("property_name") or name,
             "--max-cells", os.environ.get("WORKER_MAX_CELLS", "35000000")]
    if os.path.exists(roads):
        rules += ["--roads", roads]
    for pt in (job.get("food") or []):
        rules += ["--food", f"{pt[0]},{pt[1]}"]
    stdout = run(rules)

    # 5. Load the emitted set and upsert it.
    with open(os.path.join(out_dir, f"terrain_movement.{name}.json")) as f:
        movement = json.load(f)

    m = re.search(r"(\d+)\s+cells in outline", stdout)
    cell_count = int(m.group(1)) if m else None

    upsert_set({
        "property_id": job["property_id"],
        "owner_id": job["owner_id"],
        "set": movement,
        "source": movement.get("source"),
        "outline_hash": job.get("outline_hash"),
        "center": movement.get("center"),
        "cell_count": cell_count,
        "generated_at": now_iso(),
    })
    update_job(job["id"], {"status": "done", "finished_at": now_iso(), "error": None, "stage": None})
    print(f"[worker] done {job['property_id']}: {len(movement.get('features', []))} features", flush=True)


def main() -> int:
    if not SUPABASE_URL or not SERVICE_KEY:
        print("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required", file=sys.stderr)
        return 2
    print(f"[worker] {WORKER_ID} polling {SUPABASE_URL} every {POLL_SECONDS}s", flush=True)
    while True:
        try:
            job = claim_job()
        except Exception as e:  # noqa: BLE001
            print(f"[worker] claim failed: {e}", flush=True)
            time.sleep(POLL_SECONDS)
            continue
        if not job:
            time.sleep(POLL_SECONDS)
            continue
        print(f"[worker] claimed {job['id']} ({job['property_id']})", flush=True)
        try:
            process(job)
        except Exception as e:  # noqa: BLE001
            msg = str(e)[:1000]
            print(f"[worker] job {job['id']} error: {msg}", flush=True)
            try:
                update_job(job["id"], {"status": "error", "finished_at": now_iso(), "error": msg})
            except Exception as e2:  # noqa: BLE001
                print(f"[worker] could not mark error: {e2}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
