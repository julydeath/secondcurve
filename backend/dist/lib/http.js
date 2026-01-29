"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = exports.HttpError = void 0;
class HttpError extends Error {
    status;
    details;
    constructor(status, message, details) {
        super(message);
        this.status = status;
        this.details = details;
    }
}
exports.HttpError = HttpError;
const asyncHandler = (handler) => (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
};
exports.asyncHandler = asyncHandler;
