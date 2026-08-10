import { describe, expect, it } from "vitest";

import { parseSpeakerCsv } from "../../lib/speaker-csv";

describe("speaker CSV preview", () => {
  it("maps the evaluator headers, splits full names, and marks event-email matches", () => {
    const preview = parseSpeakerCsv(
      [
        "name,email,title,company,bio",
        'Priya Raman,priya.speaker@sbek-test.example.com,Principal Engineer,Latticework Systems,"Build tooling lead."',
        "Dana Kowalski,dana.speaker@sbek-test.example.com,Engineering Manager,Substrate,DX leader.",
      ].join("\n"),
      new Set(["priya.speaker@sbek-test.example.com"]),
    );
    expect(preview.mapping).toEqual([
      { header: "name", field: "name" },
      { header: "email", field: "email" },
      { header: "title", field: "title" },
      { header: "company", field: "company" },
      { header: "bio", field: "bio" },
    ]);
    expect(preview.rows[0]?.row).toMatchObject({
      firstName: "Priya",
      lastName: "Raman",
      action: "update",
    });
    expect(preview.rows[1]?.row).toMatchObject({
      firstName: "Dana",
      lastName: "Kowalski",
      action: "create",
    });
  });
});
