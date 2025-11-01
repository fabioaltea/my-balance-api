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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const process_1 = __importDefault(require("process"));
const GoogleHelper_1 = require("./helpers/GoogleHelper");
const src_1 = require("googleapis/build/src");
const cors_1 = __importDefault(require("cors"));
const TransactionsHelper_1 = require("./helpers/MyBalance/TransactionsHelper");
const AccountsHelper_1 = require("./helpers/MyBalance/AccountsHelper");
const CategoriesHelper_1 = require("./helpers/MyBalance/CategoriesHelper");
const SpreadsheetsHelper_1 = require("./helpers/MyBalance/SpreadsheetsHelper");
const DbHelper_1 = require("./helpers/DbHelper");
const server_1 = require("@simplewebauthn/server");
const base64url_1 = __importDefault(require("base64url/dist/base64url"));
const app = (0, express_1.default)();
const port = process_1.default.env.PORT || 8080;
const corsOptions = {
    origin: process_1.default.env.ORIGIN_URL || 'http://localhost:8100',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'access_token', 'refresh_token'],
    exposedHeaders: ['Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials'],
    credentials: true
};
app.use((0, cors_1.default)(corsOptions));
app.options('*', (0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
app.use(body_parser_1.default.urlencoded({ extended: true }));
app.use(body_parser_1.default.json());
app.use(body_parser_1.default.raw());
app.use((req, res, next) => {
    console.log('Passing through express. REQ:', req.method, req.url);
    next();
});
app.get('/', (req, res) => {
    res.send("API Working");
});
//#region Google Sheets
app.get('/get', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("get");
    try {
        const authHeaders = GoogleHelper_1.GoogleHelper.parseAuthHeaders(req.headers);
        const authClient = src_1.google.auth.fromJSON(authHeaders);
        const spreadsheetId = req.headers.spreadsheet_id;
        if (!spreadsheetId) {
            return res.status(400).json({
                success: false,
                error: "Missing spreadsheet_id in headers",
            });
        }
        const body = req.body;
        const items = yield GoogleHelper_1.GoogleHelper.update(authClient, spreadsheetId, body);
        res.json({ success: true, data: items });
    }
    catch (error) {
        console.error("Error in update:", error);
        res.status(500).json({
            success: false,
            error: "Failed to update data",
            details: error === null || error === void 0 ? void 0 : error.message,
        });
    }
}));
app.post("/addMovement", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeaders = GoogleHelper_1.GoogleHelper.parseAuthHeaders(req.headers);
        const authClient = src_1.google.auth.fromJSON(authHeaders);
        const spreadsheetId = req.headers.spreadsheet_id;
        if (!spreadsheetId) {
            return res.status(400).json({
                success: false,
                error: "Missing spreadsheet_id in headers",
            });
        }
        const body = req.body; // Dovrebbe essere IMovementRequest o compatibile
        // Backwards compatibility: se il body ha il vecchio formato, convertiamo
        if (body.movementId && body.description && !body.transactions) {
            // Formato legacy: singolo movimento diventa array di 1 transaction
            const movementRequest = {
                movementId: body.movementId,
                description: body.description,
                category: body.category || "",
                date: body.date || new Date().toISOString().split("T")[0],
                type: body.type || "",
                location: body.location || "",
                notes: body.notes || "",
                recurrenceId: body.recurrenceId || "",
                transactions: [
                    {
                        amount: body.amount || 0,
                        account: body.account || "",
                        _operation: "create",
                    },
                ],
            };
            yield TransactionsHelper_1.TransactionsHelper.appendMovement(authClient, spreadsheetId, movementRequest);
        }
        else {
            // Nuovo formato
            yield TransactionsHelper_1.TransactionsHelper.appendMovement(authClient, spreadsheetId, body);
        }
        res.json({ success: true, data: "Movement added successfully" });
    }
    catch (error) {
        console.error("Error adding movement:", error);
        res.status(500).json({
            success: false,
            error: "Failed to add movement",
            details: error === null || error === void 0 ? void 0 : error.message,
        });
    }
}));
app.post("/append", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeaders = GoogleHelper_1.GoogleHelper.parseAuthHeaders(req.headers);
        const authClient = src_1.google.auth.fromJSON(authHeaders);
        const spreadsheetId = req.headers.spreadsheet_id;
        if (!spreadsheetId) {
            return res.status(400).json({
                success: false,
                error: "Missing spreadsheet_id in headers",
            });
        }
        const body = req.body;
        const items = yield GoogleHelper_1.GoogleHelper.append(authClient, spreadsheetId, req.query.range, body);
        res.json({ success: true, data: items });
    }
    catch (error) {
        console.error("Error in append:", error);
        res.status(500).json({
            success: false,
            error: "Failed to append data",
            details: error === null || error === void 0 ? void 0 : error.message,
        });
    }
}));
// New RESTful movements endpoints
app.get("/movements", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeaders = GoogleHelper_1.GoogleHelper.parseAuthHeaders(req.headers);
        const authClient = src_1.google.auth.fromJSON(authHeaders);
        const spreadsheetId = req.headers.spreadsheet_id;
        if (!spreadsheetId) {
            return res.status(400).json({
                success: false,
                error: "Missing spreadsheet_id in headers",
            });
        }
        const movements = yield TransactionsHelper_1.TransactionsHelper.listMovements(authClient, spreadsheetId);
        res.json({ success: true, data: movements });
    }
    catch (error) {
        console.error("Error fetching movements:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch movements",
            details: error === null || error === void 0 ? void 0 : error.message,
        });
    }
}));
app.get("/movements/:movementId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeaders = GoogleHelper_1.GoogleHelper.parseAuthHeaders(req.headers);
        const authClient = src_1.google.auth.fromJSON(authHeaders);
        const { movementId } = req.params;
        const spreadsheetId = req.headers.spreadsheet_id;
        if (!spreadsheetId) {
            return res.status(400).json({
                success: false,
                error: "Missing spreadsheet_id in headers",
            });
        }
        const movement = yield TransactionsHelper_1.TransactionsHelper.getMovement(authClient, spreadsheetId, movementId);
        if (!movement) {
            return res.status(404).json({
                success: false,
                error: "Movement not found",
            });
        }
        res.json({ success: true, data: movement });
    }
    catch (error) {
        console.error("Error fetching movement:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch movement",
            details: error === null || error === void 0 ? void 0 : error.message,
        });
    }
}));
app.post("/movements", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeaders = GoogleHelper_1.GoogleHelper.parseAuthHeaders(req.headers);
        const authClient = src_1.google.auth.fromJSON(authHeaders);
        const spreadsheetId = req.headers.spreadsheet_id;
        if (!spreadsheetId) {
            return res.status(400).json({
                success: false,
                error: "Missing spreadsheet_id in headers",
            });
        }
        const movementRequest = req.body; // IMovementRequest
        if (!movementRequest.transactions ||
            !Array.isArray(movementRequest.transactions)) {
            return res.status(400).json({
                success: false,
                error: "Missing or invalid transactions array",
            });
        }
        yield TransactionsHelper_1.TransactionsHelper.appendMovement(authClient, spreadsheetId, movementRequest);
        res
            .status(201)
            .json({ success: true, data: "Movement created successfully" });
    }
    catch (error) {
        console.error("Error creating movement:", error);
        res.status(500).json({
            success: false,
            error: "Failed to create movement",
            details: error === null || error === void 0 ? void 0 : error.message,
        });
    }
}));
app.put("/movements/:movementId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeaders = GoogleHelper_1.GoogleHelper.parseAuthHeaders(req.headers);
        const authClient = src_1.google.auth.fromJSON(authHeaders);
        const spreadsheetId = req.headers.spreadsheet_id;
        if (!spreadsheetId) {
            return res.status(400).json({
                success: false,
                error: "Missing spreadsheet_id in headers",
            });
        }
        const { movementId } = req.params;
        // Verifica che il movimento esista
        const existing = yield TransactionsHelper_1.TransactionsHelper.getMovement(authClient, spreadsheetId, movementId);
        if (!existing) {
            return res.status(404).json({
                success: false,
                error: "Movement not found",
            });
        }
        const movementRequest = req.body; // IMovementRequest
        movementRequest.movementId = movementId; // Assicura che movementId sia corretto
        if (!movementRequest.transactions ||
            !Array.isArray(movementRequest.transactions)) {
            return res.status(400).json({
                success: false,
                error: "Missing or invalid transactions array",
            });
        }
        yield TransactionsHelper_1.TransactionsHelper.updateMovement(authClient, spreadsheetId, movementRequest);
        res.json({ success: true, data: "Movement updated successfully" });
    }
    catch (error) {
        console.error("Error updating movement:", error);
        res.status(500).json({
            success: false,
            error: "Failed to update movement",
            details: error === null || error === void 0 ? void 0 : error.message,
        });
    }
}));
app.delete("/movements/:movementId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeaders = GoogleHelper_1.GoogleHelper.parseAuthHeaders(req.headers);
        const authClient = src_1.google.auth.fromJSON(authHeaders);
        const spreadsheetId = req.headers.spreadsheet_id;
        if (!spreadsheetId) {
            return res.status(400).json({
                success: false,
                error: "Missing spreadsheet_id in headers",
            });
        }
        const { movementId } = req.params;
        yield TransactionsHelper_1.TransactionsHelper.deleteMovement(authClient, spreadsheetId, movementId);
        res.json({ success: true, data: "Movement deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting movement:", error);
        res.status(500).json({
            success: false,
            error: "Failed to delete movement",
            details: error === null || error === void 0 ? void 0 : error.message,
        });
    }
}));
// #region TRANSACTIONS ENDPOINTS
/**
 * GET /transactions - Restituisce tutte le transazioni individuali estratte dai movements
 * Headers: refresh_token (required), spreadsheet_id (required)
 * Returns: Array di ITransaction
 */
app.get("/transactions", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeaders = GoogleHelper_1.GoogleHelper.parseAuthHeaders(req.headers);
        const authClient = src_1.google.auth.fromJSON(authHeaders);
        const spreadsheetId = req.headers.spreadsheet_id;
        if (!spreadsheetId) {
            return res.status(400).json({
                success: false,
                error: "Missing spreadsheet_id in headers",
            });
        }
        // Ottieni tutti i movements e poi estrai le singole transazioni
        const allTransactions = yield TransactionsHelper_1.TransactionsHelper.listTransactions(authClient, spreadsheetId);
        res.json({ success: true, data: allTransactions });
    }
    catch (error) {
        console.error("Error fetching transactions:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch transactions",
            details: error === null || error === void 0 ? void 0 : error.message,
        });
    }
}));
/**
 * GET /accounts-with-transactions - Load generica: restituisce tutti gli account con le loro transazioni
 * Query params: spreadsheetId (required)
 * Headers: refresh_token (required)
 * Returns: Array di account con transazioni, balance e metadati
 */
// app.get("/accounts-with-transactions", async (req: any, res: any) => {
//   try {
//     const authHeaders = GoogleHelper.parseAuthHeaders(req.headers);
//     const authClient = google.auth.fromJSON(authHeaders);
//     const refreshToken = authHeaders.refresh_token;
//     const spreadsheetId = req.query.spreadsheetId;
//     if (!spreadsheetId) return res.status(400).send("Missing spreadsheetId");
//     // Carica account e movements in parallelo
//     const [accounts, movements] = await Promise.all([
//       AccountsHelper.getAccounts(spreadsheetId, refreshToken),
//       TransactionsHelper.listMovements(authClient, spreadsheetId),
//     ]);
//     // Estrai tutte le transazioni da tutti i movements
//     const allTransactions = movements.flatMap((movement) =>
//       movement.transactions.map((transaction) => ({
//         ...transaction,
//         // Aggiungi metadati del movement
//         movementDescription: movement.description,
//         movementCategory: movement.category,
//         movementDate: movement.date,
//         movementType: movement.type,
//         movementLocation: movement.location,
//         movementNotes: movement.notes,
//         movementRecurrenceId: movement.recurrenceId,
//         movementStatus: movement.status,
//       }))
//     );
//     // Organizza le transazioni per account
//     const accountsWithTransactions = accounts.map((account) => {
//       // Filtra transazioni per questo account (o tutte se è account "Total")
//       const accountTransactions = allTransactions.filter((transaction) => {
//         // Se l'account è "Total", include tutte le transazioni
//         if (account.name === "Total") {
//           return transaction.status !== "DELETED";
//         }
//         // Altrimenti filtra per nome account
//         return (
//           transaction.account === account.name &&
//           transaction.status !== "DELETED"
//         );
//       });
//       // Ordina transazioni per data
//       accountTransactions.sort((a, b) => {
//         if (a.date < b.date) return -1;
//         else return 1;
//       });
//       // Calcola balance progressivo
//       let runningBalance = parseFloat(account.balance || "0");
//       const transactionsWithBalance = accountTransactions.map((transaction) => {
//         runningBalance += transaction.amount;
//         return {
//           ...transaction,
//           previousTransactionsAmount: runningBalance,
//         };
//       });
//       // Calcola balance finale
//       const finalBalance =
//         transactionsWithBalance.length > 0
//           ? transactionsWithBalance[transactionsWithBalance.length - 1]
//               .previousTransactionsAmount
//           : parseFloat(account.balance || "0");
//       return {
//         ...account,
//         transactions: transactionsWithBalance,
//         balance: finalBalance.toFixed(2),
//         transactionCount: transactionsWithBalance.length,
//       };
//     });
//     // Calcola total balance da tutti gli account (escluso il "Total" stesso per evitare doppio conteggio)
//     const totalBalance = accountsWithTransactions
//       .filter((account) => account.name !== "Total")
//       .reduce((sum, account) => sum + parseFloat(account.balance), 0);
//     res.status(200).json({
//       accounts: accountsWithTransactions,
//       totalBalance: totalBalance.toFixed(2),
//       timestamp: new Date().toISOString(),
//     });
//   } catch (ex: any) {
//     res.status(500).send(`Error. ex: ${ex.message}`);
//   }
// });
// #endregion
// app.get("/create", async (req: any, res: any) => {
//   try {
//     const authHeaders = GoogleHelper.parseAuthHeaders(req.headers);
//     const authClient = google.auth.fromJSON(authHeaders);
//     const userEmail = req.query.user_email;
//     if (!userEmail) {
//       res.status(400).send("Missing user_email");
//       return;
//     }
//     GoogleHelper.create(authClient, userEmail).then((r) => {
//       DbHelper.insertUser(userEmail, r.data.spreadsheetId).then(() => {
//         res.status(200).send(r);
//       });
//     });
//   } catch (ex) {
//     res.status(500).send(`Error. ex: ${ex.message}`);
//   }
// });
//#endregion
//#region CustomCredentials
app.get("/retrieveDbCredentials", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        DbHelper_1.DbHelper.getDbCredentials(req.headers.user_email, DbHelper_1.DbHelper.hashPin(req.headers.pin)).then((info) => {
            if (info)
                res.status(200).send({
                    token: info.token,
                    spreadsheetId: info.spreadsheet_id,
                });
            else
                res.status(401).send("Unauthorized");
        });
    }
    catch (ex) {
        res.status(500).send("Error. ex: " + ex.message);
    }
}));
app.get('/create', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeaders = GoogleHelper_1.GoogleHelper.parseAuthHeaders(req.headers);
        const authClient = src_1.google.auth.fromJSON(authHeaders);
        const userEmail = req.query.user_email;
        if (!userEmail) {
            res.status(400).send("Missing user_email");
            return;
        }
        GoogleHelper_1.GoogleHelper.create(authClient, userEmail).then((r) => {
            DbHelper_1.DbHelper.insertUser(userEmail, r.data.spreadsheetId).then(() => {
                res.status(200).send(r);
            });
        });
    }
    catch (ex) {
        res.status(500).send(`Error. ex: ${ex.message}`);
    }
}));
//#endregion
//#region CustomCredentials
app.get('/retrieveDbCredentials', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        DbHelper_1.DbHelper.getDbCredentials(req.headers.user_email, DbHelper_1.DbHelper.hashPin(req.headers.pin)).then((info) => {
            if (info)
                res.status(200).send({
                    token: info.token,
                    spreadsheetId: info.spreadsheet_id
                });
            else
                res.status(401).send("Unauthorized");
        });
    }
    catch (ex) {
        res.status(500).send("Error. ex: " + ex.message);
    }
}));
app.get('/auth', (req, res) => {
    GoogleHelper_1.GoogleHelper.authenticate(req).then((authUrl) => {
        res.send({ url: authUrl });
    })
        .catch();
});
app.get("/getToken", (req, res) => {
    GoogleHelper_1.GoogleHelper.authorize(req.query.code)
        .then((tokens) => {
        res.send(tokens);
    })
        .catch((ex) => {
        res.status(500).send(ex.message);
    });
});
app.get("/checkCredentials", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const authHeaders = GoogleHelper_1.GoogleHelper.parseAuthHeaders(req.headers);
    yield GoogleHelper_1.GoogleHelper.checkCredentials(authHeaders)
        .then((r) => {
        if (r) {
            res.status(200).send(r);
        }
        else {
            res.status(401).send("Unauthorized");
        }
    })
        .catch((ex) => {
        res.status(500).send(ex.message);
    });
}));
app.post("/saveCredentials", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("saveCredentials");
    try {
        const r = yield DbHelper_1.DbHelper.saveUserToken(req.body.user_email, req.body.token);
        res.send({ status: "OK" });
    }
    catch (ex) {
        console.error(ex);
        res.status(500).send(ex.message);
    }
}));
//#endregion
//#region WebAuthn
app.post('/generate-registration-options', (req, res) => {
    console.log("generate-registration-options");
    const { userEmail } = req.body;
    if (!userEmail) {
        return res.status(400).send("Missing userEmail");
    }
    // Genera challenge e opzioni per la registrazione
    (0, server_1.generateRegistrationOptions)({
        rpName: "My Balance",
        rpID: process_1.default.env.RPID, // Sostituisci con il tuo
        userID: new Uint8Array(Buffer.from(userEmail, "utf-8")),
        userName: userEmail,
        attestationType: "none",
        authenticatorSelection: {
            residentKey: "required",
            userVerification: "preferred",
        },
    }).then((options) => {
        DbHelper_1.DbHelper.saveAuthChallenge(userEmail, options.challenge)
            .then(() => {
            res.json(options);
        })
            .catch((error) => {
            console.error("Error saving challenge:", error);
            res.status(500).send("Error saving challenge");
        });
    });
});
app.post('/verify-registration', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("verify-registration");
    const { userEmail, attestationResponse } = req.body;
    // Recupera utente e challenge
    DbHelper_1.DbHelper.getAuthChallenge(userEmail).then((row) => {
        if (!row)
            return res.status(400).send("User not found");
        const { webauthn_challenge, webauthn_challenge_created_at } = row;
        if (!webauthn_challenge)
            return res.status(400).send("No challenge stored");
        const challengeAgeMinutes = (Date.now() - new Date(webauthn_challenge_created_at).getTime()) /
            1000 /
            60;
        if (challengeAgeMinutes > 5)
            return res.status(400).send("Challenge expired");
        (0, server_1.verifyRegistrationResponse)({
            response: attestationResponse,
            expectedChallenge: webauthn_challenge,
            expectedOrigin: process_1.default.env.RP_ORIGIN || "http://localhost:8100",
            expectedRPID: process_1.default.env.RPID || "localhost",
        }).then((verification) => {
            if (verification.verified && verification.registrationInfo) {
                DbHelper_1.DbHelper.saveAuthChallenge(userEmail, null);
                DbHelper_1.DbHelper.saveUserCredentials(userEmail, verification.registrationInfo.credential.id, base64url_1.default.encode(Buffer.from(verification.registrationInfo.credential.publicKey)), verification.registrationInfo.credential.counter).catch((error) => {
                    console.error("Error saving user credentials:", error);
                    return res.status(500).send("Error saving user credentials");
                });
                res.json({ verified: true });
            }
            else {
                res.status(400).json({ verified: false, error: "Verification failed" });
            }
        });
    });
}));
app.post('/generate-auth-options', (req, res) => {
    console.log("generate-auth-options");
    res.setHeader('Access-Control-Allow-Origin', process_1.default.env.ORIGIN_URL || 'http://localhost:8100');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    (0, server_1.generateAuthenticationOptions)({
        rpID: process_1.default.env.RPID,
        userVerification: 'preferred'
    }).then((options) => {
        res.json(options);
    }).catch((error) => {
        console.error('Error retrieving user credentials:', error);
        res.status(500).send("Error retrieving user credentials");
    });
});
app.post('/verify-authentication', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { assertionResponse, challenge } = req.body;
    const userEmail = Buffer.from(assertionResponse.response.userHandle, "base64url").toString();
    console.log("verify-authentication for user:", userEmail);
    DbHelper_1.DbHelper.getUserCredentials(userEmail).then((credentials) => {
        if (!credentials || credentials.length === 0) {
            console.warn("No credentials found for user:", userEmail);
            return res.status(400).send("No credentials found for user");
        }
        if (!credentials[0].credentialPublicKey ||
            credentials[0].counter === undefined) {
            console.warn("Missing credentialPublicKey or counter for user:", userEmail);
            return res.status(400).send("Invalid credential data for user");
        }
        (0, server_1.verifyAuthenticationResponse)({
            response: assertionResponse,
            expectedChallenge: challenge,
            expectedOrigin: process_1.default.env.RP_ORIGIN || "http://localhost:8100",
            expectedRPID: process_1.default.env.RPID || "localhost",
            credential: {
                id: credentials[0].credentialID,
                publicKey: credentials[0].credentialPublicKey, // Assicurati che sia in formato base64url
                counter: credentials[0].counter, // Assicurati che il counter sia un numero valido
            },
        })
            .then((verification) => {
            if (verification.verified) {
                // Aggiorna counter in DB
                //await updateCounter(userId, verification.authenticationInfo.newCounter);
                // Login riuscito → genera sessione / token JWT / refresh token
                console.log("Authentication successful for user:", userEmail);
                res.json({
                    verified: true,
                    token: credentials[0].token,
                    userEmail: userEmail,
                });
            }
            else {
                console.log("Authentication failed for user:", userEmail);
                res.status(400).json({ verified: false });
            }
        })
            .catch((error) => {
            console.log("Error verifying authentication for user:", userEmail, error);
            res
                .status(500)
                .send(`Error verifying authentication: ${error.message}`);
        });
    });
}));
//#endregion
app.listen(port, () => {
    return console.log(`Server is listening on ${port}`);
});
//# sourceMappingURL=index.js.map