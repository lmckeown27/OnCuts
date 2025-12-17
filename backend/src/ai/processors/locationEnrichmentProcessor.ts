/**
 * AI Processor: Location Enrichment
 * 
 * Purpose: Process location enrichment jobs from BullMQ
 * 
 * Workflow:
 * 1. Fetch location data
 * 2. Build AI prompt with context
 * 3. Call OpenAI API
 * 4. Validate AI response
 * 5. Apply changes if valid
 * 6. Log enrichment attempt
 */

import { Job } from 'bullmq';
import { Pool } from 'pg';
import OpenAI from 'openai';
import { buildLocationEnrichmentPrompt } from '../prompts/locationEnrichmentPrompt';
import { CampusLocationService } from '../../services/campus-location.service';
import { LocationFuzzyMatchingService } from '../../services/location-fuzzy-matching.service';
import { logger } from '../../utils/logger';

interface LocationEnrichmentJobData {
  locationId: string;
  universityId: string;
  trigger: 'new_location' | 'usage_threshold' | 'admin_request';
}

interface AILocationEnrichmentResponse {
  canonical_name: string | null;
  aliases: string[];
  category: string;
  cohort: string;
  confidence_adjustment: number;
  reasoning: string;
}

export class LocationEnrichmentProcessor {
  private openai: OpenAI;
  private pool: Pool;
  private locationService: CampusLocationService;
  private fuzzyMatcher: LocationFuzzyMatchingService;

  constructor(openai: OpenAI, pool: Pool) {
    this.openai = openai;
    this.pool = pool;
    this.locationService = new CampusLocationService(pool);
    this.fuzzyMatcher = new LocationFuzzyMatchingService(pool);
  }

  /**
   * Process a location enrichment job
   */
  async process(job: Job<LocationEnrichmentJobData>): Promise<void> {
    const { locationId, universityId, trigger } = job.data;

    logger.info('Processing location enrichment job', { locationId, universityId, trigger });

    try {
      // Step 1: Fetch location data
      const location = await this.fetchLocationData(locationId);
      if (!location) {
        logger.warn('Location not found', { locationId });
        return;
      }

      // Step 2: Fetch university context
      const university = await this.fetchUniversityData(universityId);
      if (!university) {
        logger.warn('University not found', { universityId });
        return;
      }

      // Step 3: Build AI prompt
      const prompt = buildLocationEnrichmentPrompt({
        locationName: location.name,
        universityName: university.name,
        universityCity: university.city || 'Unknown',
        universityState: university.state || 'Unknown',
        existingAliases: location.aliases || [],
        currentCategory: location.category,
        currentCohort: location.cohort,
        usageCount: location.usage_count,
      });

      // Step 4: Call OpenAI
      const aiResponse = await this.callOpenAI(prompt);
      if (!aiResponse) {
        logger.warn('AI returned no response', { locationId });
        return;
      }

      // Step 5: Validate AI response
      const isValid = this.validateAIResponse(aiResponse, location);
      if (!isValid) {
        await this.logEnrichmentAttempt(locationId, aiResponse, false, 'Failed validation');
        return;
      }

      // Step 6: Apply changes
      await this.applyEnrichment(locationId, location, aiResponse);

      // Step 7: Log success
      await this.logEnrichmentAttempt(locationId, aiResponse, true, null);

      logger.info('Location enrichment completed', { locationId });
    } catch (error) {
      logger.error('Location enrichment failed', { locationId, error });
      throw error;
    }
  }

  /**
   * Fetch location data from database
   */
  private async fetchLocationData(locationId: string) {
    const result = await this.pool.query(
      `SELECT cl.*,
        ARRAY_AGG(DISTINCT cla.alias) FILTER (WHERE cla.alias IS NOT NULL) as aliases
       FROM campus_locations cl
       LEFT JOIN campus_location_aliases cla ON cla.campus_location_id = cl.id
       WHERE cl.id = $1
       GROUP BY cl.id`,
      [locationId]
    );

    return result.rows[0] || null;
  }

  /**
   * Fetch university context
   */
  private async fetchUniversityData(universityId: string) {
    // TODO: Replace with actual universities table query
    // For now, return mock data
    return {
      id: universityId,
      name: 'California Polytechnic State University',
      city: 'San Luis Obispo',
      state: 'California',
    };
  }

  /**
   * Call OpenAI API with retry logic
   */
  private async callOpenAI(prompt: string): Promise<AILocationEnrichmentResponse | null> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a campus geography expert. Return only valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for factual responses
        max_tokens: 500,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) return null;

      // Parse JSON response
      const parsed = JSON.parse(content);
      return parsed as AILocationEnrichmentResponse;
    } catch (error) {
      logger.error('OpenAI API call failed', { error });
      return null;
    }
  }

  /**
   * Validate AI response before applying
   * 
   * Safety checks:
   * 1. Category is valid enum value
   * 2. Cohort is valid enum value
   * 3. Confidence adjustment is within bounds
   * 4. Aliases pass fuzzy matching threshold
   * 5. Canonical name is similar to original
   */
  private validateAIResponse(aiResponse: AILocationEnrichmentResponse, location: any): boolean {
    const validCategories = ['ON_CAMPUS', 'OFF_CAMPUS', 'DORM', 'APARTMENT', 'COMMON_AREA', 'OTHER'];
    const validCohorts = ['FIRST_YEAR', 'UPPER_CLASS', 'GRAD', 'MIXED', 'UNKNOWN'];

    // Check category
    if (!validCategories.includes(aiResponse.category)) {
      logger.warn('Invalid category from AI', { category: aiResponse.category });
      return false;
    }

    // Check cohort
    if (!validCohorts.includes(aiResponse.cohort)) {
      logger.warn('Invalid cohort from AI', { cohort: aiResponse.cohort });
      return false;
    }

    // Check confidence adjustment
    if (
      aiResponse.confidence_adjustment < 0 ||
      aiResponse.confidence_adjustment > 0.3
    ) {
      logger.warn('Invalid confidence adjustment', {
        adjustment: aiResponse.confidence_adjustment,
      });
      return false;
    }

    // Check canonical name similarity (if provided)
    if (aiResponse.canonical_name) {
      const similarity = this.fuzzyMatcher['calculateSimilarity'](
        location.name,
        aiResponse.canonical_name
      );
      if (similarity < 0.6) {
        logger.warn('Canonical name too different from original', {
          original: location.name,
          canonical: aiResponse.canonical_name,
          similarity,
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Apply AI enrichment to location
   */
  private async applyEnrichment(
    locationId: string,
    location: any,
    aiResponse: AILocationEnrichmentResponse
  ): Promise<void> {
    // Update classification
    await this.locationService.updateLocationClassification(
      locationId,
      aiResponse.category !== location.category ? aiResponse.category : undefined,
      aiResponse.cohort !== location.cohort ? aiResponse.cohort : undefined,
      aiResponse.confidence_adjustment
    );

    // Add validated aliases
    if (aiResponse.aliases && aiResponse.aliases.length > 0) {
      const validatedAliases = await this.fuzzyMatcher.batchCheckAliases(
        location.university_id,
        locationId,
        aiResponse.aliases
      );

      for (const { alias, matches } of validatedAliases) {
        if (matches) {
          await this.locationService.addAlias(locationId, alias);
        }
      }
    }

    // Update name to canonical if AI provided one
    if (aiResponse.canonical_name && aiResponse.canonical_name !== location.name) {
      await this.pool.query(
        `UPDATE campus_locations
         SET name = $1, updated_at = NOW()
         WHERE id = $2`,
        [aiResponse.canonical_name, locationId]
      );
    }

    logger.info('Applied AI enrichment', {
      locationId,
      categoryChanged: aiResponse.category !== location.category,
      cohortChanged: aiResponse.cohort !== location.cohort,
      aliasesAdded: aiResponse.aliases.length,
      confidenceBoost: aiResponse.confidence_adjustment,
    });
  }

  /**
   * Log enrichment attempt to audit table
   */
  private async logEnrichmentAttempt(
    locationId: string,
    aiResponse: AILocationEnrichmentResponse,
    applied: boolean,
    rejectedReason: string | null
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO location_enrichment_log (
        campus_location_id,
        ai_suggested_name,
        ai_suggested_category,
        ai_suggested_cohort,
        ai_suggested_aliases,
        ai_confidence_adjustment,
        applied,
        applied_at,
        rejected_reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        locationId,
        aiResponse.canonical_name,
        aiResponse.category,
        aiResponse.cohort,
        aiResponse.aliases,
        aiResponse.confidence_adjustment,
        applied,
        applied ? new Date() : null,
        rejectedReason,
      ]
    );
  }
}

