"""
Backend-only connectivity tests for the GLP trusted proxy (/api/glp/*).

Scope (strictly non-destructive, no registration, no orders, no account creation):
  1) GET  /api/glp/health            -> JSON with ok, secret_configured, upstream_reachable, upstream_status=200
  2) POST /api/glp/auth/session      -> invalid creds surfaced as 401/403 JSON (NOT 500 / proxy crash)
  3) GET  /api/glp/crypto/networks   -> no Authorization header surfaces 401/403 (NOT 5xx)

Uses the external preview URL from frontend/.env (EXPO_PUBLIC_BACKEND_URL) so we
test exactly what the mobile app sees.
"""
import os
import re
from pathlib import Path

import pytest
import requests


def _load_backend_url() -> str:
    # Prefer EXPO_PUBLIC_BACKEND_URL from frontend/.env (what the mobile app uses).
    env_path = Path("/app/frontend/.env")
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            m = re.match(r"\s*EXPO_PUBLIC_BACKEND_URL\s*=\s*(.+)\s*$", line)
            if m:
                return m.group(1).strip().strip('"').strip("'").rstrip("/")
    # Fallback to env var only.
    url = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
    if not url:
        raise RuntimeError("EXPO_PUBLIC_BACKEND_URL not configured")
    return url.rstrip("/")


BASE_URL = _load_backend_url()


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Accept": "application/json"})
    return s


# ── 1) /api/glp/health ───────────────────────────────────────────────────────
class TestGlpHealth:
    def test_health_returns_200(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/glp/health", timeout=45)
        assert r.status_code == 200, f"health HTTP {r.status_code}: {r.text[:300]}"
        self._payload = r.json()
        # stash for subsequent assertions in this class
        TestGlpHealth._payload = self._payload

    def test_health_payload_shape(self, api_client):
        data = getattr(TestGlpHealth, "_payload", None)
        if data is None:
            r = api_client.get(f"{BASE_URL}/api/glp/health", timeout=45)
            data = r.json()
        assert data.get("ok") is True, f"ok != true: {data}"
        assert data.get("secret_configured") is True, (
            f"secret_configured != true (server env missing GLP_APP_SHARED_SECRET?): {data}"
        )

    def test_health_upstream_reachable_and_200(self, api_client):
        data = getattr(TestGlpHealth, "_payload", None)
        if data is None:
            r = api_client.get(f"{BASE_URL}/api/glp/health", timeout=45)
            data = r.json()
        assert data.get("upstream_status") == 200, (
            f"upstream_status != 200 (sg-captcha / connectivity regression?): {data}"
        )
        assert data.get("upstream_reachable") is True, f"upstream_reachable != true: {data}"

    def test_health_does_not_leak_secret(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/glp/health", timeout=45)
        body = r.text.lower()
        # Common accidental leaks — ensure none appear.
        for forbidden in ("x-glp-app-secret", "glp_app_shared_secret", "shared_secret"):
            assert forbidden not in body, f"health leaked field '{forbidden}'"


# ── 2) /api/glp/auth/session with invalid creds ──────────────────────────────
class TestGlpAuthSessionInvalid:
    def test_invalid_creds_surface_as_4xx_json(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/glp/auth/session",
            json={"username": "nobody@example.com", "password": "wrongpass"},
            timeout=45,
        )
        # Must NOT be a proxy crash and must NOT be a bot-protection block.
        assert r.status_code < 500, f"proxy returned 5xx ({r.status_code}): {r.text[:300]}"
        assert r.status_code != 503, (
            f"upstream_blocked (sg-captcha) regression at /auth/session: {r.text[:300]}"
        )
        assert r.status_code in (400, 401, 403), (
            f"expected 401/403 (or 400) for bad creds, got {r.status_code}: {r.text[:300]}"
        )
        # Response must be JSON (proxy json-encodes upstream responses).
        ctype = r.headers.get("content-type", "")
        assert "application/json" in ctype, f"expected JSON content-type, got {ctype}: {r.text[:200]}"
        data = r.json()
        assert isinstance(data, (dict, list)), f"expected JSON object/array, got {type(data)}"

    def test_invalid_creds_response_has_no_token(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/glp/auth/session",
            json={"username": "nobody@example.com", "password": "wrongpass"},
            timeout=45,
        )
        if "application/json" in r.headers.get("content-type", ""):
            data = r.json()
            if isinstance(data, dict):
                # Must not accidentally issue a token on bad creds.
                assert not data.get("token"), f"bad creds should not return a token: {data}"


# ── 3) /api/glp/crypto/networks without Authorization ────────────────────────
class TestGlpCryptoNetworksUnauthorized:
    def test_no_auth_returns_4xx_not_5xx(self, api_client):
        # Explicitly no Authorization header.
        r = requests.get(f"{BASE_URL}/api/glp/crypto/networks", timeout=45)
        assert r.status_code < 500, (
            f"proxy returned 5xx for unauth /crypto/networks ({r.status_code}): {r.text[:300]}"
        )
        assert r.status_code != 503, (
            f"upstream_blocked (sg-captcha) regression at /crypto/networks: {r.text[:300]}"
        )
        assert r.status_code in (400, 401, 403), (
            f"expected 401/403 for missing token, got {r.status_code}: {r.text[:300]}"
        )

    def test_no_auth_response_is_json(self, api_client):
        r = requests.get(f"{BASE_URL}/api/glp/crypto/networks", timeout=45)
        ctype = r.headers.get("content-type", "")
        assert "application/json" in ctype, f"expected JSON content-type, got {ctype}: {r.text[:200]}"
