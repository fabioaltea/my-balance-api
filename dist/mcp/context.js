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
exports.getMcpPrincipal = getMcpPrincipal;
exports.withDefaultSpreadsheet = withDefaultSpreadsheet;
const google_1 = require("../helpers/google");
const errors_1 = require("./errors");
function getMcpPrincipal(authInfo) {
    var _a, _b, _c;
    const userId = (_a = authInfo === null || authInfo === void 0 ? void 0 : authInfo.extra) === null || _a === void 0 ? void 0 : _a.userId;
    const deviceType = (_b = authInfo === null || authInfo === void 0 ? void 0 : authInfo.extra) === null || _b === void 0 ? void 0 : _b.deviceType;
    const deviceId = (_c = authInfo === null || authInfo === void 0 ? void 0 : authInfo.extra) === null || _c === void 0 ? void 0 : _c.deviceId;
    if (typeof userId !== 'string' || !userId) {
        throw new errors_1.McpApplicationError('AUTH_REQUIRED', 'Authenticated user context is missing');
    }
    return {
        userId,
        scopes: (authInfo === null || authInfo === void 0 ? void 0 : authInfo.scopes) || [],
        deviceType: deviceType === 'ios' || deviceType === 'android' || deviceType === 'web' ? deviceType : 'web',
        deviceId: typeof deviceId === 'string' ? deviceId : undefined,
    };
}
function withDefaultSpreadsheet(principal, operation) {
    return __awaiter(this, void 0, void 0, function* () {
        const spreadsheetId = yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(principal.userId);
        if (!spreadsheetId) {
            throw new errors_1.McpApplicationError('SPREADSHEET_NOT_CONFIGURED', 'No default spreadsheet is configured for this user');
        }
        return google_1.GoogleAuthHelper.executeWithRetry(principal.userId, principal.deviceType, (authClient) => __awaiter(this, void 0, void 0, function* () { return operation(authClient, spreadsheetId); }));
    });
}
//# sourceMappingURL=context.js.map