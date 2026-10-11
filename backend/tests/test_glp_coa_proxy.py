# COA proxy route — forwards GET /api/glp/products/{id}/coa to upstream
# connector. Live upstream still runs plugin v2.3.0 → expects a 404
# rest_no_route body until plugin v2.4.0 is installed. This test only
# verifies the route is wired and the proxy forwards correctly (not the
# upstream behaviour).
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://apeps-mobile-demo.preview.emergentagent.com").rstrip("/")
CUSTOMER_EMAIL = "tracktest.ap3p@mailinator.com"
CUSTOMER_PASSWORD = "TrackTest2026!"


@pytest.fixture(scope="module")
def customer_token():
    r = requests.post(
        f"{BASE_URL}/api/glp/auth/session",
        json={"username": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    tok = r.json().get("token")
    assert tok and len(tok) > 20
    return tok


def test_health_ok():
    r = requests.get(f"{BASE_URL}/api/glp/health", timeout=30)
    assert r.status_code == 200
    j = r.json()
    assert j.get("ok") is True
    assert j.get("secret_configured") is True
    assert j.get("upstream_reachable") is True


def test_coa_route_unauth_401():
    r = requests.get(f"{BASE_URL}/api/glp/products/277/coa", timeout=30)
    # proxy forwards without token; upstream should refuse. We accept 401
    # (unauthenticated) or 404 (plugin < v2.4.0 — route not registered yet).
    assert r.status_code in (401, 403, 404), f"unexpected {r.status_code}: {r.text[:200]}"


def test_coa_route_authed_forwards(customer_token):
    r = requests.get(
        f"{BASE_URL}/api/glp/products/277/coa",
        headers={"Authorization": f"Bearer {customer_token}"},
        timeout=30,
    )
    # Live upstream plugin v2.3.0 → rest_no_route 404. v2.4.0 → either 200
    # (COA present) or 404 glp_no_coa. All acceptable.
    assert r.status_code in (200, 404), f"unexpected {r.status_code}: {r.text[:200]}"
    body = r.json()
    if r.status_code == 404:
        code = body.get("code") or body.get("error") or ""
        assert code in ("rest_no_route", "glp_no_coa"), f"unexpected 404 body: {body}"
    else:
        assert "coa" in body


def test_catalogue_has_no_coa_field_yet(customer_token):
    # Plugin v2.3.0 does not emit `coa` in catalogue items — mapCoa(undefined)
    # must therefore result in `coa: null` → CoaSection hidden.
    r = requests.get(
        f"{BASE_URL}/api/glp/catalogue",
        headers={"Authorization": f"Bearer {customer_token}"},
        timeout=30,
    )
    assert r.status_code == 200
    items = r.json().get("products") or r.json().get("items") or []
    assert isinstance(items, list) and len(items) >= 1
    for p in items:
        # coa may be absent OR present as None; both correctly map to null.
        assert "coa" not in p or p["coa"] is None
