# Campus Location Ingestion System
## Production-Grade Crowd-Sourced Location Management with AI Enrichment

**Version:** 1.0  
**Date:** December 16, 2025  
**Status:** ✅ Complete and Production-Ready

---

## 🎯 Overview

The Campus Location Ingestion System is a sophisticated, scalable solution for managing campus service locations across all universities without hardcoding. It leverages crowd-sourcing, AI enrichment, fuzzy matching, and automatic quality scoring to create a self-improving location registry.

### Key Features

✅ **Zero Hardcoding**: Works for any university without manual configuration  
✅ **Crowd-Sourced**: Barbers contribute locations, system auto-deduplicates  
✅ **AI-Enriched**: OpenAI verifies, normalizes, and classifies locations  
✅ **Smart Deduplication**: Multi-algorithm fuzzy matching prevents duplicates  
✅ **Confidence Scoring**: Locations improve with usage  
✅ **Auto-Promotion**: High-quality locations automatically verified  
✅ **Scalable**: Designed for 1,000+ universities

---

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BARBER INPUT LAYER                        │
│  "Yak Yit Dorm" → Normalization → "yakit yutyu dorm"       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                 DEDUPLICATION LAYER                          │
│  Fuzzy Matching: Edit Distance + Trigrams + Tokens         │
│  Threshold: 88% similarity → Match vs. New                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
         ↓                           ↓
    [MATCH FOUND]              [NO MATCH]
         │                           │
         ↓                           ↓
  Increment Usage            Create New Location
  Boost Confidence            (confidence: 0.3)
         │                           │
         └─────────────┬─────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                   AI ENRICHMENT LAYER                        │
│  OpenAI GPT-4o-mini verifies:                               │
│  - Canonical name (e.g., "Yakʔitʸuʸu Hall")                │
│  - Aliases (e.g., ["Yak Hall", "YY Dorm"])                  │
│  - Category (DORM, APARTMENT, ON_CAMPUS, etc.)              │
│  - Cohort (FIRST_YEAR, UPPER_CLASS, GRAD, etc.)             │
│  - Confidence Boost (0.0 to 0.3)                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                 PROMOTION LAYER                              │
│  Auto-verify when:                                           │
│   ✓ usage_count >= 5                                        │
│   ✓ confidence >= 0.8                                        │
│   ✓ cohort != UNKNOWN                                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              CAMPUS LOCATION REGISTRY                        │
│  Verified locations available for all barbers               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema

### `campus_locations`

Primary table storing all campus service locations.

```sql
CREATE TABLE campus_locations (
  id UUID PRIMARY KEY,
  university_id UUID NOT NULL,
  name TEXT NOT NULL,                    -- Display name
  normalized_name TEXT NOT NULL,          -- Deduplication key
  
  category VARCHAR(32) CHECK (category IN (
    'ON_CAMPUS', 'OFF_CAMPUS', 'DORM', 
    'APARTMENT', 'COMMON_AREA', 'OTHER'
  )),
  
  cohort VARCHAR(32) CHECK (cohort IN (
    'FIRST_YEAR', 'UPPER_CLASS', 'GRAD', 
    'MIXED', 'UNKNOWN'
  )),
  
  usage_count INTEGER DEFAULT 1,
  confidence NUMERIC(3,2) DEFAULT 0.30,  -- 0.30 to 1.0
  is_verified BOOLEAN DEFAULT FALSE,
  
  created_by_user_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (university_id, normalized_name)
);
```

**Indexes:**
- `university_id` (for fast university-scoped queries)
- `normalized_name` (for fuzzy matching)
- `university_id + is_verified + confidence` (for selection UI)
- `category` (for filtered searches)
- `usage_count` (for popularity sorting)

### `campus_location_aliases`

Alternative names for locations (e.g., nicknames, abbreviations).

```sql
CREATE TABLE campus_location_aliases (
  id UUID PRIMARY KEY,
  campus_location_id UUID REFERENCES campus_locations(id),
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (campus_location_id, normalized_alias)
);
```

### `location_enrichment_log`

Audit log for all AI enrichment attempts.

```sql
CREATE TABLE location_enrichment_log (
  id UUID PRIMARY KEY,
  campus_location_id UUID REFERENCES campus_locations(id),
  
  ai_suggested_name TEXT,
  ai_suggested_category VARCHAR(32),
  ai_suggested_cohort VARCHAR(32),
  ai_suggested_aliases TEXT[],
  ai_confidence_adjustment NUMERIC(3,2),
  
  applied BOOLEAN DEFAULT FALSE,
  applied_at TIMESTAMP,
  rejected_reason TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `location_merge_log`

Audit log for location merges (deduplication).

```sql
CREATE TABLE location_merge_log (
  id UUID PRIMARY KEY,
  source_location_id UUID,
  target_location_id UUID REFERENCES campus_locations(id),
  merged_by_user_id UUID,
  merge_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔧 Backend Services

### 1. `TextNormalizationService`

**Purpose**: Deterministic text normalization for matching.

**Key Methods**:
- `normalizeForMatching(text)`: Aggressive normalization for deduplication
  ```typescript
  "Yakʔitʸuʸu Hall" → "yakit yutyu hall"
  ```
- `normalizeForDisplay(text)`: Preserve formatting for display
- `extractAcronym(text)`: Generate acronyms ("Poly Canyon Village" → "PCV")
- `similarityRatio(str1, str2)`: Calculate edit distance similarity (0.0-1.0)

### 2. `LocationFuzzyMatchingService`

**Purpose**: Intelligent duplicate detection using multiple algorithms.

**Algorithms**:
1. **Edit Distance (50% weight)**: Levenshtein distance
2. **Trigram Similarity (30% weight)**: Character 3-gram overlap
3. **Token Overlap (20% weight)**: Word-level matching
4. **Acronym Bonus**: +10% if acronym matches

**Threshold**: 88% similarity required for match.

**Key Methods**:
- `findMatches(universityId, locationName, category?)`: Find duplicate candidates
- `batchCheckAliases(universityId, locationId, aliases)`: Validate AI-suggested aliases

### 3. `CampusLocationService`

**Purpose**: Core business logic for location management.

**Key Workflows**:

#### Submit Location
```typescript
await locationService.submitLocation({
  universityId: 'calpoly-slo',
  locationName: 'Yak Yit Dorm',
  category: 'DORM',
  userId: 'user-123'
});
```

**Process**:
1. Normalize input
2. Check for duplicates (fuzzy matching)
3. If match → increment usage, boost confidence
4. If no match → create new location
5. Queue for AI enrichment

#### Usage Tracking
Every time a location is selected:
- `usage_count += 1`
- `confidence += 0.05` (capped at 1.0)

#### Auto-Promotion
Locations automatically verified when:
- ✅ `usage_count >= 5`
- ✅ `confidence >= 0.8`
- ✅ `cohort != UNKNOWN`

### 4. `LocationEnrichmentProcessor` (AI Worker)

**Purpose**: AI-powered verification and classification.

**OpenAI Prompt**:
```
You are a campus geography expert helping verify a location.

Location: "Yak Yit Dorm"
University: California Polytechnic State University
City: San Luis Obispo, CA

Provide:
1. Canonical name (official name if you recognize it)
2. Aliases (common nicknames)
3. Category (DORM, APARTMENT, etc.)
4. Cohort (FIRST_YEAR, UPPER_CLASS, etc.)
5. Confidence boost (0.0 to 0.3)

Return JSON only.
```

**Safety Checks**:
- ✅ Category must be valid enum
- ✅ Cohort must be valid enum
- ✅ Confidence boost must be 0.0-0.3
- ✅ Canonical name must be >60% similar to original
- ✅ Aliases must pass fuzzy matching (>85% similarity)

**AI Response Example**:
```json
{
  "canonical_name": "Yakʔitʸuʸu Hall",
  "aliases": ["Yak Hall", "Yak Yit", "YY Dorm"],
  "category": "DORM",
  "cohort": "FIRST_YEAR",
  "confidence_adjustment": 0.3,
  "reasoning": "Yakʔitʸuʸu is a first-year residence hall at Cal Poly SLO"
}
```

---

## 🌐 API Endpoints

### Public Endpoints

#### `POST /api/locations/submit`
Submit a new location.

**Request**:
```json
{
  "universityId": "calpoly-slo",
  "locationName": "Yak Yit Dorm",
  "category": "DORM"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "location": {
      "id": "uuid",
      "name": "Yak Yit Dorm",
      "category": "DORM",
      "usageCount": 1,
      "confidence": 0.3,
      "isVerified": false
    }
  }
}
```

#### `GET /api/locations`
Get all locations for a university.

**Query Params**:
- `universityId` (required)
- `category` (optional)

**Response**: Returns verified locations first, sorted by confidence and usage.

#### `GET /api/locations/search`
Autocomplete search.

**Query Params**:
- `universityId` (required)
- `q` (search query)
- `limit` (default: 10)

**Response**: Fuzzy-matched locations.

#### `GET /api/locations/:id`
Get single location by ID.

### Admin Endpoints

#### `GET /api/admin/locations/unverified`
View unverified locations requiring review.

**Query Params**:
- `universityId` (optional)
- `minUsageCount` (default: 2)
- `limit` (default: 50)

#### `POST /api/admin/locations/:id/verify`
Manually verify a location.

#### `POST /api/admin/locations/merge`
Merge duplicate locations.

**Request**:
```json
{
  "sourceLocationId": "uuid-to-delete",
  "targetLocationId": "uuid-to-keep",
  "reason": "Admin manual merge"
}
```

#### `POST /api/admin/locations/:id/enrich`
Trigger AI enrichment for a location.

#### `PUT /api/admin/locations/:id`
Update location details (name, category, cohort).

#### `DELETE /api/admin/locations/:id`
Delete a location (only if no bookings reference it).

#### `GET /api/admin/locations/enrichment-log`
View AI enrichment history.

#### `GET /api/admin/locations/merge-log`
View merge history.

#### `GET /api/admin/locations/duplicates`
Find potential duplicates.

**Query Params**:
- `universityId` (optional)
- `threshold` (default: 0.9)

---

## 🎨 Frontend Integration

### `LocationSelector` Component

**Purpose**: Autocomplete dropdown for location selection.

**Features**:
- ✅ Search existing locations
- ✅ Show verified locations first
- ✅ Display aliases
- ✅ "Add new location" option
- ✅ Inline category selection
- ✅ Real-time autocomplete

**Usage**:
```tsx
<LocationSelector
  universityId="calpoly-slo"
  selectedLocationId={formData.locationId}
  onLocationSelect={(locationId, locationName) => {
    setFormData({ ...formData, locationId, locationName });
  }}
/>
```

**UI Flow**:
1. Click dropdown → Shows verified locations first
2. Type to search → Fuzzy matches as you type
3. Click "Add New Location" → Inline form appears
4. Select category → Submit → Location created
5. Auto-deduplication happens server-side

---

## 📈 Confidence Scoring System

### Initial Confidence
New locations start at **0.30** (30%).

### Confidence Boosts

| Event | Boost | Cap |
|-------|-------|-----|
| Each usage | +0.05 | 1.0 |
| AI enrichment (high confidence) | +0.30 | 1.0 |
| AI enrichment (medium confidence) | +0.15 | 1.0 |
| AI enrichment (low confidence) | +0.05 | 1.0 |
| Admin manual verification | Set to 1.0 | 1.0 |

### Verification Criteria
```
is_verified = true IF:
  usage_count >= 5 AND
  confidence >= 0.8 AND
  cohort != 'UNKNOWN'
```

---

## 🚀 Why This System Works

### 1. **Zero Hardcoding**
No university-specific code paths. Every university follows the same flow.

### 2. **Self-Improving**
- More usage → Higher confidence
- AI enrichment → Better classification
- Auto-promotion → Quality assurance

### 3. **Scalable**
- Works identically for 10 or 10,000 universities
- No manual configuration required
- Database indexes ensure fast queries at scale

### 4. **Safe AI Integration**
- AI is advisory, not authoritative
- Backend validates all AI suggestions
- All AI actions logged for auditing
- Human admin override available

### 5. **Economic Signal**
- High-usage locations = high demand
- Can inform market-level pricing strategies
- Barbers naturally gravitate to verified locations

---

## 🔄 Migration & Deployment

### Database Migration

**File**: `backend/src/database/migrations/008_campus_locations.sql`

**Apply**:
```bash
psql -U postgres -d campuscuts < backend/src/database/migrations/008_campus_locations.sql
```

### Environment Variables

```env
# AI Enrichment (existing)
OPENAI_API_KEY=sk-...

# Database (existing)
DATABASE_URL=postgresql://...
```

### Backend Deployment

1. Install dependencies (none new required)
2. Apply database migration
3. Restart backend server
4. Verify routes: `curl http://localhost:3001/api/locations?universityId=test`

### Frontend Deployment

1. New component: `web-app/src/components/LocationSelector.tsx`
2. Updated page: `web-app/src/pages/BarberProfilePage.tsx`
3. Build and deploy: `npm run build`

---

## 📊 Monitoring & Metrics

### Key Metrics to Track

1. **Location Quality**:
   - % of locations verified
   - Average confidence score
   - Deduplication rate (matched vs. new)

2. **AI Enrichment**:
   - Enrichment success rate
   - Average confidence boost
   - AI rejection rate

3. **User Adoption**:
   - New locations submitted per day
   - Location selection rate (new vs. existing)
   - Top locations by usage

### Admin Dashboard Queries

**Unverified High-Usage Locations**:
```sql
SELECT * FROM campus_locations
WHERE is_verified = false
AND usage_count >= 3
ORDER BY usage_count DESC, confidence DESC
LIMIT 20;
```

**AI Enrichment Success Rate**:
```sql
SELECT 
  COUNT(*) FILTER (WHERE applied = true) as successful,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE applied = true) / COUNT(*), 2) as success_rate
FROM location_enrichment_log
WHERE created_at > NOW() - INTERVAL '30 days';
```

**Top Locations by University**:
```sql
SELECT university_id, name, usage_count, confidence, is_verified
FROM campus_locations
WHERE university_id = 'calpoly-slo'
ORDER BY usage_count DESC
LIMIT 10;
```

---

## 🎯 Future Enhancements

### Phase 2 (Optional)
1. **Geolocation**:
   - Add lat/lng to locations
   - Distance-based filtering
   - Map view for selection

2. **Photos**:
   - Upload location photos
   - Community verification via photos

3. **Real-Time Analytics**:
   - Live dashboard of location additions
   - Heat map of service demand by location

4. **Advanced Deduplication**:
   - ML model for even better duplicate detection
   - Cross-university location matching

### Phase 3 (Optional)
1. **Integration with Building APIs**:
   - University building databases
   - Official residence hall rosters
   - Campus map integrations

---

## ✅ Verification Checklist

- [x] Database schema created
- [x] Normalization service implemented
- [x] Fuzzy matching service implemented
- [x] Location management service implemented
- [x] AI enrichment worker implemented
- [x] API routes implemented
- [x] Admin endpoints implemented
- [x] Frontend component implemented
- [x] Booking flow integrated
- [x] No hardcoded campus data
- [x] Works for any university
- [x] AI safety checks in place
- [x] Audit logging implemented
- [x] Auto-promotion logic implemented

---

## 🎉 Summary

The Campus Location Ingestion System is now **production-ready**. It provides a scalable, intelligent, and self-improving location registry that works for any university without manual configuration.

**Key Achievement**: CampusCuts can now scale to 1,000+ universities with zero location-related technical debt.

**Next Steps**:
1. Apply database migration
2. Deploy backend
3. Deploy frontend
4. Monitor initial usage
5. Tune confidence scoring thresholds if needed

---

**Documentation Complete**  
**System Ready for Production** ✅

