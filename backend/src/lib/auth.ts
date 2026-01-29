import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { HttpError } from "./http";

export type AuthenticatedUser = {
  id: string;
  role: Role;
  email: string;
  name: string;
};

const jwtSecret = process.env.JWT_SECRET ?? "dev-jwt-secret";

export const signSessionToken = (payload: {
  id: string;
  role: Role;
  email: string;
  name: string;
}) =>
  jwt.sign(payload, jwtSecret, {
    expiresIn: "7d",
  });

export const verifySessionToken = (token: string) =>
  jwt.verify(token, jwtSecret) as AuthenticatedUser;

const extractUserId = (req: Request) => {
  const header = req.header("authorization");
  if (header && header.toLowerCase().startsWith("bearer ")) {
    const raw = header.slice(7).trim();
    if (raw.startsWith("dev-")) {
      return raw.slice(4);
    }
    return raw;
  }
  return req.header("x-user-id")?.trim();
};

export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const bearerOrDev = extractUserId(req);
  const cookieToken = req.cookies?.wb_session as string | undefined;
  let user: AuthenticatedUser | null = null;

  if (cookieToken) {
    try {
      user = verifySessionToken(cookieToken);
    } catch {
      user = null;
    }
  }

  if (!user && bearerOrDev) {
    if (bearerOrDev.includes(".")) {
      try {
        user = verifySessionToken(bearerOrDev);
      } catch {
        user = null;
      }
    } else {
      const userRecord = await prisma.user.findUnique({
        where: { id: bearerOrDev },
      });
      if (userRecord) {
        user = {
          id: userRecord.id,
          role: userRecord.role,
          email: userRecord.email,
          name: userRecord.name,
        };
      }
    }
  }

  if (!user) {
    return next(new HttpError(401, "unauthorized"));
  }

  req.user = user;

  return next();
};

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new HttpError(401, "unauthorized"));
    }
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, "forbidden"));
    }
    return next();
  };
