"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const zod_1 = require("zod");
const http_1 = require("../lib/http");
const errorHandler = (err, _req, res, _next) => {
    if (err instanceof http_1.HttpError) {
        return res.status(err.status).json({
            error: err.message,
            details: err.details,
        });
    }
    if (err instanceof zod_1.ZodError) {
        return res.status(400).json({
            error: "validation_error",
            details: err.issues,
        });
    }
    return res.status(500).json({ error: "internal_error" });
};
exports.errorHandler = errorHandler;
