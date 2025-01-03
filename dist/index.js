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
const app = (0, express_1.default)();
const port = process_1.default.env.PORT || 8080;
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Access-Control-Allow-Origin'],
    credentials: true
}));
app.options('*', (0, cors_1.default)());
app.use(express_1.default.json());
app.use(body_parser_1.default.urlencoded({ extended: true }));
app.use(body_parser_1.default.json());
app.use(body_parser_1.default.raw());
app.get('/', (req, res) => {
    res.send("API Working");
});
app.get('/get', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeaders = GoogleHelper_1.GoogleHelper.parseAuthHeaders(req.headers);
        const authClient = src_1.google.auth.fromJSON(authHeaders);
        GoogleHelper_1.GoogleHelper.get(authClient, req.query.spreadsheetId, req.query.range)
            .then((items) => {
            res.send(items);
        })
            .catch((ex) => {
            res.send(`Error. ex: ${ex.message}`, 400);
        });
    }
    catch (ex) {
        res.send(`Error. ex: ${ex.message}`, 500);
    }
}));
app.post('/update', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeaders = GoogleHelper_1.GoogleHelper.parseAuthHeaders(req.headers);
        const authClient = src_1.google.auth.fromJSON(authHeaders);
        const body = req.body;
        GoogleHelper_1.GoogleHelper.update(authClient, req.query.spreadsheetId, body)
            .then((items) => {
            res.send(items);
        })
            .catch((ex) => {
            res.send(`Error. ex: ${ex.message}`, 400);
        });
    }
    catch (ex) {
        res.send(`Error. ex: ${ex.message}`, 500);
    }
}));
app.post('/append', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeaders = GoogleHelper_1.GoogleHelper.parseAuthHeaders(req.headers);
        const authClient = src_1.google.auth.fromJSON(authHeaders);
        const body = req.body;
        GoogleHelper_1.GoogleHelper.append(authClient, req.query.spreadsheetId, req.query.range, body)
            .then((items) => {
            res.send(items);
        })
            .catch((ex) => {
            res.send(`Error. ex: ${ex.message}`, 400);
        });
    }
    catch (ex) {
        res.send(`Error. ex: ${ex.message}`, 500);
    }
}));
app.get('/auth', (req, res) => {
    console.log("Request headers: ", req.headers);
    GoogleHelper_1.GoogleHelper.authorize(req).then((authUrl) => {
        res.send({ url: authUrl });
    });
});
app.listen(port, () => {
    return console.log(`Server is listening on ${port}`);
});
//# sourceMappingURL=index.js.map