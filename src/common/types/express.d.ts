declare global {
  namespace Express {
    interface Request {
      auth?: {
        user: {
          id: string;
          name?: string | null;
          email: string;
          emailVerified?: boolean;
          role?: string | null | undefined;
          isApproved?: boolean | null | undefined;
          [key: string]: unknown;
        };
        session: {
          id: string;
          token: string;
          userId: string;
          expiresAt: Date;
          [key: string]: unknown;
        };
      } | null;
    }
  }
}

export {};
