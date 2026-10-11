// Staff product photo: pick an image and resize/compress it on the device
// (max 1600px longest side, JPEG ~80%) before upload, keeping uploads small.
import * as DocumentPicker from "expo-document-picker";
import { SaveFormat, manipulateAsync } from "expo-image-manipulator";

const MAX_SIDE = 1600;
const MAX_INPUT_BYTES = 30 * 1024 * 1024;

export async function pickProductPhoto(): Promise<{ data: string; name: string; mime: string } | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ["image/jpeg", "image/png", "image/webp"], copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  if (asset.size && asset.size > MAX_INPUT_BYTES) throw new Error("That photo is too large (max 30 MB before compression).");
  const info = await manipulateAsync(asset.uri, []);
  const longest = Math.max(info.width, info.height);
  const actions = longest > MAX_SIDE ? [{ resize: info.width >= info.height ? { width: MAX_SIDE } : { height: MAX_SIDE } }] : [];
  const out = await manipulateAsync(asset.uri, actions, { compress: 0.8, format: SaveFormat.JPEG, base64: true });
  if (!out.base64) throw new Error("Couldn't process that photo.");
  const base = (asset.name ?? "product").replace(/\.[^.]+$/, "");
  return { data: out.base64, name: `${base}.jpg`, mime: "image/jpeg" };
}
