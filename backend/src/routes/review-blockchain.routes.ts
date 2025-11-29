/**
 * Review Routes (Blockchain Version)
 * 
 * Reviews stored immutably on-chain
 * Review text stored on IPFS (CID on-chain)
 * Weighted ratings based on student performance
 */

import express from 'express';
import { authenticate } from '../middleware/auth';
import * as reviewController from '../controllers/review-blockchain.controller';

const router = express.Router();

// ═══════════════════════════════════════════════════════════
//  REVIEW MANAGEMENT
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/reviews-blockchain
 * Create new review (upload to IPFS + store on-chain)
 * 
 * Body: {
 *   booking_id: string,
 *   barber_address: string,
 *   rating: number (1-5),
 *   review_text: string,
 *   student_performance_score: number (0-100),
 *   password: string (for signing)
 * }
 * 
 * Returns: { tx_hash, rating, review_cid, review_url }
 */
router.post('/', authenticate, reviewController.createReview);

/**
 * GET /api/reviews-blockchain/barber/:barber_address
 * Get reviews for a barber (from blockchain + IPFS)
 * 
 * Returns: { reviews: Review[] }
 */
router.get('/barber/:barber_address', reviewController.getBarberReviews);

/**
 * GET /api/reviews-blockchain/barber/:barber_address/rating
 * Get aggregate rating for a barber (from blockchain)
 * 
 * Returns: {
 *   average_rating: number,
 *   weighted_average_rating: number,
 *   total_reviews: number,
 *   distribution: { ... }
 * }
 */
router.get('/barber/:barber_address/rating', reviewController.getBarberRating);

export default router;

