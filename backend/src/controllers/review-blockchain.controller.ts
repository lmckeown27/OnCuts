/**
 * Review Controller (Blockchain Version)
 * 
 * REPLACES: PostgreSQL-based reviews
 * USES: On-chain immutable reviews + IPFS for text
 * 
 * The Review Flow (User's Perspective vs Reality):
 * 
 * USER SEES:                    ACTUALLY HAPPENS:
 * ════════════                  ═════════════════
 * 1. "Rate 5 stars"        →    Upload review text to IPFS
 * 2. "Write review text"   →    Get IPFS CID (QmXyz123...)
 * 3. "Submit review"       →    Store rating + CID on blockchain
 * 4. "Review posted!"      →    Immutable, can never be edited/deleted
 * 5. "Barber rating: 4.8"  →    Calculated on-chain from all reviews
 * 
 * BONUS: Review weighting based on student performance score!
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import custodialSignerService from '../services/custodial-signer.service';
import blockchainQueryService from '../services/blockchain-query.service';
import ipfsService from '../services/ipfs.service';

interface CreateReviewRequest {
  booking_id: string;
  barber_address: string;
  rating: number; // 1-5
  review_text: string;
  student_performance_score: number; // From student grading system (0-100)
}

/**
 * Create Review - Upload to IPFS + Store on Blockchain
 * 
 * BEFORE (PostgreSQL):
 * BEGIN TRANSACTION
 * INSERT INTO reviews (booking_id, rating, comment, ...) VALUES (...)
 * UPDATE barbers SET average_rating = AVG(rating) WHERE id = ?
 * UPDATE barber_metrics SET total_reviews = total_reviews + 1 WHERE barber_id = ?
 * COMMIT
 * 
 * AFTER (Blockchain + IPFS):
 * 1. Upload review text to IPFS
 * 2. Submit ONE transaction to smart contract
 * 3. Smart contract:
 *    - Stores rating + IPFS CID
 *    - Calculates weighted rating
 *    - Updates barber's aggregate rating
 *    - Emits event
 * 4. Everything immutable forever!
 */
export async function createReview(req: Request, res: Response) {
  try {
    const studentAddress = (req as any).user?.address;
    const email = (req as any).user?.email;

    if (!studentAddress || !email) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    const {
      booking_id,
      barber_address,
      rating,
      review_text,
      student_performance_score,
    }: CreateReviewRequest = req.body;

    // Validate
    if (!booking_id || !barber_address || !rating || !review_text) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5',
      });
    }

    logger.info(`⭐ Creating review: ${email} → ${barber_address} (${rating} stars)`);

    // Step 1: Upload review text to IPFS
    // User thinks we're just saving to database
    // Actually: Uploading to decentralized storage!
    const ipfsResult = await ipfsService.uploadText(review_text, `review-${booking_id}.txt`);

    logger.info(`✅ Review text uploaded to IPFS: ${ipfsResult.cid}`);

    // Step 2: Get password for signing
    const password = req.body.password;
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password required',
      });
    }

    const account = await custodialSignerService.createUserAccount(email, password);

    // Step 3: Submit transaction to create review on-chain
    // THE MAGIC: Smart contract handles:
    // - Verification (booking exists and is completed)
    // - Weight calculation (based on student performance)
    // - Rating aggregation (updates barber's average)
    // - Event emission
    const tx = await custodialSignerService.signAndSubmitOptimistic(email, {
      function: `${process.env.APTOS_MODULE_ADDRESS}::reviews::create_review`,
      arguments: [
        studentAddress,                // student_addr
        barber_address,                // barber_addr
        parseInt(booking_id),          // booking_id
        rating,                        // rating (1-5)
        ipfsResult.cid,                // review_text_cid (IPFS)
        student_performance_score,     // student_performance_score (for weighting)
      ],
    });

    logger.info(`✅ Review created on blockchain: ${tx.txHash}`);

    // Step 4: Return success immediately (user sees instant confirmation)
    return res.status(201).json({
      success: true,
      message: 'Review posted! Thank you for your feedback.',
      data: {
        tx_hash: tx.txHash,
        rating,
        review_cid: ipfsResult.cid,
        review_url: ipfsResult.url, // Users can view on IPFS gateway
      },
    });
  } catch (error) {
    logger.error('Failed to create review:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit review',
      error: (error as Error).message,
    });
  }
}

/**
 * Get Barber Reviews - Query from blockchain
 * 
 * BEFORE (PostgreSQL):
 * SELECT r.*, u.username 
 * FROM reviews r 
 * JOIN users u ON r.student_id = u.id 
 * WHERE r.barber_id = ? 
 * ORDER BY created_at DESC
 * 
 * AFTER (Blockchain):
 * Query review events from blockchain
 * Fetch review text from IPFS
 * Return formatted reviews
 */
export async function getBarberReviews(req: Request, res: Response) {
  try {
    const { barber_address } = req.params;

    if (!barber_address) {
      return res.status(400).json({
        success: false,
        message: 'Barber address required',
      });
    }

    logger.info(`📚 Fetching reviews for barber: ${barber_address}`);

    // Query reviews from blockchain
    const reviews = await blockchainQueryService.getBarberReviews(barber_address, 20);

    // Fetch review text from IPFS for each review
    const reviewsWithText = await Promise.all(
      reviews.map(async (review) => {
        try {
          // Fetch review text from IPFS
          const reviewText = await ipfsService.fetchText(review.review_text_cid);
          
          return {
            id: review.id,
            booking_id: review.booking_id,
            student_address: review.student_addr,
            rating: review.rating,
            review_text: reviewText,
            created_at: review.created_at,
            review_weight: review.review_weight,
            is_verified: review.is_verified,
          };
        } catch (error) {
          logger.error(`Failed to fetch review text from IPFS: ${review.review_text_cid}`, error);
          
          // Return review without text if IPFS fetch fails
          return {
            id: review.id,
            booking_id: review.booking_id,
            student_address: review.student_addr,
            rating: review.rating,
            review_text: '[Review text unavailable]',
            created_at: review.created_at,
            review_weight: review.review_weight,
            is_verified: review.is_verified,
          };
        }
      })
    );

    logger.info(`✅ Found ${reviewsWithText.length} reviews`);

    return res.status(200).json({
      success: true,
      data: reviewsWithText,
    });
  } catch (error) {
    logger.error('Failed to get reviews:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load reviews',
    });
  }
}

/**
 * Get Barber Rating - Query from blockchain
 * 
 * BEFORE (PostgreSQL):
 * SELECT AVG(rating) as average_rating, COUNT(*) as total_reviews 
 * FROM reviews 
 * WHERE barber_id = ?
 * 
 * AFTER (Blockchain):
 * Query BarberRatings resource from blockchain
 * Rating automatically updated by smart contract on each new review
 */
export async function getBarberRating(req: Request, res: Response) {
  try {
    const { barber_address } = req.params;

    if (!barber_address) {
      return res.status(400).json({
        success: false,
        message: 'Barber address required',
      });
    }

    logger.info(`⭐ Fetching rating for barber: ${barber_address}`);

    // Query rating from blockchain
    const rating = await blockchainQueryService.getBarberRating(barber_address);

    if (!rating) {
      return res.status(200).json({
        success: true,
        data: {
          average_rating: 0,
          weighted_average_rating: 0,
          total_reviews: 0,
        },
      });
    }

    // Convert basis points to decimal (e.g., 470 → 4.70)
    const avgRating = parseInt(rating.average_rating) / 100;
    const weightedAvgRating = parseInt(rating.weighted_average_rating) / 100;

    return res.status(200).json({
      success: true,
      data: {
        average_rating: avgRating.toFixed(2),
        weighted_average_rating: weightedAvgRating.toFixed(2),
        total_reviews: parseInt(rating.total_reviews),
        distribution: {
          five_star: parseInt(rating.rating_5_count),
          four_star: parseInt(rating.rating_4_count),
          three_star: parseInt(rating.rating_3_count),
          two_star: parseInt(rating.rating_2_count),
          one_star: parseInt(rating.rating_1_count),
        },
        last_updated: rating.last_updated,
      },
    });
  } catch (error) {
    logger.error('Failed to get rating:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load rating',
    });
  }
}

