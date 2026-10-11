"""
GLP trusted backend proxy
-------------------------
The GLP App Connector (/wp-json/glp/v1/*) is server-to-server ONLY: every call
needs the shared secret header `X-GLP-App-Secret`, which must NEVER ship in the
app. This module is that trusted backend: the Expo app calls `/api/glp/*` here,
and we forward to WordPress with the secret + the customer's opaque token.

Secrets (server-side only):
  GLP_APP_SHARED_SECRET  -> injected via backend env/secrets (never logged/returned)
  GLP_BASE_URL           -> e.g. https://staging2.apeps.co.uk  (non-secret, in .env)

Auth model:
  POST /api/glp/auth/register | /auth/session  -> returns {customer, token}
  All other routes: app sends `Authorization: Bearer <token>`, we forward it as
  `X-GLP-Customer-Token`. No endpoint accepts a customer id from the client.
"""

import os
import uuid
import logging
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Request, Response, Header, HTTPException
from fastapi.responses import JSONResponse

logger = logging.getLogger("glp_proxy")

GLP_BASE_URL = os.environ.get("GLP_BASE_URL", "https://staging2.apeps.co.uk").rstrip("/")
GLP_NS = "/wp-json/glp/v1"
TIMEOUT = httpx.Timeout(30.0, connect=15.0)

# Dedicated server-to-server User-Agent (NOT a browser UA — a browser-mimicking
# UA triggers SiteGround AntiBot since this is not a real browser).
_UA = "AP3P-Storefront-API/1.0"

glp_router = APIRouter(prefix="/api/glp")


def _secret() -> str:
    return os.environ.get("GLP_APP_SHARED_SECRET", "")


def _token_from_auth(authorization: Optional[str]) -> str:
    if not authorization:
        return ""
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return authorization.strip()


async def _forward(
    method: str,
    path: str,
    *,
    token: str = "",
    params: Optional[dict] = None,
    json_body: Any = None,
) -> Response:
    secret = _secret()
    if not secret:
        return JSONResponse(
            {"error": "proxy_unconfigured",
             "message": "Payment backend not configured. GLP_APP_SHARED_SECRET is missing on the server."},
            status_code=503,
        )
    url = f"{GLP_BASE_URL}{GLP_NS}{path}"
    headers = {
        "X-GLP-App-Secret": secret,
        "Accept": "application/json",
        "User-Agent": _UA,
    }
    if token:
        headers["X-GLP-Customer-Token"] = token
        if method == "GET":
            # Bypass SiteGround Dynamic Cache for per-user reads: it keys on URL
            # only, so a cached response (e.g. a 404) must never be reused
            # across users or after a state change.
            params = {**(params or {}), "_nc": uuid.uuid4().hex}
    if json_body is not None:
        headers["Content-Type"] = "application/json"

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.request(method, url, headers=headers, params=params, json=json_body)
    except httpx.TimeoutException:
        return JSONResponse({"error": "upstream_timeout", "message": "The store took too long to respond."}, status_code=504)
    except httpx.HTTPError as e:
        logger.warning("GLP upstream error: %s", e)
        return JSONResponse({"error": "upstream_error", "message": "Could not reach the store."}, status_code=502)

    text = resp.text
    low = text.lstrip()[:200].lower()
    if "sgcaptcha" in text.lower() or low.startswith("<!doctype") or low.startswith("<html"):
        # Bot-protection challenge — surface a precise, traceable error (never the secret).
        logger.warning("GLP upstream bot-challenge %s on %s", resp.status_code, path)
        return JSONResponse(
            {
                "error": "upstream_blocked",
                "message": "The store returned a bot-protection challenge (sg-captcha). Whitelist the server IP.",
                "upstream_status": resp.status_code,
                "upstream_url": url,
            },
            status_code=503,
        )

    media = resp.headers.get("content-type", "application/json")
    try:
        data = resp.json()
        out = JSONResponse(data, status_code=resp.status_code)
    except Exception:
        out = Response(content=resp.content, status_code=resp.status_code, media_type=media)
    # Never cache authenticated / invoice reads.
    out.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return out


async def _json(request: Request) -> Any:
    try:
        return await request.json()
    except Exception:
        return {}


# ── Health / diagnostics ─────────────────────────────────────────────────────
@glp_router.get("/health")
async def glp_health():
    reachable = False
    detail: dict = {}
    if _secret():
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                r = await client.get(
                    f"{GLP_BASE_URL}{GLP_NS}/version",
                    headers={"X-GLP-App-Secret": _secret(), "Accept": "application/json", "User-Agent": _UA},
                )
            detail = {"upstream_status": r.status_code}
            reachable = r.status_code == 200
        except httpx.HTTPError as e:
            detail = {"error": str(e)}
    return {
        "ok": True,
        "secret_configured": bool(_secret()),
        "glp_base_url": GLP_BASE_URL,
        "upstream_reachable": reachable,
        **detail,
    }


# ── Auth ──────────────────────────────────────────────────────────────────────
@glp_router.post("/auth/register")
async def glp_register(request: Request):
    body = await _json(request)
    payload = {
        "email": body.get("email", ""),
        "password": body.get("password", ""),
        "first_name": body.get("firstName", body.get("first_name", "")),
        "last_name": body.get("lastName", body.get("last_name", "")),
        "telegram_username": body.get("telegramUsername", body.get("telegram_username", "")),
    }
    return await _forward("POST", "/register", json_body=payload)


@glp_router.post("/auth/session")
async def glp_session(request: Request):
    body = await _json(request)
    payload = {"username": body.get("username", body.get("email", "")), "password": body.get("password", "")}
    return await _forward("POST", "/session", json_body=payload)


# ── Account ─────────────────────────────────────────────────────────────────
@glp_router.get("/me")
async def glp_me(authorization: Optional[str] = Header(None)):
    return await _forward("GET", "/me", token=_token_from_auth(authorization))


@glp_router.get("/me/addresses")
async def glp_addresses(authorization: Optional[str] = Header(None)):
    return await _forward("GET", "/me/addresses", token=_token_from_auth(authorization))


@glp_router.post("/account/shipping-address")
async def glp_save_address(request: Request, authorization: Optional[str] = Header(None)):
    return await _forward("POST", "/account/shipping-address", token=_token_from_auth(authorization), json_body=await _json(request))


@glp_router.post("/me/change-password")
async def glp_change_password(request: Request, authorization: Optional[str] = Header(None)):
    return await _forward("POST", "/me/change-password", token=_token_from_auth(authorization), json_body=await _json(request))


@glp_router.post("/auth/request-password-reset")
async def glp_password_reset(request: Request):
    return await _forward("POST", "/auth/request-password-reset", json_body=await _json(request))


# ── Catalogue (approved members) ───────────────────────────────────────────
@glp_router.get("/categories")
async def glp_categories(authorization: Optional[str] = Header(None)):
    return await _forward("GET", "/categories", token=_token_from_auth(authorization))


@glp_router.get("/catalogue")
async def glp_catalogue(request: Request, authorization: Optional[str] = Header(None)):
    return await _forward("GET", "/catalogue", token=_token_from_auth(authorization), params=dict(request.query_params))


@glp_router.get("/products/{product_id}")
async def glp_product(product_id: int, authorization: Optional[str] = Header(None)):
    return await _forward("GET", f"/products/{product_id}", token=_token_from_auth(authorization))


@glp_router.get("/products/{product_id}/coa")
async def glp_product_coa(product_id: int, authorization: Optional[str] = Header(None)):
    return await _forward("GET", f"/products/{product_id}/coa", token=_token_from_auth(authorization))


# ── Basket / shipping / orders ──────────────────────────────────────────────
@glp_router.post("/basket/validate")
async def glp_validate(request: Request, authorization: Optional[str] = Header(None)):
    return await _forward("POST", "/basket/validate", token=_token_from_auth(authorization), json_body=await _json(request))


@glp_router.post("/shipping/quote")
async def glp_shipping(request: Request, authorization: Optional[str] = Header(None)):
    return await _forward("POST", "/shipping/quote", token=_token_from_auth(authorization), json_body=await _json(request))


@glp_router.get("/orders")
async def glp_orders(authorization: Optional[str] = Header(None)):
    return await _forward("GET", "/orders", token=_token_from_auth(authorization))


@glp_router.get("/orders/{order_id}")
async def glp_order(order_id: int, authorization: Optional[str] = Header(None)):
    return await _forward("GET", f"/orders/{order_id}", token=_token_from_auth(authorization))


@glp_router.post("/orders")
async def glp_create_order(request: Request, authorization: Optional[str] = Header(None)):
    return await _forward("POST", "/orders", token=_token_from_auth(authorization), json_body=await _json(request))


@glp_router.post("/orders/{order_id}/cancel")
async def glp_cancel(order_id: int, request: Request, authorization: Optional[str] = Header(None)):
    return await _forward("POST", f"/orders/{order_id}/cancel", token=_token_from_auth(authorization), json_body=await _json(request))


# ── Crypto (USDT / TRC20) ───────────────────────────────────────────────────
@glp_router.get("/crypto/networks")
async def glp_networks(authorization: Optional[str] = Header(None)):
    return await _forward("GET", "/crypto/networks", token=_token_from_auth(authorization))


@glp_router.get("/orders/{order_id}/crypto-invoice")
async def glp_invoice(order_id: int, authorization: Optional[str] = Header(None)):
    return await _forward("GET", f"/orders/{order_id}/crypto-invoice", token=_token_from_auth(authorization))


@glp_router.post("/orders/{order_id}/crypto-recheck")
async def glp_recheck(order_id: int, request: Request, authorization: Optional[str] = Header(None)):
    return await _forward("POST", f"/orders/{order_id}/crypto-recheck", token=_token_from_auth(authorization), json_body=await _json(request))


@glp_router.post("/orders/{order_id}/crypto-network")
async def glp_change_network(order_id: int, request: Request, authorization: Optional[str] = Header(None)):
    return await _forward("POST", f"/orders/{order_id}/crypto-network", token=_token_from_auth(authorization), json_body=await _json(request))


# ── Customer postage label (owner-scoped server-side) ─────────────────────────
@glp_router.get("/orders/{order_id}/label")
async def glp_label_get(order_id: int, authorization: Optional[str] = Header(None)):
    return await _forward("GET", f"/orders/{order_id}/label", token=_token_from_auth(authorization))


@glp_router.post("/orders/{order_id}/label")
async def glp_label_upload(order_id: int, request: Request, authorization: Optional[str] = Header(None)):
    body = await _json(request)
    payload = {
        "kind": body.get("kind", "label"),
        "filename": body.get("filename", ""),
        "data": body.get("data", ""),
    }
    return await _forward("POST", f"/orders/{order_id}/label", token=_token_from_auth(authorization), json_body=payload)


# ── Staff fulfilment (glp_fulfil_orders capability enforced by WordPress) ─────
@glp_router.get("/fulfilment/orders")
async def glp_fulfil_list(state: str = "all", authorization: Optional[str] = Header(None)):
    return await _forward("GET", "/fulfilment/orders", token=_token_from_auth(authorization), params={"state": state})


@glp_router.get("/fulfilment/orders/{order_id}")
async def glp_fulfil_detail(order_id: int, authorization: Optional[str] = Header(None)):
    return await _forward("GET", f"/fulfilment/orders/{order_id}", token=_token_from_auth(authorization))


@glp_router.get("/fulfilment/orders/{order_id}/label")
async def glp_fulfil_label(order_id: int, authorization: Optional[str] = Header(None)):
    return await _forward("GET", f"/fulfilment/orders/{order_id}/label", token=_token_from_auth(authorization))


@glp_router.get("/fulfilment/debug/emails")
async def glp_fulfil_debug_emails(order: int = 0, authorization: Optional[str] = Header(None)):
    return await _forward("GET", "/fulfilment/debug/emails", token=_token_from_auth(authorization), params={"order": order})


@glp_router.post("/fulfilment/orders/{order_id}/ready")
async def glp_fulfil_ready(order_id: int, authorization: Optional[str] = Header(None)):
    return await _forward("POST", f"/fulfilment/orders/{order_id}/ready", token=_token_from_auth(authorization), json_body={})


@glp_router.post("/fulfilment/orders/{order_id}/dispatch")
async def glp_fulfil_dispatch(order_id: int, authorization: Optional[str] = Header(None)):
    return await _forward("POST", f"/fulfilment/orders/{order_id}/dispatch", token=_token_from_auth(authorization), json_body={})


# ── Web Push stock alerts (member-scoped server-side; VAPID private key never leaves WP) ──
@glp_router.post("/push/{action}")
async def glp_push(action: str, request: Request, authorization: Optional[str] = Header(None)):
    if action not in ("status", "subscribe", "prefs", "unsubscribe", "test"):
        raise HTTPException(status_code=404, detail="Not Found")
    return await _forward("POST", f"/push/{action}", token=_token_from_auth(authorization), json_body=await _json(request))


# ── Staff catalogue / members management (capabilities enforced by WordPress) ──
@glp_router.api_route("/manage/{path:path}", methods=["GET", "POST"])
async def glp_manage(path: str, request: Request, authorization: Optional[str] = Header(None)):
    import re as _re
    if not _re.fullmatch(r"products(/\d+(/duplicate)?)?|audit|members(/\d+)?", path):
        raise HTTPException(status_code=404, detail="Not Found")
    if request.method == "GET":
        return await _forward("GET", f"/manage/{path}", token=_token_from_auth(authorization), params=dict(request.query_params))
    return await _forward("POST", f"/manage/{path}", token=_token_from_auth(authorization), json_body=await _json(request))
