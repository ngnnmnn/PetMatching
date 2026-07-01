"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)({
    path: ['.env', 'db.env'],
    override: false,
});
//# sourceMappingURL=load-env.js.map