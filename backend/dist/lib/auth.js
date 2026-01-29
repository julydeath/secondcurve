"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.requireAuth = exports.verifySessionToken = exports.signSessionToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("./prisma");
const http_1 = require("./http");
const jwtSecret = process.env.JWT_SECRET ?? "dev-jwt-secret";
const signSessionToken = (payload) => jsonwebtoken_1.default.sign(payload, jwtSecret, {
    expiresIn: "7d",
});
exports.signSessionToken = signSessionToken;
const verifySessionToken = (token) => jsonwebtoken_1.default.verify(token, jwtSecret);
exports.verifySessionToken = verifySessionToken;
const extractUserId = (req) => {
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
const requireAuth = async (req, _res, next) => {
    const bearerOrDev = extractUserId(req);
    const cookieToken = req.cookies?.wb_session;
    let user = null;
    if (cookieToken) {
        try {
            user = (0, exports.verifySessionToken)(cookieToken);
        }
        catch {
            user = null;
        }
    }
    if (!user && bearerOrDev) {
        if (bearerOrDev.includes(".")) {
            try {
                user = (0, exports.verifySessionToken)(bearerOrDev);
            }
            catch {
                user = null;
            }
        }
        else {
            const userRecord = await prisma_1.prisma.user.findUnique({
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
        return next(new http_1.HttpError(401, "unauthorized"));
    }
    req.user = user;
    return next();
};
exports.requireAuth = requireAuth;
const requireRole = (...roles) => (req, _res, next) => {
    if (!req.user) {
        return next(new http_1.HttpError(401, "unauthorized"));
    }
    if (!roles.includes(req.user.role)) {
        return next(new http_1.HttpError(403, "forbidden"));
    }
    return next();
};
exports.requireRole = requireRole;
