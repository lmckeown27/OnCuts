import express from 'express';
import { authenticate } from '../middleware/auth';
import {
  applyOperatorPointsToBooking,
  claimReferral,
  commitClientPointsDiscount,
  claimAdminWelcomePoints,
  dismissReferPrompt,
  getReferralMe,
  getReferPrompt,
  getRewardsMe,
  postCodeRequest,
  quoteClientPointsDiscount,
  revealReferralCode,
  rotateMyReferralCode,
  updateCodeRequestStatus,
  validateCode,
  validateCodePublic,
} from '../controllers/referrals.controller';

const router = express.Router();

router.get('/me', authenticate, getReferralMe);
router.get('/rewards/me', authenticate, getRewardsMe);
router.post('/codes/reveal', authenticate, revealReferralCode);
router.post('/codes/rotate', authenticate, rotateMyReferralCode);
router.post('/codes/validate', authenticate, validateCode);
router.post('/codes/validate-public', validateCodePublic);
router.post('/claim', authenticate, claimReferral);
router.post('/code-requests/:operatorUserId', postCodeRequest);
router.patch('/code-requests/:id', authenticate, updateCodeRequestStatus);
router.get('/prompts/refer', authenticate, getReferPrompt);
router.post('/prompts/refer', authenticate, dismissReferPrompt);
router.post('/prompts/welcome-claim', authenticate, claimAdminWelcomePoints);
router.post('/spend/operator/:bookingId', authenticate, applyOperatorPointsToBooking);
router.post('/spend/client/quote', authenticate, quoteClientPointsDiscount);
router.post('/spend/client/commit', authenticate, commitClientPointsDiscount);

export default router;
