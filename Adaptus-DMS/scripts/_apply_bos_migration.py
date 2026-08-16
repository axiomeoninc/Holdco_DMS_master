#!/usr/bin/env python3
"""Apply bos_ontario_columns.sql via Supabase Management API. Token from env only."""
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

PROJECT = "zwfeitodxikdwymkieai"
MIGRATION = Path(__file__).resolve().parent.parent / "src/app/supabase/migrations/bos_ontario_columns.sql"


def sql(query: str):
    token = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
    if not token:
        raise SystemExit("Set SUPABASE_ACCESS_TOKEN in environment")
    data = json.dumps({"query": query}).encode()
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT}/database/query",
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; BOS-migration/1.0)",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        body = resp.read().decode()
        return json.loads(body) if body.strip() else {}


def split_statements(text: str) -> list[str]:
    # Split on semicolons outside DO $$ ... $$ blocks
    parts: list[str] = []
    buf: list[str] = []
    in_do = False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("--") or not stripped:
            continue
        if re.match(r"DO\s+\$\$", stripped, re.I):
            in_do = True
        buf.append(line)
        if in_do and stripped.endswith("$$;"):
            in_do = False
            parts.append("\n".join(buf))
            buf = []
        elif not in_do and stripped.endswith(";"):
            parts.append("\n".join(buf))
            buf = []
    if buf:
        parts.append("\n".join(buf))
    return [p.strip() for p in parts if p.strip()]


def main():
    text = MIGRATION.read_text(encoding="utf-8")
    statements = split_statements(text)
    print(f"Applying {len(statements)} statements from {MIGRATION.name}...")
    ok = 0
    for i, stmt in enumerate(statements, 1):
        preview = stmt.replace("\n", " ")[:80]
        try:
            sql(stmt)
            ok += 1
            print(f"  [{i}/{len(statements)}] OK: {preview}...")
        except Exception as e:
            print(f"  [{i}/{len(statements)}] FAIL: {preview}...")
            print(f"    {e}")
            if hasattr(e, "read"):
                print(f"    {getattr(e, 'read', lambda: '')()}")
    print(f"\nDone: {ok}/{len(statements)} succeeded")

    # Verify key columns
    verify = sql(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name='bill_of_sale' "
        "AND column_name IN ('additional_equipment','price_vehicle','gst_enabled','customer_id','payment_status') "
        "ORDER BY column_name"
    )
    print("Verified columns:", [r["column_name"] for r in verify])

    floors = sql(
        "SELECT "
        "(SELECT COUNT(*)::int FROM vehicles) AS vehicles, "
        "(SELECT COUNT(*)::int FROM sales_deals) AS deals, "
        "(SELECT COUNT(*)::int FROM invoices) AS invoices"
    )
    print("Floor counts:", floors[0] if floors else floors)

    pay = sql(
        "SELECT COUNT(*)::int AS cnt FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name='bill_of_sale_payments'"
    )
    print("bill_of_sale_payments exists:", pay[0]["cnt"] == 1 if pay else False)


if __name__ == "__main__":
    main()
