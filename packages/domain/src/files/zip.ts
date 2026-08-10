export interface ZipEntry {
  readonly path: string;
  readonly bytes: Uint8Array;
}

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
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

export const buildZip = (entries: ReadonlyArray<ZipEntry>) => {
  const encoder = new TextEncoder();
  const localRecords: Array<Uint8Array> = [];
  const centralRecords: Array<Uint8Array> = [];
  let localOffset = 0;

  for (const entry of entries) {
    const path = encoder.encode(entry.path);
    const checksum = crc32(entry.bytes);
    const local = new Uint8Array(30 + path.length + entry.bytes.length);
    const localView = new DataView(local.buffer);
    write32(localView, 0, 0x04034b50);
    write16(localView, 4, 20);
    write16(localView, 6, 0x0800);
    write32(localView, 14, checksum);
    write32(localView, 18, entry.bytes.length);
    write32(localView, 22, entry.bytes.length);
    write16(localView, 26, path.length);
    local.set(path, 30);
    local.set(entry.bytes, 30 + path.length);
    localRecords.push(local);

    const central = new Uint8Array(46 + path.length);
    const centralView = new DataView(central.buffer);
    write32(centralView, 0, 0x02014b50);
    write16(centralView, 4, 20);
    write16(centralView, 6, 20);
    write16(centralView, 8, 0x0800);
    write32(centralView, 16, checksum);
    write32(centralView, 20, entry.bytes.length);
    write32(centralView, 24, entry.bytes.length);
    write16(centralView, 28, path.length);
    write32(centralView, 42, localOffset);
    central.set(path, 46);
    centralRecords.push(central);
    localOffset += local.length;
  }

  const centralSize = centralRecords.reduce((total, record) => total + record.length, 0);
  const output = new Uint8Array(localOffset + centralSize + 22);
  let cursor = 0;
  for (const record of [...localRecords, ...centralRecords]) {
    output.set(record, cursor);
    cursor += record.length;
  }
  const end = new DataView(output.buffer);
  write32(end, cursor, 0x06054b50);
  write16(end, cursor + 8, entries.length);
  write16(end, cursor + 10, entries.length);
  write32(end, cursor + 12, centralSize);
  write32(end, cursor + 16, localOffset);
  return output;
};
