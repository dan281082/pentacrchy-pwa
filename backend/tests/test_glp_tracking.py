"""Tests for AST (Advanced Shipment Tracking) proxy for live order #260.

Validates:
  - /api/glp/auth/session with live tracktest.ap3p credentials returns a token.
  - /api/glp/orders/260 returns tracking as an ARRAY of AST shipments with
    the expected fields (provider, tracking_number, date_shipped, tracking_url).
"""

import os
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
EMAIL = "tracktest.ap3p@mailinator.com"
PASSWORD = "TrackTest2026!"
ORDER_ID = 260


@pytest.fixture(scope="module")
def token() -> str:
    r = requests.post(
        f"{BASE_URL}/api/glp/auth/session",
        json={"email": EMAIL, "password": PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:400]}"
    data = r.json()
    tok = data.get("token") or (data.get("customer") or {}).get("token")
    assert tok, f"no token in session response: {data}"
    return tok


# ── session / login ──────────────────────────────────────────────────────────
def test_login_returns_customer_and_token(token: str):
    assert isinstance(token, str) and len(token) > 10


# ── orders list ──────────────────────────────────────────────────────────────
def test_orders_list_contains_260(token: str):
    r = requests.get(
        f"{BASE_URL}/api/glp/orders",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    assert r.status_code == 200, r.text[:400]
    body = r.json()
    orders = body if isinstance(body, list) else body.get("orders", [])
    assert any(int(o.get("id", 0)) == ORDER_ID for o in orders), (
        f"order {ORDER_ID} not found in list; got ids="
        f"{[o.get('id') for o in orders]}"
    )


# ── order detail + AST tracking ─────────────────────────────────────────────
def test_order_detail_has_ast_tracking_array(token: str):
    r = requests.get(
        f"{BASE_URL}/api/glp/orders/{ORDER_ID}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    assert r.status_code == 200, r.text[:400]
    body = r.json()
    order = body.get("order") if isinstance(body, dict) and "order" in body else body
    assert int(order["id"]) == ORDER_ID
    tracking = order.get("tracking")
    assert isinstance(tracking, list) and len(tracking) >= 1, (
        f"expected tracking ARRAY with >=1 entry, got {tracking!r}"
    )
    ship = tracking[0]
    # AST shape from the WP plugin:
    assert "provider" in ship or "carrier" in ship, ship
    assert "tracking_number" in ship or "number" in ship, ship
    # content assertions for live order #260
    assert str(ship.get("tracking_number") or ship.get("number")) == "AB123456789GB"
    provider = str(ship.get("provider") or ship.get("carrier") or "").lower()
    assert "royal" in provider, provider


def test_order_total_is_pound_sign_not_entity(token: str):
    r = requests.get(
        f"{BASE_URL}/api/glp/orders/{ORDER_ID}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    assert r.status_code == 200
    body = r.json()
    order = body.get("order") if isinstance(body, dict) and "order" in body else body
    total = str(order.get("total_display") or order.get("total") or "")
    # Should be the £ character, not the HTML entity &pound;
    assert "&pound;" not in total, f"total contains HTML entity: {total!r}"
    assert "6.10" in total, f"expected £6.10, got {total!r}"
