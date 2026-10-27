#!/usr/bin/env python3
"""
Generates ticket-data.json from the "Summary" sheet of the Electric Bristol
Ticket Count spreadsheet (.xlsx).

The Summary sheet has no Live/Club split, so each show's "type" is carried over
from the existing ticket-data.json (matched on date + name). New shows default
to "live" and are listed so they can be checked.

Usage:
    python3 generate_ticket_data.py "Electric Bristol Ticket Count 201026.xlsx"
    python3 generate_ticket_data.py  # uses the newest .xlsx found in current dir
"""

import json
import sys
import os
import glob
from datetime import datetime

try:
    import openpyxl
except ImportError:
    print("Error: openpyxl is required. Run: pip install openpyxl")
    sys.exit(1)

MONTH_NAMES = {
    1: "JANUARY", 2: "FEBRUARY", 3: "MARCH", 4: "APRIL",
    5: "MAY", 6: "JUNE", 7: "JULY", 8: "AUGUST",
    9: "SEPTEMBER", 10: "OCTOBER", 11: "NOVEMBER", 12: "DECEMBER",
}

SHEET_NAME = "Summary"

# Column indices (0-based) in the Summary sheet
COL_DATE = 0
COL_ONSALE = 1
COL_EVENT = 4
COL_PROMOTER = 5
COL_CAPACITY = 6
COL_CURRENT_SALES = 8  # "Current Sales" — the current live count
# Columns after this whose header is a date hold the weekly sales history. Shows
# that have already happened have Current Sales 0, so the latest of these is used.
COL_HISTORY_START = 17

OUT_PATH = "ticket-data.json"


def parse_int(value):
    """Convert a cell value (e.g. '1,300', 1300, 645, '#VALUE!') to int, or None."""
    try:
        return int(str(value).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def load_existing_types():
    """Map (date, name) -> type from the current ticket-data.json."""
    if not os.path.exists(OUT_PATH):
        return {}
    with open(OUT_PATH) as f:
        return {(s["date"], s["name"]): s.get("type", "live") for s in json.load(f)}


def history_columns(rows):
    """Indices of the dated weekly-sales columns, taken from the header row."""
    for row in rows:
        if row and row[COL_DATE] == "Event Date":
            return [i for i, v in enumerate(row)
                    if i >= COL_HISTORY_START and isinstance(v, datetime)]
    return []


def latest_sales(row, history_cols):
    for i in reversed(history_cols):
        if i < len(row):
            value = parse_int(row[i])
            if value:
                return value
    return 0


def extract_shows(rows, existing_types):
    history_cols = history_columns(rows)
    shows = []
    new_shows = []
    for row in rows:
        if len(row) <= COL_CURRENT_SALES:
            continue
        event_date = row[COL_DATE]
        if not isinstance(event_date, datetime):
            continue
        capacity = parse_int(row[COL_CAPACITY])
        if not capacity:
            continue
        event_name = row[COL_EVENT]
        if not isinstance(event_name, str) or not event_name.strip():
            continue
        event_name = event_name.strip()
        promoter = str(row[COL_PROMOTER] or "").strip()
        sold = parse_int(row[COL_CURRENT_SALES]) or latest_sales(row, history_cols)
        pct = round(sold / capacity, 10)
        onsale_date = row[COL_ONSALE]
        onsale = onsale_date.strftime("%Y-%m-%d") if isinstance(onsale_date, datetime) else None
        date = event_date.strftime("%Y-%m-%d")
        key = (date, event_name)
        if key in existing_types:
            show_type = existing_types[key]
        else:
            show_type = "live"
            new_shows.append(key)
        shows.append({
            "date": date,
            "day": event_date.day,
            "month": event_date.month,
            "monthName": MONTH_NAMES[event_date.month],
            "year": event_date.year,
            "name": event_name,
            "promoter": promoter,
            "capacity": capacity,
            "sold": sold,
            "pct": pct,
            "onsale": onsale,
            "type": show_type,
        })
    return shows, new_shows


def main():
    if len(sys.argv) > 1:
        xlsx_path = sys.argv[1]
    else:
        matches = sorted(glob.glob("*.xlsx"), key=os.path.getmtime, reverse=True)
        if not matches:
            print("Error: no .xlsx file found in current directory.")
            sys.exit(1)
        xlsx_path = matches[0]
        print(f"Using spreadsheet: {xlsx_path}")

    if not os.path.exists(xlsx_path):
        print(f"Error: file not found: {xlsx_path}")
        sys.exit(1)

    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
    if SHEET_NAME not in wb.sheetnames:
        print(f"Error: sheet '{SHEET_NAME}' not found in {xlsx_path}")
        sys.exit(1)
    rows = list(wb[SHEET_NAME].iter_rows(values_only=True))

    all_shows, new_shows = extract_shows(rows, load_existing_types())

    # Drop duplicate (date, name) rows, keeping the first
    seen = set()
    all_shows = [s for s in all_shows
                 if (s["date"], s["name"]) not in seen and not seen.add((s["date"], s["name"]))]
    all_shows.sort(key=lambda s: s["date"])

    with open(OUT_PATH, "w") as f:
        json.dump(all_shows, f, indent=2)
        f.write("\n")

    print(f"Written {len(all_shows)} shows to {OUT_PATH}")
    if new_shows:
        print("New shows (defaulted to type 'live' — change to 'club' in the JSON if needed):")
        for date, name in new_shows:
            print(f"  {date}  {name}")


if __name__ == "__main__":
    main()
