# -*- coding: utf-8 -*-
"""Lane 10 BOS/MVDA/mark-sold — read-only + validation probes. No invent/destroy."""
import json
import urllib.error
import urllib.request
from http.cookiejar import CookieJar

BASE = "https://app.flashfender.com"
EMAIL = "f02_test_adaptus@adaptusgroup.ca"
PWD = "AdaptusTest2026!CookieFlow"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
NOVA = "dd404bb6-3e64-43ae-9eb7-98095033c6cb"
OUT = r"C:\Users\dchat\Documents\DMSDATA\Adaptus-DMS\Adaptus-DMS\migration\_sync_audit\_l10_bos_smoke.json"

cj = CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))


def req(method, path, data=None):
    h = {"User-Agent": UA, "Accept": "application/json, text/html"}
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        h["Content-Type"] = "application/json"
    r = urllib.request.Request(BASE + path, data=body, headers=h, method=method)
    try:
        with opener.open(r, timeout=45) as resp:
            raw = resp.read().decode("utf-8", "replace")
            return resp.status, raw, dict(resp.headers)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        return e.code, raw, dict(e.headers)


out = {"lane": "L10", "base": BASE}

st, raw, _ = req("POST", "/api/auth/login", {"email": EMAIL, "password": PWD})
out["login"] = {"status": st}

st, raw, _ = req("GET", "/api/me")
out["me"] = {"status": st}
me = {}
try:
    me = json.loads(raw)
except Exception:
    pass
dealership = (me.get("data") or me).get("dealership") or {}
settings = dealership.get("settings") or {}
out["dealer_settings_present"] = {
    "business_name": bool(dealership.get("business_name") or dealership.get("name")),
    "dealer_license": bool(
        (isinstance(settings, dict) and (settings.get("dealer_license") or settings.get("license_number")))
        or dealership.get("dealer_license")
    ),
    "hst_number": bool(
        (isinstance(settings, dict) and settings.get("hst_number"))
        or dealership.get("hst_number")
    ),
}

# Floors
for key, path in [
    ("vehicles", "/api/vehicles?limit=1"),
    ("deals", "/api/deals?limit=1"),
    ("invoices", "/api/invoices?limit=1"),
]:
    st, raw, _ = req("GET", path)
    count = None
    try:
        count = json.loads(raw).get("count")
    except Exception:
        pass
    out[key] = {"status": st, "count": count}

st, raw, _ = req("GET", "/api/bill-of-sale?limit=5")
bos = {}
try:
    bos = json.loads(raw)
except Exception:
    pass
out["bill_of_sale"] = {
    "status": st,
    "count": bos.get("count"),
    "page_len": len(bos.get("data") or []),
}

# Active inventory for safe MVDA reject probe (no persist on 400)
st, raw, _ = req("GET", "/api/vehicles?limit=50&status=Active")
active_rows = []
try:
    active_rows = json.loads(raw).get("data") or []
except Exception:
    pass

out["mvda_probe_candidate"] = None
out["mvda_clear_disclosure_reject"] = None
# Safe reject probe: Active + known_damage + blank disclosure must 400 before DB write
if active_rows:
    v0 = active_rows[0]
    out["mvda_probe_candidate"] = {
        "id": v0.get("id"),
        "status": v0.get("status"),
        "known_damage_before": v0.get("known_damage"),
        "has_disclosure_before": bool(str(v0.get("disclosure") or "").strip()),
    }
    st, raw, _ = req(
        "PATCH",
        f"/api/vehicles/{v0['id']}",
        {"known_damage": True, "disclosure": ""},
    )
    err = None
    try:
        err = json.loads(raw).get("error")
    except Exception:
        err = raw[:200]
    ok = st == 400 and bool(err) and (
        "disclosure" in str(err).lower()
        or "damage" in str(err).lower()
        or "MVDA" in str(err)
    )
    out["mvda_clear_disclosure_reject"] = {
        "status": st,
        "error": err,
        "pass": ok,
    }
    # Re-read to confirm no persist
    st2, raw2, _ = req("GET", f"/api/vehicles/{v0['id']}")
    after = {}
    try:
        after = (json.loads(raw2).get("data") or {})
    except Exception:
        pass
    out["mvda_no_persist"] = {
        "known_damage": after.get("known_damage"),
        "disclosure": after.get("disclosure"),
        "unchanged_damage_flag": after.get("known_damage") == v0.get("known_damage"),
    }

# Unauth BOS
cj_clear = CookieJar()
opener_u = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj_clear))


def req_u(method, path):
    r = urllib.request.Request(
        BASE + path,
        headers={"User-Agent": UA, "Accept": "application/json"},
        method=method,
    )
    try:
        with opener_u.open(r, timeout=30) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code


out["bill_of_sale_unauth"] = req_u("GET", "/api/bill-of-sale?limit=1")

out["floors_ok"] = (
    (out.get("vehicles") or {}).get("count", 0) >= 158
    and (out.get("deals") or {}).get("count", 0) >= 77
    and (out.get("invoices") or {}).get("count", 0) >= 71
)

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, indent=2)
print(json.dumps(out, indent=2))
