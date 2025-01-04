

import { google } from 'googleapis';


export class GoogleHelper {
    private static SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

    public static oauth2Client = new google.auth.OAuth2(
        "1034336371411-9bld4rsek32mmqhn30fh5ae7ou4asm37.apps.googleusercontent.com",
        "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",
        "http://localhost:8100/acceptLogin"
    );

    // public static oauth2Client = new google.auth.OAuth2(
    //     process.env.CLIENT_ID,
    //     process.env.CLIENT_SECRET,
    //     process.env.REDIRECT_URI
    // );

    public static async authenticate(req: any): Promise<string> {
       
        console.log(this.oauth2Client._clientId, " ", this.oauth2Client._clientSecret)
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
            throw new Error(ex);
        }
    }



    public static parseAuthHeaders(headers: any) {
        // const requiredHeaders = ['type', 'access_token', 'refresh_token', 'client_secret', 'client_id'];
        const requiredHeaders = ['access_token', 'refresh_token'];
        const missingHeaders = requiredHeaders.filter(header => !headers[header] || headers[header] === '');

        if (missingHeaders.length > 0) {
            throw new Error(`Missing or invalid authentication headers: ${missingHeaders.join(', ')}`);
        }

        return {
            type: "authorized_user",
            access_token: headers.access_token,
            refresh_token: headers.refresh_token,
            client_secret: "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",
            client_id: "1034336371411-9bld4rsek32mmqhn30fh5ae7ou4asm37.apps.googleusercontent.com"
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
                    valueInputOption:"RAW",
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