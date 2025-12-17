/**
 * AI Prompt: Location Enrichment
 * 
 * Purpose: Verify, normalize, and classify campus locations
 * 
 * Input: User-submitted location name + university context
 * Output: Canonical name, aliases, category, cohort, confidence
 * 
 * AI Role: Advisory, not authoritative
 * Backend validates all AI suggestions before applying
 */

interface LocationEnrichmentInput {
  locationName: string;
  universityName: string;
  universityCity: string;
  universityState: string;
  existingAliases: string[];
  currentCategory: string;
  currentCohort: string;
  usageCount: number;
}

export function buildLocationEnrichmentPrompt(input: LocationEnrichmentInput): string {
  return `You are a campus geography expert helping verify and classify a student housing location.

# CONTEXT

University: ${input.universityName}
Location: ${input.universityCity}, ${input.universityState}
Submitted Location Name: "${input.locationName}"
Current Category: ${input.currentCategory}
Current Cohort: ${input.currentCohort}
Usage Count: ${input.usageCount}
Existing Aliases: ${input.existingAliases.length > 0 ? input.existingAliases.join(', ') : 'None'}

# YOUR TASK

Analyze this location name and provide structured classification information.

## CATEGORIES (choose one):
- ON_CAMPUS: University-owned buildings, facilities
- OFF_CAMPUS: Off-campus locations not owned by university
- DORM: On-campus dormitory/residence hall
- APARTMENT: Off-campus apartment complex
- COMMON_AREA: Shared spaces like library, quad, student center
- OTHER: Cannot determine

## COHORTS (choose one):
- FIRST_YEAR: Primarily freshman/first-year students
- UPPER_CLASS: Upperclassmen (sophomores, juniors, seniors)
- GRAD: Graduate student housing
- MIXED: Multiple cohorts live here
- UNKNOWN: Cannot determine student demographic

## INSTRUCTIONS

1. **Canonical Name**: Provide the most official/formal name if you recognize it
2. **Aliases**: List common nicknames, abbreviations, or alternate names
3. **Category**: Select the most appropriate category
4. **Cohort**: Identify the primary student demographic
5. **Confidence**: Rate your confidence (0.0 to 0.3) based on:
   - 0.3: You are very confident (know this specific location)
   - 0.2: Reasonably confident (name patterns match known conventions)
   - 0.1: Low confidence (making educated guess)
   - 0.0: No confidence (insufficient information)

## IMPORTANT CONSTRAINTS

- Do NOT invent information you don't know
- If you don't recognize the location, say so
- Generic names like "my dorm" or "apartment" should return low confidence
- Only suggest aliases that are plausible variations of the input
- Consider regional naming conventions (e.g., "Yak" for "Yakʔitʸuʸu")
- If input is already an acronym (e.g., "PCV"), suggest the full name if known

# OUTPUT FORMAT

Return ONLY valid JSON (no markdown, no explanations):

{
  "canonical_name": "Official Name" or null,
  "aliases": ["nickname1", "nickname2"] or [],
  "category": "DORM|APARTMENT|ON_CAMPUS|OFF_CAMPUS|COMMON_AREA|OTHER",
  "cohort": "FIRST_YEAR|UPPER_CLASS|GRAD|MIXED|UNKNOWN",
  "confidence_adjustment": 0.0 to 0.3,
  "reasoning": "Brief explanation of classification"
}

# EXAMPLE RESPONSE

{
  "canonical_name": "Yakʔitʸuʸu Hall",
  "aliases": ["Yak Hall", "Yak Yit", "YY Dorm"],
  "category": "DORM",
  "cohort": "FIRST_YEAR",
  "confidence_adjustment": 0.3,
  "reasoning": "Yakʔitʸuʸu is a first-year residence hall at Cal Poly SLO, commonly abbreviated as 'Yak'"
}

Now analyze the submitted location and return your classification in JSON format.`;
}

