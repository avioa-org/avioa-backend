import { z } from "zod";
const text = (max = 200) => z.string().max(max);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      Number.isFinite(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
  );
const optionalDate = z.union([date, z.literal("")]);
const time = z.union([
  z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  z.literal(""),
]);
const id = z.string().min(1).max(200);
const revision = z.number().int().positive();
export const blockInput = z
  .object({
    code: text()
      .trim()
      .min(1)
      .transform((v) => v.toUpperCase()),
    title: text().trim().min(1),
    departDate: date,
    returnDate: optionalDate,
    departTime: time,
    returnTime: time,
    origin: text(),
    destination: text(),
    flight: text(),
    capacity: z.number().int().min(1).max(10000),
    notes: text(2000),
    aliases: z.array(text(100).trim().min(1)).max(20),
  })
  .refine(
    (v) => !v.returnDate || v.returnDate >= v.departDate,
    "Regreso anterior a la ida.",
  );
export const splitInput = z.object({
  code: text(100),
  passengers: z.number().int().min(1).max(500),
  note: text(300),
});
export const manualInput = z.object({
  requestId: z.string().uuid(),
  blockId: id,
  reference: text(100),
  passenger: text(150).trim().min(1),
  advisor: text(150),
  seats: z.number().int().min(1).max(500),
});
export type ManualInput = z.infer<typeof manualInput>;
const complete = z.object({
  action: z.enum(["complete", "reopen"]),
  kind: z.enum(["payment", "names"]),
  blockId: id,
  revision,
  signature: z.string().max(200000),
  previousPaymentConfirmed: z.boolean().default(false),
  previousDataDeliveryConfirmed: z.boolean().default(false),
});
export const actionInput = z.union([
  z.object({
    action: z.literal("saveBlock"),
    id: id.optional(),
    revision: revision.optional(),
    data: blockInput,
  }),
  z.object({ action: z.literal("deleteBlock"), blockId: id, revision }),
  manualInput.extend({ action: z.literal("addManualReservation") }),
  z.object({
    action: z.literal("deleteManualReservation"),
    serviceId: id,
    signature: z.string().max(200000),
  }),
  z.object({
    action: z.literal("link"),
    serviceId: id,
    blockId: id,
    seats: z.number().int().min(1).max(500).nullable(),
    signature: z.string().max(200000),
  }),
  z.object({
    action: z.literal("splitReservation"),
    serviceId: id,
    signature: z.string().max(200000),
    revision: z.string(),
    splits: z.array(splitInput).max(100),
  }),
  z.object({
    action: z.literal("reviewReservation"),
    reviewKey: id,
    signature: z.string().max(200000),
  }),
  z.object({
    action: z.literal("adjustDriveInventory"),
    blockId: id,
    revision,
    inventorySignature: z.string().max(200000),
    mode: z.enum(["remaining", "total"]),
    quantity: z.number().int().min(0).max(10000),
    reason: z.string().trim().min(5).max(1000),
  }),
  z.object({
    action: z.literal("importBlocks"),
    rows: z.array(blockInput).min(1).max(100),
  }),
  complete,
]);
export type Action = z.infer<typeof actionInput>;
export interface Actor {
  email: string;
  permissions: string[];
}
export interface Upload {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}
