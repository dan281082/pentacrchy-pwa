"""
GLP trusted proxy — END-TO-END backend purchase journey.

Scope (authorized destructive run in Crypto Test Mode — no real funds):
  1)  GET  /api/glp/health
  2)  POST /api/glp/auth/register              (unique email + telegramUsername)
  3)  POST /api/glp/auth/register empty body   -> 400 invalid_input (NOT 404)
  4)  POST /api/glp/auth/register bad telegram -> 400 telegram_invalid
  5)  GET  /api/glp/me                         (Bearer token)
  6)  GET  /api/glp/catalogue
  7)  GET  /api/glp/products/177               (variable product w/ variations)
  8)  POST /api/glp/basket/validate            (177 / variation 236)
  9)  POST /api/glp/shipping/quote
  10) POST /api/glp/orders                     (crypto / tron)
  11) GET  /api/glp/orders/{id}/crypto-invoice (REPORT invoice.test_mode)
  12) GET  /api/glp/orders                     (contains the new order)
  13) GET  /api/glp/crypto/networks            (contains a 'tron' entry)

Reads EXPO_PUBLIC_BACKEND_URL from /app/frontend/.env — the same URL the mobile
app uses. The GLP shared secret is server-side only and is never requested here.
"""
import os
import re
import time
import uuid
from pathlib import Path

import pytest
import requests


# ── Config ───────────────────────────────────────────────────────────────────
def _load_backend_url() -> str:
    env_path = Path("/app/frontend/.env")
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            m = re.match(r"\s*EXPO_PUBLIC_BACKEND_URL\s*=\s*(.+)\s*$", line)
            if m:
                return m.group(1).strip().strip('"').strip("'").rstrip("/")
    url = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
    if not url:
        raise RuntimeError("EXPO_PUBLIC_BACKEND_URL not configured")
    return url.rstrip("/")


BASE_URL = _load_backend_url()
EPOCH = int(time.time())
UNIQUE = f"{EPOCH}{uuid.uuid4().hex[:6]}"
TEST_EMAIL = f"testap3p_{UNIQUE}@mailinator.com"
TEST_TG = f"ap3ptst_{UNIQUE}"[:28]  # ensure valid telegram length
TEST_PASSWORD = "AP3P-Test-Pw!2026"
CLIENT_REF = f"ap3p-e2e-{UNIQUE}"

# Shared state across ordered tests
STATE: dict = {
    "token": None,
    "customer": None,
    "product_177": None,
    "variation_id": "236",
    "shipping_method": "flat_rate:1",
    "order_id": None,
    "order_number": None,
    "invoice_test_mode": None,
}

SHIP_ADDRESS = {
    "name": "AP3P Tester",
    "first_name": "AP3P",
    "last_name": "Tester",
    "line1": "10 Downing St",
    "city": "London",
    "postcode": "EC1A 1BB",
    "country": "GB",
    "phone": "+447000000000",
}


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Accept": "application/json", "Content-Type": "application/json"})
    return s


def _auth_headers():
    assert STATE["token"], "token missing — register step must run first"
    return {"Authorization": f"Bearer {STATE['token']}"}


# ── 1) Health ────────────────────────────────────────────────────────────────
def test_01_health(api):
    r = api.get(f"{BASE_URL}/api/glp/health", timeout=45)
    assert r.status_code == 200, r.text[:400]
    d = r.json()
    assert d.get("ok") is True
    assert d.get("secret_configured") is True
    assert d.get("upstream_reachable") is True
    assert d.get("upstream_status") == 200, d


# ── 2) Register — happy path ─────────────────────────────────────────────────
def test_02_register_success(api):
    payload = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "firstName": "AP3P",
        "lastName": "Tester",
        "telegramUsername": TEST_TG,
    }
    r = api.post(f"{BASE_URL}/api/glp/auth/register", json=payload, timeout=60)
    assert r.status_code in (200, 201), f"register failed HTTP {r.status_code}: {r.text[:500]}"
    data = r.json()
    assert isinstance(data, dict), data
    customer = data.get("customer") or {}
    token = data.get("token")
    assert token, f"no token in register response: {data}"
    assert customer.get("approved") is True, f"customer.approved != true: {customer}"
    assert customer.get("telegram_username"), f"telegram_username missing: {customer}"
    STATE["token"] = token
    STATE["customer"] = customer
    print(f"[register] email={TEST_EMAIL} telegram={TEST_TG} customer_id={customer.get('id')} approved={customer.get('approved')}")


# ── 3) Register — empty body → 400 invalid_input (NOT 404) ───────────────────
def test_03_register_empty_body_is_400(api):
    r = api.post(f"{BASE_URL}/api/glp/auth/register", json={}, timeout=45)
    assert r.status_code != 404, f"REGRESSION: /register returned 404 — route missing on upstream! body={r.text[:300]}"
    assert r.status_code == 400, f"expected 400 for empty body, got {r.status_code}: {r.text[:300]}"
    body = r.text.lower()
    assert "invalid_input" in body or "invalid" in body, f"expected invalid_input marker: {r.text[:300]}"


# ── 4) Register — invalid telegram → 400 telegram_invalid ────────────────────
def test_04_register_invalid_telegram(api):
    bad_payload = {
        "email": f"bad_{UNIQUE}@mailinator.com",
        "password": TEST_PASSWORD,
        "firstName": "A",
        "lastName": "B",
        "telegramUsername": "ab",  # too short
    }
    r = api.post(f"{BASE_URL}/api/glp/auth/register", json=bad_payload, timeout=45)
    assert r.status_code != 404, f"REGRESSION: /register returned 404: {r.text[:300]}"
    assert r.status_code == 400, f"expected 400 for bad telegram, got {r.status_code}: {r.text[:300]}"
    assert "telegram" in r.text.lower(), f"expected telegram error marker: {r.text[:300]}"


# ── 5) /me ───────────────────────────────────────────────────────────────────
def test_05_me(api):
    if not STATE["token"]:
        pytest.skip("no token")
    r = api.get(f"{BASE_URL}/api/glp/me", headers=_auth_headers(), timeout=45)
    assert r.status_code == 200, f"/me HTTP {r.status_code}: {r.text[:300]}"
    me = r.json()
    cust = STATE["customer"] or {}
    me_id = me.get("id") or (me.get("customer") or {}).get("id")
    cust_id = cust.get("id")
    assert me_id and cust_id and str(me_id) == str(cust_id), f"/me customer mismatch: me={me_id} register={cust_id}"


# ── 6) /catalogue ────────────────────────────────────────────────────────────
def test_06_catalogue(api):
    if not STATE["token"]:
        pytest.skip("no token")
    r = api.get(f"{BASE_URL}/api/glp/catalogue", headers=_auth_headers(), timeout=60)
    assert r.status_code == 200, f"/catalogue HTTP {r.status_code}: {r.text[:300]}"
    data = r.json()
    products = data.get("products") if isinstance(data, dict) else data
    assert isinstance(products, list) and len(products) > 0, f"no products in catalogue: {str(data)[:400]}"
    in_stock = [p for p in products if p.get("stock_status") in ("in_stock", "instock", "low_stock")
                or p.get("in_stock") is True]
    assert in_stock, f"no in-stock products in catalogue (n={len(products)}); statuses={ {p.get('stock_status') for p in products} }"
    sample = in_stock[0]
    for field in ("id", "name", "type", "price", "price_display", "stock_status", "image_url"):
        assert field in sample, f"product missing field '{field}': keys={list(sample.keys())}"


# ── 7) /products/177 ─────────────────────────────────────────────────────────
def test_07_product_177_variations(api):
    if not STATE["token"]:
        pytest.skip("no token")
    r = api.get(f"{BASE_URL}/api/glp/products/177", headers=_auth_headers(), timeout=45)
    assert r.status_code == 200, f"/products/177 HTTP {r.status_code}: {r.text[:300]}"
    data = r.json()
    p = data.get("product", data) if isinstance(data, dict) else data
    STATE["product_177"] = p
    assert p.get("type") == "variable", f"product 177 type != variable: {p.get('type')}"
    variations = p.get("variations") or []
    assert isinstance(variations, list) and len(variations) > 0, "no variations array"
    for v in variations:
        for field in ("variation_id", "price", "stock_status", "purchasable"):
            assert field in v, f"variation missing '{field}': keys={list(v.keys())}"
    # Ensure target variation 236 exists & is purchasable
    v236 = next((v for v in variations if str(v.get("variation_id")) == "236"), None)
    assert v236, f"variation 236 not found; got variation_ids={[v.get('variation_id') for v in variations]}"
    assert v236.get("purchasable") is True, f"variation 236 not purchasable: {v236}"


# ── 8) Basket validate ───────────────────────────────────────────────────────
def test_08_basket_validate(api):
    if not STATE["token"]:
        pytest.skip("no token")
    body = {"items": [{"product_id": "177", "variation_id": "236", "qty": 1}]}
    r = api.post(f"{BASE_URL}/api/glp/basket/validate", headers=_auth_headers(), json=body, timeout=45)
    assert r.status_code == 200, f"/basket/validate HTTP {r.status_code}: {r.text[:300]}"
    data = r.json()
    assert data.get("valid") is True, f"basket not valid: {data}"
    assert data.get("subtotal_display"), f"missing subtotal_display: {data}"


# ── 9) Shipping quote ────────────────────────────────────────────────────────
def test_09_shipping_quote(api):
    if not STATE["token"]:
        pytest.skip("no token")
    body = {
        "items": [{"product_id": "177", "variation_id": "236", "qty": 1}],
        "address": SHIP_ADDRESS,
    }
    r = api.post(f"{BASE_URL}/api/glp/shipping/quote", headers=_auth_headers(), json=body, timeout=45)
    assert r.status_code == 200, f"/shipping/quote HTTP {r.status_code}: {r.text[:300]}"
    data = r.json()
    methods = data.get("methods") if isinstance(data, dict) else data
    assert isinstance(methods, list) and len(methods) > 0, f"no shipping methods: {data}"
    ids = [m.get("id") for m in methods]
    assert any(str(i).startswith("flat_rate") for i in ids), f"no flat_rate shipping method: ids={ids}"


# ── 10) Create order (crypto / tron) ─────────────────────────────────────────
def test_10_create_order(api):
    if not STATE["token"]:
        pytest.skip("no token")
    body = {
        "items": [{"product_id": "177", "variation_id": "236", "qty": 1}],
        "payment_method": "crypto",
        "network": "tron",
        "shipping_address": SHIP_ADDRESS,
        "shipping_method": STATE["shipping_method"],
        "client_ref": CLIENT_REF,
    }
    r = api.post(f"{BASE_URL}/api/glp/orders", headers=_auth_headers(), json=body, timeout=60)
    assert r.status_code in (200, 201), f"/orders HTTP {r.status_code}: {r.text[:500]}"
    data = r.json()
    order = data.get("order") or data
    assert order.get("id"), f"order.id missing: {data}"
    assert order.get("number"), f"order.number missing: {data}"
    assert order.get("status") == "pending", f"order.status != pending: {order.get('status')}"
    assert order.get("total_display"), f"total_display missing: {order}"
    pm = order.get("payment_method")
    assert pm == "apeps_crypto", f"payment_method != apeps_crypto (got {pm})"
    STATE["order_id"] = order["id"]
    STATE["order_number"] = order["number"]
    print(f"[order] id={order['id']} number={order['number']} total={order.get('total_display')} pm={pm}")


# ── 11) Crypto invoice (REPORT invoice.test_mode) ────────────────────────────
def test_11_crypto_invoice(api):
    if not STATE["order_id"]:
        pytest.skip("no order created")
    oid = STATE["order_id"]
    # retry a couple of times — invoice generation can lag by ~1s
    data = None
    for _ in range(4):
        r = api.get(f"{BASE_URL}/api/glp/orders/{oid}/crypto-invoice", headers=_auth_headers(), timeout=45)
        if r.status_code == 200:
            data = r.json()
            break
        time.sleep(1.0)
    assert data, f"crypto-invoice never returned 200 for order {oid}"
    inv = data.get("invoice") or data
    assert inv.get("network") == "tron", f"invoice.network != tron: {inv.get('network')}"
    assert inv.get("token") == "USDT", f"invoice.token != USDT: {inv.get('token')}"
    for field in ("address", "amount", "fiat_total", "status", "required_confirmations",
                  "remaining_seconds", "payment_uri", "network_label"):
        assert field in inv, f"invoice missing '{field}': keys={list(inv.keys())}"
    assert inv.get("status") == "awaiting_payment", f"invoice.status != awaiting_payment: {inv.get('status')}"
    STATE["invoice_test_mode"] = inv.get("test_mode")
    print(f"[invoice] order={oid} test_mode={inv.get('test_mode')!r} status={inv.get('status')} "
          f"network={inv.get('network')} token={inv.get('token')} amount={inv.get('amount')} "
          f"fiat_total={inv.get('fiat_total')} address={inv.get('address')}")


# ── 12) Orders list contains the new order ───────────────────────────────────
def test_12_orders_list_contains_new(api):
    if not STATE["token"] or not STATE["order_id"]:
        pytest.skip("prereq missing")
    r = api.get(f"{BASE_URL}/api/glp/orders", headers=_auth_headers(), timeout=45)
    assert r.status_code == 200, f"/orders HTTP {r.status_code}: {r.text[:300]}"
    data = r.json()
    orders = data.get("orders") if isinstance(data, dict) else data
    assert isinstance(orders, list), f"orders not a list: {type(orders)}"
    ids = [str(o.get("id")) for o in orders]
    assert str(STATE["order_id"]) in ids, f"order {STATE['order_id']} not in list ids={ids}"


# ── 13) /crypto/networks contains tron (TRC20) ───────────────────────────────
def test_13_crypto_networks_has_tron(api):
    if not STATE["token"]:
        pytest.skip("no token")
    r = api.get(f"{BASE_URL}/api/glp/crypto/networks", headers=_auth_headers(), timeout=45)
    assert r.status_code == 200, f"/crypto/networks HTTP {r.status_code}: {r.text[:300]}"
    data = r.json()
    nets = data.get("networks") if isinstance(data, dict) else data
    assert isinstance(nets, list) and len(nets) > 0, f"no networks: {data}"
    tron = next((n for n in nets if (n.get("id") == "tron" or str(n.get("network", "")).lower() == "tron")), None)
    assert tron is not None, f"no tron network in list: {nets}"
    label = f"{tron.get('token','')} {tron.get('label','')} {tron.get('name','')}".lower()
    assert "trc20" in label or "tron" in label, f"tron entry missing TRC20 marker: {tron}"
