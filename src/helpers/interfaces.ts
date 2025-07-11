export interface IGetBody{
    spreadsheetId:string,
    range:string
}

export interface IUpdateBody{
    spreadsheetId:string,
    requestBody:{
        valueInputOption:"RAW" | "USER_ENTERED",
        data:IUpdateBodyData[]
    }
}

export interface IUpdateBodyData{
    majorDimension:"ROWS" | "COLUMNS",
    range:string,
    values:any[]
}

export interface IAppendBody{
    spreadsheetId:string,
    range:string,
    requestBody:{}
    valueInputOption:"RAW" | "USER_ENTERED",
}