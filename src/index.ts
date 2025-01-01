import express, { Request, Response } from 'express'
import fs,{promises} from 'fs';
import path from 'path';
import process from 'process';

import { authenticate } from '@google-cloud/local-auth/build/src';
import {google} from 'googleapis'

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

async function loadSavedCredentialsIfExist() {
    try {
      const content = await promises.readFile(TOKEN_PATH, 'utf8');
      const credentials = JSON.parse(content);
      return google.auth.fromJSON(credentials);
    } catch (err) {
      return null;
    }
}

async function saveCredentials(client: any) {
    const content = await promises.readFile(CREDENTIALS_PATH, 'utf8');
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
      type: 'authorized_user',
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile(TOKEN_PATH, payload, (err) => {
        if (err) throw err;
    });
}

async function authorize() {
    let client: any = await loadSavedCredentialsIfExist();
    if (client) {
      return client;
    }
    client = await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
      await saveCredentials(client);
    }
    return client;
  }

  async function listMajors(auth:any) {
    const sheets = google.sheets({version: 'v4', auth});
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
      range: 'Class Data!A2:E',
    });
    const rows = res.data.values;
    if (!rows || rows.length === 0) {
      console.log('No data found.');
      return;
    }
    console.log('Name, Major:');
    rows.forEach((row) => {
      // Print columns A and E, which correspond to indices 0 and 4.
      console.log(`${row[0]}, ${row[4]}`);
    });
    return rows
  }

  const app = express()
  const port = process.env.PORT || 8080

  app.get('/', (req:any, res:any) => {
    authorize().then((auth)=>{
        listMajors(auth).then((majors)=>{
            console.log(majors)
            return res.send(majors.toString())
        })}).catch(()=>{
            return res.send("error")
        });

  })

  app.get('/ping', (_req: any, res: any) => {
    return res.send('pong 🏓')
  })

  app.listen(port, () => {
    return console.log(`Server is listening on ${port}`)
  })