// Staff catalogue + members API (WooCommerce stays the source of truth; every
// route is capability-checked server-side by the GLP connector).
import { stripHtml } from "@/src/utils/html";

import type { ProductCoa } from "@/src/types/catalogue";

import { glpFetch } from "./client";
import { mapCoa } from "./coa";

export interface AuditEntry { at: string; by: string; action: string; name: string; changes: Record<string, { from: any; to: any }> }
export interface ManagedProduct {
  id: number; name: string; sku: string; status: string; membersOnly: boolean;
  price: string; salePrice: string; manageStock: boolean; stockQuantity: number | null; stockStatus: string;
  imageUrl: string | null; soldTotal: number; sold30d: number;
  description?: string; audit?: AuditEntry[]; preview?: any; coa?: ProductCoa | null;
}
export interface Member { id: number; name: string; email: string; telegram: string; approved: boolean; staff: boolean; registered: string; orders: number }
export interface ProductEdit {
  name?: string; price?: string; sale_price?: string; stock_quantity?: number | null; stock_status?: "instock" | "outofstock";
  status?: "publish" | "draft"; members_only?: boolean; description?: string; image?: string; image_name?: string; notify?: boolean;
  coa_file?: string; coa_name?: string; coa_url?: string; coa_remove?: boolean;
}

const mapAudit = (a: any): AuditEntry => ({ at: String(a?.at ?? ""), by: String(a?.by ?? ""), action: String(a?.action ?? ""), name: String(a?.name ?? ""), changes: a?.changes && typeof a.changes === "object" && !Array.isArray(a.changes) ? a.changes : {} });

function mapProduct(p: any): ManagedProduct {
  return {
    id: Number(p?.id ?? 0), name: stripHtml(String(p?.name ?? "")), sku: String(p?.sku ?? ""), status: String(p?.status ?? ""),
    membersOnly: Boolean(p?.members_only), price: String(p?.price ?? ""), salePrice: String(p?.sale_price ?? ""),
    manageStock: Boolean(p?.manage_stock), stockQuantity: p?.stock_quantity === null || p?.stock_quantity === undefined ? null : Number(p.stock_quantity),
    stockStatus: String(p?.stock_status ?? ""), imageUrl: p?.image_url ? String(p.image_url) : null,
    soldTotal: Number(p?.sold_total ?? 0), sold30d: Number(p?.sold_30d ?? 0),
    description: p?.description !== undefined ? stripHtml(String(p.description)) : undefined,
    audit: Array.isArray(p?.audit) ? p.audit.map(mapAudit) : undefined, preview: p?.preview,
    coa: p?.coa !== undefined ? mapCoa(p.coa) : undefined,
  };
}

export const glpManage = {
  async products(search: string, filter: string): Promise<ManagedProduct[]> {
    const q = new URLSearchParams({ search, filter }).toString();
    const r = await glpFetch<any>(`/manage/products?${q}`);
    return Array.isArray(r?.products) ? r.products.map(mapProduct) : [];
  },
  async product(id: number) { return mapProduct((await glpFetch<any>(`/manage/products/${id}`))?.product); },
  async save(id: number | null, edit: ProductEdit): Promise<{ product: ManagedProduct; notify: string | null }> {
    const r = await glpFetch<any>(id ? `/manage/products/${id}` : "/manage/products", { method: "POST", body: edit, retries: 0 });
    return { product: mapProduct(r?.product), notify: r?.notify ?? null };
  },
  async duplicate(id: number) { return mapProduct((await glpFetch<any>(`/manage/products/${id}/duplicate`, { method: "POST", body: {}, retries: 0 }))?.product); },
  async audit(): Promise<AuditEntry[]> { const r = await glpFetch<any>("/manage/audit"); return Array.isArray(r?.entries) ? r.entries.map(mapAudit) : []; },
  async members(search: string): Promise<Member[]> {
    const r = await glpFetch<any>(`/manage/members?${new URLSearchParams({ search }).toString()}`);
    return Array.isArray(r?.members) ? r.members.map((m: any) => ({ id: Number(m.id), name: String(m.name ?? ""), email: String(m.email ?? ""), telegram: String(m.telegram ?? ""), approved: Boolean(m.approved), staff: Boolean(m.staff), registered: String(m.registered ?? ""), orders: Number(m.orders ?? 0) })) : [];
  },
  async setApproved(id: number, approved: boolean) { await glpFetch<any>(`/manage/members/${id}`, { method: "POST", body: { approved }, retries: 0 }); },
};

export function describeChange(field: string, c: { from: any; to: any }): string {
  const f = (v: any) => (v === null || v === undefined || v === "" ? "—" : typeof v === "boolean" ? (v ? "yes" : "no") : String(v));
  return c.from === null && field !== "image" ? `${field.replace(/_/g, " ")}: ${f(c.to)}` : `${field.replace(/_/g, " ")}: ${f(c.from)} → ${f(c.to)}`;
}
