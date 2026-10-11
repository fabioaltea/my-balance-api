"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushJobsRoutes = void 0;
const express_1 = require("express");
const crypto_1 = require("crypto");
const push_notifications_helper_1 = require("../helpers/push-notifications.helper");
exports.pushJobsRoutes = (0, express_1.Router)();
exports.pushJobsRoutes.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const expected = process.env.CRON_SECRET;
    const received = req.headers.authorization;
    if (!expected ||
        !received ||
        Buffer.byteLength(received) !== Buffer.byteLength(`Bearer ${expected}`) ||
        !(0, crypto_1.timingSafeEqual)(Buffer.from(received), Buffer.from(`Bearer ${expected}`))) {
        res.status(401).json({ success: false });
        return;
    }
    try {
        res.json(Object.assign({ success: true }, (yield push_notifications_helper_1.PushNotificationsHelper.run(5))));
    }
    catch (error) {
        console.error('Push worker failed');
        res.status(500).json({ success: false });
    }
}));
//# sourceMappingURL=push-jobs.routes.js.map