// Web Push (stock alerts) client helpers. The browser subscription is sent to
// the GLP connector (via the same-domain proxy) and tied to the signed-in member
// server-side. Only the VAPID PUBLIC key ever reaches the app.

import { Platform } from "react-native";

import { glpFetch } from "@/src/api/glp/client";

export interface AlertPrefs {
  new_vial: boolean;
  back_in_stock: boolean;
}
export interface PushStatus {
  available: boolean;
  publicKey: string;
  prefs: AlertPrefs;
  thisDevice: boolean;
}
export type PushSupport = "ok" | "needs_install" | "unsupported" | "denied";

const isWeb = Platform.OS === "web" && typeof window !== "undefined";

export function pushSupport(): PushSupport {
  if (!isWeb) return "unsupported";
  const nav: any = window.navigator;
  const ios = /iPhone|iPad|iPod/.test(nav.userAgent) || (nav.userAgent.includes("Macintosh") && "ontouchend" in document);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone === true;
  if (ios && !standalone) return "needs_install";
  if (!("serviceWorker" in nav) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if ((window as any).Notification.permission === "denied") return "denied";
  return "ok";
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const nav: any = window.navigator;
  const existing = await nav.serviceWorker.getRegistration("/");
  if (!existing) await nav.serviceWorker.register("/sw.js", { scope: "/" });
  return nav.serviceWorker.ready;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "ok") return null;
  return (await registration()).pushManager.getSubscription();
}

function keyBytes(b64url: string): Uint8Array {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const raw = atob(b64url.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function mapStatus(r: any): PushStatus {
  return {
    available: Boolean(r?.available),
    publicKey: String(r?.public_key ?? ""),
    prefs: { new_vial: Boolean(r?.prefs?.new_vial), back_in_stock: Boolean(r?.prefs?.back_in_stock) },
    thisDevice: Boolean(r?.this_device),
  };
}

export async function getPushStatus(): Promise<PushStatus> {
  const sub = await currentSubscription().catch(() => null);
  return mapStatus(await glpFetch<any>("/push/status", { method: "POST", body: { endpoint: sub?.endpoint ?? "" } }));
}

/** Must be called from a user tap (iOS requirement). */
export async function savePrefs(prefs: AlertPrefs, status: PushStatus): Promise<PushStatus> {
  const wantsAny = prefs.new_vial || prefs.back_in_stock;
  let sub = await currentSubscription();
  if (wantsAny && (!sub || !status.thisDevice)) {
    const perm = await (window as any).Notification.requestPermission();
    if (perm !== "granted") throw new Error(perm === "denied" ? "denied" : "dismissed");
    const reg = await registration();
    sub = sub ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(status.publicKey) as any }));
    return mapStatus(await glpFetch<any>("/push/subscribe", { method: "POST", body: { subscription: sub.toJSON(), prefs }, retries: 0 }));
  }
  return mapStatus(await glpFetch<any>("/push/prefs", { method: "POST", body: { ...prefs, endpoint: sub?.endpoint ?? "" }, retries: 0 }));
}

export async function sendTestAlert(): Promise<{ sent: number }> {
  const r = await glpFetch<any>("/push/test", { method: "POST", body: {}, retries: 0 });
  return { sent: Number(r?.sent ?? 0) };
}
