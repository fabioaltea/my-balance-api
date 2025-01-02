import express from 'express'
import bodyParser from 'body-parser'
import process from 'process';
import { GoogleHelper } from './helpers/GoogleHelper';
import { google } from 'googleapis/build/src';


const app = express()
const port = process.env.PORT || 8080

app.use(express.json())
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.raw());

app.get('/', (req: any, res: any) => {
    res.send("API Working")

})

app.get('/get', async (req: any, res: any) => {
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
    GoogleHelper.authorize().then((auth) => {
        res.send(auth)
    })
})


app.listen(port, () => {
    return console.log(`Server is listening on ${port}`)
})