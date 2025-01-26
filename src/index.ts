import express from 'express'
import bodyParser from 'body-parser'
import process from 'process';
import { GoogleHelper } from './helpers/GoogleHelper';
import { google } from 'googleapis/build/src';
import cors from 'cors';
import { URLSearchParams } from 'url';
import { MyBalanceHelper } from './helpers/MyBalanceHelper';


const app = express()
const port = process.env.PORT || 8080

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'access_token', 'refresh_token'],
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
    console.log("now in get")
    try {
        const authHeaders = GoogleHelper.parseAuthHeaders(req.headers);
        const authClient = google.auth.fromJSON(authHeaders);

        GoogleHelper.get(authClient, req.query.spreadsheetId, req.query.range)
            .then((items) => {
                res.send(items)
            })
            .catch((ex) => {
                res.status(400).send(`Error. ex: ${ex.message}`)
            })
    } catch (ex) {
        console.log(ex)
        res.status(500).send(`Error. ex: ${ex.message}`)
    }
})

app.post('/update', async (req: any, res: any) => {

    try {
        const authHeaders = GoogleHelper.parseAuthHeaders(req.headers);
        const authClient = google.auth.fromJSON(authHeaders);
        const body = req.body;
        console.log(body)
        GoogleHelper.update(authClient, req.query.spreadsheetId, body)
            .then((items) => {
                res.send(items)
            })
            .catch((ex) => {
                res.status(400).send(`Error. ex: ${ex.message}`)
            })
    } catch (ex) {
        res.status(500).send(`Error. ex: ${ex.message}`)
    }
})

app.post('/addMovement', async (req: any, res: any) => {
    try {
        const authHeaders = GoogleHelper.parseAuthHeaders(req.headers);
        const authClient = google.auth.fromJSON(authHeaders);
        const body = req.body;
        MyBalanceHelper.AppendMovement(authClient, req.query.spreadsheetId, body)
            .then((items:any) => {
                res.status(200).send("OK")
            })
            .catch((ex:any) => {
                res.status(400).send(`Error. ex: ${ex.message}`)
            })
    } catch (ex) {
        res.status(500).send(`Error. ex: ${ex.message}`)
    }
})

app.post('/append', async (req: any, res: any) => {
    try {
        const authHeaders = GoogleHelper.parseAuthHeaders(req.headers);
        const authClient = google.auth.fromJSON(authHeaders);
        console.log("requestbody:",req)
        const body = req.body;
        GoogleHelper.append(authClient, req.query.spreadsheetId, req.query.range, body)
            .then((items) => {
                res.send(items)
            })
            .catch((ex) => {
                res.status(400).send(`Error. ex: ${ex.message}`)
            })
    } catch (ex) {
        res.status(500).send(`Error. ex: ${ex.message}`)
    }
})

app.get('/auth', (req: any, res: any) => {
    GoogleHelper.authenticate(req).then((authUrl) => {
        res.send({url:authUrl})
    }).catch()
})

app.get('/getToken', (req: any, res: any) => {
    GoogleHelper.authorize(req.query.code).then((tokens) => {
        res.send(tokens)
    }).catch((ex)=>{
        res.status(500).send(ex.message)
    })
})

app.get('/checkCredentials', async(req: any, res: any) => {
    const authHeaders = GoogleHelper.parseAuthHeaders(req.headers)
    await GoogleHelper.checkCredentials(authHeaders).then((r)=>{
        if(r){
            res.status(200).send(r)
        }else{
            res.status(401).send("Unauthorized")
        }
    }).catch((ex)=>{
        res.status(500).send(ex.message)
    })
})


app.listen(port, () => {
    return console.log(`Server is listening on ${port}`)
})   