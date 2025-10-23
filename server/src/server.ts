import express from 'express';
import session from 'express-session';
import FileStore from 'session-file-store';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { initDb } from './database';
import apiRoutes from './routes';
import { User } from './types';

dotenv.config();

// Initialize Database
try {
    initDb();
} catch (e) {
    console.error("CRITICAL: Database initialization failed.", e);
    process.exit(1);
}

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;
const SessionStore = FileStore(session);

// --- Serve Static Files from Server ---
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Middleware ---

// Enable CORS
app.use(cors({
    origin: 'http://localhost:5173', 
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---Session Management DEFINE TWO RATE LIMITERS ---

// 1. A strict limiter for the login page ONLY.
const loginLimiter = rateLimit({
    windowMs: 3 * 60 * 1000, // 3 minutes, as requested
    max: 5, // Allow 5 failed login attempts per IP per 3 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many login attempts. Please wait 3 minutes before trying again.',
});

// 2. A lenient, session-based limiter for all other API calls.
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // A high limit to prevent legitimate users from being blocked
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req, res) => {
        // Rate limit by session ID for logged-in users
        if ((req as any).session && (req as any).session.id) {
            return (req as any).session.id;
        }
        // Fallback to IP address if no session
        return req.ip;
    },
});

// --- APPLY THE RATE LIMITERS TO THE CORRECT ROUTES ---

// Apply the strict limiter ONLY to the login route
app.use('/api/auth/login', loginLimiter);

// Apply the lenient limiter to all other API routes
app.use('/api', apiLimiter);


// --- Session Management (must come AFTER rate limiters) ---
app.use(session({
    store: new SessionStore({
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
    const clientBuildPath = path.resolve(__dirname, '..', '..', 'client', 'dist');
    app.use(express.static(clientBuildPath));

    app.get('*', (req, res) => {
        res.sendFile(path.join(clientBuildPath, 'index.html'));
    });
}

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});