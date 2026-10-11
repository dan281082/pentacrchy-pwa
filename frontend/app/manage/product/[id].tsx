// Staff product editor (create / edit / duplicate / preview / notify / audit).
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { describeChange, glpManage, type ProductEdit } from "@/src/api/glp/manage";
import { Button } from "@/src/components/ui/Button";
import { TopBar } from "@/src/components/ui/TopBar";
import { useAuth } from "@/src/context/auth";
import { confirmAction } from "@/src/utils/confirm";
import { pickLabelFile } from "@/src/utils/label-file";
import { pickProductPhoto } from "@/src/utils/product-photo";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

export default function ProductEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const pid = isNew ? null : Number(id);
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["manage", "product", pid], queryFn: () => glpManage.product(pid as number), enabled: !!pid && !!user?.manage, staleTime: 0 });
  const p = q.data;

  const [f, setF] = useState({ name: "", price: "", sale: "", stock: "", desc: "", publish: false, members: true, inStock: true });
  const [image, setImage] = useState<{ data: string; name: string; mime: string } | null>(null);
  const [notify, setNotify] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [coaFile, setCoaFile] = useState<{ data: string; name: string } | null>(null);
  const [coaUrl, setCoaUrl] = useState("");
  const [coaRemove, setCoaRemove] = useState(false);

  useEffect(() => {
    if (p) setF({ name: p.name, price: p.price, sale: p.salePrice, stock: p.stockQuantity === null ? "" : String(p.stockQuantity), desc: p.description ?? "", publish: p.status === "publish", members: p.membersOnly, inStock: p.stockStatus !== "outofstock" });
  }, [p]);

  if (!user?.manage) return null;
  const set = (k: keyof typeof f) => (v: any) => setF((s) => ({ ...s, [k]: v }));

  const save = async () => {
    if (p && !isNew) {
      if (p.status === "publish" && !f.publish && !(await confirmAction("Unpublish product?", `“${p.name}” will be hidden from members until it is published again.`, "Unpublish"))) return;
      const zeroNow = f.stock.trim() !== "" ? Number(f.stock) === 0 : !f.inStock;
      const wasAvailable = p.stockStatus !== "outofstock" && p.stockQuantity !== 0;
      if (zeroNow && wasAvailable && !(await confirmAction("Mark as sold out?", `Stock for “${p.name}” will be set to zero and members won't be able to order it.`, "Set to zero"))) return;
    }
    if (coaRemove && !(await confirmAction("Remove COA?", "The Certificate of Analysis will no longer be shown to members.", "Remove"))) return;
    setBusy("save"); setMsg(null);
    try {
      const edit: ProductEdit = { name: f.name.trim(), price: f.price.trim(), sale_price: f.sale.trim(), description: f.desc, status: f.publish ? "publish" : "draft", members_only: f.members, notify };
      if (f.stock.trim() !== "") edit.stock_quantity = Number(f.stock); else edit.stock_status = f.inStock ? "instock" : "outofstock";
      if (image) { edit.image = image.data; edit.image_name = image.name; }
      if (coaRemove) edit.coa_remove = true;
      else if (coaFile) { edit.coa_file = coaFile.data; edit.coa_name = coaFile.name; }
      else if (coaUrl.trim()) edit.coa_url = coaUrl.trim();
      const r = await glpManage.save(pid, edit);
      qc.invalidateQueries(); // staff + catalogue views re-fetch live WooCommerce data
      setImage(null); setNotify(false); setCoaFile(null); setCoaUrl(""); setCoaRemove(false);
      const n = r.notify === "new_vial" ? " Members notified (new product)." : r.notify === "back_in_stock" ? " Members notified (back in stock)." : r.notify ? " No alert sent: product isn't newly available to members." : "";
      setMsg(`Saved.${n}`);
      if (isNew) router.replace({ pathname: "/manage/product/[id]", params: { id: String(r.product.id) } });
    } catch (e: any) { setMsg(e?.message ?? "Couldn't save."); } finally { setBusy(""); }
  };
  const duplicate = async () => {
    if (!pid) return; setBusy("dup");
    try { const d = await glpManage.duplicate(pid); qc.invalidateQueries({ queryKey: ["manage"] }); router.push({ pathname: "/manage/product/[id]", params: { id: String(d.id) } }); }
    catch (e: any) { setMsg(e?.message ?? "Couldn't duplicate."); } finally { setBusy(""); }
  };
  const pickImage = async () => { try { const x = await pickProductPhoto(); if (x) setImage(x); } catch (e: any) { setMsg(e?.message ?? "Couldn't use that photo."); } };
  const pickCoa = async () => {
    try { const x = await pickLabelFile("label"); if (x) { setCoaFile({ data: x.data, name: x.name }); setCoaUrl(""); setCoaRemove(false); } }
    catch { setMsg("COA files must be a PDF, JPG or PNG up to 5 MB."); }
  };
  const coaCurrent = coaRemove ? null : coaFile ? `New file: ${coaFile.name}` : coaUrl.trim() ? `New link: ${coaUrl.trim()}` : p?.coa ? (p.coa.type === "url" ? `Link: ${p.coa.url}` : `File: ${p.coa.name}`) : null;

  const imgSrc = image ? `data:${image.mime};base64,${image.data}` : p?.imageUrl;
  return (
    <View style={s.c} testID="manage-editor">
      <TopBar title={isNew ? "New product" : "Edit product"} showBack showBasket={false} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 120 }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={pickImage} style={s.img} testID="manage-image">{imgSrc ? <Image source={imgSrc} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <Text style={s.meta}>Tap to add a photo (resized automatically)</Text>}</Pressable>
        <Field label="Name" value={f.name} onChange={set("name")} testID="manage-name" />
        <View style={s.row2}>
          <View style={{ flex: 1 }}><Field label="Price (£)" value={f.price} onChange={set("price")} keyboard="decimal-pad" testID="manage-price" /></View>
          <View style={{ flex: 1 }}><Field label="Sale price (£)" value={f.sale} onChange={set("sale")} keyboard="decimal-pad" testID="manage-sale" /></View>
        </View>
        <Field label="Stock quantity (leave empty to use In/Out of stock)" value={f.stock} onChange={set("stock")} keyboard="number-pad" testID="manage-stock" />
        {f.stock.trim() === "" && <Toggle label="In stock" value={f.inStock} onChange={set("inStock")} testID="manage-instock" />}
        <Field label="Description" value={f.desc} onChange={set("desc")} multiline testID="manage-desc" />
        <View style={s.card} testID="manage-coa">
          <Text style={s.label}>Certificate of Analysis (COA) — optional</Text>
          <Text style={s.meta} testID="manage-coa-current">{coaCurrent ?? (coaRemove ? "Will be removed on save" : "No COA attached")}</Text>
          <View style={s.row2}>
            <View style={{ flex: 1 }}><Button title="Upload file" icon="document-attach-outline" variant="secondary" onPress={pickCoa} testID="manage-coa-upload" /></View>
            {(!!p?.coa || !!coaFile || !!coaUrl.trim()) && !coaRemove && <View style={{ flex: 1 }}><Button title="Remove" icon="trash-outline" variant="ghost" onPress={() => { setCoaFile(null); setCoaUrl(""); if (p?.coa) setCoaRemove(true); }} testID="manage-coa-remove" /></View>}
          </View>
          <Field label="…or COA link (https://)" value={coaUrl} onChange={(v) => { setCoaUrl(v); if (v) { setCoaFile(null); setCoaRemove(false); } }} keyboard="url" testID="manage-coa-url" />
          <Text style={s.meta}>PDF, JPG or PNG up to 5 MB. Shown to approved members only, separate from the description.</Text>
        </View>
        <Toggle label="Published" value={f.publish} onChange={set("publish")} testID="manage-publish" />
        <Toggle label="Members-only (Pentarchy)" value={f.members} onChange={set("members")} testID="manage-members-only" />
        <Toggle label="Notify members on save" hint="Sends a ‘New product’ or ‘Back in stock’ alert only if this save makes it newly available." value={notify} onChange={setNotify} testID="manage-notify" />
        {!!msg && <Text style={s.msg} testID="manage-message">{msg}</Text>}
        <Button title="Save" icon="checkmark" onPress={save} loading={busy === "save"} testID="manage-save" />
        {!isNew && <View style={s.row2}>
          <View style={{ flex: 1 }}><Button title="Preview" icon="eye-outline" variant="secondary" onPress={() => setPreview(true)} testID="manage-preview" /></View>
          <View style={{ flex: 1 }}><Button title="Duplicate" icon="copy-outline" variant="secondary" onPress={duplicate} loading={busy === "dup"} testID="manage-duplicate" /></View>
        </View>}
        {!!p && <View style={s.card}>
          <Text style={s.label}>Sales</Text>
          <Text style={s.meta}>{p.sold30d} sold in the last 30 days · {p.soldTotal} all time</Text>
        </View>}
        {!!p?.audit?.length && <View style={s.card} testID="manage-audit">
          <Text style={s.label}>Change history</Text>
          {p.audit.slice(0, 30).map((a, i) => (
            <Text key={i} style={s.meta}>{new Date(a.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {a.by} · {a.action.replace(/_/g, " ")}{Object.keys(a.changes).length ? ` — ${Object.entries(a.changes).map(([k, c]) => describeChange(k, c)).join("; ")}` : ""}</Text>
          ))}
        </View>}
      </ScrollView>
      <Modal visible={preview} transparent animationType="fade" onRequestClose={() => setPreview(false)}>
        <Pressable style={s.overlay} onPress={() => setPreview(false)}>
          <View style={s.previewCard} testID="manage-preview-card">
            <Text style={s.meta}>Member preview{p?.status !== "publish" ? " (draft — not visible yet)" : ""}</Text>
            <View style={[s.img, { height: 200 }]}>{imgSrc ? <Image source={imgSrc} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}</View>
            <Text style={s.pname}>{f.name}</Text>
            <Text style={s.pprice}>£{f.sale || f.price}{f.sale ? `  (was £${f.price})` : ""}</Text>
            <Text style={s.meta}>{f.stock.trim() !== "" ? (Number(f.stock) > 0 ? "Available" : "Sold out") : f.inStock ? "Available" : "Sold out"}</Text>
            {!!f.desc && <Text style={s.meta}>{f.desc}</Text>}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function Field({ label, value, onChange, keyboard, multiline, testID }: { label: string; value: string; onChange: (v: string) => void; keyboard?: any; multiline?: boolean; testID?: string }) {
  return (<View style={{ gap: 4 }}><Text style={s.label}>{label}</Text><TextInput value={value} onChangeText={onChange} keyboardType={keyboard} multiline={multiline} style={[s.input, multiline && { minHeight: 90, textAlignVertical: "top" }]} placeholderTextColor={colors.onSurfaceTertiary} testID={testID} /></View>);
}
function Toggle({ label, hint, value, onChange, testID }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; testID?: string }) {
  return (<View style={s.toggle}><View style={{ flex: 1 }}><Text style={s.tl}>{label}</Text>{!!hint && <Text style={s.meta}>{hint}</Text>}</View><Switch value={value} onValueChange={onChange} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} testID={testID} /></View>);
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.surface },
  img: { height: 160, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  row2: { flexDirection: "row", gap: spacing.sm },
  label: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  input: { minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, color: colors.onSurface, fontSize: fontSize.base },
  toggle: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 48 },
  tl: { color: colors.onSurface, fontSize: fontSize.base },
  meta: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, lineHeight: 18 },
  msg: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm },
  card: { padding: spacing.md, gap: 6, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "center", padding: spacing.lg },
  previewCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  pname: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.medium },
  pprice: { color: colors.onSurface, fontSize: fontSize.lg },
});
