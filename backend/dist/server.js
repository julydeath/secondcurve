"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = require("./app");
const port = Number.parseInt(process.env.PORT ?? "4000", 10);
const app = (0, app_1.createApp)();
app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
});
