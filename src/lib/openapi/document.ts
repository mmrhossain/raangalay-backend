import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { registry } from "./registry.ts";
import "./security.ts";
import "./common-schemas.ts";

import "../../modules/auth/auth.openapi.ts";
import "../../modules/catalog/category/category.openapi.ts";
import "../../modules/catalog/brand/brand.openapi.ts";
import "../../modules/catalog/product/product.openapi.ts";
import "../../modules/catalog/inventory/inventory.openapi.ts";
import "../../modules/cart/cart.openapi.ts";
import "../../modules/order/order.openapi.ts";
import "../../modules/payment/payment.openapi.ts";
import "../../modules/coupon/coupon.openapi.ts";
import "../../modules/wishlist/wishlist.openapi.ts";
import "../../modules/review/review.openapi.ts";
import "../../modules/ai/ai.openapi.ts";

export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title: "Raangalay API",
      version: "1.0.0",
      description:
        "HTTP API for the Raangalay e-commerce backend. Authenticate with a Better Auth bearer token unless a route is public or webhook-signed.",
    },
    servers: [{ url: "/", description: "Current host" }],
  });
}
