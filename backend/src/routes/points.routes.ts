import express from 'express';
import { authenticate } from '../middleware/auth';
import { getMyPointsBalance } from '../controllers/points.controller';

const router = express.Router();

router.get('/me', authenticate, getMyPointsBalance);

export default router;
