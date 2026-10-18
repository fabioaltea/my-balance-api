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
exports.ChatGptPreferences = void 0;
const db_helper_1 = require("./db.helper");
class ChatGptPreferences {
    static get(userId, connectionId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const client = yield db_helper_1.DbHelper.connect();
            try {
                const { rows } = yield client.query("SELECT model_slug FROM chatgpt_model_preferences WHERE user_email=$1 AND product_name='MyBalance' AND connection_id=$2", [userId, connectionId]);
                return ((_a = rows[0]) === null || _a === void 0 ? void 0 : _a.model_slug) || null;
            }
            finally {
                client.release();
            }
        });
    }
    static set(userId, connectionId, model) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield db_helper_1.DbHelper.connect();
            try {
                yield client.query(`INSERT INTO chatgpt_model_preferences(user_email,product_name,connection_id,model_slug)
        VALUES($1,'MyBalance',$2,$3) ON CONFLICT(user_email,product_name,connection_id)
        DO UPDATE SET model_slug=EXCLUDED.model_slug,updated_at=NOW()`, [userId, connectionId, model]);
            }
            finally {
                client.release();
            }
        });
    }
}
exports.ChatGptPreferences = ChatGptPreferences;
//# sourceMappingURL=chatgpt-preferences.helper.js.map