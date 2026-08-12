import { Schema } from "effect";

export const EntityFields = {
  id: Schema.String,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
};

export const JsonObject = Schema.Record(Schema.String, Schema.Json);
export const NullableString = Schema.NullOr(Schema.String);
export const NullableNumber = Schema.NullOr(Schema.Number);
export const NullableDate = Schema.NullOr(Schema.Date);
export const Text255 = Schema.String.check(Schema.isMaxLength(255));
export const Text1000 = Schema.String.check(Schema.isMaxLength(1000));
export const RichText5000 = Schema.String.check(Schema.isMaxLength(5000));
export const Heading15 = Schema.String.check(Schema.isMaxLength(15));
export const Score = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 5 }));

export type AuditActor =
  | { readonly kind: "user"; readonly userId: string; readonly name: string }
  | { readonly kind: "api_key"; readonly apiKeyId: string; readonly name: string };
