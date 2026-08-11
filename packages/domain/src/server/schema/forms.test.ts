import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { makeFormAnswersSchema, type FormFieldDefinition } from "./forms";

const description: FormFieldDefinition = {
  id: "description",
  label: "Description",
  fieldType: "richtext",
  maxChars: 5,
  required: true,
  locked: false,
  position: 1,
  options: null,
  mapsTo: "description",
  condition: null,
};

describe("form answer validation", () => {
  it("measures rich-text character limits by visible markdown text", () => {
    const decode = Schema.decodeUnknownSync(makeFormAnswersSchema([description]));

    expect(decode({ description: "**12345**" })).toEqual({
      description: "**12345**",
    });
    expect(() => decode({ description: "**123456**" })).toThrow();
  });
});
