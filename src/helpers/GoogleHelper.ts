

import { google } from 'googleapis';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' }); 


export class GoogleHelper {
    private static SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/userinfo'];

    // public static oauth2Client = new google.auth.OAuth2(
    //     "1034336371411-c26vlds0a64po2m69jb21mtnpsdeius5.apps.googleusercontent.com",
    //     "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",
    //     "http://localhost:8100"
    // );

    public static oauth2Client = new google.auth.OAuth2(
        process.env.CLIENT_ID,
        process.env.CLIENT_SECRET,
        process.env.REDIRECT_URI
    );

    public static async authenticate(req: any): Promise<string> {
       
        const authorizationUrl = this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: this.SCOPES,
            include_granted_scopes: true,
        });

        return authorizationUrl
    }

    public static async authorize(queryCode: any): Promise<any> {
        
        try {
            const code = decodeURIComponent(queryCode);
            const { tokens } = await this.oauth2Client.getToken(code);
            return tokens;
        } catch (ex) {
            console.log(ex)
            throw new Error(ex);
        }
    }

    public static async checkCredentials(auth:any):Promise<any|null>{
        try{
            var OAuth2 = google.auth.OAuth2;
            var oauth2Client = new OAuth2(
                auth.client_id, auth.client_secret, ""
            );
            oauth2Client.setCredentials({
                refresh_token:auth.refresh_token,
            })
            var oauth2=google.oauth2({
                auth:oauth2Client,
                version:'v2'
            });
            const {data}= await oauth2.userinfo.get()
            return data
            
            
        }catch(ex){
            console.log(ex)
            throw new Error(ex);
        }
    }



    public static parseAuthHeaders(headers: any) {
        const requiredHeaders = [ 'refresh_token'];
        const missingHeaders = requiredHeaders.filter(header => !headers[header] || headers[header] === '');

        if (missingHeaders.length > 0) {
            throw new Error(`Missing or invalid authentication headers: ${missingHeaders.join(', ')}`);
        }

        return {
            type: "authorized_user",
            access_token: headers.access_token,
            refresh_token: headers.refresh_token,
            client_secret: process.env.CLIENT_SECRET,
            client_id: process.env.CLIENT_ID
        };
    }
    
    public static async get(auth: any, spreadsheetId: string, range: string) {
        if (!spreadsheetId && !range) {
            throw new Error('Missing or invalid parameters: spreadsheetId, range');
        }
        if (!spreadsheetId || spreadsheetId == "") {
            throw new Error('Missing or invalid parameter: spreadsheetId');
        }
        if (!range || range == "") {
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

    public static async update(auth: any, spreadsheetId: string, body: any) {

        if (!spreadsheetId && !body) {
            throw new Error('Missing or invalid parameters: spreadsheetId, range');
        }
        if (!spreadsheetId || spreadsheetId == "") {
            throw new Error('Missing or invalid parameter: spreadsheetId');
        }
        if (!body) {
            throw new Error('Missing or invalid parameter: body');
        }

        try {
            const sheets = google.sheets({ version: 'v4', auth });
            const res = await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: spreadsheetId,
                requestBody: {
                    valueInputOption:"USER_ENTERED",
                    data:body
                }
            })

            if (res.status) {
                return res
            } else {
                throw new Error()
            }
        } catch (error) {
            console.error('Error fetching items:', error);
            throw new Error(`Failed to fetch items from Google Sheets. Error: ${error}`);
        }
    }

    public static async append(auth: any, spreadsheetId: string, range: string, body: any) {
        if (!spreadsheetId && !body) {
            throw new Error('Missing or invalid parameters: spreadsheetId, range');
        }
        if (!spreadsheetId || spreadsheetId == "") {
            throw new Error('Missing or invalid parameter: spreadsheetId');
        }
        if (!body) {
            throw new Error('Missing or invalid parameter: range');
        }

        try {
            const sheets = google.sheets({ version: 'v4', auth });
            const res = await sheets.spreadsheets.values.append({
                spreadsheetId: spreadsheetId,
                requestBody: body,
                range: range,
                valueInputOption: "RAW"
            })

            if (res.status) {
                return res
            } else {
                throw new Error()
            }
        } catch (error) {
            console.error('Error fetching items:', error);
            throw new Error(`Failed to fetch items from Google Sheets. Error: ${error}`);
        }
    }

}