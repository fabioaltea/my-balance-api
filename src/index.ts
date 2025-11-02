import express from "express";
import bodyParser from "body-parser";
import process from "process";
import { GoogleHelper } from "./helpers/GoogleHelper";
import { google } from "googleapis/build/src";
import cors from "cors";
import { URLSearchParams } from "url";
import { TransactionsHelper } from "./helpers/MyBalance/TransactionsHelper";
import { AccountsHelper } from "./helpers/MyBalance/AccountsHelper";
import { CategoriesHelper } from "./helpers/MyBalance/CategoriesHelper";
import { SpreadsheetsHelper } from "./helpers/MyBalance/SpreadsheetsHelper";
import { inject } from "@vercel/analytics";
import { DbHelper } from "./helpers/DbHelper";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import base64url from "base64url/dist/base64url";

const app = express();
const port = process.env.PORT || 8080;

const corsOptions = {
  origin: process.env.ORIGIN_URL || "http://localhost:8100",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "access_token",
    "refresh_token",
    "spreadsheet_id",
  ],
  exposedHeaders: [
    "Access-Control-Allow-Origin",
    "Access-Control-Allow-Credentials",
  ],
  credentials: true,
};

app.use(cors(corsOptions));

app.options("*", cors(corsOptions));

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.raw());

app.use((req, res, next) => {
  console.log("Passing through express. REQ:", req.method, req.url);
  next();
});

app.get("/", (req: any, res: any) => {
  res.send("API Working");
});

//#region Google Sheets

app.get("/get", async (req: any, res: any) => {
  console.log("get");
  try {
    const authHeaders = GoogleHelper.parseAuthHeaders(req.headers);
    const authClient = google.auth.fromJSON(authHeaders);
    const spreadsheetId = req.headers.spreadsheet_id;

    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: "Missing spreadsheet_id in headers",
      });
    }

    const items = await GoogleHelper.get(
      authClient,
      spreadsheetId,
      req.query.range
    );
    res.json({ success: true, data: items });
  } catch (error: any) {
    console.error("Error in get:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get data",
      details: error?.message,
    });
  }
});

app.post("/update", async (req: any, res: any) => {
  try {
    const authHeaders = GoogleHelper.parseAuthHeaders(req.headers);
    const authClient = google.auth.fromJSON(authHeaders);
    const spreadsheetId = req.headers.spreadsheet_id;

    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: "Missing spreadsheet_id in headers",
      });
    }

    const body = req.body;
    const items = await GoogleHelper.update(authClient, spreadsheetId, body);
    res.json({ success: true, data: items });
  } catch (error: any) {
    console.error("Error in update:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update data",
      details: error?.message,
    });
  }
});

app.post("/addMovement", async (req: any, res: any) => {
  try {
    const authHeaders = GoogleHelper.parseAuthHeaders(req.headers);
    const authClient = google.auth.fromJSON(authHeaders);
    const spreadsheetId = req.headers.spreadsheet_id;

    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: "Missing spreadsheet_id in headers",
      });
    }

    const body = req.body; // Dovrebbe essere IMovementRequest o compatibile

    // Backwards compatibility: se il body ha il vecchio formato, convertiamo
    if (body.movementId && body.description && !body.transactions) {
      // Formato legacy: singolo movimento diventa array di 1 transaction
      const movementRequest = {
        movementId: body.movementId,
        description: body.description,
        category: body.category || "",
        date: body.date || new Date().toISOString().split("T")[0],
        type: body.type || "",
        location: body.location || "",
        notes: body.notes || "",
        recurrenceId: body.recurrenceId || "",
        transactions: [
          {
            amount: body.amount || 0,
            account: body.account || "",
            _operation: "create" as const,
          },
        ],
      };
      await TransactionsHelper.appendMovement(
        authClient,
        spreadsheetId,
        movementRequest
      );
    } else {
      // Nuovo formato
      await TransactionsHelper.appendMovement(authClient, spreadsheetId, body);
    }

    res.json({ success: true, data: "Movement added successfully" });
  } catch (error: any) {
    console.error("Error adding movement:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add movement",
      details: error?.message,
    });
  }
});

app.post("/append", async (req: any, res: any) => {
  try {
    const authHeaders = GoogleHelper.parseAuthHeaders(req.headers);
    const authClient = google.auth.fromJSON(authHeaders);
    const spreadsheetId = req.headers.spreadsheet_id;

    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: "Missing spreadsheet_id in headers",
      });
    }

    const body = req.body;
    const items = await GoogleHelper.append(
      authClient,
      spreadsheetId,
      req.query.range,
      body
    );
    res.json({ success: true, data: items });
  } catch (error: any) {
    console.error("Error in append:", error);
    res.status(500).json({
      success: false,
      error: "Failed to append data",
      details: error?.message,
    });
  }
});

// New RESTful movements endpoints
app.get("/movements", async (req: any, res: any) => {
  try {
    const authHeaders = GoogleHelper.parseAuthHeaders(req.headers);
    const authClient = google.auth.fromJSON(authHeaders);
    const spreadsheetId = req.headers.spreadsheet_id;

    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: "Missing spreadsheet_id in headers",
      });
    }

    const movements = await TransactionsHelper.listMovements(
      authClient,
      spreadsheetId
    );
    res.json({ success: true, data: movements });
  } catch (error: any) {
    console.error("Error fetching movements:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch movements",
      details: error?.message,
    });
  }
});

app.get("/movements/:movementId", async (req: any, res: any) => {
  try {
    const authHeaders = GoogleHelper.parseAuthHeaders(req.headers);
    const authClient = google.auth.fromJSON(authHeaders);
    const { movementId } = req.params;
    const spreadsheetId = req.headers.spreadsheet_id;

    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: "Missing spreadsheet_id in headers",
      });
    }

    const movement = await TransactionsHelper.getMovement(
      authClient,
      spreadsheetId,
      movementId
    );

    if (!movement) {
      return res.status(404).json({
        success: false,
        error: "Movement not found",
      });
    }

    res.json({ success: true, data: movement });
  } catch (error: any) {
    console.error("Error fetching movement:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch movement",
      details: error?.message,
    });
  }
});

app.post("/movements", async (req: any, res: any) => {
  try {
    const authHeaders = GoogleHelper.parseAuthHeaders(req.headers);
    const authClient = google.auth.fromJSON(authHeaders);
    const spreadsheetId = req.headers.spreadsheet_id;

    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: "Missing spreadsheet_id in headers",
      });
    }

    const movementRequest = req.body; // IMovementRequest
    if (
      !movementRequest.transactions ||
      !Array.isArray(movementRequest.transactions)
    ) {
      return res.status(400).json({
        success: false,
        error: "Missing or invalid transactions array",
      });
    }

    await TransactionsHelper.appendMovement(
      authClient,
      spreadsheetId,
      movementRequest
    );
    res
      .status(201)
      .json({ success: true, data: "Movement created successfully" });
  } catch (error: any) {
    console.error("Error creating movement:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create movement",
      details: error?.message,
    });
  }
});

app.put("/movements/:movementId", async (req: any, res: any) => {
  try {
    const authHeaders = GoogleHelper.parseAuthHeaders(req.headers);
    const authClient = google.auth.fromJSON(authHeaders);
    const spreadsheetId = req.headers.spreadsheet_id;

    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: "Missing spreadsheet_id in headers",
      });
    }

    const { movementId } = req.params;

    // Verifica che il movimento esista
    const existing = await TransactionsHelper.getMovement(
      authClient,
      spreadsheetId,
      movementId
    );

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Movement not found",
      });
    }

    const movementRequest = req.body; // IMovementRequest
    movementRequest.movementId = movementId; // Assicura che movementId sia corretto

    if (
      !movementRequest.transactions ||
      !Array.isArray(movementRequest.transactions)
    ) {
      return res.status(400).json({
        success: false,
        error: "Missing or invalid transactions array",
      });
    }

    await TransactionsHelper.updateMovement(
      authClient,
      spreadsheetId,
      movementRequest
    );
    res.json({ success: true, data: "Movement updated successfully" });
  } catch (error: any) {
    console.error("Error updating movement:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update movement",
      details: error?.message,
    });
  }
});

app.delete("/movements/:movementId", async (req: any, res: any) => {
  try {
    const authHeaders = GoogleHelper.parseAuthHeaders(req.headers);
    const authClient = google.auth.fromJSON(authHeaders);
    const spreadsheetId = req.headers.spreadsheet_id;

    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: "Missing spreadsheet_id in headers",
      });
    }

    const { movementId } = req.params;
    await TransactionsHelper.deleteMovement(
      authClient,
      spreadsheetId,
      movementId
    );
    res.json({ success: true, data: "Movement deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting movement:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete movement",
      details: error?.message,
    });
  }
});

// #region TRANSACTIONS ENDPOINTS

/**
 * GET /transactions - Restituisce tutte le transazioni individuali estratte dai movements
 * Headers: refresh_token (required), spreadsheet_id (required)
 * Returns: Array di ITransaction
 */
app.get("/transactions", async (req: any, res: any) => {
  try {
    const authHeaders = GoogleHelper.parseAuthHeaders(req.headers);
    const authClient = google.auth.fromJSON(authHeaders);
    const spreadsheetId = req.headers.spreadsheet_id;

    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: "Missing spreadsheet_id in headers",
      });
    }

    // Ottieni tutti i movements e poi estrai le singole transazioni
    const allTransactions = await TransactionsHelper.listTransactions(
      authClient,
      spreadsheetId
    );

    res.json({ success: true, data: allTransactions });
  } catch (error: any) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch transactions",
      details: error?.message,
    });
  }
});

/**
 * GET /accounts-with-transactions - Load generica: restituisce tutti gli account con le loro transazioni
 * Query params: spreadsheetId (required)
 * Headers: refresh_token (required)
 * Returns: Array di account con transazioni, balance e metadati
 */
// app.get("/accounts-with-transactions", async (req: any, res: any) => {
//   try {
//     const authHeaders = GoogleHelper.parseAuthHeaders(req.headers);
//     const authClient = google.auth.fromJSON(authHeaders);
//     const refreshToken = authHeaders.refresh_token;
//     const spreadsheetId = req.query.spreadsheetId;
//     if (!spreadsheetId) return res.status(400).send("Missing spreadsheetId");

//     // Carica account e movements in parallelo
//     const [accounts, movements] = await Promise.all([
//       AccountsHelper.getAccounts(spreadsheetId, refreshToken),
//       TransactionsHelper.listMovements(authClient, spreadsheetId),
//     ]);

//     // Estrai tutte le transazioni da tutti i movements
//     const allTransactions = movements.flatMap((movement) =>
//       movement.transactions.map((transaction) => ({
//         ...transaction,
//         // Aggiungi metadati del movement
//         movementDescription: movement.description,
//         movementCategory: movement.category,
//         movementDate: movement.date,
//         movementType: movement.type,
//         movementLocation: movement.location,
//         movementNotes: movement.notes,
//         movementRecurrenceId: movement.recurrenceId,
//         movementStatus: movement.status,
//       }))
//     );

//     // Organizza le transazioni per account
//     const accountsWithTransactions = accounts.map((account) => {
//       // Filtra transazioni per questo account (o tutte se è account "Total")
//       const accountTransactions = allTransactions.filter((transaction) => {
//         // Se l'account è "Total", include tutte le transazioni
//         if (account.name === "Total") {
//           return transaction.status !== "DELETED";
//         }
//         // Altrimenti filtra per nome account
//         return (
//           transaction.account === account.name &&
//           transaction.status !== "DELETED"
//         );
//       });

//       // Ordina transazioni per data
//       accountTransactions.sort((a, b) => {
//         if (a.date < b.date) return -1;
//         else return 1;
//       });

//       // Calcola balance progressivo
//       let runningBalance = parseFloat(account.balance || "0");
//       const transactionsWithBalance = accountTransactions.map((transaction) => {
//         runningBalance += transaction.amount;
//         return {
//           ...transaction,
//           previousTransactionsAmount: runningBalance,
//         };
//       });

//       // Calcola balance finale
//       const finalBalance =
//         transactionsWithBalance.length > 0
//           ? transactionsWithBalance[transactionsWithBalance.length - 1]
//               .previousTransactionsAmount
//           : parseFloat(account.balance || "0");

//       return {
//         ...account,
//         transactions: transactionsWithBalance,
//         balance: finalBalance.toFixed(2),
//         transactionCount: transactionsWithBalance.length,
//       };
//     });

//     // Calcola total balance da tutti gli account (escluso il "Total" stesso per evitare doppio conteggio)
//     const totalBalance = accountsWithTransactions
//       .filter((account) => account.name !== "Total")
//       .reduce((sum, account) => sum + parseFloat(account.balance), 0);

//     res.status(200).json({
//       accounts: accountsWithTransactions,
//       totalBalance: totalBalance.toFixed(2),
//       timestamp: new Date().toISOString(),
//     });
//   } catch (ex: any) {
//     res.status(500).send(`Error. ex: ${ex.message}`);
//   }
// });

// #endregion

// app.get("/create", async (req: any, res: any) => {
//   try {
//     const authHeaders = GoogleHelper.parseAuthHeaders(req.headers);
//     const authClient = google.auth.fromJSON(authHeaders);
//     const userEmail = req.query.user_email;
//     if (!userEmail) {
//       res.status(400).send("Missing user_email");
//       return;
//     }
//     GoogleHelper.create(authClient, userEmail).then((r) => {
//       DbHelper.insertUser(userEmail, r.data.spreadsheetId).then(() => {
//         res.status(200).send(r);
//       });
//     });
//   } catch (ex) {
//     res.status(500).send(`Error. ex: ${ex.message}`);
//   }
// });

//#endregion

//#region CustomCredentials

app.get("/retrieveDbCredentials", async (req: any, res: any) => {
  try {
    DbHelper.getDbCredentials(
      req.headers.user_email,
      DbHelper.hashPin(req.headers.pin)
    ).then((info) => {
      if (info)
        res.status(200).send({
          token: info.token,
          spreadsheetId: info.spreadsheet_id,
        });
      else res.status(401).send("Unauthorized");
    });
  } catch (ex) {
    res.status(500).send("Error. ex: " + ex.message);
  }
});

app.get("/auth", (req: any, res: any) => {
  GoogleHelper.authenticate(req)
    .then((authUrl) => {
      res.send({ url: authUrl });
    })
    .catch();
});

app.get("/getToken", (req: any, res: any) => {
  GoogleHelper.authorize(req.query.code)
    .then((tokens) => {
      res.send(tokens);
    })
    .catch((ex) => {
      res.status(500).send(ex.message);
    });
});

app.get("/checkCredentials", async (req: any, res: any) => {
  const authHeaders = GoogleHelper.parseAuthHeaders(req.headers);
  await GoogleHelper.checkCredentials(authHeaders)
    .then((r) => {
      if (r) {
        res.status(200).send(r);
      } else {
        res.status(401).send("Unauthorized");
      }
    })
    .catch((ex) => {
      res.status(500).send(ex.message);
    });
});

app.post("/saveCredentials", async (req: any, res: any) => {
  console.log("saveCredentials");
  try {
    const r = await DbHelper.saveUserToken(req.body.user_email, req.body.token);
    res.send({ status: "OK" });
  } catch (ex) {
    console.error(ex);

    res.status(500).send(ex.message);
  }
});
//#endregion

//#region WebAuthn
app.post("/generate-registration-options", (req: any, res: any) => {
  console.log("generate-registration-options");

  const { userEmail } = req.body;

  if (!userEmail) {
    return res.status(400).send("Missing userEmail");
  }

  // Genera challenge e opzioni per la registrazione
  generateRegistrationOptions({
    rpName: "My Balance",
    rpID: process.env.RPID, // Sostituisci con il tuo
    userID: new Uint8Array(Buffer.from(userEmail, "utf-8")),
    userName: userEmail,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "preferred",
    },
  }).then((options) => {
    DbHelper.saveAuthChallenge(userEmail, options.challenge)
      .then(() => {
        res.json(options);
      })
      .catch((error) => {
        console.error("Error saving challenge:", error);
        res.status(500).send("Error saving challenge");
      });
  });
});

app.post("/verify-registration", async (req: any, res: any) => {
  console.log("verify-registration");
  const { userEmail, attestationResponse } = req.body;

  // Recupera utente e challenge
  DbHelper.getAuthChallenge(userEmail).then((row) => {
    if (!row) return res.status(400).send("User not found");
    const { webauthn_challenge, webauthn_challenge_created_at } = row;
    if (!webauthn_challenge) return res.status(400).send("No challenge stored");
    const challengeAgeMinutes =
      (Date.now() - new Date(webauthn_challenge_created_at).getTime()) /
      1000 /
      60;
    if (challengeAgeMinutes > 5)
      return res.status(400).send("Challenge expired");
    verifyRegistrationResponse({
      response: attestationResponse,
      expectedChallenge: webauthn_challenge,
      expectedOrigin: process.env.RP_ORIGIN || "http://localhost:8100",
      expectedRPID: process.env.RPID || "localhost",
    }).then((verification) => {
      if (verification.verified && verification.registrationInfo) {
        DbHelper.saveAuthChallenge(userEmail, null);
        DbHelper.saveUserCredentials(
          userEmail,
          verification.registrationInfo.credential.id,
          base64url.encode(
            Buffer.from(verification.registrationInfo.credential.publicKey)
          ),
          verification.registrationInfo.credential.counter
        ).catch((error) => {
          console.error("Error saving user credentials:", error);
          return res.status(500).send("Error saving user credentials");
        });
        res.json({ verified: true });
      } else {
        res.status(400).json({ verified: false, error: "Verification failed" });
      }
    });
  });
});

app.post("/generate-auth-options", (req: any, res: any) => {
  console.log("generate-auth-options");
  res.setHeader(
    "Access-Control-Allow-Origin",
    process.env.ORIGIN_URL || "http://localhost:8100"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  generateAuthenticationOptions({
    rpID: process.env.RPID,
    userVerification: "preferred",
  })
    .then((options) => {
      res.json(options);
    })
    .catch((error) => {
      console.error("Error retrieving user credentials:", error);
      res.status(500).send("Error retrieving user credentials");
    });
});

app.post("/verify-authentication", async (req, res) => {
  const { assertionResponse, challenge } = req.body;
  const userEmail = Buffer.from(
    assertionResponse.response.userHandle,
    "base64url"
  ).toString();

  console.log("verify-authentication for user:", userEmail);
  DbHelper.getUserCredentials(userEmail).then((credentials) => {
    if (!credentials || credentials.length === 0) {
      console.warn("No credentials found for user:", userEmail);
      return res.status(400).send("No credentials found for user");
    }
    if (
      !credentials[0].credentialPublicKey ||
      credentials[0].counter === undefined
    ) {
      console.warn(
        "Missing credentialPublicKey or counter for user:",
        userEmail
      );
      return res.status(400).send("Invalid credential data for user");
    }
    console.log(
      "Verifying authentication for user:",
      userEmail,
      "id:",
      credentials[0].credentialID,
      "counter:",
      credentials[0].counter,
      "publicKey:",
      credentials[0].credentialPublicKey,
      "challenge:",
      challenge,
      "assertionResponse:",
      assertionResponse,
      "RP_ORIGIN:",
      process.env.RP_ORIGIN,
      "RPID:",
      process.env.RPID
    );

    // Convert Buffer to base64url string if needed
    const credentialIDString = Buffer.isBuffer(credentials[0].credentialID)
      ? base64url(credentials[0].credentialID)
      : credentials[0].credentialID;
    const credentialPublicKeyBuffer = Buffer.isBuffer(
      credentials[0].credentialPublicKey
    )
      ? credentials[0].credentialPublicKey
      : Buffer.from(credentials[0].credentialPublicKey, "base64url");

    verifyAuthenticationResponse({
      response: assertionResponse,
      expectedChallenge: challenge,
      expectedOrigin: process.env.RP_ORIGIN || "http://localhost:8100",
      expectedRPID: process.env.RPID || "localhost",
      credential: {
        id: credentialIDString,
        publicKey: credentialPublicKeyBuffer,
        counter: credentials[0].counter,
      },
    } as any)
      .then((verification: any) => {
        if (verification.verified) {
          // Aggiorna counter in DB
          //await updateCounter(userId, verification.authenticationInfo.newCounter);
          // Login riuscito → genera sessione / token JWT / refresh token
          DbHelper.updateUserLastAccess(userEmail).catch((error) => {
            console.log(
              "Error updating last access for user:",
              userEmail,
              error
            );
          });
          console.log("Authentication successful for user:", userEmail);
          res.json({
            verified: true,
            token: credentials[0].token,
            userEmail: userEmail,
          });
        } else {
          console.log("Authentication failed for user:", userEmail);
          res.status(400).json({ verified: false });
        }
      })
      .catch((error) => {
        console.log(
          "Error verifying authentication for user:",
          userEmail,
          error
        );
        res
          .status(500)
          .send(`Error verifying authentication: ${error.message}`);
      });
  });
});
//#endregion

//#region Accounts Controllers

/**
 * GET /accounts - Recupera tutti gli accounts
 */
app.get("/accounts", async (req: any, res: any) => {
  try {
    const refreshToken = req.headers.refresh_token as string;
    const spreadsheetId = req.headers.spreadsheet_id as string;
    const authHeaders = GoogleHelper.parseAuthHeaders(req.headers);
    const authClient = google.auth.fromJSON(authHeaders);

    if (!refreshToken || !spreadsheetId) {
      res.status(400).json({
        error: "Missing refresh_token or spreadsheet_id in headers",
      });
      return;
    }

    const accounts = await AccountsHelper.getAccounts(
      spreadsheetId,
      authClient
    );
    res.json({ success: true, data: accounts });
  } catch (error: any) {
    console.error("Error fetching accounts:", error);
    res.status(500).json({
      error: "Failed to fetch accounts",
      details: error?.message,
    });
  }
});

/**
 * POST /accounts - Crea nuovo account
 */
app.post("/accounts", async (req: any, res: any) => {
  try {
    const refreshToken = req.headers.refresh_token as string;
    const spreadsheetId = req.headers.spreadsheet_id as string;
    const { name, description, balance, color, textColor } = req.body;

    if (!refreshToken || !spreadsheetId) {
      return res.status(400).json({
        error: "Missing refresh_token or spreadsheet_id in headers",
      });
    }

    if (!name) {
      return res.status(400).json({ error: "Account name is required" });
    }

    const account = await AccountsHelper.createAccount(
      spreadsheetId,
      refreshToken,
      {
        name,
        description: description || "",
        balance: balance || "0,00",
        color: color || "#808080",
        textColor: textColor || "#ffffff",
      }
    );

    res.json({ success: true, data: account });
  } catch (error) {
    console.error("Error creating account:", error);
    res.status(500).json({
      error: "Failed to create account",
      details: error.message,
    });
  }
});

/**
 * PUT /accounts/:accountId - Aggiorna account esistente
 */
app.put("/accounts/:accountId", async (req: any, res: any) => {
  try {
    const refreshToken = req.headers.refresh_token as string;
    const spreadsheetId = req.headers.spreadsheet_id as string;
    const { accountId } = req.params;
    const updateData = req.body;

    if (!refreshToken || !spreadsheetId) {
      return res.status(400).json({
        error: "Missing refresh_token or spreadsheet_id in headers",
      });
    }

    const updatedAccount = await AccountsHelper.updateAccount(
      spreadsheetId,
      refreshToken,
      accountId,
      updateData
    );

    res.json({ success: true, data: updatedAccount });
  } catch (error) {
    console.error("Error updating account:", error);
    res.status(500).json({
      error: "Failed to update account",
      details: error.message,
    });
  }
});

/**
 * DELETE /accounts/:accountId - Elimina account (soft delete)
 */
app.delete("/accounts/:accountId", async (req: any, res: any) => {
  try {
    const refreshToken = req.headers.refresh_token as string;
    const spreadsheetId = req.headers.spreadsheet_id as string;
    const { accountId } = req.params;

    if (!refreshToken || !spreadsheetId) {
      return res.status(400).json({
        error: "Missing refresh_token or spreadsheet_id in headers",
      });
    }

    await AccountsHelper.deleteAccount(spreadsheetId, refreshToken, accountId);
    res.json({ success: true, message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).json({
      error: "Failed to delete account",
      details: error.message,
    });
  }
});

/**
 * POST /accounts/batch - Crea multipli accounts in batch
 */
app.post("/accounts/batch", async (req: any, res: any) => {
  try {
    const refreshToken = req.headers.refresh_token as string;
    const spreadsheetId = req.headers.spreadsheet_id as string;
    const { accounts } = req.body;

    if (!refreshToken || !spreadsheetId) {
      return res.status(400).json({
        error: "Missing refresh_token or spreadsheet_id in headers",
      });
    }

    if (!Array.isArray(accounts) || accounts.length === 0) {
      return res.status(400).json({ error: "Accounts array is required" });
    }

    const createdAccounts = await AccountsHelper.createAccountsBatch(
      spreadsheetId,
      refreshToken,
      accounts
    );

    res.json({ success: true, data: createdAccounts });
  } catch (error) {
    console.error("Error creating accounts batch:", error);
    res.status(500).json({
      error: "Failed to create accounts batch",
      details: error.message,
    });
  }
});

//#endregion

//#region Categories Controllers

/**
 * GET /categories - Recupera tutte le categorie
 */
app.get("/categories", async (req: any, res: any) => {
  try {
    const refreshToken = req.headers.refresh_token as string;
    const spreadsheetId = req.headers.spreadsheet_id as string;
    const authHeaders = GoogleHelper.parseAuthHeaders(req.headers);
    const authClient = google.auth.fromJSON(authHeaders);

    if (!refreshToken || !spreadsheetId) {
      res.status(400).json({
        error: "Missing refresh_token or spreadsheet_id in headers",
      });
      return;
    }

    const categories = await CategoriesHelper.getCategories(
      spreadsheetId,
      authClient
    );
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      error: "Failed to fetch categories",
      details: error.message,
    });
  }
});

/**
 * POST /categories - Crea nuova categoria
 */
app.post("/categories", async (req: any, res: any) => {
  try {
    const refreshToken = req.headers.refresh_token as string;
    const spreadsheetId = req.headers.spreadsheet_id as string;
    const { name, description, color, icon } = req.body;

    if (!refreshToken || !spreadsheetId) {
      return res.status(400).json({
        error: "Missing refresh_token or spreadsheet_id in headers",
      });
    }

    if (!name) {
      return res.status(400).json({ error: "Category name is required" });
    }

    const category = await CategoriesHelper.createCategory(
      spreadsheetId,
      refreshToken,
      {
        name,
        description: description || "",
        color: color || "#808080",
        icon: icon || "",
      }
    );

    res.json({ success: true, data: category });
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({
      error: "Failed to create category",
      details: error.message,
    });
  }
});

/**
 * PUT /categories/:categoryId - Aggiorna categoria esistente
 */
app.put("/categories/:categoryId", async (req: any, res: any) => {
  try {
    const refreshToken = req.headers.refresh_token as string;
    const spreadsheetId = req.headers.spreadsheet_id as string;
    const { categoryId } = req.params;
    const updateData = req.body;

    if (!refreshToken || !spreadsheetId) {
      return res.status(400).json({
        error: "Missing refresh_token or spreadsheet_id in headers",
      });
    }

    const updatedCategory = await CategoriesHelper.updateCategory(
      spreadsheetId,
      refreshToken,
      categoryId,
      updateData
    );

    res.json({ success: true, data: updatedCategory });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({
      error: "Failed to update category",
      details: error.message,
    });
  }
});

/**
 * DELETE /categories/:categoryId - Elimina categoria (soft delete)
 */
app.delete("/categories/:categoryId", async (req: any, res: any) => {
  try {
    const refreshToken = req.headers.refresh_token as string;
    const spreadsheetId = req.headers.spreadsheet_id as string;
    const { categoryId } = req.params;

    if (!refreshToken || !spreadsheetId) {
      return res.status(400).json({
        error: "Missing refresh_token or spreadsheet_id in headers",
      });
    }

    await CategoriesHelper.deleteCategory(
      spreadsheetId,
      refreshToken,
      categoryId
    );
    res.json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({
      error: "Failed to delete category",
      details: error.message,
    });
  }
});

/**
 * POST /categories/batch - Crea multiple categorie in batch
 */
app.post("/categories/batch", async (req: any, res: any) => {
  try {
    const refreshToken = req.headers.refresh_token as string;
    const spreadsheetId = req.headers.spreadsheet_id as string;
    const { categories } = req.body;

    if (!refreshToken || !spreadsheetId) {
      return res.status(400).json({
        error: "Missing refresh_token or spreadsheet_id in headers",
      });
    }

    if (!Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ error: "Categories array is required" });
    }

    const createdCategories = await CategoriesHelper.createCategoriesBatch(
      spreadsheetId,
      refreshToken,
      categories
    );

    res.json({ success: true, data: createdCategories });
  } catch (error) {
    console.error("Error creating categories batch:", error);
    res.status(500).json({
      error: "Failed to create categories batch",
      details: error.message,
    });
  }
});

/**
 * GET /categories/default - Recupera categorie default del sistema
 */
app.get("/categories/default", async (req, res) => {
  try {
    const defaultCategories = CategoriesHelper.getDefaultCategories();
    res.json({ success: true, data: defaultCategories });
  } catch (error) {
    console.error("Error fetching default categories:", error);
    res.status(500).json({
      error: "Failed to fetch default categories",
      details: error.message,
    });
  }
});

//#endregion

//#region Spreadsheet Management Controllers

/**
 * POST /spreadsheet/create - Crea nuovo spreadsheet vuoto
 */
app.post("/spreadsheet/create", async (req: any, res: any) => {
  try {
    const refreshToken = req.headers.refresh_token as string;
    const { title, userEmail } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: "Missing refresh_token in headers",
      });
    }

    if (!title || !userEmail) {
      return res.status(400).json({
        error: "Title and userEmail are required",
      });
    }

    const spreadsheetId = await SpreadsheetsHelper.createSpreadsheet(
      refreshToken,
      title,
      userEmail
    );

    res.json({ success: true, data: { spreadsheetId } });
  } catch (error) {
    console.error("Error creating spreadsheet:", error);
    res.status(500).json({
      error: "Failed to create spreadsheet",
      details: error.message,
    });
  }
});

/**
 * POST /spreadsheet/initialize - Setup headers e struttura iniziale
 */
app.post("/spreadsheet/initialize", async (req: any, res: any) => {
  try {
    const refreshToken = req.headers.refresh_token as string;
    const { spreadsheetId } = req.body;

    if (!refreshToken || !spreadsheetId) {
      return res.status(400).json({
        error: "Missing refresh_token in headers or spreadsheetId in body",
      });
    }

    await SpreadsheetsHelper.initializeSpreadsheet(spreadsheetId, refreshToken);
    res.json({
      success: true,
      message: "Spreadsheet initialized successfully",
    });
  } catch (error) {
    console.error("Error initializing spreadsheet:", error);
    res.status(500).json({
      error: "Failed to initialize spreadsheet",
      details: error.message,
    });
  }
});

/**
 * GET /spreadsheet/validate - Valida struttura spreadsheet esistente
 */
app.get("/spreadsheet/validate", async (req: any, res: any) => {
  try {
    const refreshToken = req.headers.refresh_token as string;
    const spreadsheetId = req.headers.spreadsheet_id as string;

    if (!refreshToken || !spreadsheetId) {
      return res.status(400).json({
        error: "Missing refresh_token or spreadsheet_id in headers",
      });
    }

    const validation = await SpreadsheetsHelper.validateSpreadsheetStructure(
      spreadsheetId,
      refreshToken
    );

    res.json({ success: true, data: validation });
  } catch (error) {
    console.error("Error validating spreadsheet:", error);
    res.status(500).json({
      error: "Failed to validate spreadsheet",
      details: error.message,
    });
  }
});

/**
 * GET /spreadsheet/template - Ottieni dati template per nuovo setup
 */
app.get("/spreadsheet/template", async (req, res) => {
  try {
    const templateData = SpreadsheetsHelper.getTemplateData();
    res.json({ success: true, data: templateData });
  } catch (error) {
    console.error("Error getting template data:", error);
    res.status(500).json({
      error: "Failed to get template data",
      details: error.message,
    });
  }
});

//#endregion

app.listen(port, () => {
  return console.log(`Server is listening on ${port}`);
});
