import { Capacitor, registerPlugin } from "@capacitor/core";

export interface NativeFileWriter {
  begin(options: { name: string; mime: string; size: number }): Promise<{ token: string }>;
  append(options: { token: string; offset: number; data: string }): Promise<void>;
  finish(options: { token: string }): Promise<{ saved: boolean }>;
  cancel(options: { token: string }): Promise<void>;
}

const nativeFiles = registerPlugin<NativeFileWriter>("LektrusFiles");
const CHUNK_BYTES = 256 * 1024;
const MAX_NATIVE_FILE_BYTES = 512 * 1024 * 1024;

export function safeExportFilename(name: string): string {
  const safe = name.replace(/[\\/:*?"<>|\u0000-\u001f\u007f-\u009f]/g, "_").trim().replace(/^\.+/, "_");
  if (!safe) return "lektrus-file";
  const extension = safe.match(/\.[a-zA-Z0-9]{1,16}$/)?.[0] ?? "";
  const stem = extension ? safe.slice(0, -extension.length) : safe;
  const encoder = new TextEncoder();
  let result = "";
  let bytes = extension.length;
  for (const character of stem) {
    const width = encoder.encode(character).length;
    if (bytes + width > 240 || result.length + character.length + extension.length > 180) break;
    result += character; bytes += width;
  }
  return (result || "lektrus-file") + extension;
}

function safeMime(value: string): string {
  const mime = value.split(";")[0].trim();
  return /^[\w.+-]+\/[\w.+-]+$/.test(mime) ? mime : "application/octet-stream";
}

function encodeChunk(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

/** Bounded bridge messages avoid multiple full-size base64 copies of large PDFs/backups. */
export async function writeNativeBlob(writer: NativeFileWriter, blob: Blob, name: string): Promise<boolean> {
  if (blob.size > MAX_NATIVE_FILE_BYTES) throw new Error("На мобильном устройстве можно сохранить файл размером до 512 МБ");
  const { token } = await writer.begin({ name: safeExportFilename(name), mime: safeMime(blob.type), size: blob.size });
  try {
    for (let offset = 0; offset < blob.size; offset += CHUNK_BYTES) {
      const bytes = new Uint8Array(await blob.slice(offset, offset + CHUNK_BYTES).arrayBuffer());
      await writer.append({ token, offset, data: encodeChunk(bytes) });
    }
    return (await writer.finish({ token })).saved;
  } catch (error) {
    await writer.cancel({ token }).catch(() => undefined);
    throw error;
  }
}

/** Native saves show the OS file picker; cancellation never reports success. */
export async function saveExport(blob: Blob, name: string): Promise<boolean> {
  if (Capacitor.isNativePlatform()) return writeNativeBlob(nativeFiles, blob, name);
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = safeExportFilename(name);
    link.click();
    return true;
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
