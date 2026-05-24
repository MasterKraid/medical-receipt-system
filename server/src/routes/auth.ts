import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../database';
import { User, Branch } from '../types';
import { isAuthenticated } from './shared';

const router = Router();

router.post('/auth/login', (req, res) => {
    const { username, password, password_hash } = req.body;
    try {
        const userRow = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User & { password_hash: string };
        if (userRow) {
            const sha256 = (str: string) => crypto.createHash('sha256').update(str).digest('hex');

            // 1. Check if they already have a migrated hash matching the client-side hash
            if (password_hash && bcrypt.compareSync(password_hash, userRow.password_hash)) {
                const { password_hash: _, ...user } = userRow;
                const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(user.branchId) as Branch;
                const assigned_list_ids = db.prepare('SELECT package_list_id FROM user_package_list_access WHERE user_id = ?').all(user.id).map((row: any) => row.package_list_id);
                const userSessionData = { ...user, assigned_list_ids };
                (req.session as any).user = userSessionData;
                res.json({ user: userSessionData, branch });
                return;
            }

            // 2. Check if they match via legacy plaintext password
            if (password && bcrypt.compareSync(password, userRow.password_hash)) {
                // If it matched plaintext, transparently migrate them to the client-side hash!
                const targetHash = password_hash || sha256(password);
                const newPasswordHashed = bcrypt.hashSync(targetHash, 10);
                db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newPasswordHashed, userRow.id);
                console.log(`Transparently migrated password hash for user "${username}" to the client-side SHA-256 schema on successful login.`);

                const { password_hash: _, ...user } = userRow;
                const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(user.branchId) as Branch;
                const assigned_list_ids = db.prepare('SELECT package_list_id FROM user_package_list_access WHERE user_id = ?').all(user.id).map((row: any) => row.package_list_id);
                const userSessionData = { ...user, assigned_list_ids };
                (req.session as any).user = userSessionData;
                res.json({ user: userSessionData, branch });
                return;
            }
        }
        res.status(401).json({ message: 'Invalid username or password' });
    } catch (error: any) {
        res.status(500).json({ message: 'Server error during login: ' + error.message });
    }
});

router.post('/auth/logout', (req, res) => {
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ message: 'Could not log out' });
            }
            res.clearCookie('connect.sid');
            res.json({ message: 'Logged out successfully' });
        });
    } else {
        res.json({ message: 'Logged out successfully' });
    }
});

router.get('/auth/me', isAuthenticated, (req, res) => {
    const sessionUser = (req.session as any).user as User;
    try {
        const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(sessionUser.id) as User & { password_hash: string };
        if (userRow) {
            const { password_hash, ...user } = userRow;
            const assigned_list_ids = db.prepare('SELECT package_list_id FROM user_package_list_access WHERE user_id = ?').all(user.id).map((row: any) => row.package_list_id);
            const userSessionData = { ...user, assigned_list_ids };

            // Update session with fresh data
            (req.session as any).user = userSessionData;

            const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(user.branchId) as Branch;
            res.json({ user: userSessionData, branch });
        } else {
            res.status(404).json({ message: "User not found" });
        }
    } catch (e: any) {
        res.status(500).json({ message: e.message });
    }
});

export default router;
