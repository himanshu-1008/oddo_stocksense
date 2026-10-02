import prisma from "@/lib/prisma";
import { OperationStatus, OperationType, Prisma } from "@prisma/client";
import {
  TransferQuery,
  TransferItemInput,
} from "@/lib/validations/transfer";
import { ConflictError, ValidationError, NotFoundError } from "@/lib/utils/api-error";

export class TransferRepository {
  async generateTransferNumber(): Promise<string> {
    const totalTransfers = await prisma.internalTransfer.count();
    const nextSeq = totalTransfers + 1;
    const formattedSeq = String(nextSeq).padStart(6, "0");
    const candidate = `TRF-${formattedSeq}`;

    // Verify candidate uniqueness
    const existing = await prisma.internalTransfer.findUnique({
      where: { referenceNumber: candidate },
    });

    if (!existing) {
      return candidate;
    }

    // Fallback if collision
    const timestampSeq = Date.now().toString().slice(-6);
    return `TRF-${timestampSeq}`;
  }

  async findById(id: string) {
    return prisma.internalTransfer.findUnique({
      where: { id },
      include: {
        sourceWarehouse: true,
        sourceLocation: {
          include: { warehouse: true },
        },
        destinationWarehouse: true,
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
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  async list(params?: TransferQuery) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.InternalTransferWhereInput = {
      ...(params?.status && params.status !== "ALL"
        ? { status: params.status as OperationStatus }
        : {}),
      ...(params?.sourceWarehouseId && params.sourceWarehouseId !== "ALL"
        ? { sourceWarehouseId: params.sourceWarehouseId }
        : {}),
      ...(params?.destinationWarehouseId && params.destinationWarehouseId !== "ALL"
        ? { destinationWarehouseId: params.destinationWarehouseId }
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
              { notes: { contains: params.search, mode: "insensitive" } },
              {
                sourceLocation: {
                  OR: [
                    { name: { contains: params.search, mode: "insensitive" } },
                    { code: { contains: params.search, mode: "insensitive" } },
                  ],
                },
              },
              {
                destinationLocation: {
                  OR: [
                    { name: { contains: params.search, mode: "insensitive" } },
                    { code: { contains: params.search, mode: "insensitive" } },
                  ],
                },
              },
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

    const [total, transfers] = await Promise.all([
      prisma.internalTransfer.count({ where }),
      prisma.internalTransfer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          sourceWarehouse: true,
          sourceLocation: true,
          destinationWarehouse: true,
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
            },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
    ]);

    return {
      data: transfers,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async countPendingTransfers(): Promise<number> {
    return prisma.internalTransfer.count({
      where: {
        status: {
          in: [OperationStatus.DRAFT, OperationStatus.WAITING, OperationStatus.READY],
        },
      },
    });
  }

  async create(
    data: {
      sourceWarehouseId?: string | null;
      sourceLocationId: string;
      destinationWarehouseId?: string | null;
      destinationLocationId: string;
      scheduledDate?: Date | null;
      notes?: string | null;
      items: TransferItemInput[];
    },
    createdById: string
  ) {
    const referenceNumber = await this.generateTransferNumber();

    return prisma.internalTransfer.create({
      data: {
        referenceNumber,
        sourceWarehouseId: data.sourceWarehouseId || null,
        sourceLocationId: data.sourceLocationId,
        destinationWarehouseId: data.destinationWarehouseId || null,
        destinationLocationId: data.destinationLocationId,
        scheduledDate: data.scheduledDate || null,
        notes: data.notes?.trim() || null,
        status: OperationStatus.DRAFT,
        createdById,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            uom: item.uom || "PCS",
          })),
        },
      },
      include: {
        sourceWarehouse: true,
        sourceLocation: true,
        destinationWarehouse: true,
        destinationLocation: true,
        items: {
          include: { product: true },
        },
      },
    });
  }

  async updateDraft(
    id: string,
    data: {
      sourceWarehouseId?: string | null;
      sourceLocationId?: string;
      destinationWarehouseId?: string | null;
      destinationLocationId?: string;
      scheduledDate?: Date | null;
      notes?: string | null;
      items?: TransferItemInput[];
    }
  ) {
    const existing = await prisma.internalTransfer.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existing) {
      throw new NotFoundError("Internal Transfer");
    }

    if (existing.status !== OperationStatus.DRAFT) {
      throw new ValidationError(
        `Cannot modify an internal transfer with status "${existing.status}". Only DRAFT transfers can be edited.`
      );
    }

    return prisma.$transaction(async (tx) => {
      // If items provided, replace them
      if (data.items) {
        await tx.internalTransferItem.deleteMany({
          where: { transferId: id },
        });

        await tx.internalTransferItem.createMany({
          data: data.items.map((item) => ({
            transferId: id,
            productId: item.productId,
            quantity: item.quantity,
            uom: item.uom || "PCS",
          })),
        });
      }

      return tx.internalTransfer.update({
        where: { id },
        data: {
          ...(data.sourceWarehouseId !== undefined ? { sourceWarehouseId: data.sourceWarehouseId || null } : {}),
          ...(data.sourceLocationId !== undefined ? { sourceLocationId: data.sourceLocationId } : {}),
          ...(data.destinationWarehouseId !== undefined ? { destinationWarehouseId: data.destinationWarehouseId || null } : {}),
          ...(data.destinationLocationId !== undefined ? { destinationLocationId: data.destinationLocationId } : {}),
          ...(data.scheduledDate !== undefined ? { scheduledDate: data.scheduledDate || null } : {}),
          ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
        },
        include: {
          sourceWarehouse: true,
          sourceLocation: true,
          destinationWarehouse: true,
          destinationLocation: true,
          items: {
            include: { product: true },
          },
        },
      });
    });
  }

  async updateStatus(id: string, status: OperationStatus) {
    return prisma.internalTransfer.update({
      where: { id },
      data: { status },
      include: {
        sourceWarehouse: true,
        sourceLocation: true,
        destinationWarehouse: true,
        destinationLocation: true,
        items: {
          include: { product: true },
        },
      },
    });
  }

  async validateTransferTransaction(transferId: string, validatedById: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Fetch current transfer with lock & relations
      const transfer = await tx.internalTransfer.findUnique({
        where: { id: transferId },
        include: {
          sourceLocation: true,
          destinationLocation: true,
          items: {
            include: { product: true },
          },
        },
      });

      if (!transfer) {
        throw new NotFoundError("Internal Transfer");
      }

      // 2. Concurrency / Idempotency check
      if (transfer.status === OperationStatus.DONE) {
        throw new ConflictError(
          "This internal transfer has already been validated and processed."
        );
      }

      if (transfer.status === OperationStatus.CANCELED) {
        throw new ValidationError("Cannot validate a canceled internal transfer.");
      }

      if (!transfer.items || transfer.items.length === 0) {
        throw new ValidationError("Cannot validate an internal transfer with no line items.");
      }

      if (transfer.sourceLocationId === transfer.destinationLocationId) {
        throw new ValidationError("Source location and destination location cannot be the same.");
      }

      // 3. Process each transfer item atomically
      for (const item of transfer.items) {
        if (item.quantity <= 0) {
          throw new ValidationError(
            `Line item for product "${item.product.name}" has invalid quantity ${item.quantity}. Must be greater than 0.`
          );
        }

        // 3a. Re-verify source stock level inside transaction
        const sourceStock = await tx.stock.findUnique({
          where: {
            productId_locationId: {
              productId: item.productId,
              locationId: transfer.sourceLocationId,
            },
          },
        });

        const availableQty = sourceStock?.quantity ?? 0;
        if (availableQty < item.quantity) {
          throw new ValidationError(
            `Insufficient stock for product "${item.product.name}" (${item.product.sku}) at source location "${transfer.sourceLocation.name}". Available: ${availableQty} ${item.uom}, Requested: ${item.quantity} ${item.uom}.`
          );
        }

        // 3b. Decrement source stock atomically
        await tx.stock.update({
          where: {
            productId_locationId: {
              productId: item.productId,
              locationId: transfer.sourceLocationId,
            },
          },
          data: {
            quantity: { decrement: item.quantity },
          },
        });

        // 3c. Increment/Upsert destination stock atomically
        await tx.stock.upsert({
          where: {
            productId_locationId: {
              productId: item.productId,
              locationId: transfer.destinationLocationId,
            },
          },
          update: {
            quantity: { increment: item.quantity },
          },
          create: {
            productId: item.productId,
            locationId: transfer.destinationLocationId,
            quantity: item.quantity,
            reservedQuantity: 0,
          },
        });

        // 3d. Record immutable Stock Ledger entry
        await tx.stockLedger.create({
          data: {
            reference: transfer.referenceNumber,
            operationType: OperationType.INTERNAL_TRANSFER,
            productId: item.productId,
            sourceLocationId: transfer.sourceLocationId,
            destinationLocationId: transfer.destinationLocationId,
            quantity: item.quantity,
            uom: item.uom,
            performedById: validatedById,
            notes: `Internal transfer from ${transfer.sourceLocation.name} to ${transfer.destinationLocation.name}`,
          },
        });
      }

      // 4. Mark transfer as DONE with audit trail
      return tx.internalTransfer.update({
        where: { id: transferId },
        data: {
          status: OperationStatus.DONE,
          validatedById,
          validatedAt: new Date(),
        },
        include: {
          sourceWarehouse: true,
          sourceLocation: true,
          destinationWarehouse: true,
          destinationLocation: true,
          validatedBy: {
            select: { id: true, name: true, email: true },
          },
          items: {
            include: { product: true },
          },
        },
      });
    }, { maxWait: 15000, timeout: 30000 });
  }

  async cancel(id: string) {
    const existing = await prisma.internalTransfer.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError("Internal Transfer");
    }

    if (existing.status === OperationStatus.DONE) {
      throw new ValidationError(
        "Cannot cancel a completed internal transfer. Completed stock movements must be reversed via a new transfer or adjustment."
      );
    }

    if (existing.status === OperationStatus.CANCELED) {
      return existing;
    }

    return prisma.internalTransfer.update({
      where: { id },
      data: { status: OperationStatus.CANCELED },
      include: {
        sourceWarehouse: true,
        sourceLocation: true,
        destinationWarehouse: true,
        destinationLocation: true,
        items: {
          include: { product: true },
        },
      },
    });
  }
}

export const transferRepository = new TransferRepository();
