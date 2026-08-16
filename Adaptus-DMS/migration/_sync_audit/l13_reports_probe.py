# -*- coding: utf-8 -*-
"""Lane 13 deepest QA — reports types, dealership scoping, commissions."""
import json
import sys
from http.cookiejar import CookieJar
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

BASE = "https://app.flashfender.com"
NOVA = "dd404bb6-3e64-43ae-9eb7-98095033c6cb"
FOREIGN = "00000000-0000-0000-0000-000000000001"
EMAIL = "f02_test_adaptus@adaptusgroup.ca"
PWD = "AdaptusTest2026!CookieFlow"
SP_EMAIL = "f02_qa_salesperson@adaptusgroup.ca"
SP_PWD = "AdaptusTest2026!CookieFlow"
UA = "Mozilla/5.0 QA-L13/1.0"
OUT = r"C:\Users\dchat\Documents\DMSDATA\Adaptus-DMS\Adaptus-DMS\migration\_sync_audit\l13_reports_probe.json"

TYPES = [
    "summary",
    "sales",
    "inventory",
    "financial",
    "leads",
    "expenses",
    "salesperson",
    "commissions",
]


def req(opener, method, url, data=None, headers=None):
    body = None
    hdrs = {"User-Agent": UA, "Accept": "application/json"}
    if headers:
        hdrs.update(headers)
    if data is not None:
        body = json.dumps(data).encode()
        hdrs["Content-Type"] = "application/json"
    r = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    try:
        with opener.open(r, timeout=60) as resp:
            text = resp.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(text) if text else None
            except Exception:
                parsed = None
            return resp.status, parsed, text
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(text) if text else None
        except Exception:
            parsed = None
        return e.code, parsed, text


def login(email, pwd):
    jar = CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    st, body, _ = req(opener, "POST", f"{BASE}/api/auth/login", {"email": email, "password": pwd})
    return opener, st, body


def summarize_report(body):
    if not isinstance(body, dict):
        return {"raw_type": type(body).__name__}
    data = body.get("data") or {}
    summary = data.get("summary") if isinstance(data, dict) else None
    out = {
        "reportType": body.get("reportType"),
        "error": body.get("error"),
        "keys": sorted(list(data.keys())) if isinstance(data, dict) else None,
    }
    if isinstance(summary, dict):
        out["summary"] = {k: summary.get(k) for k in list(summary.keys())[:12]}
    if isinstance(data, dict):
        if "bySalesperson" in data:
            rows = data.get("bySalesperson") or []
            out["bySalesperson_len"] = len(rows)
            out["bySalesperson_sample"] = [
                {
                    "name": r.get("name"),
                    "deals": r.get("deals"),
                    "revenue": r.get("revenue"),
                    "commission": r.get("commission"),
                }
                for r in rows[:3]
            ]
        if "inventory" in data and isinstance(data["inventory"], dict):
            out["inventory"] = data["inventory"]
        if "agingBuckets" in data:
            out["agingBuckets"] = data["agingBuckets"]
        if "topSalespeople" in data:
            out["topSalespeople_len"] = len(data.get("topSalespeople") or [])
    return out


out = {"base": BASE, "nova": NOVA}

# Unauth
st, body, _ = req(
    urllib.request.build_opener(),
    "GET",
    f"{BASE}/api/reports?type=sales",
)
out["unauth"] = {"status": st, "error": (body or {}).get("error") if isinstance(body, dict) else None}

# Admin
opener, st, body = login(EMAIL, PWD)
out["admin_login"] = {
    "status": st,
    "role": ((body or {}).get("user") or {}).get("role"),
    "dealership_id": ((body or {}).get("user") or {}).get("dealership_id")
    or ((body or {}).get("profile") or {}).get("dealership_id"),
    "is_platform_admin": ((body or {}).get("user") or {}).get("is_platform_admin")
    or ((body or {}).get("profile") or {}).get("is_platform_admin"),
}

# /api/me for dealership context
st_me, me, _ = req(opener, "GET", f"{BASE}/api/me")
out["admin_me"] = {
    "status": st_me,
    "dealership_id": (me or {}).get("dealership_id") if isinstance(me, dict) else None,
    "role": (me or {}).get("role") if isinstance(me, dict) else None,
    "is_platform_admin": (me or {}).get("is_platform_admin") if isinstance(me, dict) else None,
    "keys": sorted(list(me.keys()))[:30] if isinstance(me, dict) else None,
}

reports = {}
for t in TYPES:
    st, body, text = req(opener, "GET", f"{BASE}/api/reports?type={t}")
    reports[t] = {"status": st, **summarize_report(body)}
    if st != 200:
        reports[t]["text_snip"] = (text or "")[:240]
out["admin_report_types"] = reports

# Date filter honor on expenses
st1, b1, _ = req(opener, "GET", f"{BASE}/api/reports?type=expenses")
st2, b2, _ = req(
    opener,
    "GET",
    f"{BASE}/api/reports?type=expenses&start_date=2099-01-01&end_date=2099-01-02",
)
c1 = ((b1 or {}).get("data") or {}).get("summary", {}).get("expenseCount")
c2 = ((b2 or {}).get("data") or {}).get("summary", {}).get("expenseCount")
out["expenses_date_filter"] = {
    "unscoped_status": st1,
    "unscoped_count": c1,
    "future_status": st2,
    "future_count": c2,
    "shrinks": (c2 is not None and c1 is not None and c2 <= c1 and c2 == 0),
}

# Inventory floor sanity
inv = reports.get("inventory") or {}
inv_summary = inv.get("summary") or {}
out["inventory_floor"] = {
    "totalVehicles": inv_summary.get("totalVehicles"),
    "activeVehicles": inv_summary.get("activeVehicles"),
    "ok_ge_158": (inv_summary.get("totalVehicles") or 0) >= 158,
}

# Page
st, _, text = req(opener, "GET", f"{BASE}/reports", headers={"Accept": "text/html"})
out["reports_page"] = {
    "status": st,
    "has_error_boundary": "Something went wrong" in (text or ""),
    "has_commissions_marker": ("Commissions" in (text or "")) or ("salesperson" in (text or "").lower()),
}

# Salesperson isolation
sp_opener, st, body = login(SP_EMAIL, SP_PWD)
out["sp_login"] = {
    "status": st,
    "role": ((body or {}).get("user") or {}).get("role"),
    "error": (body or {}).get("error") if isinstance(body, dict) else None,
}
if st == 200:
    st_me, me, _ = req(sp_opener, "GET", f"{BASE}/api/me")
    out["sp_me"] = {
        "status": st_me,
        "dealership_id": (me or {}).get("dealership_id") if isinstance(me, dict) else None,
        "role": (me or {}).get("role") if isinstance(me, dict) else None,
    }
    sp_reports = {}
    for t in ("summary", "sales", "inventory", "financial", "salesperson", "commissions"):
        st, body, text = req(sp_opener, "GET", f"{BASE}/api/reports?type={t}")
        sp_reports[t] = {"status": st, **summarize_report(body)}
        if st != 200:
            sp_reports[t]["text_snip"] = (text or "")[:200]
    out["sp_report_types"] = sp_reports
    inv_s = (sp_reports.get("inventory") or {}).get("summary") or {}
    out["sp_inventory_scoped"] = {
        "totalVehicles": inv_s.get("totalVehicles"),
        "matches_nova_floor": (inv_s.get("totalVehicles") or 0) >= 158,
        "not_absurdly_high": (inv_s.get("totalVehicles") or 0) < 5000,
    }
    # Foreign dealership query param must not widen scope
    st, body, _ = req(
        sp_opener,
        "GET",
        f"{BASE}/api/reports?type=inventory&dealership_id={FOREIGN}",
    )
    out["sp_foreign_dealership_param"] = {
        "status": st,
        "totalVehicles": ((body or {}).get("data") or {}).get("summary", {}).get("totalVehicles"),
        "error": (body or {}).get("error") if isinstance(body, dict) else None,
    }

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, indent=2)
print(json.dumps(out, indent=2)[:8000])
print("\nWROTE", OUT)
