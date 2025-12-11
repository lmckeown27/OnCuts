/**
 * Dynamic Pricing Engine
 * 
 * Calculates recommended pricing based on:
 * - Barber rating & completion rate
 * - Local supply/demand
 * - Market type (campus size)
 * - Time-of-day multipliers
 * - Location-based adjustments
 * 
 * Output: Recommended price with floor/ceiling bounds
 */

import { logger } from '../utils/logger';
import Decimal from 'decimal.js';

// ═══════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════

export interface PricingInput {
  // Barber metrics
  barber_rating: number;             // 1-5 stars
  barber_completion_rate: number;    // 0-1 (e.g., 0.95 = 95%)
  barber_total_bookings: number;     // Lifetime bookings
  barber_avg_price: number;          // Current average price
  
  // Supply/demand
  barbers_available_count: number;   // How many barbers nearby
  bookings_last_24h: number;         // Student demand
  
  // Market context
  market_type: 'small_campus' | 'medium_campus' | 'large_campus' | 'metro';
  time_of_day: 'morning' | 'afternoon' | 'evening' | 'night' | 'weekend';
  
  // Service type
  service_category: 'basic' | 'standard' | 'premium';
  estimated_duration_minutes: number;
  
  // Optional overrides
  barber_custom_base_price?: number;
}

export interface PricingOutput {
  recommended_price: number;      // Main recommendation
  price_floor: number;            // Minimum (barber can't go below)
  price_ceiling: number;          // Maximum (competitive cap)
  confidence: number;             // 0-1 (how confident we are)
  
  // Breakdown for transparency
  breakdown: {
    base_price: number;
    quality_multiplier: number;
    demand_multiplier: number;
    time_multiplier: number;
    market_adjustment: number;
  };
  
  reasoning: string[];            // Human-readable explanations
}

// ═══════════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════════

const BASE_PRICES = {
  basic: 15,      // Simple cut, 15-20 min
  standard: 25,   // Regular haircut, 30-40 min
  premium: 40,    // Detailed work, 60+ min
};

const MARKET_MULTIPLIERS = {
  small_campus: 0.85,   // Small college towns (lower cost of living)
  medium_campus: 1.0,   // Mid-size universities (baseline)
  large_campus: 1.15,   // Major universities (higher demand)
  metro: 1.35,          // Major metros (highest prices)
};

const TIME_MULTIPLIERS = {
  morning: 0.95,        // 6am-11am (lower demand)
  afternoon: 1.0,       // 11am-5pm (standard)
  evening: 1.15,        // 5pm-9pm (peak demand)
  night: 0.9,           // 9pm+ (limited availability)
  weekend: 1.2,         // Sat/Sun (premium)
};

const MIN_CONFIDENCE = 0.6;       // Below this, suggest more data needed
const QUALITY_WEIGHT = 0.3;       // 30% weight on barber quality
const DEMAND_WEIGHT = 0.4;        // 40% weight on supply/demand
const TIME_WEIGHT = 0.2;          // 20% weight on time-of-day
const MARKET_WEIGHT = 0.1;        // 10% weight on market type

// ═══════════════════════════════════════════════════════════
//  DYNAMIC PRICING SERVICE
// ═══════════════════════════════════════════════════════════

class DynamicPricingService {
  
  /**
   * Calculate recommended pricing
   */
  calculatePrice(input: PricingInput): PricingOutput {
    const reasoning: string[] = [];
    
    // 1. Start with base price
    const basePrice = input.barber_custom_base_price || BASE_PRICES[input.service_category];
    reasoning.push(`Base price for ${input.service_category} service: $${basePrice.toFixed(2)}`);
    
    // 2. Quality multiplier (rating + completion rate)
    const qualityMultiplier = this.calculateQualityMultiplier(input);
    reasoning.push(`Quality multiplier: ${qualityMultiplier.toFixed(2)}x (rating: ${input.barber_rating.toFixed(1)}⭐, completion: ${(input.barber_completion_rate * 100).toFixed(0)}%)`);
    
    // 3. Demand multiplier (supply vs demand)
    const demandMultiplier = this.calculateDemandMultiplier(input);
    reasoning.push(`Demand multiplier: ${demandMultiplier.toFixed(2)}x (${input.bookings_last_24h} bookings, ${input.barbers_available_count} barbers available)`);
    
    // 4. Time-of-day multiplier
    const timeMultiplier = TIME_MULTIPLIERS[input.time_of_day];
    reasoning.push(`Time multiplier: ${timeMultiplier.toFixed(2)}x (${input.time_of_day.replace('_', ' ')})`);
    
    // 5. Market adjustment
    const marketMultiplier = MARKET_MULTIPLIERS[input.market_type];
    reasoning.push(`Market adjustment: ${marketMultiplier.toFixed(2)}x (${input.market_type.replace('_', ' ')})`);
    
    // 6. Combine all factors
    const weightedMultiplier = 
      (qualityMultiplier * QUALITY_WEIGHT) +
      (demandMultiplier * DEMAND_WEIGHT) +
      (timeMultiplier * TIME_WEIGHT) +
      (marketMultiplier * MARKET_WEIGHT);
    
    const combinedMultiplier = 1 + (weightedMultiplier - 1); // Normalize around 1.0
    
    const recommendedPrice = new Decimal(basePrice)
      .times(combinedMultiplier)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber();
    
    // 7. Calculate floor and ceiling
    const priceFloor = new Decimal(basePrice)
      .times(0.75) // Never less than 75% of base
      .toDecimalPlaces(2, Decimal.ROUND_UP)
      .toNumber();
    
    const priceCeiling = new Decimal(basePrice)
      .times(1.5) // Never more than 150% of base
      .toDecimalPlaces(2, Decimal.ROUND_DOWN)
      .toNumber();
    
    // Clamp recommended price within bounds
    const clampedPrice = Math.max(priceFloor, Math.min(priceCeiling, recommendedPrice));
    
    // 8. Calculate confidence
    const confidence = this.calculateConfidence(input);
    
    if (confidence < MIN_CONFIDENCE) {
      reasoning.push(`⚠️ Low confidence (${(confidence * 100).toFixed(0)}%) - more booking history needed`);
    }
    
    return {
      recommended_price: clampedPrice,
      price_floor: priceFloor,
      price_ceiling: priceCeiling,
      confidence,
      breakdown: {
        base_price: basePrice,
        quality_multiplier: qualityMultiplier,
        demand_multiplier: demandMultiplier,
        time_multiplier: timeMultiplier,
        market_adjustment: marketMultiplier,
      },
      reasoning,
    };
  }
  
  /**
   * Calculate quality multiplier based on rating and completion rate
   */
  private calculateQualityMultiplier(input: PricingInput): number {
    // Rating component (1-5 stars → 0.8-1.2 multiplier)
    const ratingNormalized = input.barber_rating / 5; // 0-1
    const ratingMultiplier = 0.8 + (ratingNormalized * 0.4); // 0.8-1.2
    
    // Completion rate component (0.8-1.0 → 0.95-1.05 multiplier)
    const completionMultiplier = 0.95 + (input.barber_completion_rate * 0.1);
    
    // Experience bonus (more bookings = slight boost)
    const experienceBonus = Math.min(input.barber_total_bookings / 100, 0.1); // Max +10%
    
    return ratingMultiplier * completionMultiplier * (1 + experienceBonus);
  }
  
  /**
   * Calculate demand multiplier based on supply and demand
   */
  private calculateDemandMultiplier(input: PricingInput): number {
    // Calculate demand-to-supply ratio
    const demandPerBarber = input.barbers_available_count > 0
      ? input.bookings_last_24h / input.barbers_available_count
      : input.bookings_last_24h;
    
    // Low demand (0-2 bookings/barber) → 0.9x
    // Medium demand (2-5 bookings/barber) → 1.0x
    // High demand (5-10 bookings/barber) → 1.15x
    // Very high demand (10+ bookings/barber) → 1.3x
    
    if (demandPerBarber < 2) {
      return 0.9;
    } else if (demandPerBarber < 5) {
      return 1.0;
    } else if (demandPerBarber < 10) {
      return 1.0 + ((demandPerBarber - 5) / 5) * 0.15; // Linear 1.0 → 1.15
    } else {
      return Math.min(1.3, 1.15 + ((demandPerBarber - 10) / 20) * 0.15); // Max 1.3x
    }
  }
  
  /**
   * Calculate confidence score based on data quality
   */
  private calculateConfidence(input: PricingInput): number {
    let confidence = 1.0;
    
    // Reduce confidence if limited booking history
    if (input.barber_total_bookings < 5) {
      confidence *= 0.6; // Very limited data
    } else if (input.barber_total_bookings < 20) {
      confidence *= 0.8; // Some data
    }
    
    // Reduce confidence if no recent demand data
    if (input.bookings_last_24h === 0) {
      confidence *= 0.9;
    }
    
    // Reduce confidence if supply data is missing
    if (input.barbers_available_count === 0) {
      confidence *= 0.85;
    }
    
    return Math.max(0, Math.min(1, confidence));
  }
  
  /**
   * Batch calculate prices for multiple barbers (comparison view)
   */
  calculateBatchPrices(inputs: PricingInput[]): PricingOutput[] {
    return inputs.map(input => this.calculatePrice(input));
  }
  
  /**
   * Suggest optimal price range for a new barber
   */
  suggestStartingPrice(input: {
    service_category: 'basic' | 'standard' | 'premium';
    market_type: 'small_campus' | 'medium_campus' | 'large_campus' | 'metro';
    estimated_duration_minutes: number;
  }): { min: number; max: number; recommended: number } {
    const basePrice = BASE_PRICES[input.service_category];
    const marketMultiplier = MARKET_MULTIPLIERS[input.market_type];
    
    const recommendedPrice = new Decimal(basePrice)
      .times(marketMultiplier)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber();
    
    const minPrice = new Decimal(recommendedPrice)
      .times(0.8)
      .toDecimalPlaces(2, Decimal.ROUND_UP)
      .toNumber();
    
    const maxPrice = new Decimal(recommendedPrice)
      .times(1.2)
      .toDecimalPlaces(2, Decimal.ROUND_DOWN)
      .toNumber();
    
    return {
      min: minPrice,
      max: maxPrice,
      recommended: recommendedPrice,
    };
  }
  
  /**
   * Get current time-of-day category
   */
  getCurrentTimeCategory(): 'morning' | 'afternoon' | 'evening' | 'night' | 'weekend' {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    
    // Weekend
    if (day === 0 || day === 6) {
      return 'weekend';
    }
    
    // Weekday time slots
    if (hour >= 6 && hour < 11) return 'morning';
    if (hour >= 11 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }
}

// Singleton instance
export const dynamicPricingService = new DynamicPricingService();

export default dynamicPricingService;

