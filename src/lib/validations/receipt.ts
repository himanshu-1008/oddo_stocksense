import { z } from "zod";

export const supplierSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Supplier name must be at least 2 characters")
    .max(100, "Supplier name cannot exceed 100 characters"),
  code: z
    .string()
    .trim()
    .min(2, "Supplier code must be at least 2 characters")
    .max(30, "Supplier code cannot exceed 30 characters")
    .regex(/^[A-Za-z0-9_-]+$/, "Code can only contain alphanumeric characters, hyphens, and underscores")
    .transform((val) => val.toUpperCase())
    .optional()
    .nullable(),
  email: z.string().trim().email("Invalid email address").optional().nullable().or(z.literal("")),
  phone: z.string().trim().max(30, "Phone cannot exceed 30 characters").optional().nullable(),
  address: z.string().trim().max(500, "Address cannot exceed 500 characters").optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateSupplierSchema = supplierSchema.partial();

export const receiptItemInputSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  locationId: z.string().optional().nullable(),
  quantityReceived: z.coerce
    .number()
    .positive("Received quantity must be greater than 0")
    .max(1_000_000, "Quantity exceeds realistic single shipment threshold"),
  uom: z.string().default("PCS"),
});

export const receiptSchema = z.object({
  supplierName: z
    .string()
    .trim()
    .min(2, "Supplier name must be at least 2 characters")
    .max(100, "Supplier name cannot exceed 100 characters"),
  supplierId: z.string().optional().nullable(),
  warehouseId: z.string().min(1, "Destination warehouse is required"),
  destinationLocationId: z.string().optional().nullable(),
  scheduledDate: z.coerce.date().optional().nullable(),
  notes: z.string().trim().max(1000, "Notes cannot exceed 1000 characters").optional().nullable(),
  items: z
    .array(receiptItemInputSchema)
    .min(1, "At least one product line item is required on the receipt"),
});

export const updateReceiptSchema = z.object({
  supplierName: z.string().trim().min(2).max(100).optional(),
  supplierId: z.string().optional().nullable(),
  warehouseId: z.string().min(1).optional(),
  destinationLocationId: z.string().optional().nullable(),
  scheduledDate: z.coerce.date().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  items: z.array(receiptItemInputSchema).min(1).optional(),
});

export const receiptQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  status: z
    .enum(["ALL", "DRAFT", "WAITING", "READY", "DONE", "CANCELED"])
    .default("ALL"),
  warehouseId: z.string().optional(),
  supplierId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type SupplierInput = z.infer<typeof supplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type ReceiptItemInput = z.infer<typeof receiptItemInputSchema>;
export type ReceiptInput = z.infer<typeof receiptSchema>;
export type UpdateReceiptInput = z.infer<typeof updateReceiptSchema>;
export type ReceiptQuery = z.infer<typeof receiptQuerySchema>;
