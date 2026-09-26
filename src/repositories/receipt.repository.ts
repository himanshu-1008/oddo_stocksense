import prisma from "@/lib/prisma";
import { OperationStatus, OperationType, Prisma } from "@prisma/client";
import { ReceiptQuery, ReceiptItemInput } from "@/lib/validations/receipt";
import { ConflictError, ValidationError, NotFoundError } from "@/lib/utils/api-error";

export class ReceiptRepository {
  async generateReceiptNumber(): Promise<string> {
    const totalReceipts = await prisma.receipt.count();
    const nextSeq = totalReceipts + 1;
    const formattedSeq = String(nextSeq).padStart(6, "0");
    const candidate = `REC-${formattedSeq}`;

    // Verify candidate uniqueness
    const existing = await prisma.receipt.findUnique({
      where: { referenceNumber: candidate },
    });

    if (!existing) {
      return candidate;
    }

    // Fallback if collision
    const timestampSeq = Date.now().toString().slice(-6);
    return `REC-${timestampSeq}`;
  }

  async findById(id: string) {
    return prisma.receipt.findUnique({
      where: { id },
      include: {
        supplier: true,
        warehouse: true,
        destinationLocation: {
          include: { warehouse: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
        validatedBy: {
          select: { id: true, name: true, email: true, role: true },
        },
        items: {
          include: {
            product: {
              include: { category: true },
            },
            location: {
              include: { warehouse: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  async list(params?: ReceiptQuery) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ReceiptWhereInput = {
      ...(params?.status && params.status !== "ALL"
        ? { status: params.status as OperationStatus }
        : {}),
      ...(params?.warehouseId && params.warehouseId !== "ALL"
        ? { warehouseId: params.warehouseId }
        : {}),
      ...(params?.supplierId && params.supplierId !== "ALL"
        ? { supplierId: params.supplierId }
        : {}),
      ...(params?.startDate || params?.endDate
        ? {
            createdAt: {
              ...(params?.startDate ? { gte: new Date(params.startDate) } : {}),
              ...(params?.endDate ? { lte: new Date(params.endDate) } : {}),
            },
          }
        : {}),
      ...(params?.search
        ? {
            OR: [
              { referenceNumber: { contains: params.search, mode: "insensitive" } },
              { supplierName: { contains: params.search, mode: "insensitive" } },
              { notes: { contains: params.search, mode: "insensitive" } },
              {
                items: {
                  some: {
                    product: {
                      OR: [
                        { name: { contains: params.search, mode: "insensitive" } },
                        { sku: { contains: params.search, mode: "insensitive" } },
                      ],
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [total, receipts] = await Promise.all([
      prisma.receipt.count({ where }),
      prisma.receipt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          supplier: true,
          warehouse: true,
          destinationLocation: true,
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          validatedBy: {
            select: { id: true, name: true, email: true },
          },
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, uom: true },
              },
              location: {
                select: { id: true, name: true, code: true },
              },
            },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
    ]);

    return {
      data: receipts,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async countPendingReceipts(): Promise<number> {
    return prisma.receipt.count({
      where: {
        status: { in: [OperationStatus.DRAFT, OperationStatus.WAITING, OperationStatus.READY] },
      },
    });
  }

  async create(
    data: {
      supplierName: string;
      supplierId?: string | null;
      warehouseId?: string | null;
      destinationLocationId?: string | null;
      scheduledDate?: Date | null;
      notes?: string | null;
      items: ReceiptItemInput[];
    },
    createdById: string
  ) {
    const referenceNumber = await this.generateReceiptNumber();

    let defaultLocationId = data.destinationLocationId || null;
    if (!defaultLocationId && data.warehouseId) {
      const defaultLoc = await prisma.location.findFirst({
        where: { warehouseId: data.warehouseId, isActive: true },
        orderBy: { createdAt: "asc" },
      });
      defaultLocationId = defaultLoc?.id || null;
    }

    return prisma.receipt.create({
      data: {
        referenceNumber,
        supplierName: data.supplierName.trim(),
        supplierId: data.supplierId || null,
        warehouseId: data.warehouseId || null,
        destinationLocationId: defaultLocationId,
        scheduledDate: data.scheduledDate || null,
        notes: data.notes?.trim() || null,
        status: OperationStatus.DRAFT,
        createdById,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            locationId: item.locationId || defaultLocationId,
            quantityExpected: item.quantityReceived,
            quantityReceived: item.quantityReceived,
            uom: item.uom || "PCS",
          })),
        },
      },
      include: {
        supplier: true,
        warehouse: true,
        items: {
          include: { product: true, location: true },
        },
      },
    });
  }

  async updateDraft(
    id: string,
    data: {
      supplierName?: string;
      supplierId?: string | null;
      warehouseId?: string | null;
      destinationLocationId?: string | null;
      scheduledDate?: Date | null;
      notes?: string | null;
      items?: ReceiptItemInput[];
    }
  ) {
    const existing = await prisma.receipt.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existing) {
      throw new NotFoundError("Receipt");
    }

    if (existing.status !== OperationStatus.DRAFT) {
      throw new ValidationError(
        `Cannot modify a receipt with status "${existing.status}". Only DRAFT receipts can be edited.`
      );
    }

    const warehouseId = data.warehouseId || existing.warehouseId;
    let defaultLocationId = data.destinationLocationId || existing.destinationLocationId;
    if (!defaultLocationId && warehouseId) {
      const defaultLoc = await prisma.location.findFirst({
        where: { warehouseId, isActive: true },
        orderBy: { createdAt: "asc" },
      });
      defaultLocationId = defaultLoc?.id || null;
    }

    return prisma.$transaction(
      async (tx) => {
        // If items provided, replace them
      if (data.items) {
        await tx.receiptItem.deleteMany({
          where: { receiptId: id },
        });

        await tx.receiptItem.createMany({
          data: data.items.map((item) => ({
            receiptId: id,
            productId: item.productId,
            locationId: item.locationId || defaultLocationId,
            quantityExpected: item.quantityReceived,
            quantityReceived: item.quantityReceived,
            uom: item.uom || "PCS",
          })),
        });
      }

      return tx.receipt.update({
        where: { id },
        data: {
          ...(data.supplierName !== undefined ? { supplierName: data.supplierName.trim() } : {}),
          ...(data.supplierId !== undefined ? { supplierId: data.supplierId || null } : {}),
          ...(data.warehouseId !== undefined ? { warehouseId: data.warehouseId || null } : {}),
          ...(data.destinationLocationId !== undefined
            ? { destinationLocationId: data.destinationLocationId || defaultLocationId }
            : {}),
          ...(data.scheduledDate !== undefined ? { scheduledDate: data.scheduledDate || null } : {}),
          ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
        },
        include: {
          supplier: true,
          warehouse: true,
          items: {
            include: { product: true, location: true },
          },
        },
      });
    }, { maxWait: 15000, timeout: 30000 });
  }

  async updateStatus(id: string, status: OperationStatus) {
    return prisma.receipt.update({
      where: { id },
      data: { status },
    });
  }

  async validateReceiptTransaction(receiptId: string, validatedById: string) {
    return prisma.$transaction(
      async (tx) => {
        // 1. Fetch current receipt with lock & relations
      const receipt = await tx.receipt.findUnique({
        where: { id: receiptId },
        include: {
          items: {
            include: { product: true, location: true },
          },
        },
      });

      if (!receipt) {
        throw new NotFoundError("Receipt");
      }

      // 2. Concurrency / Idempotency check
      if (receipt.status === OperationStatus.DONE) {
        throw new ConflictError("This receipt has already been validated and stock has been allocated.");
      }

      if (receipt.status === OperationStatus.CANCELED) {
        throw new ValidationError("Cannot validate a canceled receipt.");
      }

      if (!receipt.items || receipt.items.length === 0) {
        throw new ValidationError("Cannot validate a receipt with no line items.");
      }

      // Resolve default warehouse location if line items don't have one
      let warehouseDefaultLocId = receipt.destinationLocationId;
      if (!warehouseDefaultLocId && receipt.warehouseId) {
        const whLoc = await tx.location.findFirst({
          where: { warehouseId: receipt.warehouseId, isActive: true },
          orderBy: { createdAt: "asc" },
        });
        warehouseDefaultLocId = whLoc?.id || null;
      }
      if (!warehouseDefaultLocId) {
        const fallbackLoc = await tx.location.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        });
        warehouseDefaultLocId = fallbackLoc?.id || null;
      }

      // 3. Process every line item atomically
      for (const item of receipt.items) {
        const targetLocationId = item.locationId || receipt.destinationLocationId || warehouseDefaultLocId;
        if (!targetLocationId) {
          throw new ValidationError(
            `Line item for product "${item.product.name}" is missing a destination location.`
          );
        }

        if (item.quantityReceived <= 0) {
          throw new ValidationError(
            `Line item for product "${item.product.name}" has invalid quantity ${item.quantityReceived}. Must be greater than 0.`
          );
        }

        // 3a. Increase stock atomically at (productId, locationId)
        await tx.stock.upsert({
          where: {
            productId_locationId: {
              productId: item.productId,
              locationId: targetLocationId,
            },
          },
          update: {
            quantity: { increment: item.quantityReceived },
          },
          create: {
            productId: item.productId,
            locationId: targetLocationId,
            quantity: item.quantityReceived,
            reservedQuantity: 0,
          },
        });

        // 3b. Record immutable stock ledger entry
        await tx.stockLedger.create({
          data: {
            reference: receipt.referenceNumber,
            operationType: OperationType.RECEIPT,
            productId: item.productId,
            sourceLocationId: null, // External vendor source
            destinationLocationId: targetLocationId,
            quantity: item.quantityReceived,
            uom: item.uom,
            performedById: validatedById,
            notes: `Receipt from vendor ${receipt.supplierName}`,
          },
        });
      }

      // 4. Mark receipt as DONE with audit trail
      return tx.receipt.update({
        where: { id: receiptId },
        data: {
          status: OperationStatus.DONE,
          validatedById,
          validatedAt: new Date(),
        },
        include: {
          supplier: true,
          warehouse: true,
          destinationLocation: true,
          validatedBy: {
            select: { id: true, name: true, email: true },
          },
          items: {
            include: { product: true, location: true },
          },
        },
      });
    }, { maxWait: 15000, timeout: 30000 });
  }
}

export const receiptRepository = new ReceiptRepository();
