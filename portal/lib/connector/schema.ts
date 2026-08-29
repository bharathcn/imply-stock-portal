import { z } from "zod";

export const inventorySnapshotSchema = z.object({
  connectorId: z.string().min(3).max(80),
  requestId: z.string().uuid(),
  tallyCompany: z.string().min(1).max(160),
  syncStartedAt: z.string().datetime(),
  syncCompletedAt: z.string().datetime(),
  connectorVersion: z.string().min(1).max(40),
  tallyRelease: z.string().max(80).optional(),
  items: z
    .array(
      z.object({
        tallyItemName: z.string().min(1).max(240),
        totalQuantity: z.string().regex(/^-?\d+(\.\d{1,3})?$/),
        unit: z.string().min(1).max(40),
        godowns: z
          .array(
            z.object({
              godownName: z.string().min(1).max(160),
              quantity: z.string().regex(/^-?\d+(\.\d{1,3})?$/)
            })
          )
          .max(80)
      })
    )
    .min(1)
    .max(5000)
});

export const heartbeatSchema = z.object({
  connectorId: z.string().min(3).max(80),
  connectorVersion: z.string().min(1).max(40),
  tallyCompany: z.string().min(1).max(160),
  tallyRelease: z.string().max(80).optional(),
  status: z.enum(["healthy", "tally_unavailable", "company_not_loaded", "sync_failed"]),
  lastSuccessfulSyncAt: z.string().datetime().optional()
});

export type InventorySnapshotPayload = z.infer<typeof inventorySnapshotSchema>;
