# -*- coding: utf-8 -*-
"""Brand AI smoke — login, floors, AI status, TipTap/cmdk pages."""
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
UA = "Mozilla/5.0 BrandAI-Smoke/1.0"
cj = CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))


def req(method, path, data=None, accept="application/json"):
    h = {"User-Agent": UA, "Accept": accept}
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        h["Content-Type"] = "application/json"
    r = urllib.request.Request(BASE + path, data=body, headers=h, method=method)
    try:
        with opener.open(r, timeout=60) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


out = {}
st, body = req("POST", "/api/auth/login", {"email": EMAIL, "password": PWD})
out["login"] = st
print("login", st)

st, body = req("GET", "/api/ai/status")
out["ai_status_code"] = st
try:
    out["ai_status"] = json.loads(body)
except Exception:
    out["ai_status"] = body[:400]
print("ai_status", st, out["ai_status"])


def count_payload(data, keys):
    if isinstance(data, list):
        return len(data)
    if not isinstance(data, dict):
        return None
    for k in keys:
        v = data.get(k)
        if isinstance(v, list):
            return len(v)
        if isinstance(v, int):
            return v
    if "count" in data and isinstance(data["count"], int):
        return data["count"]
    if "total" in data and isinstance(data["total"], int):
        return data["total"]
    return None


for name, path, keys in [
    ("vehicles", "/api/vehicles?limit=500", ("vehicles", "data", "items")),
    ("deals", "/api/deals?limit=500", ("deals", "data", "items")),
    ("invoices", "/api/invoices?limit=500", ("invoices", "data", "items")),
]:
    st, body = req("GET", path)
    try:
        data = json.loads(body)
        n = count_payload(data, keys)
    except Exception:
        n = "parse_err"
        data = body[:200]
    out[name] = {"status": st, "count": n}
    print(name, st, "count=", n)

st, body = req("GET", "/api/dashboard")
try:
    dash = json.loads(body)
    out["dashboard"] = {
        k: dash.get(k)
        for k in (
            "vehicles",
            "sales",
            "invoices",
            "vehicleCount",
            "dealCount",
            "invoiceCount",
            "stats",
            "counts",
            "totals",
        )
        if k in dash
    }
    if not out["dashboard"]:
        out["dashboard_keys"] = list(dash.keys())[:20]
except Exception:
    out["dashboard"] = body[:400]
print("dashboard", st, json.dumps(out.get("dashboard") or out.get("dashboard_keys"), default=str)[:600])

for page in ["/inventory/new", "/inventory", "/dashboard", "/quotations", "/follow-ups", "/login"]:
    st, html = req("GET", page, accept="text/html")
    signals = []
    for sig in (
        "tiptap",
        "ProseMirror",
        "cmdk",
        "CommandPalette",
        "FlashAi",
        "rich-text",
        "Ask Flash",
        "/brand/",
        "flashfender-mark",
    ):
        if sig.lower() in html.lower():
            signals.append(sig)
    out[page] = {
        "status": st,
        "chunks": len(re.findall(r"/_next/static/", html)),
        "signals": signals,
        "len": len(html),
    }
    print(page, st, "chunks", out[page]["chunks"], "signals", signals)

st, html = req("GET", "/dashboard", accept="text/html")
out["dashboard_brand_paths"] = sorted(set(re.findall(r"/brand/[A-Za-z0-9._/-]+", html)))
print("dashboard_brand_paths", out["dashboard_brand_paths"])

print("JSON_OUT=" + json.dumps(out, default=str))
