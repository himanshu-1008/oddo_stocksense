import prisma from "@/lib/prisma";
import { OperationStatus, OperationType, Prisma } from "@prisma/client";
import {
  AdjustmentQuery,
  AdjustmentItemInput,
} from "@/lib/validations/adjustment";
import { ConflictError, ValidationError, NotFoundError } from "@/lib/utils/api-error";

export class AdjustmentRepository {
  async generateAdjustmentNumber(): Promise<string> {
    const totalAdjustments = await prisma.adjustment.count();
    const nextSeq = totalAdjustments + 1;
    const formattedSeq = String(nextSeq).padStart(6, "0");
    const candidate = `ADJ-${formattedSeq}`;

    // Verify candidate uniqueness
    const existing = await prisma.adjustment.findUnique({
      where: { referenceNumber: candidate },
    });

    if (!existing) {
      return candidate;
    }

    // Fallback if collision
    const timestampSeq = Date.now().toString().slice(-6);
    return `ADJ-${timestampSeq}`;
  }

  async findById(id: string) {
    return prisma.adjustment.findUnique({
      where: { id },
      include: {
        warehouse: true,
        location: {
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

  async list(params?: AdjustmentQuery) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AdjustmentWhereInput = {
      ...(params?.status && params.status !== "ALL"
        ? { status: params.status as OperationStatus }
        : {}),
      ...(params?.warehouseId && params.warehouseId !== "ALL"
        ? { warehouseId: params.warehouseId }
        : {}),
      ...(params?.locationId && params.locationId !== "ALL"
        ? { locationId: params.locationId }
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
              { reason: { contains: params.search, mode: "insensitive" } },
              {
                location: {
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

    const [total, adjustments] = await Promise.all([
      prisma.adjustment.count({ where }),
      prisma.adjustment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          warehouse: true,
          location: true,
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
      data: adjustments,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async countPendingAdjustments(): Promise<number> {
    return prisma.adjustment.count({
      where: {
        status: OperationStatus.DRAFT,
      },
    });
  }

  async create(
    data: {
      warehouseId?: string | null;
      locationId: string;
      reason?: string | null;
      items: AdjustmentItemInput[];
    },
    createdById: string
  ) {
    const referenceNumber = await this.generateAdjustmentNumber();

    // Fetch current system stock for items to compute theoretical & diff quantities
    const itemsWithCalculatedStock = await Promise.all(
      data.items.map(async (item) => {
        const stockRecord = await prisma.stock.findUnique({
          where: {
            productId_locationId: {
              productId: item.productId,
              locationId: data.locationId,
            },
          },
        });
        const theoreticalQty = stockRecord?.quantity ?? 0;
        const differenceQty = item.countedQty - theoreticalQty;

        return {
          productId: item.productId,
          theoreticalQty,
          countedQty: item.countedQty,
          differenceQty,
          uom: item.uom || "PCS",
        };
      })
    );

    return prisma.adjustment.create({
      data: {
        referenceNumber,
        warehouseId: data.warehouseId || null,
        locationId: data.locationId,
        reason: data.reason?.trim() || null,
        status: OperationStatus.DRAFT,
        createdById,
        items: {
          create: itemsWithCalculatedStock,
        },
      },
      include: {
        warehouse: true,
        location: true,
        items: {
          include: { product: true },
        },
      },
    });
  }

  async updateDraft(
    id: string,
    data: {
      warehouseId?: string | null;
      locationId?: string;
      reason?: string | null;
      items?: AdjustmentItemInput[];
    }
  ) {
    const existing = await prisma.adjustment.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existing) {
      throw new NotFoundError("Inventory Adjustment");
    }

    if (existing.status !== OperationStatus.DRAFT) {
      throw new ValidationError(
        `Cannot modify an adjustment with status "${existing.status}". Only DRAFT adjustments can be edited.`
      );
    }

    const locationId = data.locationId || existing.locationId;

    return prisma.$transaction(async (tx) => {
      // If items provided, replace them with updated system stock calculations
      if (data.items) {
        await tx.adjustmentItem.deleteMany({
          where: { adjustmentId: id },
        });

        const itemsToCreate = await Promise.all(
          data.items.map(async (item) => {
            const stockRecord = await tx.stock.findUnique({
              where: {
                productId_locationId: {
                  productId: item.productId,
                  locationId,
                },
              },
            });
            const theoreticalQty = stockRecord?.quantity ?? 0;
            const differenceQty = item.countedQty - theoreticalQty;

            return {
              adjustmentId: id,
              productId: item.productId,
              theoreticalQty,
              countedQty: item.countedQty,
              differenceQty,
              uom: item.uom || "PCS",
            };
          })
        );

        await tx.adjustmentItem.createMany({
          data: itemsToCreate,
        });
      }

      return tx.adjustment.update({
        where: { id },
        data: {
          ...(data.warehouseId !== undefined ? { warehouseId: data.warehouseId || null } : {}),
          ...(data.locationId !== undefined ? { locationId: data.locationId } : {}),
          ...(data.reason !== undefined ? { reason: data.reason?.trim() || null } : {}),
        },
        include: {
          warehouse: true,
          location: true,
          items: {
            include: { product: true },
          },
        },
      });
    });
  }

  async validateAdjustmentTransaction(adjustmentId: string, validatedById: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Fetch current adjustment with lock & relations
      const adjustment = await tx.adjustment.findUnique({
        where: { id: adjustmentId },
        include: {
          location: true,
          items: {
            include: { product: true },
          },
        },
      });

      if (!adjustment) {
        throw new NotFoundError("Inventory Adjustment");
      }

      // 2. Concurrency / Idempotency check
      if (adjustment.status === OperationStatus.DONE) {
        throw new ConflictError(
          "This inventory adjustment has already been validated and processed."
        );
      }

      if (adjustment.status === OperationStatus.CANCELED) {
        throw new ValidationError("Cannot validate a canceled adjustment.");
      }

      if (!adjustment.items || adjustment.items.length === 0) {
        throw new ValidationError("Cannot validate an adjustment with no line items.");
      }

      // 3. Process each line item atomically
      for (const item of adjustment.items) {
        if (item.countedQty < 0) {
          throw new ValidationError(
            `Counted physical quantity for product "${item.product.name}" cannot be negative (${item.countedQty}).`
          );
        }

        // 3a. Read current system stock inside transaction
        const stockRecord = await tx.stock.findUnique({
          where: {
            productId_locationId: {
              productId: item.productId,
              locationId: adjustment.locationId,
            },
          },
        });

        const currentStock = stockRecord?.quantity ?? 0;
        const difference = item.countedQty - currentStock;

        // 3b. Update StockBalance to EXACT counted quantity (Rule: counted stock becomes new stock)
        await tx.stock.upsert({
          where: {
            productId_locationId: {
              productId: item.productId,
              locationId: adjustment.locationId,
            },
          },
          update: {
            quantity: item.countedQty,
          },
          create: {
            productId: item.productId,
            locationId: adjustment.locationId,
            quantity: item.countedQty,
            reservedQuantity: 0,
          },
        });

        // 3c. Update AdjustmentItem with final authoritative theoretical & difference
        await tx.adjustmentItem.update({
          where: { id: item.id },
          data: {
            theoreticalQty: currentStock,
            differenceQty: difference,
          },
        });

        // 3d. Record immutable Stock Ledger entry if there is a difference
        if (difference !== 0) {
          await tx.stockLedger.create({
            data: {
              reference: adjustment.referenceNumber,
              operationType: OperationType.ADJUSTMENT,
              productId: item.productId,
              sourceLocationId: difference < 0 ? adjustment.locationId : null,
              destinationLocationId: difference > 0 ? adjustment.locationId : null,
              quantity: difference, // Signed difference: -3 or +5
              uom: item.uom,
              performedById: validatedById,
              notes: `Inventory adjustment at ${adjustment.location.name}: counted ${item.countedQty} vs system ${currentStock} (diff: ${difference > 0 ? '+' : ''}${difference})`,
            },
          });
        }
      }

      // 4. Mark adjustment as DONE with audit trail
      return tx.adjustment.update({
        where: { id: adjustmentId },
        data: {
          status: OperationStatus.DONE,
          validatedById,
          validatedAt: new Date(),
        },
        include: {
          warehouse: true,
          location: true,
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
    const existing = await prisma.adjustment.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError("Inventory Adjustment");
    }

    if (existing.status === OperationStatus.DONE) {
      throw new ValidationError(
        "Cannot cancel a completed inventory adjustment. Stock adjustments are permanent records."
      );
    }

    if (existing.status === OperationStatus.CANCELED) {
      return existing;
    }

    return prisma.adjustment.update({
      where: { id },
      data: { status: OperationStatus.CANCELED },
      include: {
        warehouse: true,
        location: true,
        items: {
          include: { product: true },
        },
      },
    });
  }
}

export const adjustmentRepository = new AdjustmentRepository();
