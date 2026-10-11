"""Post-dispatch lock tests for order 263."""
import os
import base64
import requests
import pytest

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://apeps-mobile-demo.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api/glp"
ORDER_ID = 263


def _login(email, pw):
    r = requests.post(f"{API}/auth/session", json={"username": email, "password": pw}, timeout=30)
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    return d.get("token") or (d.get("customer") or {}).get("token")


@pytest.fixture(scope="module")
def customer_token():
    return _login("tracktest.ap3p@mailinator.com", "TrackTest2026!")


@pytest.fixture(scope="module")
def intruder_token():
    return _login("intruder.ap3p@mailinator.com", "Intruder2026!")


@pytest.fixture(scope="module")
def staff_token():
    return _login("test@test.com", "Q#s%EbEuj#nzB93JIfmnfafZ")


def _h(t):
    return {"Authorization": f"Bearer {t}"}


# ── Customer: upload after dispatch must 409 label_locked ────────────────────
def test_customer_upload_after_dispatch_409(customer_token):
    tiny_png = base64.b64encode(
        base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
        )
    ).decode()
    r = requests.post(
        f"{API}/orders/{ORDER_ID}/label",
        headers=_h(customer_token),
        json={"kind": "qr", "filename": "a.png", "data": f"data:image/png;base64,{tiny_png}"},
        timeout=30,
    )
    assert r.status_code == 409, f"expected 409 got {r.status_code}: {r.text[:300]}"
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    err = (body.get("code") or body.get("error") or "")
    print("customer upload-after-dispatch body:", body)
    assert "label_locked" in str(body).lower() or "lock" in str(body).lower()


# ── Staff: dispatching an already-dispatched order must 409 ─────────────────
def test_staff_dispatch_again_409(staff_token):
    r = requests.post(f"{API}/fulfilment/orders/{ORDER_ID}/dispatch", headers=_h(staff_token), timeout=30)
    assert r.status_code == 409, f"expected 409 got {r.status_code}: {r.text[:300]}"
    print("staff dispatch-again body:", r.text[:300])


# ── Customer must get 403 on staff endpoints ────────────────────────────────
def test_customer_forbidden_fulfilment_list(customer_token):
    r = requests.get(f"{API}/fulfilment/orders", headers=_h(customer_token), timeout=30)
    assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text[:300]}"


# ── Intruder must get 404 on order 263 label ────────────────────────────────
def test_intruder_label_404(intruder_token):
    r = requests.get(f"{API}/orders/{ORDER_ID}/label", headers=_h(intruder_token), timeout=30)
    assert r.status_code in (403, 404), f"expected 403/404 got {r.status_code}: {r.text[:300]}"
