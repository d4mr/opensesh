import { describe, expect, it } from "vitest";

import { buildZip } from "./zip";

const centralPaths = (zip: Uint8Array) => {
  const decoder = new TextDecoder();
  const paths: Array<string> = [];
  for (let offset = 0; offset <= zip.length - 46; offset += 1) {
    const view = new DataView(zip.buffer, zip.byteOffset + offset);
    if (view.getUint32(0, true) !== 0x02014b50) continue;
    const nameLength = view.getUint16(28, true);
    paths.push(decoder.decode(zip.subarray(offset + 46, offset + 46 + nameLength)));
    offset += 45 + nameLength;
  }
  return paths;
};

describe("buildZip", () => {
  it("contains only the selected latest files at session grouping paths", () => {
    const zip = buildZip([
      { path: "SESS-4/slides.pdf", bytes: new Uint8Array([2]) },
      { path: "SESS-9/headshot.png", bytes: new Uint8Array([3]) },
    ]);

    expect(centralPaths(zip)).toEqual(["SESS-4/slides.pdf", "SESS-9/headshot.png"]);
    expect(centralPaths(zip)).not.toContain("SESS-4/slides-v1.pdf");
  });

  it("preserves speaker grouping paths and UTF-8 names", () => {
    const zip = buildZip([
      { path: "Priya Raman/slides.pdf", bytes: new Uint8Array([1, 2, 3]) },
      { path: "Zoë Chen/headshot.png", bytes: new Uint8Array([4, 5]) },
    ]);

    expect(centralPaths(zip)).toEqual(["Priya Raman/slides.pdf", "Zoë Chen/headshot.png"]);
  });
});
