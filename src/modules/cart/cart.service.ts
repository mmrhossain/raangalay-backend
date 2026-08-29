import { prisma, transaction } from "../../lib/prisma.ts";
import type { Prisma } from "../../generated/prisma/client.ts";
import { AppError } from "../../common/errors/AppError.ts";
import { getDefaultWarehouse, lockInventory } from "../catalog/inventory/services/inventory.service.ts";
import { applyCouponAtomic } from "../coupon/coupon.service.ts";
import type { CheckoutInput } from "./cart.validator.ts";

const TAX_RATE = 0;
const SHIPPING_FEE = 0;

const cartInclude = {
  items: {
    include: {
      variant: {
        select: {
          id: true,
          sku: true,
          price: true,
          compareAtPrice: true,
          product: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  },
  coupon: true,
  activities: { orderBy: { createdAt: "desc" }, take: 5 },
} as const;

export const getActiveCart = async (customerProfileId: string) => {
  return prisma.cart.findFirst({
    where: { customerProfileId, status: "ACTIVE" },
    include: cartInclude,
  });
};

const getOrCreateActiveCart = async (customerProfileId: string) => {
  const existing = await getActiveCart(customerProfileId);
  if (existing) return existing;

  return prisma.cart.create({
    data: { customerProfileId },
    include: cartInclude,
  });
};

const getAvailableStock = async (variantId: string) => {
  const agg = await prisma.inventory.aggregate({
    _sum: { quantityAvailable: true },
    where: { variantId },
  });
  return agg._sum.quantityAvailable ?? 0;
};

const recalcCartTotals = async (cartId: string) => {
  const items = await prisma.cartItem.findMany({ where: { cartId } });
  const coupon = await prisma.cartCoupon.findUnique({ where: { cartId } });

  const subtotal = items.reduce((sum, i) => sum + Number(i.subtotal), 0);
  const discountAmount = coupon ? Number(coupon.discountAmount) : 0;
  const taxAmount = Math.round(subtotal * TAX_RATE * 100) / 100;
  const shippingAmount = SHIPPING_FEE;
  const grandTotal = subtotal - discountAmount + taxAmount + shippingAmount;

  return prisma.cart.update({
    where: { id: cartId },
    data: { subtotal, discountAmount, taxAmount, shippingAmount, grandTotal },
  });
};

export const getCart = async (customerProfileId: string) => {
  const cart = await getActiveCart(customerProfileId);

  if (!cart) {
    return {
      items: [],
      coupon: null,
      subtotal: 0,
      discountAmount: 0,
      taxAmount: 0,
      shippingAmount: 0,
      grandTotal: 0,
    };
  }

  return cart;
};

export const addItem = async (
  customerProfileId: string,
  variantId: string,
  quantity: number
) => {
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, deletedAt: null, product: { deletedAt: null } },
    include: { product: { select: { id: true, name: true, slug: true } } },
  });

  if (!variant) throw new AppError("Variant not found", 404);

  const available = await getAvailableStock(variantId);
  if (available < quantity) throw new AppError("Insufficient stock available", 409);

  const cart = await getOrCreateActiveCart(customerProfileId);

  const existingItem = await prisma.cartItem.findUnique({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
  });

  if (existingItem) {
    const newQuantity = existingItem.quantity + quantity;
    if (available < newQuantity) {
      throw new AppError("Insufficient stock available", 409);
    }

    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: {
        quantity: newQuantity,
        subtotal: Number(existingItem.unitPrice) * newQuantity,
      },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: variant.productId,
        variantId,
        quantity,
        productName: variant.product.name,
        productSlug: variant.product.slug,
        sku: variant.sku,
        unitPrice: Number(variant.price),
        subtotal: Number(variant.price) * quantity,
      },
    });
  }

  await prisma.cartActivity.create({
    data: {
      cartId: cart.id,
      eventType: "ITEM_ADDED",
      metadata: { variantId, quantity },
    },
  });

  await recalcCartTotals(cart.id);

  return getActiveCart(customerProfileId);
};

export const updateItemQuantity = async (
  customerProfileId: string,
  variantId: string,
  quantity: number
) => {
  const cart = await getOrCreateActiveCart(customerProfileId);

  const item = await prisma.cartItem.findUnique({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
  });

  if (!item) throw new AppError("Item not in cart", 404);

  const available = await getAvailableStock(variantId);
  if (available < quantity) throw new AppError("Insufficient stock available", 409);

  await prisma.cartItem.update({
    where: { id: item.id },
    data: { quantity, subtotal: Number(item.unitPrice) * quantity },
  });

  await prisma.cartActivity.create({
    data: {
      cartId: cart.id,
      eventType: "QUANTITY_CHANGED",
      metadata: { variantId, quantity },
    },
  });

  await recalcCartTotals(cart.id);

  return getActiveCart(customerProfileId);
};

export const removeItem = async (customerProfileId: string, variantId: string) => {
  const cart = await getOrCreateActiveCart(customerProfileId);

  const item = await prisma.cartItem.findUnique({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
  });

  if (!item) throw new AppError("Item not in cart", 404);

  await prisma.cartItem.delete({ where: { id: item.id } });

  await prisma.cartActivity.create({
    data: {
      cartId: cart.id,
      eventType: "ITEM_REMOVED",
      metadata: { variantId },
    },
  });

  await recalcCartTotals(cart.id);

  return getActiveCart(customerProfileId);
};

export const clearCart = async (customerProfileId: string) => {
  const cart = await getOrCreateActiveCart(customerProfileId);

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  await prisma.cartCoupon.deleteMany({ where: { cartId: cart.id } });
  await recalcCartTotals(cart.id);

  return getActiveCart(customerProfileId);
};

export const getGuestCart = async (sessionId: string) => {
  const guestCart = await prisma.guestCart.findUnique({ where: { sessionId } });
  return guestCart ?? null;
};

export const saveGuestCart = async (
  sessionId: string,
  cartData: unknown
) => {
  const data = cartData as Prisma.InputJsonValue;

  return prisma.guestCart.upsert({
    where: { sessionId },
    update: { cartData: data },
    create: {
      sessionId,
      cartData: data,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
};

export const mergeGuestCart = async (customerProfileId: string, sessionId: string) => {
  const guestCart = await prisma.guestCart.findUnique({ where: { sessionId } });

  if (!guestCart || !guestCart.cartData) return getActiveCart(customerProfileId);

  const data = guestCart.cartData as {
    items?: Array<{ variantId: string; quantity: number }>;
  };

  for (const item of data.items ?? []) {
    try {
      await addItem(customerProfileId, item.variantId, item.quantity);
    } catch {
      // skip items that are unavailable or out of stock during merge
    }
  }

  return getActiveCart(customerProfileId);
};

export const applyCoupon = async (
  customerProfileId: string,
  code: string
) => {
  const cart = await getOrCreateActiveCart(customerProfileId);

  const items = await prisma.cartItem.findMany({ where: { cartId: cart.id } });
  if (items.length === 0) throw new AppError("Cart is empty", 400);

  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, categoryId: true },
  });
  const productCategoryIds = products.map((p) => p.categoryId);

  const subtotal = items.reduce((s, i) => s + Number(i.subtotal), 0);

  const { coupon, discountAmount } = await applyCouponAtomic(
    code,
    customerProfileId,
    { subtotal, productIds, productCategoryIds },
    prisma
  );

  await prisma.cartCoupon.upsert({
    where: { cartId: cart.id },
    update: { couponCode: coupon.code, discountAmount },
    create: {
      cartId: cart.id,
      couponCode: coupon.code,
      discountAmount,
    },
  });

  await recalcCartTotals(cart.id);

  return getActiveCart(customerProfileId);
};

export const removeCoupon = async (customerProfileId: string) => {
  const cart = await getOrCreateActiveCart(customerProfileId);

  await prisma.cartCoupon.deleteMany({ where: { cartId: cart.id } });
  await recalcCartTotals(cart.id);

  return getActiveCart(customerProfileId);
};

const generateOrderNumber = () => {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${ts}-${rand}`;
};

const toNullableAddress = (a: CheckoutInput["billingAddress"]) => ({
  fullName: a.fullName,
  phone: a.phone,
  email: a.email ?? null,
  country: a.country,
  state: a.state ?? null,
  city: a.city,
  area: a.area ?? null,
  postalCode: a.postalCode ?? null,
  addressLine1: a.addressLine1,
  addressLine2: a.addressLine2 ?? null,
});

export const checkout = async (
  customerProfileId: string,
  input: CheckoutInput
) => {
  const orderNumber = generateOrderNumber();

  return transaction(async (tx) => {
    const cartRows = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM "Cart" WHERE id IN (SELECT id FROM "Cart" WHERE "customerProfileId" = ${customerProfileId} AND status = 'ACTIVE' ORDER BY "createdAt" ASC LIMIT 1) FOR UPDATE`;

    if (!cartRows[0]) throw new AppError("Cart is empty", 400);

    const cart = await tx.cart.findUniqueOrThrow({
      where: { id: cartRows[0].id },
      include: { items: { include: { variant: { include: { product: true } } } } },
    });

    if (cart.items.length === 0) throw new AppError("Cart is empty", 400);

    for (const item of cart.items) {
      if (!item.variant || item.variant.deletedAt) {
        throw new AppError(`Variant unavailable: ${item.sku}`, 409);
      }
    }

    const subtotal = cart.items.reduce(
      (s, i) => s + Number(i.variant!.price) * i.quantity,
      0
    );

    const productIds = cart.items.map((i) => i.productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, categoryId: true },
    });
    const productCategoryIds = products.map((p) => p.categoryId);

    let discountAmount = 0;
    let coupon: { id: string } | null = null;

    if (input.couponCode) {
      const res = await applyCouponAtomic(
        input.couponCode,
        customerProfileId,
        { subtotal, productIds, productCategoryIds },
        tx
      );
      discountAmount = res.discountAmount;
      coupon = res.coupon;
    }

    const taxAmount = Math.round(subtotal * TAX_RATE * 100) / 100;
    const shippingAmount = SHIPPING_FEE;
    const grandTotal = subtotal - discountAmount + taxAmount + shippingAmount;

    const warehouse = await getDefaultWarehouse(tx);
    if (!warehouse) {
      throw new AppError("No active warehouse configured", 500);
    }

    const reservations: Array<{
      variantId: string;
      quantity: number;
      inventoryId: string;
    }> = [];

    for (const item of cart.items) {
      const invRow = await lockInventory(tx, item.variantId, warehouse.id);

      if (!invRow) {
        throw new AppError(`No inventory record for variant ${item.sku}`, 409);
      }

      const inventory = await tx.inventory.findUniqueOrThrow({
        where: { id: invRow.id },
      });

      if (inventory.quantityAvailable < item.quantity) {
        throw new AppError(
          `Insufficient stock for ${item.sku} (requested ${item.quantity}, available ${inventory.quantityAvailable})`,
          409
        );
      }

      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          quantityReserved: { increment: item.quantity },
          quantityAvailable: { decrement: item.quantity },
          lastTransactionAt: new Date(),
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          inventoryId: inventory.id,
          variantId: item.variantId,
          warehouseId: warehouse.id,
          type: "RESERVE",
          quantity: item.quantity,
          referenceType: "ORDER",
          referenceId: orderNumber,
          createdBy: customerProfileId,
        },
      });

      reservations.push({
        variantId: item.variantId,
        quantity: item.quantity,
        inventoryId: inventory.id,
      });
    }

    const order = await tx.order.create({
      data: {
        orderNumber,
        subtotal,
        discountAmount,
        taxAmount,
        shippingAmount,
        grandTotal,
        notes: input.notes ?? null,
        customerProfileId,
        items: {
          create: cart.items.map((item) => ({
            productName: item.variant!.product.name,
            sku: item.variant!.sku,
            variantName: item.variant!.sku,
            quantity: item.quantity,
            unitPrice: Number(item.variant!.price),
            discountAmount: 0,
            taxAmount: 0,
            subtotal: Number(item.variant!.price) * item.quantity,
            variantId: item.variantId,
          })),
        },
        billingAddress: { create: toNullableAddress(input.billingAddress) },
        ...(input.shippingAddress && {
          shippingAddress: { create: toNullableAddress(input.shippingAddress) },
        }),
        statusHistory: {
          create: { status: "PENDING", remarks: "Order created" },
        },
        events: {
          create: { eventType: "ORDER_CREATED", metadata: { orderNumber } },
        },
        payments: {
          create: {
            method: input.paymentMethod,
            status: "PENDING",
            amount: grandTotal,
          },
        },
      },
      include: { items: true, payments: true },
    });

    for (const r of reservations) {
      await tx.stockReservation.create({
        data: {
          orderId: order.id,
          variantId: r.variantId,
          warehouseId: warehouse.id,
          quantity: r.quantity,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      });
    }

    if (coupon) {
      await tx.coupon.update({
        where: { id: coupon.id },
        data: { usageCount: { increment: 1 } },
      });

      await tx.couponUsage.create({
        data: {
          couponId: coupon.id,
          customerProfileId,
          orderId: order.id,
          discountAmount,
        },
      });
    }

    await tx.cart.update({
      where: { id: cart.id },
      data: { status: "CHECKED_OUT" },
    });

    await tx.cartActivity.create({
      data: {
        cartId: cart.id,
        eventType: "CHECKOUT_STARTED",
        metadata: { orderId: order.id, orderNumber },
      },
    });

    return order;
  });
};
