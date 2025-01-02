import fs, { promises } from 'fs';
import path from 'path';
import process from 'process';

import { authenticate } from '@google-cloud/local-auth/build/src';
import { google, Auth } from 'googleapis';
import crypto from 'crypto'


export class GoogleHelper {
    private static SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

    private static getCredentials(){
        return {
            installed: {
            auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
            auth_uri: process.env.AUTH_URI,
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            project_id: process.env.PROJECT_ID,
            redirect_uris: process.env.REDIRECT_URIS ? process.env.REDIRECT_URIS.split(',') : [],
            token_uri: process.env.TOKEN_URI
            }
        };
    }

    public static async authorize(req:any): Promise<string> {
        const oauth2Client = new google.auth.OAuth2(
            "1034336371411-9bld4rsek32mmqhn30fh5ae7ou4asm37.apps.googleusercontent.com",
            "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",
            "http://localhost:8080"
          );

        const authorizationUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: this.SCOPES,
            include_granted_scopes: true, 
          });

          return authorizationUrl

        // let client: Auth.OAuth2Client;
        // client = await authenticate({
        //     scopes: this.SCOPES,
        //     keyfilePath: this.CREDENTIALS_PATH,
        // });
        // const content = await promises.readFile(this.CREDENTIALS_PATH, 'utf8');

        // const keys = JSON.parse(content);
        // const key = keys.installed || keys.web;
        // const payload = JSON.stringify({
        //     type: 'authorized_user',
        //     client_id: key.client_id,
        //     client_secret: key.client_secret,
        //     refresh_token: client.credentials.refresh_token || '',
        //     access_token: client.credentials.access_token || ''
        // });
        // console.log(client)
        // return payload;
    }

    public static parseAuthHeaders(headers:any){
        const requiredHeaders = ['type', 'access_token', 'refresh_token', 'client_secret', 'client_id'];
        const missingHeaders = requiredHeaders.filter(header => !headers[header] || headers[header] === '');

        if (missingHeaders.length > 0) {
            throw new Error(`Missing or invalid authentication headers: ${missingHeaders.join(', ')}`);
        }

        return {
            type: headers.type,
            access_token: headers.access_token,
            refresh_token: headers.refresh_token,
            client_secret: headers.client_secret,
            client_id: headers.client_id
        };
    }

    public static async get(auth:any, spreadsheetId:string, range:string){
        if(!spreadsheetId && !range){
            throw new Error('Missing or invalid parameters: spreadsheetId, range');
        }    
        if (!spreadsheetId || spreadsheetId=="") {
            throw new Error('Missing or invalid parameter: spreadsheetId');
        }
        if (!range || range=="") {
            throw new Error('Missing or invalid parameter: range');
        }

        try {
            const sheets = google.sheets({ version: 'v4', auth });
            const res = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: range
        });
        const rows = res.data.values;
        if (!rows || rows.length === 0) {
            console.log('No data found.');
            return;
        }

        return rows
        } catch (error) {
            console.error('Error fetching items:', error);
            throw new Error(`Failed to fetch items from Google Sheets. Error: ${error}`);
        }
    }

    public static async update(auth:any, spreadsheetId:string, body:any){
        if(!spreadsheetId && !body){
            throw new Error('Missing or invalid parameters: spreadsheetId, range');
        }    
        if (!spreadsheetId || spreadsheetId=="") {
            throw new Error('Missing or invalid parameter: spreadsheetId');
        }
        if (!body) {
            throw new Error('Missing or invalid parameter: range');
        }

        try {
            const sheets = google.sheets({ version: 'v4', auth });
            const res = await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId:spreadsheetId,
                requestBody:body
              })
            
              if(res.status){
                return res
              }else{
                throw new Error()
              }
        } catch (error) {
            console.error('Error fetching items:', error);
            throw new Error(`Failed to fetch items from Google Sheets. Error: ${error}`);
        }
    }

    public static async append(auth:any, spreadsheetId:string, range:string, body:any){
        if(!spreadsheetId && !body){
            throw new Error('Missing or invalid parameters: spreadsheetId, range');
        }    
        if (!spreadsheetId || spreadsheetId=="") {
            throw new Error('Missing or invalid parameter: spreadsheetId');
        }
        if (!body) {
            throw new Error('Missing or invalid parameter: range');
        }

        try {
            const sheets = google.sheets({ version: 'v4', auth });
            const res = await sheets.spreadsheets.values.append({
                spreadsheetId:spreadsheetId,
                requestBody:body,
                range:range,
                valueInputOption:"RAW"
              })
            
              if(res.status){
                return res
              }else{
                throw new Error()
              }
        } catch (error) {
            console.error('Error fetching items:', error);
            throw new Error(`Failed to fetch items from Google Sheets. Error: ${error}`);
        }
    }

}