# Phase 2: Property Retrieval — Supabase Query Integration

**Status:** Specification (Awaiting Approval)  
**Date:** April 11, 2026  
**Objective:** Replace placeholder property lookup logic in SHOW_RESULTS with real Supabase queries returning structured property data.

---

## 1. Overview

Phase 2 extends the Phase 1 deterministic chat flow by:
- Replacing `getResultSummary()` placeholder with structured property queries
- Returning full property objects (not just titles) with id, title, location, price, bhk
- Implementing conditional, deterministic SQL-based filtering
- Handling graceful fallback when filters are incomplete
- Supporting up to 5 results per request

**Key Constraint:** All filtering must be deterministic SQL-based. No AI, no in-memory filtering, no post-query processing.

---

## 2. Available Data at SHOW_RESULTS

When the flow reaches `SHOW_RESULTS` step, the conversation's `collected_data` contains:

| Field | Type | Status |
|-------|------|--------|
| `intent` | 'buy' \| 'rent' \| 'explore' | ✅ Always present |
| `location` | string \| null | ⚠️ May be null/empty/generic (see validation rules below) |
| `budget_min` | number \| null | ⚠️ May be null (no budget provided) |
| `budget_max` | number \| null | ⚠️ May be null (no budget provided) |
| `property_type` | 'apartment' \| 'villa' \| 'plot' \| 'commercial' | ✅ Always present |
| `bhk` | string | ✅ Always present (user input, e.g., "2BHK", requires normalization) |
| `timeline` | 'urgent' \| 'soon' \| 'flexible' | ✅ Always present |

**Note:** `intent`, `property_type`, and `timeline` are guaranteed from Phase 1 validation.

**Location Validation:** Location must be validated before applying filter:
- Skip filter if location is null, empty string, or whitespace-only
- Skip filter if location length < 3 characters  
- Skip filter if location is generic/non-specific (e.g., "anywhere", "all", "vizag")
- Only apply location ILIKE filter if: `location && location.trim().length >= 3 && !isGeneric(location)`

---

## 3. Database Schema (Read-Only)

### `properties` Table

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | No | Primary key |
| `title` | TEXT | No | Listing title |
| `location` | TEXT | No | Area/locality in Visakhapatnam |
| `price` | INT | No | Price in rupees |
| `type` | TEXT | Yes | Property category (apartment/villa/plot/commercial) |
| `bhk` | TEXT | Yes | BHK configuration (e.g., "2BHK", "1BHK") |
| `is_available` | BOOLEAN | No | Availability flag (default true) |
| `status` | TEXT | Yes | Listing status |
| `description` | TEXT | Yes | Full description |
| `agent_id` | UUID | Yes | Assigned agent |
| `created_at` | TIMESTAMP | No | Creation datetime |

**Availability Constraint:** Always query with `is_available = true`.

---

## 4. Filtering Logic

### Strict Null/Empty Validation Rules

Before applying any conditional filter, verify:
- Value is not null
- Value is not undefined
- Value is not empty string ("")  
- For strings: value.trim().length > 0

### Deterministic Filter Application

Filters are applied conditionally based on collected data availability:

```
ALWAYS APPLY:
  ✅ is_available = true

CONDITIONALLY APPLY:
  📍 IF location passes validation:
     - Check: location is not null/undefined/empty AND location.trim().length >= 3
     - Check: NOT a generic term (e.g., "anywhere", "all", "vizag")
     - Apply ILIKE filter: location ~* `%${location}%` (case-insensitive substring match)
     - Rationale: Location may contain partial names (e.g., "ram" matches "Rambagh")
  
  💰 IF budget_min is a number (not null, not undefined):
     → Apply GTE filter: price >= budget_min
  
  💰 IF budget_max is a number (not null, not undefined):
     → Apply LTE filter: price <= budget_max
  
  🏠 IF property_type is provided and not null:
     → Apply EQ filter: type = property_type
     → Note: User input "apartment" maps directly to properties.type column
  
  🛏️ IF bhk is provided and not null after normalization:
     → Normalize: remove whitespace, convert to UPPERCASE
     → Example: "2 bhk" → "2BHK", "2bhk" → "2BHK"
     → Apply EQ filter: UPPER(bhk) = UPPER(normalized_bhk)
     → Rationale: User input formats vary; normalize before exact match
```

### Filter Application Order (for determinism)

1. `is_available = true`
2. `location` (ILIKE if validation passes)
3. `type` (EQ if property_type provided and not null)
4. `price` (GTE if budget_min is number, LTE if budget_max is number)
5. `bhk` (EQ on UPPER() if normalized bhk is not null)

This order ensures consistent query plan generation.

---

## 5. Result Limit & Sorting

### Row Limit
- **Maximum:** 5 properties per query
- **Rationale:** Prevents overwhelming user with options; matches Phase 1 `getResultSummary` behavior (top 3 titles)

### Sorting
- **Primary:** `created_at DESC` (newest first)
- **Rationale:** Provides deterministic ordering independent of any "relevance" or AI scoring. Newest listings are typically higher engagement signals.

---

## 6. Response Structure

### New Response Format

The API response must be updated to include property details:

```typescript
interface Property {
  id: string        // UUID
  title: string     // Listing title
  location: string  // Area/locality
  price: number     // Price in rupees
  bhk?: string      // BHK configuration (may be null in DB)
}

interface ChatApiResponse {
  // ... existing fields ...
  
  // NEW FIELD (included when step = SHOW_RESULTS)
  properties?: Property[]
}
```

### Response Message Quality Rules

Response message must include:
- Count of properties found
- Location (if valid and was applied as filter)
- User-friendly language

**Examples:**

With location filter applied:
```
"Great! I found 3 properties in Madhurawada matching your criteria."
"I found 5 properties in Rambagh matching your criteria."
```

Without location filter (generic or missing):
```
"Great! I found 4 properties matching your criteria."
"I found 2 properties matching your criteria."
```

No matches all fallback attempts:
```
"No exact matches found, but the agent can help you further."
```

Query error:
```
"I'm having trouble fetching results right now. Let me connect you with an agent."
```

### Example Response (SHOW_RESULTS step with location)

```json
{
  "success": true,
  "sessionId": "uuid...",
  "conversationId": "uuid...",
  "step": "SHOW_RESULTS",
  "response": "Great! I found 3 properties in Madhurawada matching your criteria.",
  "properties": [
    {
      "id": "uuid-1",
      "title": "Beautiful 2BHK in Visakhapatnam",
      "location": "Madhurawada",
      "price": 3500000,
      "bhk": "2BHK"
    },
    {
      "id": "uuid-2",
      "title": "Premium Villa near Beach",
      "location": "Madhurawada",
      "price": 4200000,
      "bhk": "3BHK"
    },
    {
      "id": "uuid-3",
      "title": "Modern Apartment Complex",
      "location": "Madhurawada",
      "price": 3800000,
      "bhk": "2BHK"
    }
  ],
  "collectedData": { /* ... */ }
}
```

---

## 7. Fallback Behavior & Over-Filtering Protection

### Scenario 1: Successful Match (Standard Case)
**Condition:** Query with all applicable filters returns ≥ 1 result  
**Action:** Return results (up to 5) sorted by created_at DESC  
**No retry needed** - proceed normally.

### Scenario 2: No Matches Found (Strict Filtering Retry)
**Condition:** Query returns 0 rows  
**Action:** Implement graceful fallback retry sequence:

#### Retry Strategy (Deterministic)
Execute retries **in order** until results found or all retries exhausted:

```
RETRY 1: Remove BHK filter
  - Keep: is_available=true, location (if valid), type, price range
  - IF results > 0 → return results
  - Log: 'Removed bhk filter, got {count} results'

RETRY 2: If RETRY 1 returned 0 → Remove PRICE filters
  - Keep: is_available=true, location (if valid), type
  - Remove: budget_min, budget_max
  - IF results > 0 → return results
  - Log: 'Removed price filters, got {count} results'

RETRY 3: If RETRY 2 returned 0 → Return Latest 5 Available Properties
  - Keep: ONLY is_available=true
  - Remove: location, type, price, bhk
  - Sort: created_at DESC, limit 5
  - Log: 'Returning latest properties (all filters removed), got {count} results'
```

**Fallback Response (after all retries):**
```json
{
  "success": true,
  "step": "SHOW_RESULTS",
  "response": "No exact matches found, but the agent can help you further.",
  "properties": [],
  "collectedData": { /* ... */ }
}
```

**Rationale:** Progressive relaxation ensures user sees results when possible rather than immediate empty state.

### Scenario 3: Partial Matches
**Condition:** Query returns fewer than 5 results  
**Action:** Return all available results (no padding, no defaults)  
**Response:**
```json
{
  "success": true,
  "step": "SHOW_RESULTS",
  "response": "I found 2 properties matching your criteria.",
  "properties": [ /* 2 items */ ],
  "collectedData": { /* ... */ }
}
```

### Scenario 4: Location Skipped (Generic/Short)
**Condition:** Location is null, empty, < 3 chars, or generic  
**Action:** Skip location filter; return latest 5 properties matching other filters  
**Example Query:**
```sql
SELECT * FROM properties 
WHERE is_available = true
  AND type = 'apartment'
  AND price BETWEEN 2000000 AND 5000000
ORDER BY created_at DESC
LIMIT 5
```

### Scenario 5: Budget Missing (null budget_min/max)
**Condition:** Both `budget_min` and `budget_max` are null  
**Action:** Skip price filters entirely  
**Example Query:**
```sql
SELECT * FROM properties 
WHERE is_available = true
  AND location ILIKE '%visakhapatnam%'
  AND type = 'apartment'
ORDER BY created_at DESC
LIMIT 5
```

### Scenario 6: Query Failure (Supabase Error)
**Condition:** Database query throws error (network, permission, etc.)  
**Action:** Deterministic error handling  
**Response:**
```json
{
  "success": true,
  "step": "SHOW_RESULTS",
  "response": "I'm having trouble fetching results right now. Let me connect you with an agent.",
  "properties": [],
  "collectedData": { /* ... */ }
}
```
**Log Entry:**
```
[property-service] query failed
{
  error: "Error message from Supabase",
  failedAttempt: 1,
  sessionId: "session-uuid"
}
```

**Note:** User flow continues to CAPTURE_NAME step for escalation/follow-up regardless of error.

---

## 8. Service Architecture

### New File: `lib/propertyService.ts`

**Purpose:** Encapsulate all deterministic property query logic with fallback retry strategy.

**Exports:**

```typescript
export interface PropertyFilter {
  location?: string | null     // Optional location filter (validated by caller)
  budget_min?: number | null
  budget_max?: number | null
  property_type?: string       // Mapped from collected_data.property_type
  bhk?: string                 // User input, will be normalized before query
}

export interface PropertyResult {
  id: string
  title: string
  location: string
  price: number
  bhk?: string
}

/**
 * Deterministic query to fetch matching properties with fallback retry strategy.
 * 
 * Algorithm:
 * 1. Try query with all applicable filters
 * 2. If 0 results: Retry without bhk filter
 * 3. If still 0: Retry without price filters
 * 4. If still 0: Return latest 5 available properties
 * 
 * @param filters - Conditional filter criteria (location already validated)
 * @returns Promise<PropertyResult[]> - Up to 5 matching properties
 */
export async function getMatchingProperties(filters: PropertyFilter): Promise<PropertyResult[]>
```

### Integration with chatService

In `lib/chatService.ts`, the `processConversationTurn()` function must be updated:

**Current Behavior (SHOW_RESULTS case):**
```typescript
case ChatStep.SHOW_RESULTS: {
  const summary = await getResultSummary(conversation)
  const titles = summary.topTitles.length > 0 ? summary.topTitles.join(', ') : 'no exact title matches yet'
  response = `Great! I found ${summary.count} properties matching your criteria. Top matches: ${titles}.`
  conversation.step = getNextStep(conversation.step)
  break
}
```

**New Behavior (Phase 2):**
```typescript
case ChatStep.SHOW_RESULTS: {
  const filters: PropertyFilter = {
    location: isValidLocation(conversation.collected_data.location) 
      ? conversation.collected_data.location 
      : undefined,
    budget_min: conversation.collected_data.budget_min,
    budget_max: conversation.collected_data.budget_max,
    property_type: conversation.collected_data.property_type,
    bhk: conversation.collected_data.bhk
  }
  
  const properties = await getMatchingProperties(filters)
  const count = properties.length
  
  // Build response message with location context
  let message: string
  if (count === 0) {
    message = "No exact matches found, but the agent can help you further."
  } else if (filters.location && isValidLocation(conversation.collected_data.location)) {
    message = `Great! I found ${count} properties in ${filters.location} matching your criteria.`
  } else {
    message = `Great! I found ${count} properties matching your criteria.`
  }
  
  response = message
  
  // NOTE: Properties are returned in API response (see chat/route.ts)
  // Do NOT store in conversation object or persist to database
  
  conversation.step = getNextStep(conversation.step)
  break
}

// Helper function to check location validity
function isValidLocation(location: string | undefined | null): boolean {
  if (!location) return false
  const trimmed = location.trim()
  if (trimmed.length < 3) return false
  const generic = ['anywhere', 'all', 'vizag', 'visakhapatnam']
  return !generic.includes(trimmed.toLowerCase())
}
```

**Key Changes:**
1. Call `getMatchingProperties()` with validated filters
2. Build response message dynamically based on count + location
3. Properties returned in chatService for caller to include in response (not stored in conversation)
4. Remove `getResultSummary()` function (no longer needed)

### API Route Integration (app/api/chat/route.ts)

**Current Code:**
```typescript
const result = await processConversationTurn(conversation, message)
const payload: ChatApiResponse = {
  success: true,
  sessionId,
  conversationId: conversation.id,
  step: conversation.step,
  response: result.response,
  collectedData: conversation.collected_data,
  requiresEscalation: result.requiresEscalation,
  isCompleted: result.isCompleted,
}
```

**Updated Code:**
```typescript
const result = await processConversationTurn(conversation, message)

// Include properties only when SHOW_RESULTS step
const payload: ChatApiResponse = {
  success: true,
  sessionId,
  conversationId: conversation.id,
  step: conversation.step,
  response: result.response,
  collectedData: conversation.collected_data,
  requiresEscalation: result.requiresEscalation,
  isCompleted: result.isCompleted,
  ...(conversation.step === ChatStep.SHOW_RESULTS && result.properties 
    ? { properties: result.properties } 
    : {}),
}
```

**Or simpler approach:**
```typescript
const payload: ChatApiResponse = {
  success: true,
  sessionId,
  conversationId: conversation.id,
  step: conversation.step,
  response: result.response,
  collectedData: conversation.collected_data,
  requiresEscalation: result.requiresEscalation,
  isCompleted: result.isCompleted,
  properties: result.properties, // Undefined if not SHOW_RESULTS
}
```

**Action Items:**
1. Remove `getResultSummary()` function from chatService.ts
2. Create `propertyService.ts` with `getMatchingProperties()` implementing fallback retry
3. Update SHOW_RESULTS case in `processConversationTurn()` to call propertyService
4. Extend `ProcessResult` interface to include `properties?: PropertyResult[]`
5. Update API route to conditionally include properties in response
6. Implement `isValidLocation()` helper

---

## 9. Logging Requirements

### propertyService.ts Logging

#### Initial Query Attempt
```typescript
console.log('[property-service] initial query', {
  filters: {
    location: filters.location,
    budget_min: filters.budget_min,
    budget_max: filters.budget_max,
    property_type: filters.property_type,
    bhk: filters.bhk
  },
  sessionId: conversation.session_id
})
```

#### Query Result
```typescript
console.log('[property-service] initial query result', {
  count: properties.length,
  maxResults: 5,
  filters_applied: {
    location: !!filters.location,
    budget_min: typeof filters.budget_min === 'number',
    budget_max: typeof filters.budget_max === 'number',
    property_type: !!filters.property_type,
    bhk: !!filters.bhk
  }
})
```

#### Fallback Retry Attempts (Log each attempt)
```typescript
// RETRY 1: Remove BHK
console.log('[property-service] retry 1: removed bhk filter', {
  resultCount: properties.length,
  filters_now_applied: {
    location: !!filters.location,
    budget_min: typeof filters.budget_min === 'number',
    budget_max: typeof filters.budget_max === 'number',
    property_type: !!filters.property_type,
    bhk: false
  }
})

// RETRY 2: Remove Price
console.log('[property-service] retry 2: removed price filters', {
  resultCount: properties.length,
  filters_now_applied: {
    location: !!filters.location,
    budget_min: false,
    budget_max: false,
    property_type: !!filters.property_type,
    bhk: false
  }
})

// RETRY 3: Return Latest
console.log('[property-service] retry 3: returning latest available properties', {
  resultCount: properties.length,
  filters_now_applied: {
    location: false,
    budget_min: false,
    budget_max: false,
    property_type: false,
    bhk: false
  }
})
```

#### Error Handling
```typescript
console.log('[property-service] query failed', {
  error: error.message,
  failedAttempt: attemptNumber,
  sessionId: conversation.session_id,
  returnedEmptyArray: true
})
```

### chatService.ts Logging (SHOW_RESULTS case)

```typescript
console.log('[chat] showing results', {
  sessionId: conversation.session_id,
  step: conversation.step,
  count: properties.length,
  filters: {
    location: filters.location,
    property_type: filters.property_type,
    budget_min: filters.budget_min,
    budget_max: filters.budget_max,
    bhk: filters.bhk
  },
  collected_data: conversation.collected_data
})

console.log('[chat] result response message', {
  sessionId: conversation.session_id,
  message: response,
  propertyCount: properties.length
})
```

### Logging Best Practices

- **Always log attempt number** when retrying
- **Log which filters were removed** in each retry
- **Log final result count** so debugging is clear
- **Include sessionId** in every log for traceability
- **Log errors with context** (attempt #, filters applied)
- **Use [property-service]** prefix for queries, **[chat]** prefix for flow

---

## 10. Type Safety & TypeScript

### New Types in `types/chat.ts`

Add to the module:

```typescript
// Phase 2 types
export interface PropertyResult {
  id: string
  title: string
  location: string
  price: number
  bhk?: string
}

// Extend ProcessResult from processConversationTurn()
export interface ProcessResult {
  response: string
  requiresEscalation: boolean
  isCompleted: boolean
  properties?: PropertyResult[]  // Included when step = SHOW_RESULTS
}

// Extended ChatApiResponse (add optional field)
export interface ChatApiResponse {
  // ... existing fields ...
  properties?: PropertyResult[]  // Included when step = SHOW_RESULTS (in response only, not persisted)
}

// NOTE: ConversationRecord is NOT extended with properties field
// Properties only exist in API response, never in database state
```

### Query Type Safety

Use generated Supabase types from `types/supabase.ts`:

```typescript
import { Tables } from '@/types/supabase'

type PropertiesRow = Tables<'properties'>

// In getMatchingProperties:
const { data, error } = await supabase
  .from('properties')
  .select('id,title,location,price,bhk')
  .eq('is_available', true)
  // ... filters ...

// TypeScript ensures selected columns match PropertiesRow fields
```

### Type Guard for Location Validation

```typescript
function isValidLocation(location: string | undefined | null): location is string {
  if (!location) return false
  const trimmed = location.trim()
  if (trimmed.length < 3) return false
  const generic = ['anywhere', 'all', 'vizag', 'visakhapatnam']
  return !generic.includes(trimmed.toLowerCase())
}
```

---

## 11. Anti-Patterns & Constraints

### ❌ DO NOT:
- Use AI/LLM for filtering or ranking
- Fetch all properties and filter in JavaScript
- Apply price filters if both budget_min and budget_max are null
- Return full property objects with description, agent_id, or other metadata
- Write query results to database
- Store properties in conversation state (DB or in-memory)
- Assume location is always valid (check length and generic terms)
- Assume bhk format without normalization (normalize before query)
- Skip null/empty checks on dynamic filters
- Ignore Supabase errors (handle gracefully and log)
- Use vector search or embeddings
- Modify database schema
- Change the existing API contract for other steps
- Return results if query fails (return empty array + fallback message)

### ✅ DO:
- Filter by `is_available = true` on every query
- Return exactly: id, title, location, price, bhk
- Validate location before filtering (>= 3 chars, not generic)
- Normalize bhk input (remove spaces, uppercase) before query
- Check all filter values for null/undefined/empty before applying
- Limit to 5 results max
- Sort by `created_at DESC` for determinism
- Handle null budget gracefully (skip price filters)
- Implement fallback retry strategy (remove bhk → remove price → latest 5)
- Include location in response message when location filter was applied
- Log each retry attempt with filters applied
- Use Supabase typed client for type safety
- Test with missing/partial/generic filters
- Handle database errors with deterministic fallback
- Return properties ONLY in API response (never persist to DB or conversation state)

---

## 12. Validation Checklist

Before approving implementation:

- [ ] Properties table schema reviewed in `types/supabase.ts`
- [ ] Filter logic aligns with collected_data structure
- [ ] Response format extends API contract without breaking changes
- [ ] Fallback behavior covers all missing filter scenarios
- [ ] Deterministic SQL sorting (created_at DESC) is justified
- [ ] Result limit (5) is acceptable for UX
- [ ] TypeScript types are defined for PropertyResult
- [ ] Logging strategy captures filter application
- [ ] No AI/LLM usage in filtering logic
- [ ] Integration point (SHOW_RESULTS case) identified

---

## 13. Specification Summary

| Aspect | Decision |
|--------|----------|
| **Data Source** | Supabase `properties` table (read-only) |
| **Filter Type** | Deterministic SQL-based (conditional with fallback retry) |
| **Availability** | Always filter `is_available = true` |
| **Result Limit** | 5 properties max |
| **Sort Order** | `created_at DESC` (newest first) |
| **Location Match** | Case-insensitive substring (ILIKE) - only if length >= 3 AND not generic |
| **Location Validation** | Skip if null/empty/< 3 chars/generic (anywhere, all, vizag, visakhapatnam) |
| **Price Match** | Range (GTE budget_min, LTE budget_max) - only if not null |
| **Type Match** | Exact match on property_type |
| **BHK Match** | Normalized (trim + uppercase) exact match |
| **BHK Normalization** | Remove whitespace, convert to UPPERCASE (e.g., "2 bhk" → "2BHK") |
| **Over-Filtering Protection** | 3-step fallback: Remove BHK → Remove Price → Latest 5 properties |
| **Empty Result** | Fallback to latest 5 after retries, then return empty [] if nothing |
| **Query Failure** | Log error + return [] with error response message |
| **Response Message** | Include property count + location (if filter applied) |
| **Response Field** | Add optional `properties: PropertyResult[]` (response only) |
| **State Management** | Properties in response ONLY - never persisted to DB or conversation state |
| **Logging** | Detail each retry attempt, filters applied, result count |
| **Type Safety** | Full TypeScript with generated Supabase types |
| **Schema Changes** | None (read-only) |

---

## Next Steps (Upon Approval)

1. **Implementation** → Create `lib/propertyService.ts`
2. **Update** → Integrate `getMatchingProperties()` into chatService.ts
3. **Types** → Update `types/chat.ts` with PropertyResult interface
4. **Response** → Update API response to include properties field
5. **Testing** → Validate with various filter combinations
6. **Validation** → Confirm deterministic behavior (same input → same output)

---

**Specification prepared for Senior Backend Engineer review.**  
**Awaiting approval before implementation begins.**
