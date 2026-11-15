"""Build the versioned school atlas snapshot from USGS OFR 2005-1294.

Source: https://zenodo.org/records/3747876 (USGS, ore_deposits.csv).
Do not infer commodity, location or operating status from names.
"""
import csv
import hashlib
import json
import sys
from pathlib import Path

source = Path(sys.argv[1])
assert hashlib.md5(source.read_bytes()).hexdigest() == "4085d220d892fcae5ee080614009c13e"
records = []
with source.open(encoding="utf-8-sig", newline="") as stream:
    for row in csv.DictReader(stream):
        try:
            lat, lon = float(row["latitude"]), float(row["longitude"])
            gid = int(row["gid"])
        except (ValueError, TypeError):
            continue
        if not (-90 <= lat <= 90 and -180 <= lon <= 180) or not row["commodity"].strip():
            continue
        records.append([gid, lon, lat, row["dep_name"], row["country"], row["state"],
                        row["commodity"], row["dep_type"], row["model_code"], row["model_name"]])
assert len(records) > 3000 and len({row[0] for row in records}) == len(records)
target = Path(__file__).resolve().parents[1] / "public/assets/atlas-usgs-major-v1.json"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps({"source": "USGS OFR 2005-1294", "doi": "10.5281/zenodo.3747876",
                              "records": records}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
print(f"{len(records)} published coordinates; {target.stat().st_size} bytes")
