import express from 'express';
import session from 'express-session';
import FileStore from 'session-file-store';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import fs from 'fs';
import { initDb } from './database';
import apiRoutes from './routes';
import { User } from './types';

dotenv.config();

// Dynamically generate a session secret if not already set persistently in .env
const envPath = path.resolve(__dirname, '..', '.env');
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'supersecretkey') {
    const generatedSecret = crypto.randomBytes(32).toString('hex');
    try {
        if (fs.existsSync(envPath)) {
            let content = fs.readFileSync(envPath, 'utf8');
            if (content.includes('SESSION_SECRET=')) {
                content = content.replace(/SESSION_SECRET=.*/, `SESSION_SECRET=${generatedSecret}`);
            } else {
                content += `\nSESSION_SECRET=${generatedSecret}\n`;
            }
            fs.writeFileSync(envPath, content, 'utf8');
        } else {
            fs.writeFileSync(envPath, `SESSION_SECRET=${generatedSecret}\n`, 'utf8');
        }
        process.env.SESSION_SECRET = generatedSecret;
        console.log("Successfully generated and saved persistent SESSION_SECRET to .env file.");
    } catch (err) {
        console.warn("Could not save dynamic session secret persistently. Sessions will reset on restart.", err);
        process.env.SESSION_SECRET = generatedSecret;
    }
}

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

// --- Middleware ---

// Enable CORS
app.use(cors({
    origin: 'https://localhost:5173',
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Session Management (must come BEFORE rate limiters & CSRF so session is available) ---
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

// --- CSRF Protection Middleware ---
app.use((req, res, next) => {
    if (req.session) {
        if (!(req.session as any).csrfToken) {
            (req.session as any).csrfToken = crypto.randomBytes(24).toString('hex');
        }
        // Set XSRF-TOKEN cookie readable by client JavaScript
        res.cookie('XSRF-TOKEN', (req.session as any).csrfToken, {
            sameSite: 'strict',
            secure: process.env.NODE_ENV === 'production',
            path: '/'
        });
    }
    next();
});

const csrfProtection = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.path === '/auth/login' || req.path === '/auth/login/') {
        return next();
    }
    const csrfHeader = req.headers['x-xsrf-token'] || req.headers['x-csrf-token'];
    const sessionToken = (req.session as any)?.csrfToken;
    if (!sessionToken || csrfHeader !== sessionToken) {
        return res.status(403).json({ message: "Invalid or missing CSRF token" });
    }
    next();
};

app.use('/api', csrfProtection);

// --- Rate Limiters (applied after session and CSRF to allow session-based limiting) ---

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
    keyGenerator: (req) => {
        // Rate limit by session ID for logged-in users
        if ((req as any).session && (req as any).session.id) {
            return (req as any).session.id;
        }
        // Fallback to IP address if no session
        return req.ip || 'unknown-ip';
    },
});

// Apply the strict limiter ONLY to the login route
app.use('/api/auth/login', loginLimiter);

// Apply the lenient limiter to all other API routes
app.use('/api', apiLimiter);

// --- API Routes ---
app.use('/api', apiRoutes);

// --- Secure Lab Reports Serving ---
const requireAuthForReports = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if ((req as any).session && (req as any).session.user) {
        next();
    } else {
        res.status(401).send("Unauthorized: Please log in to view lab reports.");
    }
};
app.use('/lab_reports', requireAuthForReports, express.static(path.join(__dirname, '..', 'public', 'lab_reports')));

// --- Serve React App in Production ---
if (process.env.NODE_ENV === 'production') {
    const clientBuildPath = path.resolve(__dirname, '..', '..', 'client', 'dist');
    app.use(express.static(clientBuildPath));

    app.get('*', (req, res) => {
        res.sendFile(path.join(clientBuildPath, 'index.html'));
    });
}

app.listen(Number(PORT), '127.0.0.1', () => {
    console.log(`Server is running on http://127.0.0.1:${PORT}`);
});