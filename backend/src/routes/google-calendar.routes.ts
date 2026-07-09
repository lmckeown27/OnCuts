/**
 * Google Calendar OAuth Routes — DISABLED
 *
 * Integration commented out. Restore route handlers from git history and
 * re-enable mounts in `backend/src/index.ts` to turn this back on.
 */

import express, { Router } from 'express';

const router: Router = express.Router();

export default router;

/*
 * --- Original routes (disabled) ---
 *
 * import { authenticate } from '../middleware/auth';
 * import { pool } from '../database/connection';
 * import { logger } from '../utils/logger';
 * import { getFrontendBaseUrl } from '../config/app-url';
 * import * as googleCalendarService from '../services/google-calendar.service';
 *
 * GET  /connect
 * GET  /callback
 * GET  /status
 * DELETE /disconnect
 * PUT  /sync-settings
 * GET  /busy-times
 */
