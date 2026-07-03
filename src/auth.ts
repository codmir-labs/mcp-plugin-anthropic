import type { Request, Response, NextFunction } from "express";
import {
  validateBearerToken,
  extractBearerToken,
  type PrismaLike,
  type TokenValidationResult,
} from "@codmir/auth/validate";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string | null;
      userName?: string | null;
      authResult?: TokenValidationResult;
    }
  }
}

export function createAuthMiddleware(prisma: PrismaLike) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = extractBearerToken(
      req.headers as Record<string, string | string[] | undefined>
    );
    if (!token) {
      res.status(401).json({ error: "Missing or invalid Bearer token" });
      return;
    }

    const result = await validateBearerToken(token, prisma);
    if (!result.authenticated || !result.userId) {
      res.status(401).json({
        error: result.error || "Authentication failed",
        code: result.failureCode,
      });
      return;
    }

    req.userId = result.userId;
    req.userEmail = result.email;
    req.userName = result.name;
    req.authResult = result;
    next();
  };
}
