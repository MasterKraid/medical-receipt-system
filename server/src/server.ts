
import express from 'express';
import session from 'express-session';
import FileStore from 'session-file-store';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { initDb } from './database';
// Fix: Import the apiRoutes from './routes' to resolve the 'Cannot find name' error.
import apiRoutes from './routes';
import { User } from './types';

// Fix: Removed module augmentation for express-session due to missing type definitions.
// Session properties will be accessed using type assertion `(req.session as any)`.

dotenv.config();

// Initialize Database
try {
    initDb();
} catch (e) {
    console.error("CRITICAL: Database initialization failed.", e);
    // Fix: Cast process to any to access exit method when type definitions are missing.
    (process as any).exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;
const SessionStore = FileStore(session);

// --- Serve Static Files from Server ---
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Middleware ---

// Enable CORS
app.use(cors({
    origin: 'http://localhost:5173', // Adjust for your client's port
    credentials: true
}));

// Rate Limiting
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
	standardHeaders: true,
	legacyHeaders: false,
});
app.use(limiter);

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Management
app.use(session({
    store: new SessionStore({
        // Corrected path to the new 'data' directory
        path: path.join(__dirname, '..', 'data', 'sessions'),
        ttl: 86400, // 1 day
        retries: 0
    }),
    secret: process.env.SESSION_SECRET || 'supersecretkey',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

// --- API Routes ---
app.use('/api', apiRoutes);


// --- Serve React App in Production ---
if (process.env.NODE_ENV === 'production') {
    // Fix: Use process.cwd() as a workaround for __dirname not being defined in the TypeScript environment.
    // Fix: Cast `process` to `any` to resolve TypeScript error `Property 'cwd' does not exist on type 'Process'`.
    const clientBuildPath = path.join((process as any).cwd(), 'client', 'dist');
    app.use(express.static(clientBuildPath));

    app.get('*', (req, res) => {
        res.sendFile(path.join(clientBuildPath, 'index.html'));
    });
}


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
