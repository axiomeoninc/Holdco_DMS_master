# -*- coding: utf-8 -*-
"""Deep Flash AI smoke — think-strip, branding, all /api/ai/* endpoints."""
import json
import re
import sys
from http.cookiejar import CookieJar
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

BASE = "https://app.flashfender.com"
EMAIL = "f02_test_adaptus@adaptusgroup.ca"
PWD = "AdaptusTest2026!CookieFlow"
UA = "Mozilla/5.0 FlashAI-ThinkStrip-Smoke/1.0"
cj = CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

VENDOR_RE = re.compile(r"minimax", re.I)
THINK_RE = re.compile(r"<\s*think", re.I)


def req(method, path, data=None, accept="application/json", timeout=120):
    h = {"User-Agent": UA, "Accept": accept}
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        h["Content-Type"] = "application/json"
    r = urllib.request.Request(BASE + path, data=body, headers=h, method=method)
    try:
        with opener.open(r, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", "replace"), dict(resp.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace"), dict(e.headers)


def has_vendor(text: str) -> bool:
    return bool(VENDOR_RE.search(text or ""))


def has_think(text: str) -> bool:
    return bool(THINK_RE.search(text or ""))


def content_ok(text: str) -> dict:
    return {
        "len": len(text or ""),
        "has_think": has_think(text or ""),
        "has_vendor": has_vendor(text or ""),
        "preview": (text or "")[:180].replace("\n", " "),
    }


matrix = {}
out = {"matrix": matrix}

st, body, _ = req("POST", "/api/auth/login", {"email": EMAIL, "password": PWD})
out["login"] = st
print("login", st)
if st != 200:
    print("JSON_OUT=" + json.dumps(out, default=str))
    sys.exit(1)

# Floors
for name, path, keys, floor in [
    ("vehicles", "/api/vehicles?limit=500", ("vehicles", "data", "items"), 158),
    ("deals", "/api/deals?limit=500", ("deals", "data", "items"), 78),
    ("invoices", "/api/invoices?limit=500", ("invoices", "data", "items"), 72),
]:
    st, body, _ = req("GET", path)
    try:
        data = json.loads(body)
        n = None
        if isinstance(data, list):
            n = len(data)
        elif isinstance(data, dict):
            for k in keys:
                v = data.get(k)
                if isinstance(v, list):
                    n = len(v)
                    break
                if isinstance(v, int):
                    n = v
                    break
            if n is None and isinstance(data.get("data"), list):
                n = len(data["data"])
    except Exception:
        n = None
        data = {}
    matrix[f"floor_{name}"] = {
        "status": st,
        "count": n,
        "pass": st == 200 and (n or 0) >= floor,
    }
    print(f"floor_{name}", st, n)

# Resolve lead + vehicle ids
st, body, _ = req("GET", "/api/leads?limit=5")
lead_id = None
try:
    leads = json.loads(body)
    items = []
    if isinstance(leads, list):
        items = leads
    elif isinstance(leads, dict):
        raw = leads.get("data") or leads.get("leads") or leads.get("items")
        if isinstance(raw, list):
            items = raw
        elif isinstance(raw, dict):
            items = raw.get("items") or []
    if items:
        lead_id = items[0].get("id")
except Exception:
    pass
print("lead_id", lead_id)

st, body, _ = req("GET", "/api/vehicles?limit=5&status=Active")
vehicle_id = None
quotation_id = None
try:
    vehicles = json.loads(body)
    items = vehicles.get("data") or vehicles.get("vehicles") or []
    if isinstance(items, dict):
        items = items.get("items") or []
    if items:
        vehicle_id = items[0].get("id")
except Exception:
    pass
print("vehicle_id", vehicle_id)

st, body, _ = req("GET", "/api/quotations?limit=5")
try:
    quotes = json.loads(body)
    items = quotes.get("data") or quotes.get("quotations") or []
    if isinstance(items, dict):
        items = items.get("items") or []
    if items:
        quotation_id = items[0].get("id")
except Exception:
    pass
print("quotation_id", quotation_id)

# GET /api/ai/status
st, body, _ = req("GET", "/api/ai/status")
try:
    status_json = json.loads(body)
except Exception:
    status_json = {}
data = status_json.get("data") or status_json
matrix["ai_status"] = {
    "status": st,
    "provider": data.get("provider"),
    "model": data.get("model"),
    "configured": data.get("configured"),
    "has_vendor": has_vendor(body),
    "pass": st == 200
    and data.get("provider") == "flash_ai"
    and data.get("configured") is True
    and not has_vendor(body),
}
print("ai_status", matrix["ai_status"])

# Integrations scrub
st, body, _ = req("GET", "/api/settings/integrations")
matrix["integrations"] = {
    "status": st,
    "has_vendor": has_vendor(body),
    "pass": st == 200 and not has_vendor(body),
}
print("integrations", matrix["integrations"]["status"], "vendor=", matrix["integrations"]["has_vendor"])

# POST endpoints
endpoints = []

if lead_id:
    endpoints.append(
        (
            "follow_up",
            "POST",
            "/api/ai/follow-up",
            {"lead_id": lead_id, "channel": "email"},
            "content",
        )
    )

if vehicle_id:
    endpoints.extend(
        [
            (
                "description",
                "POST",
                "/api/ai/description",
                {"vehicle_id": vehicle_id},
                "content",
            ),
            (
                "price_narrative",
                "POST",
                "/api/ai/price-narrative",
                {"vehicle_id": vehicle_id},
                "content",
            ),
            (
                "disclosure",
                "POST",
                "/api/ai/disclosure",
                {"vehicle_id": vehicle_id},
                "content",
            ),
        ]
    )

endpoints.append(
    (
        "inventory_search",
        "POST",
        "/api/ai/inventory-search",
        {"query": "red SUVs under 30000 aging over 45 days"},
        None,
    )
)

if quotation_id:
    endpoints.append(
        (
            "quote_coach",
            "POST",
            "/api/ai/quote-coach",
            {"quotation_id": quotation_id, "objection": "price too high"},
            "content",
        )
    )
else:
    endpoints.append(
        (
            "quote_coach",
            "POST",
            "/api/ai/quote-coach",
            {"objection": "price too high"},
            "content",
        )
    )

endpoints.append(("desk_brief", "GET", "/api/ai/desk-brief", None, "content"))

for name, method, path, payload, content_key in endpoints:
    st, body, _ = req(method, path, payload, timeout=180)
    # One retry on transient 5xx (cold model / upstream blip)
    if st >= 500:
        st, body, _ = req(method, path, payload, timeout=180)
    try:
        parsed = json.loads(body)
    except Exception:
        parsed = {}
    text = ""
    d = parsed.get("data") if isinstance(parsed, dict) else {}
    if content_key and isinstance(d, dict):
        text = d.get(content_key) or d.get("body") or ""
    elif name == "inventory_search" and isinstance(d, dict):
        text = json.dumps(d.get("filters") or {}) + " " + str(d.get("explanation") or "")
    else:
        text = body
    ok = (
        st == 200
        and not has_think(text)
        and not has_vendor(body)
        and (len(str(text).strip()) > 0 if content_key or name == "inventory_search" else True)
    )
    if name == "follow_up" and isinstance(d, dict):
        ok = ok and bool((d.get("body") or d.get("content") or "").strip())
    if name == "inventory_search" and isinstance(d, dict):
        ok = ok and isinstance(d.get("filters"), dict)
    # Empty disclosure after strip → treat as fail (502 preferred)
    if name == "disclosure" and st == 200 and not str(text).strip():
        ok = False
    matrix[name] = {
        "status": st,
        "pass": ok,
        **content_ok(text if isinstance(text, str) else str(text)),
        "error": parsed.get("error") if isinstance(parsed, dict) else None,
    }
    print(name, st, "pass=", ok, matrix[name]["preview"][:100])

# Copilot stream
st, body, headers = req(
    "POST",
    "/api/ai/copilot",
    {
        "messages": [{"role": "user", "content": "List 2 aging inventory priorities in short bullets."}],
        "stream": True,
    },
    accept="*/*",
    timeout=180,
)
ctype = headers.get("Content-Type") or headers.get("content-type") or ""
copilot_ok = (
    st == 200
    and not has_think(body)
    and not has_vendor(body)
    and len(body.strip()) > 10
)
matrix["copilot_stream"] = {
    "status": st,
    "content_type": ctype,
    "pass": copilot_ok,
    **content_ok(body),
}
print("copilot_stream", st, "pass=", copilot_ok, matrix["copilot_stream"]["preview"][:100])

# UI pages brand scrub
for page in ["/dashboard", "/inventory", "/quotations", "/settings/integrations"]:
    st, html, _ = req("GET", page, accept="text/html")
    matrix[f"ui_{page.strip('/').replace('/', '_') or 'dashboard'}"] = {
        "status": st,
        "has_vendor": has_vendor(html),
        "has_ask_flash": "Ask Flash" in html or "Flash AI" in html,
        "pass": st == 200 and not has_vendor(html),
    }
    print("ui", page, matrix[f"ui_{page.strip('/').replace('/', '_') or 'dashboard'}"])

passed = sum(1 for v in matrix.values() if isinstance(v, dict) and v.get("pass"))
total = sum(1 for v in matrix.values() if isinstance(v, dict) and "pass" in v)
out["passed"] = passed
out["total"] = total
out["all_pass"] = passed == total and total > 0
print(f"PASS_MATRIX {passed}/{total} all_pass={out['all_pass']}")
print("JSON_OUT=" + json.dumps(out, default=str))
