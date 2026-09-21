import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import express from 'express';
import process from 'process';
import { randomUUID } from 'crypto';
import { GoogleHelper, GoogleAuthHelper, GoogleTokenError } from './helpers/google';
import cors from 'cors';
import { TransactionsHelper, SpreadsheetsHelper, MigrationHelper } from './helpers/mybalance';
import { DbHelper } from './helpers/db.helper';

// ROUTES IMPORTS
// Note: Auth routes removed - frontend calls auth service directly
import { accountsRoutes } from './routes/accounts.routes';
import { categoriesRoutes } from './routes/categories.routes';
import { transactionsRoutes } from './routes/transactions.routes';
import { movementsRoutes } from './routes/movements.routes';
import { shortcutRoutes } from './routes/shortcut.routes';
import { aggregationsRoutes } from './routes/aggregations.routes';
import { RequireAuthMiddleware } from './middleware/requireAuth.middleware';
import { mcpRoutes } from './mcp/router';

function handleGoogleTokenError(error: any, res: any, context: string): boolean {
  if (error instanceof GoogleTokenError) {
    console.error(`❌ Google token error in ${context}:`, error.message, error.code);
    res.status(401).json({
      success: false,
      error: error.message,
      code: error.code,
      requiresReauth: true,
    });
    return true;
  }

  return false;
}

const app = express();
const port = process.env.PORT || 8080;

app.use((req, res, next) => {
  const requestId = req.header('x-request-id') || randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
});

// Parse allowed origins from env (comma-separated) or use defaults
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
  : [
      process.env.ORIGIN_URL || 'http://localhost:8100',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:8081',
    ];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`CORS blocked request from origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'access_token',
    'refresh_token',
    'spreadsheet_id',
    'x-shortcutkey',
    'x-authorization',
    'MCP-Protocol-Version',
    'MCP-Method',
    'MCP-Name',
    'X-Request-ID',
  ],
  exposedHeaders: [
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Credentials',
    'MCP-Protocol-Version',
    'X-Request-ID',
  ],
  credentials: true,
};

app.set('trust proxy', 1);

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.raw());

// ==============================
// API ROUTES (External Routers)
// Note: /auth routes removed - frontend calls auth service directly (port 8080)
// ==============================
app.use('/accounts', accountsRoutes);
app.use('/categories', categoriesRoutes);
app.use('/transactions', transactionsRoutes);
app.use('/movements', movementsRoutes);
app.use('/shortcut', shortcutRoutes);
app.use('/aggregations', aggregationsRoutes);
app.use('/mcp', mcpRoutes);

// ==============================
// User Data Endpoints
// ==============================
app.get('/user/spreadsheet', RequireAuthMiddleware.verify, async (req: any, res: any) => {
  try {
    const userEmail = req.userId;

    const user = await DbHelper.getUserByEmail(userEmail);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      data: {
        spreadSheetID: user.spreadsheet_id,
        userInfo: {
          user_email: user.user_email,
          user_name: user.user_name,
          spreadsheet_id: user.spreadsheet_id,
          last_access: user.last_access,
        },
      },
    });
  } catch (error: any) {
    console.error('Error getting user spreadsheet:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user spreadsheet',
      details: error?.message,
    });
  }
});

app.post('/user/last-access', RequireAuthMiddleware.verify, async (req: any, res: any) => {
  try {
    const userEmail = req.userId;
    const result = await DbHelper.updateUserLastAccess(userEmail);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error updating last access:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update last access',
      details: error?.message,
    });
  }
});

// ==============================
// Health Check
// ==============================
app.get('/', (req: any, res: any) => {
  res.send('API Working');
});

// ==============================
// Waitlist (Public)
// ==============================
app.post('/waitlist', async (req: any, res: any) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
      });
    }

    const result = await DbHelper.addToWaitlist(email.toLowerCase().trim());

    res.status(201).json({
      success: true,
      message: 'Successfully added to waitlist',
      data: {
        email: result.email,
      },
    });
  } catch (error: any) {
    console.error('Error adding to waitlist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add to waitlist',
      details: error?.message,
    });
  }
});

// ==============================
// Legacy Google Sheets Endpoints
// ==============================
app.get('/get', RequireAuthMiddleware.verify, async (req: any, res: any) => {
  try {
    const userEmail = req.userId;
    const deviceType = req.deviceType || 'web';

    let spreadsheetId = req.headers.spreadsheet_id;
    if (!spreadsheetId) {
      spreadsheetId = await GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
    }

    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: 'Missing spreadsheet_id in headers and no default spreadsheet configured',
      });
    }

    const items = await GoogleAuthHelper.executeWithRetry(userEmail, deviceType, async (client) =>
      GoogleHelper.get(client, spreadsheetId, req.query.range),
    );
    res.json({ success: true, data: items });
  } catch (error: any) {
    if (handleGoogleTokenError(error, res, 'legacyGet')) return;
    console.error('Error in get:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get data',
      details: error?.message,
    });
  }
});

app.post('/update', RequireAuthMiddleware.verify, async (req: any, res: any) => {
  try {
    const userEmail = req.userId;
    const deviceType = req.deviceType || 'web';

    let spreadsheetId = req.headers.spreadsheet_id;
    if (!spreadsheetId) {
      spreadsheetId = await GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
    }

    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: 'Missing spreadsheet_id in headers and no default spreadsheet configured',
      });
    }

    const body = req.body;
    const items = await GoogleAuthHelper.executeWithRetry(userEmail, deviceType, async (client) =>
      GoogleHelper.update(client, spreadsheetId, body),
    );
    res.json({ success: true, data: items });
  } catch (error: any) {
    if (handleGoogleTokenError(error, res, 'legacyUpdate')) return;
    console.error('Error in update:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update data',
      details: error?.message,
    });
  }
});

app.post('/addMovement', RequireAuthMiddleware.verify, async (req: any, res: any) => {
  try {
    const userEmail = req.userId;
    const deviceType = req.deviceType || 'web';

    let spreadsheetId = req.headers.spreadsheet_id;
    if (!spreadsheetId) {
      spreadsheetId = await GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
    }

    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: 'Missing spreadsheet_id in headers and no default spreadsheet configured',
      });
    }

    const body = req.body;

    // Backwards compatibility: convert legacy format
    if (body.movementId && body.description && !body.transactions) {
      const movementRequest = {
        movementId: body.movementId,
        description: body.description,
        category: body.category || '',
        date: body.date || new Date().toISOString().split('T')[0],
        type: body.type || '',
        location: body.location || '',
        notes: body.notes || '',
        recurrenceId: body.recurrenceId || '',
        transactions: [
          {
            amount: body.amount || 0,
            account: body.account || '',
            _operation: 'create' as const,
          },
        ],
      };
      await GoogleAuthHelper.executeWithRetry(userEmail, deviceType, async (client) =>
        TransactionsHelper.appendMovement(client, spreadsheetId, movementRequest),
      );
    } else {
      await GoogleAuthHelper.executeWithRetry(userEmail, deviceType, async (client) =>
        TransactionsHelper.appendMovement(client, spreadsheetId, body),
      );
    }

    res.json({ success: true, data: 'Movement added successfully' });
  } catch (error: any) {
    if (handleGoogleTokenError(error, res, 'legacyAddMovement')) return;
    console.error('Error adding movement:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add movement',
      details: error?.message,
    });
  }
});

app.post('/append', RequireAuthMiddleware.verify, async (req: any, res: any) => {
  try {
    const userEmail = req.userId;
    const deviceType = req.deviceType || 'web';

    let spreadsheetId = req.headers.spreadsheet_id;
    if (!spreadsheetId) {
      spreadsheetId = await GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
    }

    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: 'Missing spreadsheet_id in headers and no default spreadsheet configured',
      });
    }

    const body = req.body;
    const items = await GoogleAuthHelper.executeWithRetry(userEmail, deviceType, async (client) =>
      GoogleHelper.append(client, spreadsheetId, req.query.range, body),
    );
    res.json({ success: true, data: items });
  } catch (error: any) {
    if (handleGoogleTokenError(error, res, 'legacyAppend')) return;
    console.error('Error in append:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to append data',
      details: error?.message,
    });
  }
});

// ==============================
// Spreadsheet Management
// ==============================
app.post('/spreadsheet/create', RequireAuthMiddleware.verify, async (req: any, res: any) => {
  try {
    const userEmail = req.userId;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({
        error: 'Title is required',
      });
    }

    const deviceType = req.deviceType || 'web';
    const spreadsheetId = await SpreadsheetsHelper.createSpreadsheet(userEmail, title, deviceType);

    res.json({ success: true, data: { spreadsheetId } });
  } catch (error: any) {
    if (handleGoogleTokenError(error, res, 'createSpreadsheet')) return;
    console.error('Error creating spreadsheet:', error);
    res.status(500).json({
      error: 'Failed to create spreadsheet',
      details: error.message,
    });
  }
});

app.post('/spreadsheet/initialize', RequireAuthMiddleware.verify, async (req: any, res: any) => {
  try {
    const userEmail = req.userId;
    const { spreadsheetId } = req.body;

    if (!spreadsheetId) {
      return res.status(400).json({
        error: 'Missing spreadsheetId in body',
      });
    }

    const deviceType = req.deviceType || 'web';
    await SpreadsheetsHelper.initializeSpreadsheet(spreadsheetId, userEmail, deviceType);
    res.json({
      success: true,
      message: 'Spreadsheet initialized successfully',
    });
  } catch (error: any) {
    if (handleGoogleTokenError(error, res, 'initializeSpreadsheet')) return;
    console.error('Error initializing spreadsheet:', error);
    res.status(500).json({
      error: 'Failed to initialize spreadsheet',
      details: error.message,
    });
  }
});

app.get('/spreadsheet/validate', RequireAuthMiddleware.verify, async (req: any, res: any) => {
  try {
    const userEmail = req.userId;

    let spreadsheetId = req.query.spreadsheet_id;
    if (!spreadsheetId) {
      spreadsheetId = await GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
    }

    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: 'Missing spreadsheet_id in query params and no default spreadsheet configured',
      });
    }

    const deviceType = req.deviceType || 'web';
    const validation = await SpreadsheetsHelper.validateSpreadsheetStructure(
      spreadsheetId,
      userEmail,
      deviceType,
    );

    res.json({ success: true, data: validation });
  } catch (error: any) {
    if (handleGoogleTokenError(error, res, 'validateSpreadsheet')) return;
    console.error('Error validating spreadsheet:', error);
    res.status(500).json({
      error: 'Failed to validate spreadsheet',
      details: error.message,
    });
  }
});

app.post(
  '/spreadsheet/complete-setup',
  RequireAuthMiddleware.verify,
  async (req: any, res: any) => {
    try {
      const userEmail = req.userId;
      await DbHelper.setSetupComplete(userEmail, true);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error completing setup:', error);
      res.status(500).json({
        error: 'Failed to complete setup',
        details: error.message,
      });
    }
  },
);

app.post('/spreadsheet/migrate', RequireAuthMiddleware.verify, async (req: any, res: any) => {
  try {
    const userEmail = req.userId;
    const deviceType = req.deviceType || 'web';

    console.log(`🔄 Migration request from ${userEmail}`);

    const result = await MigrationHelper.executePendingMigrations(userEmail, deviceType);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (handleGoogleTokenError(error, res, 'executeMigration')) return;
    console.error('Error executing migration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute migration',
      details: error.message,
    });
  }
});

app.get('/spreadsheet/template', async (req, res) => {
  try {
    const templateData = SpreadsheetsHelper.getTemplateData();
    res.json({ success: true, data: templateData });
  } catch (error: any) {
    console.error('Error getting template data:', error);
    res.status(500).json({
      error: 'Failed to get template data',
      details: error.message,
    });
  }
});

// ==============================
// Catch-all 404
// ==============================
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ==============================
// Server Start
// ==============================
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log('🚀 =================================');
    console.log(`🚀 MyBalance API Server is running on port ${port}`);
    console.log('🚀 =================================');
    console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🚀 CORS Allowed Origins: ${allowedOrigins.join(', ')}`);
    console.log('🚀 =================================');
  });
}

export default app;
