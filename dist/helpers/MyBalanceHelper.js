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
exports.MyBalanceHelper = void 0;
const GoogleHelper_1 = require("./GoogleHelper");
class MyBalanceHelper {
    static AppendMovement(auth, spreadsheetId, body) {
        return __awaiter(this, void 0, void 0, function* () {
            // let tResult: any[][] = []
            // for (const transaction of movement) {
            //     tResult.push([
            //         `${transaction.description}`,
            //         `${transaction.category}`,
            //         `${transaction.amount}`,
            //         `${transaction.date}`,
            //         `${transaction.status}`,
            //         `${transaction.location}`,
            //         `${transaction.transactionId}`,
            //         `${transaction.movementId}`,
            //         "",
            //         `${transaction.location}`,
            //         "",
            //         `${transaction.dateAdded}`,
            //         `${transaction.dateModified}`
            //     ])
            // }
            return yield GoogleHelper_1.GoogleHelper.append(auth, spreadsheetId, "AllTransactions!A:Z", body);
        });
    }
}
exports.MyBalanceHelper = MyBalanceHelper;
//# sourceMappingURL=MyBalanceHelper.js.map