import { receiptRepository } from "@/repositories/receipt.repository";
import { productRepository } from "@/repositories/product.repository";
import { warehouseRepository } from "@/repositories/warehouse.repository";
import { locationRepository } from "@/repositories/location.repository";
import { supplierRepository } from "@/repositories/supplier.repository";
import {
  ReceiptInput,
  UpdateReceiptInput,
  ReceiptQuery,
  receiptSchema,
  updateReceiptSchema,
  receiptQuerySchema,
} from "@/lib/validations/receipt";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from "@/lib/utils/api-error";
import { OperationStatus } from "@prisma/client";

export class ReceiptService {
  async getReceipts(query?: ReceiptQuery) {
    const validated = query ? receiptQuerySchema.parse(query) : undefined;
    return receiptRepository.list(validated);
  }

  async getReceiptById(id: string) {
    const receipt = await receiptRepository.findById(id);
    if (!receipt) {
      throw new NotFoundError("Receipt");
    }
    return receipt;
  }

  async createReceipt(input: ReceiptInput, createdById: string) {
    const validated = receiptSchema.parse(input);

    // 1. Validate Supplier if ID given
    if (validated.supplierId) {
      const supplier = await supplierRepository.findById(validated.supplierId);
      if (!supplier) {
        throw new NotFoundError("Supplier");
      }
      if (!supplier.isActive) {
        throw new ValidationError("Selected supplier is inactive.");
      }
    }

    // 2. Validate Warehouse
    const warehouse = await warehouseRepository.findById(validated.warehouseId);
    if (!warehouse) {
      throw new NotFoundError("Warehouse");
    }
    if (!warehouse.isActive) {
      throw new ValidationError("Selected destination warehouse is inactive.");
    }

    // 3. Validate Line Items (Product & Warehouse)
    for (const item of validated.items) {
      const product = await productRepository.findById(item.productId);
      if (!product) {
        throw new NotFoundError(`Product (${item.productId})`);
      }
      if (!product.isActive) {
        throw new ValidationError(
          `Product "${product.name}" (${product.sku}) is deactivated and cannot be received.`
        );
      }

      if (item.locationId) {
        const location = await locationRepository.findById(item.locationId);
        if (!location) {
          throw new NotFoundError(`Location (${item.locationId})`);
        }
        if (!location.isActive) {
          throw new ValidationError(
            `Destination location "${location.name}" is deactivated.`
          );
        }

        // Ensure location belongs to the selected warehouse
        if (location.warehouseId !== validated.warehouseId) {
          throw new ValidationError(
            `Location "${location.name}" does not belong to warehouse "${warehouse.name}".`
          );
        }
      }
    }

    return receiptRepository.create(validated, createdById);
  }

  async updateDraftReceipt(id: string, input: UpdateReceiptInput) {
    const validated = updateReceiptSchema.parse(input);

    const existing = await receiptRepository.findById(id);
    if (!existing) {
      throw new NotFoundError("Receipt");
    }

    if (existing.status !== OperationStatus.DRAFT) {
      throw new ValidationError(
        `Cannot edit receipt in "${existing.status}" status. Only DRAFT receipts can be modified.`
      );
    }

    const warehouseId = validated.warehouseId || existing.warehouseId;

    if (validated.items && warehouseId) {
      for (const item of validated.items) {
        const product = await productRepository.findById(item.productId);
        if (!product || !product.isActive) {
          throw new ValidationError(`Invalid or inactive product in receipt items.`);
        }

        if (item.locationId) {
          const location = await locationRepository.findById(item.locationId);
          if (!location || location.warehouseId !== warehouseId) {
            throw new ValidationError(
              `Location "${location?.name || item.locationId}" does not belong to the selected warehouse.`
            );
          }
        }
      }
    }

    return receiptRepository.updateDraft(id, validated);
  }

  async markReady(id: string) {
    const existing = await receiptRepository.findById(id);
    if (!existing) {
      throw new NotFoundError("Receipt");
    }

    if (existing.status !== OperationStatus.DRAFT) {
      throw new ValidationError(
        `Only DRAFT receipts can be marked as READY. Current status is "${existing.status}".`
      );
    }

    if (!existing.items || existing.items.length === 0) {
      throw new ValidationError("Cannot mark a receipt as READY with no product line items.");
    }

    return receiptRepository.updateStatus(id, OperationStatus.READY);
  }

  async validateReceipt(id: string, validatedById: string) {
    const existing = await receiptRepository.findById(id);
    if (!existing) {
      throw new NotFoundError("Receipt");
    }

    if (existing.status === OperationStatus.DONE) {
      throw new ConflictError("This receipt has already been validated.");
    }

    if (existing.status === OperationStatus.CANCELED) {
      throw new ValidationError("Cannot validate a canceled receipt.");
    }

    return receiptRepository.validateReceiptTransaction(id, validatedById);
  }

  async cancelReceipt(id: string) {
    const existing = await receiptRepository.findById(id);
    if (!existing) {
      throw new NotFoundError("Receipt");
    }

    if (existing.status === OperationStatus.DONE) {
      throw new ValidationError(
        "Cannot cancel a completed receipt. Completed stock additions must be reversed via return or stock adjustment."
      );
    }

    if (existing.status === OperationStatus.CANCELED) {
      return existing;
    }

    return receiptRepository.updateStatus(id, OperationStatus.CANCELED);
  }

  async getPendingCount() {
    return receiptRepository.countPendingReceipts();
  }
}

export const receiptService = new ReceiptService();
