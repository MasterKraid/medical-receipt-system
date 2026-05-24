import { Router } from 'express';
import authRouter from './routes/auth';
import documentsRouter from './routes/documents';
import managementRouter from './routes/management';

const router = Router();

// Register modular sub-routers
router.use(authRouter);
router.use(documentsRouter);
router.use(managementRouter);

export default router;