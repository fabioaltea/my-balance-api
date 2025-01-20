import { GoogleApis } from "googleapis/build/src"
import { GoogleHelper } from "./GoogleHelper"


export type Transaction={
    description:string,
    category:string,
    amount:string,
    date:string,
    location:string,
    transactionId:string,
    movementId:string,
    dateAdded:string,
    dateModified:string,
    dateDeleted:string,
    recurrenceId:string,
    status:string
}

export class MyBalanceHelper{
    public static async AppendMovement(auth:any, spreadsheetId:string,body:any){
        // let tResult: any[][] = []
        // for (const transaction of movement) {
        //     tResult.push([
        //         `${transaction.description}`,
        //         `${transaction.category}`,
        //         `${transaction.amount}`,
        //         `${transaction.date}`,
        //         `${transaction.status}`,
        //         `${transaction.location}`,
        //         `${transaction.transactionId}`,
        //         `${transaction.movementId}`,
        //         "",
        //         `${transaction.location}`,
        //         "",
        //         `${transaction.dateAdded}`,
        //         `${transaction.dateModified}`
        //     ])
        // }

        return await GoogleHelper.append(auth,spreadsheetId,"AllTransactions!A:Z",body);
    }
}