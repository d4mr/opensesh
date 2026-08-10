import { downloadPortalFile } from "@/server-fns/portal";

const base64Bytes = (base64: string) => {
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

export const fileAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = reader.result;
      resolve(typeof result === "string" ? (result.split(",")[1] ?? "") : "");
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });

export const downloadVersion = async (versionId: string) => {
  const result = await downloadPortalFile({ data: { versionId } });
  if (!result.ok) return result;
  const bytes = base64Bytes(result.data.base64);
  const blob = new Blob([bytes], { type: result.data.contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = result.data.filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return result;
};

export const fetchVersionData = async (versionId: string) => {
  const result = await downloadPortalFile({ data: { versionId } });
  return result.ok
    ? {
        filename: result.data.filename,
        bytes: base64Bytes(result.data.base64),
      }
    : null;
};

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ (crcTable[(crc ^ byte) & 0xff] ?? 0);
  return (crc ^ 0xffffffff) >>> 0;
};

const write16 = (view: DataView, offset: number, value: number) =>
  view.setUint16(offset, value, true);
const write32 = (view: DataView, offset: number, value: number) =>
  view.setUint32(offset, value, true);

export const downloadZip = (
  name: string,
  files: ReadonlyArray<{ readonly filename: string; readonly bytes: Uint8Array }>,
) => {
  const encoder = new TextEncoder();
  const locals: Array<Uint8Array> = [];
  const centrals: Array<Uint8Array> = [];
  let offset = 0;
  for (const file of files) {
    const filename = encoder.encode(file.filename);
    const checksum = crc32(file.bytes);
    const local = new Uint8Array(30 + filename.length + file.bytes.length);
    const localView = new DataView(local.buffer);
    write32(localView, 0, 0x04034b50);
    write16(localView, 4, 20);
    write16(localView, 8, 0);
    write32(localView, 14, checksum);
    write32(localView, 18, file.bytes.length);
    write32(localView, 22, file.bytes.length);
    write16(localView, 26, filename.length);
    local.set(filename, 30);
    local.set(file.bytes, 30 + filename.length);
    locals.push(local);

    const central = new Uint8Array(46 + filename.length);
    const centralView = new DataView(central.buffer);
    write32(centralView, 0, 0x02014b50);
    write16(centralView, 4, 20);
    write16(centralView, 6, 20);
    write32(centralView, 16, checksum);
    write32(centralView, 20, file.bytes.length);
    write32(centralView, 24, file.bytes.length);
    write16(centralView, 28, filename.length);
    write32(centralView, 42, offset);
    central.set(filename, 46);
    centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(offset + centralSize + 22);
  let cursor = 0;
  for (const part of [...locals, ...centrals]) {
    output.set(part, cursor);
    cursor += part.length;
  }
  const end = new DataView(output.buffer);
  write32(end, cursor, 0x06054b50);
  write16(end, cursor + 8, files.length);
  write16(end, cursor + 10, files.length);
  write32(end, cursor + 12, centralSize);
  write32(end, cursor + 16, offset);
  const blob = new Blob([output.buffer], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const dataUrlForVersion = async (versionId: string) => {
  const result = await downloadPortalFile({ data: { versionId } });
  return result.ok ? `data:${result.data.contentType};base64,${result.data.base64}` : null;
};
