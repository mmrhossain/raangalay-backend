import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins";
import { prisma } from "./prisma.ts";
import { env } from "../config/env.ts";

export const auth = betterAuth({
  appName: "raangalay",
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/v1/auth",
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  socialProviders: {
        google: { 
            clientId: process.env.GOOGLE_CLIENT_ID as string, 
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string, 
        }, 
  },
  trustedOrigins: [env.FRONTEND_URL],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      // Email provider plug-in point. In production, send via SMTP/Resend.
      console.log(`[auth] password reset requested for ${user.email}: ${url}`);
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "CUSTOMER",
        input: false,
      },
      isApproved: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const customerRole = await prisma.role.findUnique({
            where: { name: "CUSTOMER" },
          });

          if (!customerRole) {
            throw new Error(
              "[auth] default CUSTOMER role not found. Run `npm run seed` first."
            );
          }

          const firstName = (user.name as string | undefined)
            ?.trim()
            .split(/\s+/)[0];

          return {
            data: {
              ...user,
              firstName: firstName ?? "",
              roleId: customerRole.id,
            },
          };
        },
      },
    },
  },
  plugins: [bearer()],
});
