"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = require("./app");
const payments_1 = require("./services/payments");
const subscriptions_1 = require("./services/subscriptions");
const availability_1 = require("./services/availability");
const port = Number.parseInt(process.env.PORT ?? "4000", 10);
const app = (0, app_1.createApp)();
app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
});
const startSchedulers = () => {
    const run = async () => {
        await (0, payments_1.captureDuePayments)();
        await (0, payments_1.cancelOverdueUnpaidBookings)();
        await (0, subscriptions_1.resumeDueSubscriptions)();
        await (0, availability_1.ensureRollingSlots)(8);
    };
    void run();
    setInterval(() => {
        void run();
    }, 5 * 60 * 1000);
};
startSchedulers();
