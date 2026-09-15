"""
Scoped-down Phase 5: batch-downloads one season's worth of FastF1 race
telemetry (all drivers, Race sessions only) in parallel.

Standalone script -- not part of the Docker Compose stack, same as the
existing download_fastf1.py. Requires `pip install fastf1` locally.

Usage:
    python backend/download_historical_season.py
"""
import fastf1
import json
import math
import os
import re
import time
from concurrent.futures import ProcessPoolExecutor, as_completed

SEASON = 2024
SESSION_TYPE = 'R'  # Race only
MAX_WORKERS = 4

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
CACHE_ROOT = os.path.join(REPO_ROOT, '.fastf1_cache')
OUTPUT_ROOT = os.path.join(REPO_ROOT, 'data', 'historical')


def _slugify(name: str) -> str:
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')


def _enable_cache(tag: str):
    cache_dir = os.path.join(CACHE_ROOT, tag)
    os.makedirs(cache_dir, exist_ok=True)
    fastf1.Cache.enable_cache(cache_dir)


def _init_worker():
    # Each pool process gets its own cache directory -- FastF1's cache is a
    # requests_cache SQLite file, and concurrent writes from multiple
    # *processes* to one shared cache file risk "database is locked" errors.
    _enable_cache(f"worker_{os.getpid()}")


def _extract_telemetry_points(lap) -> list:
    """Same field shape/conversion as download_fastf1.py's single-lap extraction."""
    telemetry = lap.get_telemetry()
    points = []
    for _, row in telemetry.iterrows():
        x = row['X'] if not math.isnan(row['X']) else 0
        y = row['Y'] if not math.isnan(row['Y']) else 0
        speed = row['Speed'] if not math.isnan(row['Speed']) else 0
        rpm = row['RPM'] if not math.isnan(row['RPM']) else 0
        throttle = row['Throttle'] if not math.isnan(row['Throttle']) else 0
        brake = row['Brake'] if not isinstance(row['Brake'], float) or not math.isnan(row['Brake']) else False
        # Brake in FastF1 is usually boolean, convert to 100 for percentage
        brake_val = 100.0 if brake else 0.0
        points.append({
            "speed": float(speed),
            "rpm": float(rpm),
            "throttle": float(throttle),
            "brake_pressure": float(brake_val),
            "x": float(x),
            "y": float(y),
            # Add mock tire temperatures (matches download_fastf1.py)
            "tire_temp_fl": 100.0,
            "tire_temp_fr": 100.0,
            "tire_temp_rl": 100.0,
            "tire_temp_rr": 100.0,
        })
    return points


def fetch_session_telemetry(year: int, event_name: str, round_number: int, session_type: str) -> dict:
    """Runs in a worker process. Never raises -- always returns a result dict
    so one bad race weekend can't kill the whole batch."""
    event_slug = _slugify(event_name)
    result = {
        "event_name": event_name,
        "event_slug": event_slug,
        "round": round_number,
        "session_type": session_type,
        "status": "ok",
        "drivers_saved": [],
        "drivers_failed": [],
        "error": None,
    }
    try:
        session = fastf1.get_session(year, event_name, session_type)
        session.load(telemetry=True, laps=True, weather=False)

        out_dir = os.path.join(OUTPUT_ROOT, str(year), event_slug, session_type)
        os.makedirs(out_dir, exist_ok=True)

        drivers = session.laps['Driver'].dropna().unique().tolist()
        for driver in drivers:
            out_path = os.path.join(out_dir, f"{driver}.json")
            if os.path.exists(out_path):
                # Already fetched in a previous run -- skip so a re-run after
                # a partial failure only does the missing work.
                result["drivers_saved"].append(driver)
                continue
            try:
                lap = session.laps.pick_drivers(driver).pick_fastest()
                if lap is None or lap.empty:
                    result["drivers_failed"].append({"driver": driver, "error": "no timed lap"})
                    continue
                points = _extract_telemetry_points(lap)
                if not points:
                    result["drivers_failed"].append({"driver": driver, "error": "empty telemetry"})
                    continue
                with open(out_path, 'w') as f:
                    json.dump(points, f)
                result["drivers_saved"].append(driver)
            except Exception as e:
                result["drivers_failed"].append({"driver": driver, "error": str(e)})

        if not result["drivers_saved"]:
            result["status"] = "error"
            result["error"] = "no drivers produced usable telemetry"
    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)

    return result


def main():
    _enable_cache("main")
    print(f"Fetching {SEASON} race schedule...")
    schedule = fastf1.get_event_schedule(SEASON, include_testing=False)
    events = [(int(row['RoundNumber']), row['EventName']) for _, row in schedule.iterrows()]
    print(f"Found {len(events)} race weekends. Fetching with {MAX_WORKERS} parallel workers "
          f"(session type: {SESSION_TYPE})...")

    os.makedirs(OUTPUT_ROOT, exist_ok=True)
    results = []
    start = time.time()

    with ProcessPoolExecutor(max_workers=MAX_WORKERS, initializer=_init_worker) as executor:
        futures = {
            executor.submit(fetch_session_telemetry, SEASON, event_name, round_number, SESSION_TYPE): event_name
            for round_number, event_name in events
        }
        for future in as_completed(futures):
            result = future.result()
            results.append(result)
            progress = f"[{len(results)}/{len(events)}]"
            if result["status"] == "ok":
                extra = f", {len(result['drivers_failed'])} failed" if result["drivers_failed"] else ""
                print(f"  {progress} OK   {result['event_name']}: {len(result['drivers_saved'])} drivers saved{extra}")
            else:
                print(f"  {progress} FAIL {result['event_name']}: {result['error']}")

    elapsed = time.time() - start
    succeeded = [r for r in results if r["status"] == "ok"]
    failed = [r for r in results if r["status"] == "error"]

    manifest = {
        "season": SEASON,
        "session_type": SESSION_TYPE,
        "generated_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        "events": sorted((
            {
                "event_name": r["event_name"],
                "event_slug": r["event_slug"],
                "round": r["round"],
                "drivers": r["drivers_saved"],
            }
            for r in succeeded
        ), key=lambda e: e["round"]),
    }
    manifest_path = os.path.join(OUTPUT_ROOT, "index.json")
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f"\nDone in {elapsed:.1f}s. {len(succeeded)}/{len(events)} race weekends succeeded.")
    if failed:
        print("Failed events:")
        for r in failed:
            print(f"  - {r['event_name']}: {r['error']}")
    print(f"Manifest written to {manifest_path}")


if __name__ == "__main__":
    main()
