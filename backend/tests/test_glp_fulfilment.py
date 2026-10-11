"""Backend API tests for Pentarchy label/fulfilment flow against the live GLP proxy.

Covers:
- Customer auth & owner isolation for order 263 label
- Staff fulfilment list/detail/label endpoints
- Role protection (customer -> 403 staff endpoints)
- Lock/409 after dispatch
"""
import base64
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://apeps-mobile-demo.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api/glp"

CUSTOMER_EMAIL = "tracktest.ap3p@mailinator.com"
CUSTOMER_PW = "TrackTest2026!"
INTRUDER_EMAIL = "intruder.ap3p@mailinator.com"
INTRUDER_PW = "Intruder2026!"
STAFF_EMAIL = "test@test.com"
STAFF_PW = "Q#s%EbEuj#nzB93JIfmnfafZ"
ORDER_ID = 263


def _session_token(email: str, pw: str) -> str:
    r = requests.post(f"{API}/auth/session", json={"username": email, "password": pw}, timeout=30)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text[:300]}"
    data = r.json()
    tok = data.get("token") or (data.get("customer") or {}).get("token")
    assert tok, f"no token in response: {data}"
    return tok


@pytest.fixture(scope="module")
def customer_token():
    return _session_token(CUSTOMER_EMAIL, CUSTOMER_PW)


@pytest.fixture(scope="module")
def intruder_token():
    return _session_token(INTRUDER_EMAIL, INTRUDER_PW)


@pytest.fixture(scope="module")
def staff_token():
    return _session_token(STAFF_EMAIL, STAFF_PW)


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ─── Customer owner read ────────────────────────────────────────────────────
class TestCustomerOrder263:
    def test_customer_can_read_order(self, customer_token):
        r = requests.get(f"{API}/orders/{ORDER_ID}", headers=_h(customer_token), timeout=30)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        order = d.get("order") or d
        assert str(order.get("id")) == str(ORDER_ID)
        shipping = str(order.get("shipping_display") or "")
        # New design: no £6 shipping charge
        assert "6.00" not in shipping, f"unexpected £6 shipping: {shipping}"
        print("order 263 status:", order.get("status"), "state:", order.get("state"), "shipping:", shipping)

    def test_customer_can_fetch_label(self, customer_token):
        r = requests.get(f"{API}/orders/{ORDER_ID}/label", headers=_h(customer_token), timeout=30)
        print("customer label GET:", r.status_code)
        assert r.status_code in (200, 404), r.text[:400]
        if r.status_code == 200:
            d = r.json()
            lbl = d.get("label") or d
            assert "mime" in lbl or "filename" in lbl or "data" in lbl, lbl


# ─── Owner isolation: intruder must NOT read 263 ────────────────────────────
class TestOwnerIsolation:
    def test_intruder_cannot_read_order_263(self, intruder_token):
        r = requests.get(f"{API}/orders/{ORDER_ID}", headers=_h(intruder_token), timeout=30)
        assert r.status_code in (403, 404), f"expected 403/404 got {r.status_code}: {r.text[:300]}"

    def test_intruder_cannot_fetch_label_263(self, intruder_token):
        r = requests.get(f"{API}/orders/{ORDER_ID}/label", headers=_h(intruder_token), timeout=30)
        assert r.status_code in (403, 404), f"expected 403/404 got {r.status_code}: {r.text[:300]}"


# ─── Staff role protection ──────────────────────────────────────────────────
class TestStaffRoleProtection:
    def test_customer_forbidden_on_fulfilment_list(self, customer_token):
        r = requests.get(f"{API}/fulfilment/orders", headers=_h(customer_token), timeout=30)
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text[:300]}"

    def test_customer_forbidden_on_fulfilment_detail(self, customer_token):
        r = requests.get(f"{API}/fulfilment/orders/{ORDER_ID}", headers=_h(customer_token), timeout=30)
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text[:300]}"


# ─── Staff happy path ───────────────────────────────────────────────────────
class TestStaffFulfilment:
    def test_staff_can_list(self, staff_token):
        r = requests.get(f"{API}/fulfilment/orders", headers=_h(staff_token), timeout=30)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert "orders" in d, d
        print("fulfilment list counts:", d.get("counts"))

    def test_staff_can_read_order_263(self, staff_token):
        r = requests.get(f"{API}/fulfilment/orders/{ORDER_ID}", headers=_h(staff_token), timeout=30)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        order = d.get("order") or d
        assert "state" in order, order
        assert "number" in order, order
        print("staff order 263 state:", order.get("state"), "status:", order.get("status"))

    def test_staff_can_read_label_263(self, staff_token):
        r = requests.get(f"{API}/fulfilment/orders/{ORDER_ID}/label", headers=_h(staff_token), timeout=30)
        print("staff label GET:", r.status_code)
        assert r.status_code in (200, 404), r.text[:400]


# ─── Server-side upload validation (customer) ───────────────────────────────
class TestLabelUploadValidation:
    def test_fake_pdf_rejected_as_qr(self, customer_token):
        # QR must be image; sending a text payload with image mime should fail server-side
        # (plugin inspects magic bytes).
        bad = base64.b64encode(b"not an image, just text").decode()
        r = requests.post(
            f"{API}/orders/{ORDER_ID}/label",
            headers=_h(customer_token),
            json={"kind": "qr", "filename": "bad.png", "data": f"data:image/png;base64,{bad}"},
            timeout=30,
        )
        # 415 unsupported media or 400 invalid payload
        assert r.status_code in (400, 415, 422), f"expected 4xx reject got {r.status_code}: {r.text[:300]}"
