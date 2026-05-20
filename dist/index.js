"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const dotenv = __importStar(require("dotenv"));
dotenv.config({ path: '.env.local' });
const express_1 = __importDefault(require("express"));
const process_1 = __importDefault(require("process"));
const google_1 = require("./helpers/google");
const cors_1 = __importDefault(require("cors"));
const mybalance_1 = require("./helpers/mybalance");
const db_helper_1 = require("./helpers/db.helper");
const server_1 = require("@simplewebauthn/server");
const base64url_1 = __importDefault(require("base64url/dist/base64url"));
// ROUTES IMPORTS
// Note: Auth routes removed - frontend calls auth service directly
const accounts_routes_1 = require("./routes/accounts.routes");
const categories_routes_1 = require("./routes/categories.routes");
const transactions_routes_1 = require("./routes/transactions.routes");
const movements_routes_1 = require("./routes/movements.routes");
const shortcut_routes_1 = require("./routes/shortcut.routes");
const aggregations_routes_1 = require("./routes/aggregations.routes");
const saltedge_routes_1 = require("./routes/saltedge.routes");
const requireAuth_middleware_1 = require("./middleware/requireAuth.middleware");
const jwt_helper_1 = require("./helpers/jwt.helper");
function handleGoogleTokenError(error, res, context) {
    if (error instanceof google_1.GoogleTokenError) {
        console.error(`❌ Google token error in ${context}:`, error.message, error.code);
        res.status(401).json({
            success: false,
            error: error.message,
            code: error.code,
            requiresReauth: true,
        });
        return true;
    }
    return false;
}
const app = (0, express_1.default)();
const port = process_1.default.env.PORT || 8080;
// Parse allowed origins from env (comma-separated) or use defaults
const allowedOrigins = process_1.default.env.ALLOWED_ORIGINS
    ? process_1.default.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
    : [
        process_1.default.env.ORIGIN_URL || 'http://localhost:8100',
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:8081',
    ];
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        console.warn(`CORS blocked request from origin: ${origin}`);
        return callback(new Error('Not allowed by CORS'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'access_token',
        'refresh_token',
        'spreadsheet_id',
        'x-shortcutkey',
        'x-authorization',
    ],
    exposedHeaders: ['Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials'],
    credentials: true,
};
app.set('trust proxy', 1);
app.use((0, cors_1.default)(corsOptions));
app.options('*', (0, cors_1.default)(corsOptions));
// Capture raw body for webhook signature verification before JSON parsing
app.use(express_1.default.json({
    verify: (req, _res, buf) => {
        req.rawBody = buf.toString('utf8');
    },
}));
app.use(express_1.default.urlencoded({ extended: true }));
app.use(express_1.default.raw());
// ==============================
// API ROUTES (External Routers)
// Note: /auth routes removed - frontend calls auth service directly (port 8080)
// ==============================
app.use('/accounts', accounts_routes_1.accountsRoutes);
app.use('/categories', categories_routes_1.categoriesRoutes);
app.use('/transactions', transactions_routes_1.transactionsRoutes);
app.use('/movements', movements_routes_1.movementsRoutes);
app.use('/shortcut', shortcut_routes_1.shortcutRoutes);
app.use('/aggregations', aggregations_routes_1.aggregationsRoutes);
app.use('/saltedge', saltedge_routes_1.saltedgeRoutes);
// ==============================
// User Data Endpoints
// ==============================
app.get('/user/spreadsheet', requireAuth_middleware_1.RequireAuthMiddleware.verify, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userEmail = req.userId;
        const user = yield db_helper_1.DbHelper.getUserByEmail(userEmail);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
            });
        }
        res.json({
            success: true,
            data: {
                spreadSheetID: user.spreadsheet_id,
                userInfo: {
                    user_email: user.user_email,
                    user_name: user.user_name,
                    spreadsheet_id: user.spreadsheet_id,
                    last_access: user.last_access,
                },
            },
        });
    }
    catch (error) {
        console.error('Error getting user spreadsheet:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user spreadsheet',
            details: error === null || error === void 0 ? void 0 : error.message,
        });
    }
}));
app.post('/user/last-access', requireAuth_middleware_1.RequireAuthMiddleware.verify, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userEmail = req.userId;
        const result = yield db_helper_1.DbHelper.updateUserLastAccess(userEmail);
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        console.error('Error updating last access:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update last access',
            details: error === null || error === void 0 ? void 0 : error.message,
        });
    }
}));
// ==============================
// Health Check
// ==============================
app.get('/', (req, res) => {
    res.send('API Working');
});
// ==============================
// Waitlist (Public)
// ==============================
app.post('/waitlist', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email is required',
            });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format',
            });
        }
        const result = yield db_helper_1.DbHelper.addToWaitlist(email.toLowerCase().trim());
        res.status(201).json({
            success: true,
            message: 'Successfully added to waitlist',
            data: {
                email: result.email,
            },
        });
    }
    catch (error) {
        console.error('Error adding to waitlist:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add to waitlist',
            details: error === null || error === void 0 ? void 0 : error.message,
        });
    }
}));
// ==============================
// Legacy Google Sheets Endpoints
// ==============================
app.get('/get', requireAuth_middleware_1.RequireAuthMiddleware.verify, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userEmail = req.userId;
        const deviceType = req.deviceType || 'web';
        let spreadsheetId = req.headers.spreadsheet_id;
        if (!spreadsheetId) {
            spreadsheetId = yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
        }
        if (!spreadsheetId) {
            return res.status(400).json({
                success: false,
                error: 'Missing spreadsheet_id in headers and no default spreadsheet configured',
            });
        }
        const items = yield google_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(void 0, void 0, void 0, function* () { return google_1.GoogleHelper.get(client, spreadsheetId, req.query.range); }));
        res.json({ success: true, data: items });
    }
    catch (error) {
        if (handleGoogleTokenError(error, res, 'legacyGet'))
            return;
        console.error('Error in get:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get data',
            details: error === null || error === void 0 ? void 0 : error.message,
        });
    }
}));
app.post('/update', requireAuth_middleware_1.RequireAuthMiddleware.verify, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userEmail = req.userId;
        const deviceType = req.deviceType || 'web';
        let spreadsheetId = req.headers.spreadsheet_id;
        if (!spreadsheetId) {
            spreadsheetId = yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
        }
        if (!spreadsheetId) {
            return res.status(400).json({
                success: false,
                error: 'Missing spreadsheet_id in headers and no default spreadsheet configured',
            });
        }
        const body = req.body;
        const items = yield google_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(void 0, void 0, void 0, function* () { return google_1.GoogleHelper.update(client, spreadsheetId, body); }));
        res.json({ success: true, data: items });
    }
    catch (error) {
        if (handleGoogleTokenError(error, res, 'legacyUpdate'))
            return;
        console.error('Error in update:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update data',
            details: error === null || error === void 0 ? void 0 : error.message,
        });
    }
}));
app.post('/addMovement', requireAuth_middleware_1.RequireAuthMiddleware.verify, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userEmail = req.userId;
        const deviceType = req.deviceType || 'web';
        let spreadsheetId = req.headers.spreadsheet_id;
        if (!spreadsheetId) {
            spreadsheetId = yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
        }
        if (!spreadsheetId) {
            return res.status(400).json({
                success: false,
                error: 'Missing spreadsheet_id in headers and no default spreadsheet configured',
            });
        }
        const body = req.body;
        // Backwards compatibility: convert legacy format
        if (body.movementId && body.description && !body.transactions) {
            const movementRequest = {
                movementId: body.movementId,
                description: body.description,
                category: body.category || '',
                date: body.date || new Date().toISOString().split('T')[0],
                type: body.type || '',
                location: body.location || '',
                notes: body.notes || '',
                recurrenceId: body.recurrenceId || '',
                transactions: [
                    {
                        amount: body.amount || 0,
                        account: body.account || '',
                        _operation: 'create',
                    },
                ],
            };
            yield google_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(void 0, void 0, void 0, function* () { return mybalance_1.TransactionsHelper.appendMovement(client, spreadsheetId, movementRequest); }));
        }
        else {
            yield google_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(void 0, void 0, void 0, function* () { return mybalance_1.TransactionsHelper.appendMovement(client, spreadsheetId, body); }));
        }
        res.json({ success: true, data: 'Movement added successfully' });
    }
    catch (error) {
        if (handleGoogleTokenError(error, res, 'legacyAddMovement'))
            return;
        console.error('Error adding movement:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add movement',
            details: error === null || error === void 0 ? void 0 : error.message,
        });
    }
}));
app.post('/append', requireAuth_middleware_1.RequireAuthMiddleware.verify, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userEmail = req.userId;
        const deviceType = req.deviceType || 'web';
        let spreadsheetId = req.headers.spreadsheet_id;
        if (!spreadsheetId) {
            spreadsheetId = yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
        }
        if (!spreadsheetId) {
            return res.status(400).json({
                success: false,
                error: 'Missing spreadsheet_id in headers and no default spreadsheet configured',
            });
        }
        const body = req.body;
        const items = yield google_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(void 0, void 0, void 0, function* () { return google_1.GoogleHelper.append(client, spreadsheetId, req.query.range, body); }));
        res.json({ success: true, data: items });
    }
    catch (error) {
        if (handleGoogleTokenError(error, res, 'legacyAppend'))
            return;
        console.error('Error in append:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to append data',
            details: error === null || error === void 0 ? void 0 : error.message,
        });
    }
}));
// ==============================
// WebAuthn Endpoints
// ==============================
app.post('/generate-registration-options', (req, res) => {
    const { userEmail } = req.body;
    if (!userEmail) {
        return res.status(400).send('Missing userEmail');
    }
    (0, server_1.generateRegistrationOptions)({
        rpName: 'My Balance',
        rpID: process_1.default.env.RPID,
        userID: new Uint8Array(Buffer.from(userEmail, 'utf-8')),
        userName: userEmail,
        attestationType: 'none',
        authenticatorSelection: {
            residentKey: 'required',
            userVerification: 'preferred',
        },
    }).then((options) => {
        db_helper_1.DbHelper.saveAuthChallenge(userEmail, options.challenge)
            .then(() => {
            res.json(options);
        })
            .catch((error) => {
            console.error('Error saving challenge:', error);
            res.status(500).send('Error saving challenge');
        });
    });
});
app.post('/verify-registration', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userEmail, attestationResponse } = req.body;
    db_helper_1.DbHelper.getAuthChallenge(userEmail).then((row) => {
        if (!row)
            return res.status(400).send('User not found');
        const { webauthn_challenge, webauthn_challenge_created_at } = row;
        if (!webauthn_challenge)
            return res.status(400).send('No challenge stored');
        const challengeAgeMinutes = (Date.now() - new Date(webauthn_challenge_created_at).getTime()) / 1000 / 60;
        if (challengeAgeMinutes > 5)
            return res.status(400).send('Challenge expired');
        try {
            (0, server_1.verifyRegistrationResponse)({
                response: attestationResponse,
                expectedChallenge: webauthn_challenge,
                expectedOrigin: process_1.default.env.RP_ORIGIN || 'http://localhost:8100',
                expectedRPID: process_1.default.env.RPID || 'localhost',
            })
                .then((verification) => {
                if (verification.verified && verification.registrationInfo) {
                    db_helper_1.DbHelper.saveAuthChallenge(userEmail, null);
                    const credentialId = verification.registrationInfo.credential.id;
                    const publicKeyBuffer = verification.registrationInfo.credential.publicKey;
                    const counter = verification.registrationInfo.credential.counter;
                    db_helper_1.DbHelper.saveUserCredentials(userEmail, credentialId, base64url_1.default.encode(Buffer.from(publicKeyBuffer)), counter)
                        .then(() => {
                        res.json({ verified: true });
                    })
                        .catch((error) => {
                        console.error('Error saving user credentials:', error);
                        return res.status(500).send('Error saving user credentials');
                    });
                }
                else {
                    res.status(400).json({ verified: false, error: 'Verification failed' });
                }
            })
                .catch((error) => {
                console.error('Error verifying registration:', error);
                res.status(500).send(`Error verifying registration: ${error.message}`);
            });
        }
        catch (error) {
            console.error('Synchronous error in verifyRegistrationResponse:', error);
            res.status(500).send(`Synchronous error in verifyRegistrationResponse: ${error.message}`);
        }
    });
}));
app.post('/generate-auth-options', (req, res) => {
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
        userVerification: 'preferred',
    })
        .then((options) => {
        res.json(options);
    })
        .catch((error) => {
        console.error('Error retrieving user credentials:', error);
        res.status(500).send('Error retrieving user credentials');
    });
});
app.post('/verify-authentication', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { assertionResponse, challenge } = req.body;
    const userEmail = Buffer.from(assertionResponse.response.userHandle, 'base64url').toString();
    const clientCredentialId = assertionResponse.id;
    db_helper_1.DbHelper.getUserCredentials(userEmail, clientCredentialId).then((credentials) => {
        if (!credentials || credentials.length === 0) {
            console.warn(`Credential ${clientCredentialId} not found for user`, userEmail);
            return res.status(400).send('No credentials found for user');
        }
        if (!credentials[0].credentialPublicKey || credentials[0].counter === undefined) {
            console.warn('Missing credentialPublicKey or counter for user:', userEmail);
            return res.status(400).send('Invalid credential data for user');
        }
        const credentialIDString = Buffer.isBuffer(credentials[0].credentialID)
            ? (0, base64url_1.default)(credentials[0].credentialID)
            : credentials[0].credentialID;
        const credentialPublicKeyBuffer = Buffer.isBuffer(credentials[0].credentialPublicKey)
            ? credentials[0].credentialPublicKey
            : Buffer.from(credentials[0].credentialPublicKey, 'base64url');
        (0, server_1.verifyAuthenticationResponse)({
            response: assertionResponse,
            expectedChallenge: challenge,
            expectedOrigin: process_1.default.env.RP_ORIGIN || 'http://localhost:8100',
            expectedRPID: process_1.default.env.RPID || 'localhost',
            credential: {
                id: credentialIDString,
                publicKey: credentialPublicKeyBuffer,
                counter: credentials[0].counter,
            },
        })
            .then((verification) => __awaiter(void 0, void 0, void 0, function* () {
            if (verification.verified) {
                db_helper_1.DbHelper.updateUserLastAccess(userEmail).catch((error) => {
                    console.log('Error updating last access for user:', userEmail, error);
                });
                const user = yield db_helper_1.DbHelper.getUserByEmail(userEmail);
                if (!user) {
                    console.error('User not found after successful authentication:', userEmail);
                    res.status(500).json({ verified: false, error: 'User not found' });
                    return;
                }
                const tokenPayload = {
                    userId: user.user_email,
                    scopes: ['read', 'write'],
                };
                const accessToken = jwt_helper_1.JwtHelper.signAccessToken(tokenPayload);
                const refreshToken = jwt_helper_1.JwtHelper.signRefreshToken(tokenPayload);
                res.json({
                    verified: true,
                    success: true,
                    accessToken,
                    refreshToken,
                    user: {
                        id: user.id,
                        email: user.user_email,
                        name: user.user_name,
                        picture: user.user_picture,
                    },
                });
            }
            else {
                res.status(400).json({ verified: false });
            }
        }))
            .catch((error) => {
            console.log('Error verifying authentication for user:', userEmail, error);
            res.status(500).send(`Error verifying authentication: ${error.message}`);
        });
    });
}));
// ==============================
// Spreadsheet Management
// ==============================
app.post('/spreadsheet/create', requireAuth_middleware_1.RequireAuthMiddleware.verify, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userEmail = req.userId;
        const { title } = req.body;
        if (!title) {
            return res.status(400).json({
                error: 'Title is required',
            });
        }
        const deviceType = req.deviceType || 'web';
        const spreadsheetId = yield mybalance_1.SpreadsheetsHelper.createSpreadsheet(userEmail, title, deviceType);
        res.json({ success: true, data: { spreadsheetId } });
    }
    catch (error) {
        if (handleGoogleTokenError(error, res, 'createSpreadsheet'))
            return;
        console.error('Error creating spreadsheet:', error);
        res.status(500).json({
            error: 'Failed to create spreadsheet',
            details: error.message,
        });
    }
}));
app.post('/spreadsheet/initialize', requireAuth_middleware_1.RequireAuthMiddleware.verify, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userEmail = req.userId;
        const { spreadsheetId } = req.body;
        if (!spreadsheetId) {
            return res.status(400).json({
                error: 'Missing spreadsheetId in body',
            });
        }
        const deviceType = req.deviceType || 'web';
        yield mybalance_1.SpreadsheetsHelper.initializeSpreadsheet(spreadsheetId, userEmail, deviceType);
        res.json({
            success: true,
            message: 'Spreadsheet initialized successfully',
        });
    }
    catch (error) {
        if (handleGoogleTokenError(error, res, 'initializeSpreadsheet'))
            return;
        console.error('Error initializing spreadsheet:', error);
        res.status(500).json({
            error: 'Failed to initialize spreadsheet',
            details: error.message,
        });
    }
}));
app.get('/spreadsheet/validate', requireAuth_middleware_1.RequireAuthMiddleware.verify, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userEmail = req.userId;
        let spreadsheetId = req.query.spreadsheet_id;
        if (!spreadsheetId) {
            spreadsheetId = yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
        }
        if (!spreadsheetId) {
            return res.status(400).json({
                success: false,
                error: 'Missing spreadsheet_id in query params and no default spreadsheet configured',
            });
        }
        const deviceType = req.deviceType || 'web';
        const validation = yield mybalance_1.SpreadsheetsHelper.validateSpreadsheetStructure(spreadsheetId, userEmail, deviceType);
        res.json({ success: true, data: validation });
    }
    catch (error) {
        if (handleGoogleTokenError(error, res, 'validateSpreadsheet'))
            return;
        console.error('Error validating spreadsheet:', error);
        res.status(500).json({
            error: 'Failed to validate spreadsheet',
            details: error.message,
        });
    }
}));
app.post('/spreadsheet/complete-setup', requireAuth_middleware_1.RequireAuthMiddleware.verify, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userEmail = req.userId;
        yield db_helper_1.DbHelper.setSetupComplete(userEmail, true);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error completing setup:', error);
        res.status(500).json({
            error: 'Failed to complete setup',
            details: error.message,
        });
    }
}));
app.post('/spreadsheet/migrate', requireAuth_middleware_1.RequireAuthMiddleware.verify, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userEmail = req.userId;
        const deviceType = req.deviceType || 'web';
        console.log(`🔄 Migration request from ${userEmail}`);
        const result = yield mybalance_1.MigrationHelper.executePendingMigrations(userEmail, deviceType);
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        if (handleGoogleTokenError(error, res, 'executeMigration'))
            return;
        console.error('Error executing migration:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to execute migration',
            details: error.message,
        });
    }
}));
app.get('/spreadsheet/template', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const templateData = mybalance_1.SpreadsheetsHelper.getTemplateData();
        res.json({ success: true, data: templateData });
    }
    catch (error) {
        console.error('Error getting template data:', error);
        res.status(500).json({
            error: 'Failed to get template data',
            details: error.message,
        });
    }
}));
// ==============================
// Catch-all 404
// ==============================
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
// ==============================
// Server Start
// ==============================
app.listen(port, () => {
    console.log('🚀 =================================');
    console.log(`🚀 MyBalance API Server is running on port ${port}`);
    console.log('🚀 =================================');
    console.log(`🚀 Environment: ${process_1.default.env.NODE_ENV || 'development'}`);
    console.log(`🚀 CORS Allowed Origins: ${allowedOrigins.join(', ')}`);
    console.log('🚀 =================================');
});
//# sourceMappingURL=index.js.map