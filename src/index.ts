import express from 'express'
import bodyParser from 'body-parser'
import process from 'process';
import { GoogleHelper } from './helpers/GoogleHelper';
import { google } from 'googleapis/build/src';
import cors from 'cors';
import { URLSearchParams } from 'url';


const app = express()
const port = process.env.PORT || 8080

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Access-Control-Allow-Origin'],
    credentials: true
}));

app.options('*', cors());
app.use(express.json())
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.raw());


app.get('/', (req: any, res: any) => {
    res.send("API Working")
})

app.get('/get',async (req: any, res: any) => {

    try {
        const authHeaders = GoogleHelper.parseAuthHeaders(req.headers);
        const authClient = google.auth.fromJSON(authHeaders);

        GoogleHelper.get(authClient, req.query.spreadsheetId, req.query.range)
            .then((items) => {
                res.send(items)
            })
            .catch((ex) => {
                res.send(`Error. ex: ${ex.message}`, 400)
            })
    } catch (ex) {
        res.send(`Error. ex: ${ex.message}`, 500)
    }
})

app.post('/update', async (req: any, res: any) => {

    try {
        const authHeaders = GoogleHelper.parseAuthHeaders(req.headers);
        const authClient = google.auth.fromJSON(authHeaders);
        const body = req.body;
        GoogleHelper.update(authClient, req.query.spreadsheetId, body)
            .then((items) => {
                res.send(items)
            })
            .catch((ex) => {
                res.send(`Error. ex: ${ex.message}`, 400)
            })
    } catch (ex) {
        res.send(`Error. ex: ${ex.message}`, 500)
    }
})

app.post('/append', async (req: any, res: any) => {
    try {
        const authHeaders = GoogleHelper.parseAuthHeaders(req.headers);
        const authClient = google.auth.fromJSON(authHeaders);
        const body = req.body;
        GoogleHelper.append(authClient, req.query.spreadsheetId, req.query.range, body)
            .then((items) => {
                res.send(items)
            })
            .catch((ex) => {
                res.send(`Error. ex: ${ex.message}`, 400)
            })
    } catch (ex) {
        res.send(`Error. ex: ${ex.message}`, 500)
    }
})

app.get('/auth', (req: any, res: any) => {
    console.log("Now in /auth") 

    GoogleHelper.authenticate(req).then((authUrl) => {
        res.send({url:authUrl})
    }).catch()
})

app.get('/getToken', (req: any, res: any) => {
    
    console.log("Now in getToken")
    GoogleHelper.authorize(req.query.code).then((tokens) => {
        console.log("authorize ok, tokens: ",tokens)
        res.send(tokens)
    }).catch((ex)=>{
        console.log("authorize ko, exception: ",ex.message)

        res.send(ex.message, 500)
    })
})


app.listen(port, () => {
    return console.log(`Server is listening on ${port}`)
})