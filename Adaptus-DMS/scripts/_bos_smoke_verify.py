#!/usr/bin/env python3
"""Smoke verify BOS schema + optional REST insert via service role. Token from env only."""
import json
import os
import sys
import urllib.request

PROJECT = "zwfeitodxikdwymkieai"
URL = "https://zwfeitodxikdwymkieai.supabase.co"


def mgmt_sql(query: str):
    token = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
    data = json.dumps({"query": query}).encode()
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT}/database/query",
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; BOS-smoke/1.0)",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def rest(method: str, path: str, body=None):
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"{URL}/rest/v1/{path}",
        data=data,
        method=method,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw.strip() else {}
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def main():
    results = {}

    cols = mgmt_sql(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name='bill_of_sale' ORDER BY column_name"
    )
    col_names = [c["column_name"] for c in cols]
    results["bill_of_sale_column_count"] = len(col_names)
    results["has_additional_equipment"] = "additional_equipment" in col_names
    results["has_sold_status"] = True
    try:
        mgmt_sql("SELECT 1 FROM bill_of_sale WHERE status = 'Sold' LIMIT 0")
    except Exception as e:
        results["has_sold_status"] = False
        results["sold_status_error"] = str(e)[:200]

    floors = mgmt_sql(
        "SELECT (SELECT COUNT(*)::int FROM vehicles) AS vehicles, "
        "(SELECT COUNT(*)::int FROM sales_deals) AS deals, "
        "(SELECT COUNT(*)::int FROM invoices) AS invoices"
    )[0]
    results["floors"] = floors

    pay = mgmt_sql(
        "SELECT COUNT(*)::int AS cnt FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name='bill_of_sale_payments'"
    )
    results["payments_table"] = pay[0]["cnt"] == 1

    sibling = mgmt_sql(
        "SELECT table_name, column_name FROM information_schema.columns "
        "WHERE table_schema='public' AND ("
        " (table_name='sales_deals' AND column_name IN ('finance_term','interest_rate','finance_company','notes'))"
        " OR (table_name='test_drives' AND column_name='lead_id')) "
        "ORDER BY table_name, column_name"
    )
    results["sibling_columns"] = [f"{r['table_name']}.{r['column_name']}" for r in sibling]

    # REST smoke: insert minimal BOS row with Ontario fields (service role bypasses RLS)
    if os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        sample = {
            "buyer_name": "Smoke Test Buyer",
            "sale_price": 25000,
            "total_amount": 27500,
            "price_vehicle": 25000,
            "additional_equipment": 500,
            "gst_enabled": True,
            "status": "Sold",
            "payment_status": "Not Paid",
        }
        code, body = rest("POST", "bill_of_sale", sample)
        results["rest_insert_status"] = code
        if code in (200, 201):
            row = body[0] if isinstance(body, list) else body
            bos_id = row.get("id")
            results["rest_insert_id"] = bos_id
            # PATCH additional_equipment
            if bos_id:
                patch_code, patch_body = rest(
                    "PATCH",
                    f"bill_of_sale?id=eq.{bos_id}",
                    {"additional_equipment": 750, "trade_in_allowance": 1000},
                )
                results["rest_patch_status"] = patch_code
                rest("DELETE", f"bill_of_sale?id=eq.{bos_id}")
        else:
            results["rest_insert_error"] = body[:500] if isinstance(body, str) else body

    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
