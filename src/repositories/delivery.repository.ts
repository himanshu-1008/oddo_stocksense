import prisma from "@/lib/prisma";
import { OperationStatus, OperationType, Prisma } from "@prisma/client";
import {
  DeliveryQuery,
  DeliveryItemInput,
  PickItemsInput,
  PackItemsInput,
} from "@/lib/validations/delivery";
import { ConflictError, ValidationError, NotFoundError } from "@/lib/utils/api-error";

export class DeliveryRepository {
  async generateDeliveryNumber(): Promise<string> {
    const totalDeliveries = await prisma.delivery.count();
    const nextSeq = totalDeliveries + 1;
    const formattedSeq = String(nextSeq).padStart(6, "0");
    const candidate = `DEL-${formattedSeq}`;

    // Verify candidate uniqueness
    const existing = await prisma.delivery.findUnique({
      where: { referenceNumber: candidate },
    });

    if (!existing) {
      return candidate;
    }

    // Fallback if collision
    const timestampSeq = Date.now().toString().slice(-6);
    return `DEL-${timestampSeq}`;
  }

  async findById(id: string) {
    return prisma.delivery.findUnique({
      where: { id },
      include: {
        warehouse: true,
        sourceLocation: {
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

  async list(params?: DeliveryQuery) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.DeliveryWhereInput = {
      ...(params?.status && params.status !== "ALL"
        ? { status: params.status as OperationStatus }
        : {}),
      ...(params?.warehouseId && params.warehouseId !== "ALL"
        ? { warehouseId: params.warehouseId }
        : {}),
      ...(params?.sourceLocationId && params.sourceLocationId !== "ALL"
        ? { sourceLocationId: params.sourceLocationId }
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
              { customerName: { contains: params.search, mode: "insensitive" } },
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

    const [total, deliveries] = await Promise.all([
      prisma.delivery.count({ where }),
      prisma.delivery.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          warehouse: true,
          sourceLocation: true,
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
      data: deliveries,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async countPendingDeliveries(): Promise<number> {
    return prisma.delivery.count({
      where: {
        status: {
          in: [OperationStatus.DRAFT, OperationStatus.WAITING, OperationStatus.READY],
        },
      },
    });
  }

  async create(
    data: {
      customerName: string;
      warehouseId: string;
      sourceLocationId?: string | null;
      scheduledDate?: Date | null;
      notes?: string | null;
      items: DeliveryItemInput[];
    },
    createdById: string
  ) {
    const referenceNumber = await this.generateDeliveryNumber();

    return prisma.delivery.create({
      data: {
        referenceNumber,
        customerName: data.customerName.trim(),
        warehouseId: data.warehouseId,
        sourceLocationId: data.sourceLocationId || null,
        scheduledDate: data.scheduledDate || null,
        notes: data.notes?.trim() || null,
        status: OperationStatus.DRAFT,
        createdById,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            locationId: item.locationId,
            quantityDemand: item.quantityDemand,
            pickedQuantity: 0,
            packedQuantity: 0,
            quantityDelivered: 0,
            uom: item.uom || "PCS",
          })),
        },
      },
      include: {
        warehouse: true,
        sourceLocation: true,
        items: {
          include: { product: true, location: true },
        },
      },
    });
  }

  async updateDraft(
    id: string,
    data: {
      customerName?: string;
      warehouseId?: string;
      sourceLocationId?: string | null;
      scheduledDate?: Date | null;
      notes?: string | null;
      items?: DeliveryItemInput[];
    }
  ) {
    const existing = await prisma.delivery.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existing) {
      throw new NotFoundError("Delivery");
    }

    if (existing.status !== OperationStatus.DRAFT) {
      throw new ValidationError(
        `Cannot modify a delivery with status "${existing.status}". Only DRAFT deliveries can be edited.`
      );
    }

    return prisma.$transaction(async (tx) => {
      // If items provided, replace them
      if (data.items) {
        await tx.deliveryItem.deleteMany({
          where: { deliveryId: id },
        });

        await tx.deliveryItem.createMany({
          data: data.items.map((item) => ({
            deliveryId: id,
            productId: item.productId,
            locationId: item.locationId,
            quantityDemand: item.quantityDemand,
            pickedQuantity: 0,
            packedQuantity: 0,
            quantityDelivered: 0,
            uom: item.uom || "PCS",
          })),
        });
      }

      return tx.delivery.update({
        where: { id },
        data: {
          ...(data.customerName !== undefined ? { customerName: data.customerName.trim() } : {}),
          ...(data.warehouseId !== undefined ? { warehouseId: data.warehouseId } : {}),
          ...(data.sourceLocationId !== undefined
            ? { sourceLocationId: data.sourceLocationId || null }
            : {}),
          ...(data.scheduledDate !== undefined ? { scheduledDate: data.scheduledDate || null } : {}),
          ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
        },
        include: {
          warehouse: true,
          sourceLocation: true,
          items: {
            include: { product: true, location: true },
          },
        },
      });
    });
  }

  async updateStatus(id: string, status: OperationStatus) {
    return prisma.delivery.update({
      where: { id },
      data: { status },
      include: {
        warehouse: true,
        sourceLocation: true,
        items: {
          include: { product: true, location: true },
        },
      },
    });
  }

  async pickItems(id: string, pickInput: PickItemsInput) {
    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!delivery) {
      throw new NotFoundError("Delivery");
    }

    if (
      delivery.status !== OperationStatus.WAITING &&
      delivery.status !== OperationStatus.DRAFT &&
      delivery.status !== OperationStatus.READY
    ) {
      throw new ValidationError(
        `Cannot pick items for a delivery with status "${delivery.status}".`
      );
    }

    return prisma.$transaction(async (tx) => {
      for (const pickItem of pickInput.items) {
        const item = delivery.items.find((i) => i.id === pickItem.id);
        if (!item) {
          throw new NotFoundError(`Delivery Line Item (${pickItem.id})`);
        }

        await tx.deliveryItem.update({
          where: { id: pickItem.id },
          data: {
            pickedQuantity: pickItem.pickedQuantity,
          },
        });
      }

      // If delivery is DRAFT, advance it to WAITING
      const nextStatus =
        delivery.status === OperationStatus.DRAFT
          ? OperationStatus.WAITING
          : delivery.status;

      return tx.delivery.update({
        where: { id },
        data: { status: nextStatus },
        include: {
          warehouse: true,
          sourceLocation: true,
          items: {
            include: { product: true, location: true },
          },
        },
      });
    });
  }

  async packItems(id: string, packInput: PackItemsInput) {
    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!delivery) {
      throw new NotFoundError("Delivery");
    }

    if (
      delivery.status !== OperationStatus.WAITING &&
      delivery.status !== OperationStatus.READY
    ) {
      throw new ValidationError(
        `Cannot pack items for a delivery with status "${delivery.status}". Delivery must be in WAITING or READY status.`
      );
    }

    return prisma.$transaction(async (tx) => {
      for (const packItem of packInput.items) {
        const item = delivery.items.find((i) => i.id === packItem.id);
        if (!item) {
          throw new NotFoundError(`Delivery Line Item (${packItem.id})`);
        }

        await tx.deliveryItem.update({
          where: { id: packItem.id },
          data: {
            packedQuantity: packItem.packedQuantity,
          },
        });
      }

      // Transition to READY once packed
      return tx.delivery.update({
        where: { id },
        data: { status: OperationStatus.READY },
        include: {
          warehouse: true,
          sourceLocation: true,
          items: {
            include: { product: true, location: true },
          },
        },
      });
    });
  }

  async validateDeliveryTransaction(deliveryId: string, validatedById: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Fetch current delivery with relations
      const delivery = await tx.delivery.findUnique({
        where: { id: deliveryId },
        include: {
          items: {
            include: { product: true, location: true },
          },
        },
      });

      if (!delivery) {
        throw new NotFoundError("Delivery");
      }

      // 2. Concurrency / Idempotency check
      if (delivery.status === OperationStatus.DONE) {
        throw new ConflictError(
          "This delivery order has already been validated and stock has been dispatched."
        );
      }

      if (delivery.status === OperationStatus.CANCELED) {
        throw new ValidationError("Cannot validate a canceled delivery order.");
      }

      if (!delivery.items || delivery.items.length === 0) {
        throw new ValidationError("Cannot validate a delivery order with no line items.");
      }

      // 3. Process every line item atomically
      for (const item of delivery.items) {
        const sourceLocationId = item.locationId || delivery.sourceLocationId;
        if (!sourceLocationId) {
          throw new ValidationError(
            `Line item for product "${item.product.name}" is missing a source location.`
          );
        }

        // Determine effective quantity to deliver
        const deliverQty =
          item.packedQuantity > 0
            ? item.packedQuantity
            : item.pickedQuantity > 0
            ? item.pickedQuantity
            : item.quantityDemand;

        if (deliverQty <= 0) {
          throw new ValidationError(
            `Line item for product "${item.product.name}" has invalid quantity ${deliverQty}. Must be greater than 0.`
          );
        }

        // 3a. Re-verify available stock inside transaction to prevent negative stock & race conditions
        const stockRecord = await tx.stock.findUnique({
          where: {
            productId_locationId: {
              productId: item.productId,
              locationId: sourceLocationId,
            },
          },
        });

        const availableQty = stockRecord?.quantity ?? 0;
        if (availableQty < deliverQty) {
          throw new ValidationError(
            `Insufficient stock for product "${item.product.name}" (${item.product.sku}) at source location "${item.location?.name || 'Assigned Location'}". Available: ${availableQty} ${item.uom}, Requested: ${deliverQty} ${item.uom}. Cannot reduce inventory below zero.`
          );
        }

        // 3b. Decrement stock atomically at (productId, locationId)
        await tx.stock.update({
          where: {
            productId_locationId: {
              productId: item.productId,
              locationId: sourceLocationId,
            },
          },
          data: {
            quantity: { decrement: deliverQty },
          },
        });

        // 3c. Update item delivered quantity
        await tx.deliveryItem.update({
          where: { id: item.id },
          data: {
            quantityDelivered: deliverQty,
            pickedQuantity: item.pickedQuantity > 0 ? item.pickedQuantity : deliverQty,
            packedQuantity: item.packedQuantity > 0 ? item.packedQuantity : deliverQty,
          },
        });

        // 3d. Record immutable Stock Ledger entry
        await tx.stockLedger.create({
          data: {
            reference: delivery.referenceNumber,
            operationType: OperationType.DELIVERY,
            productId: item.productId,
            sourceLocationId: sourceLocationId,
            destinationLocationId: null, // Outgoing to customer / external
            quantity: -deliverQty, // Negative for outgoing stock deduction
            uom: item.uom,
            performedById: validatedById,
            notes: `Delivery order to customer: ${delivery.customerName}`,
          },
        });
      }

      // 4. Mark delivery as DONE with audit trail
      return tx.delivery.update({
        where: { id: deliveryId },
        data: {
          status: OperationStatus.DONE,
          validatedById,
          validatedAt: new Date(),
        },
        include: {
          warehouse: true,
          sourceLocation: true,
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

  async cancel(id: string) {
    const existing = await prisma.delivery.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError("Delivery");
    }

    if (existing.status === OperationStatus.DONE) {
      throw new ValidationError(
        "Cannot cancel a completed delivery order. Completed shipments cannot be reversed directly."
      );
    }

    if (existing.status === OperationStatus.CANCELED) {
      return existing;
    }

    return prisma.delivery.update({
      where: { id },
      data: { status: OperationStatus.CANCELED },
      include: {
        warehouse: true,
        sourceLocation: true,
        items: {
          include: { product: true, location: true },
        },
      },
    });
  }
}

export const deliveryRepository = new DeliveryRepository();
