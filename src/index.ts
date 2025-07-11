import express from 'express'
import bodyParser from 'body-parser'
import process from 'process';
import { GoogleHelper } from './helpers/GoogleHelper';
import { google } from 'googleapis/build/src';
import cors from 'cors';
import { URLSearchParams } from 'url';
import { MyBalanceHelper } from './helpers/MyBalanceHelper';
import { inject } from "@vercel/analytics"
import { DbHelper } from './helpers/DbHelper';
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';
import base64url from 'base64url/dist/base64url';


const app = express()
const port = process.env.PORT || 8080

app.use(cors({
    origin: 'https://my-balance-ionic.vercel.app',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'access_token', 'refresh_token'],
    exposedHeaders: ['Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials'],
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

app.get('/retrieveDbCredentials', async (req: any, res: any) => {
    try {
        DbHelper.getDbCredentials(req.headers.user_email, DbHelper.hashPin(req.headers.pin)).then((info) => {
            if(info)
                res.status(200).send({
                token: DbHelper.decryptToken(info.token, req.headers.pin),
                spreadsheetId: info.spreadsheet_id
                })
            else 
                res.status(401).send("Unauthorized")
        })
    }catch(ex){
        res.status(500).send("Error. ex: "+ex.message)
    }
})


app.get('/get',async (req: any, res: any) => {
    console.log("get")
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
        res.status(500).send(`Error. ex: ${ex.message}`)
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


app.post('/saveCredentials', async(req: any, res: any) => {
    console.log("saveCredentials")
    try {
        const r=await DbHelper.saveUserToken(req.body.user_email,req.body.token)
        res.send({ status: "OK" });
    }catch(ex){
            console.error(ex)

        res.status(500).send(ex.message)
    }
})

app.post('/generate-registration-options', (req:any, res:any) => {
    console.log("generate-registration-options")

    const { userEmail } = req.body;

  if (!userEmail ) {
    return res.status(400).send("Missing userEmail");
  }

  // Genera challenge e opzioni per la registrazione
  generateRegistrationOptions({
    rpName: 'My Balance',
    rpID: process.env.RPID, // Sostituisci con il tuo
    userID: new Uint8Array(Buffer.from(userEmail, 'utf-8')),
    userName: userEmail,
    attestationType: 'none', 
    authenticatorSelection: {
    residentKey: 'required',
    userVerification: 'preferred',
    },
  }).then((options)=>{
    DbHelper.saveAuthChallenge(userEmail, options.challenge).then(()=>{
      res.json(options);
    }).catch((error) => {
      console.error('Error saving challenge:', error);
      res.status(500).send("Error saving challenge");
    });
})
});


app.post('/generate-auth-options', (req:any, res:any) => {
    console.log("generate-auth-options")
    
    generateAuthenticationOptions({
        rpID: process.env.RPID, // Sostituisci con il tuo
        userVerification: 'preferred'
    }).then((options)=>{
        // DbHelper.saveAuthChallenge(userEmail, options.challenge).then(()=>{
        res.json(options);
        // }).catch((error) => {
        //     console.error('Error saving challenge:', error);
        //     res.status(500).send("Error saving challenge");
        // });
    }).catch((error) => {
        console.error('Error retrieving user credentials:', error);
        res.status(500).send("Error retrieving user credentials");
    });
        
});


app.post('/verify-registration', async (req:any, res:any) => {
  console.log("verify-registration")
    const { userEmail, attestationResponse } = req.body;

  // Recupera utente e challenge
    DbHelper.getAuthChallenge(userEmail).then((row)=>{
        if (!row) return res.status(400).send("User not found");
        const { webauthn_challenge, webauthn_challenge_created_at } = row;
        if (!webauthn_challenge) return res.status(400).send("No challenge stored");
        const challengeAgeMinutes = (Date.now() - new Date(webauthn_challenge_created_at).getTime()) / 1000 / 60;
        if (challengeAgeMinutes > 5) return res.status(400).send("Challenge expired");
        verifyRegistrationResponse({
            response: attestationResponse, 
            expectedChallenge: webauthn_challenge, 
            expectedOrigin: process.env.RP_ORIGIN || "http://localhost:8100", 
            expectedRPID: process.env.RPID || "localhost" 
        }).then((verification) => {
            if (verification.verified && verification.registrationInfo) {
                DbHelper.saveAuthChallenge(userEmail, null);
                DbHelper.saveUserCredentials(
                    userEmail, 
                    verification.registrationInfo.credential.id,
                    base64url.encode(Buffer.from(verification.registrationInfo.credential.publicKey)),
                    verification.registrationInfo.credential.counter 
                ).catch((error) => {
                    console.error('Error saving user credentials:', error);
                    return res.status(500).send("Error saving user credentials");
                });
                res.json({ verified: true });
            }else{
                res.status(400).json({ verified: false, error: 'Verification failed' });
            }
        });
    });
});


app.post('/verify-authentication', async (req, res) => {
  const {  assertionResponse, challenge } = req.body;
    const userEmail = Buffer.from(assertionResponse.response.userHandle, 'base64url').toString();

console.log("verify-authentication for user:", userEmail);
  DbHelper.getUserCredentials(userEmail).then((credentials)=>{
            if (!credentials || credentials.length === 0 ) {
                console.warn("No credentials found for user:", userEmail);
                return res.status(400).send("No credentials found for user");
            }
            if (!credentials[0].credentialPublicKey || credentials[0].counter === undefined) {
                console.warn("Missing credentialPublicKey or counter for user:", userEmail);
                return res.status(400).send("Invalid credential data for user");
            }
            verifyAuthenticationResponse({
                response: assertionResponse,
                expectedChallenge: challenge,
                expectedOrigin: process.env.RP_ORIGIN || "http://localhost:8100",
                expectedRPID: process.env.RPID || "localhost",
                credential: {
                    id: credentials[0].credentialID,
                    publicKey: credentials[0].credentialPublicKey, // Assicurati che sia in formato base64url
                    counter: credentials[0].counter // Assicurati che il counter sia un numero valido
                },
            } as any).then((verification:any)=>{
                if (verification.verified) {
                    // Aggiorna counter in DB
                    //await updateCounter(userId, verification.authenticationInfo.newCounter);
                    // Login riuscito → genera sessione / token JWT / refresh token
                    console.log("Authentication successful for user:", userEmail);
                    res.json({ verified: true, token: credentials[0].token, userEmail: userEmail });
                } else {
                    console.log("Authentication failed for user:", userEmail);
                    res.status(400).json({ verified: false });
                }
            }).catch((error) => {
                console.log("Error verifying authentication for user:", userEmail, error);
                res.status(500).send(`Error verifying authentication: ${error.message}`);
            })
        
        })
  
})


app.listen(port, () => {
    return console.log(`Server is listening on ${port}`)
})   