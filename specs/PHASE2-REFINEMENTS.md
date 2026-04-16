# Phase 2 Specification — Refinements Applied

**Date:** April 11, 2026  
**Status:** All 9 required corrections applied and integrated

---

## Summary of Changes

The Phase 2 Property Retrieval specification has been refined for robustness and real-world reliability. All 9 requested corrections have been systematically applied to address edge cases, remove unsafe assumptions, and strengthen fallback logic.

---

## 1. ✅ Fix Location Assumption

**Section Modified:** Section 2 (Available Data at SHOW_RESULTS)

**Changes:**
- Changed location status from "✅ Always present" to "⚠️ May be null/empty/generic"
- Added explicit validation rules:
  - Skip filter if location is null, empty string, or whitespace-only
  - Skip filter if location length < 3 characters
  - Skip filter if location is generic/non-specific (e.g., "anywhere", "all", "vizag")
  - Only apply location ILIKE filter if: `location && location.trim().length >= 3 && !isGeneric(location)`

---

## 2. ✅ Improve Location Matching Logic

**Section Modified:** Section 4 (Filtering Logic)

**Changes:**
- Added minimum length validation: **>= 3 characters required**
- Enhanced location filter rule:
  ```
  📍 IF location passes validation:
     - Check: location is not null/undefined/empty AND location.trim().length >= 3
     - Check: NOT a generic term (already listed above)
     - Apply ILIKE filter: location ~* `%${location}%`
  ```
- Prevents short or vague terms from creating empty result sets

---

## 3. ✅ Add Over-Filtering Protection (CRITICAL)

**Section Modified:** Section 7 (Fallback Behavior & Over-Filtering Protection)

**Changes:**
- Completely restructured fallback section with deterministic retry strategy
- Implemented **3-step graceful fallback** when query returns 0 results:

  ```
  RETRY 1: Remove BHK filter
    - Keep: is_available=true, location, type, price
    - If results > 0 → return results
  
  RETRY 2: If still 0 → Remove PRICE filters
    - Keep: is_available=true, location, type
    - If results > 0 → return results
  
  RETRY 3: If still 0 → Return Latest 5 Available Properties
    - Keep: ONLY is_available=true
    - Sort: created_at DESC, limit 5
  ```
- Added logging for each retry attempt tracking which filters were removed
- Ensures progressive relaxation of filters rather than immediate empty state

---

## 4. ✅ Normalize BHK Before Filtering

**Section Modified:** Section 4 (Filtering Logic)

**Changes:**
- Added BHK normalization rule:
  ```
  🛏️ IF bhk is provided and not null after normalization:
     → Normalize: remove whitespace, convert to UPPERCASE
     → Example: "2 bhk" → "2BHK", "2bhk" → "2BHK"
     → Apply EQ filter: UPPER(bhk) = UPPER(normalized_bhk)
  ```
- Handles variable user input formats (spaces, case variations)
- Improves match rates by normalizing before comparison

---

## 5. ✅ Strengthen Null/Empty Checks

**Section Modified:** Section 4 (Filtering Logic) - New subsection "Strict Null/Empty Validation Rules"

**Changes:**
- Added explicit validation rules that apply to ALL conditional filters:
  ```
  Before applying any conditional filter, verify:
  - Value is not null
  - Value is not undefined
  - Value is not empty string ("")  
  - For strings: value.trim().length > 0
  ```
- Applies to location, budget_min, budget_max, property_type, bhk
- Prevents unsafe queries with falsy values

---

## 6. ✅ Improve Response Message Quality

**Section Modified:** Section 6 (Response Structure) + Section 8 (Integration)

**Changes:**
- Added **Response Message Quality Rules** subsection with examples:
  ```
  With location filter applied:
  "Great! I found 3 properties in Madhurawada matching your criteria."
  
  Without location filter:
  "Great! I found 4 properties matching your criteria."
  
  No matches:
  "No exact matches found, but the agent can help you further."
  
  Query error:
  "I'm having trouble fetching results right now. Let me connect you with an agent."
  ```
- Updated integration code to build response dynamically:
  ```typescript
  let message: string
  if (count === 0) {
    message = "No exact matches found, but the agent can help you further."
  } else if (filters.location && isValidLocation(...)) {
    message = `Great! I found ${count} properties in ${filters.location} matching your criteria.`
  } else {
    message = `Great! I found ${count} properties matching your criteria.`
  }
  ```

---

## 7. ✅ Add Query Failure Handling

**Section Modified:** Section 7 (Fallback Behavior) - New subsection "Scenario 6: Query Failure"

**Changes:**
- Added explicit Supabase error handling scenario:
  ```
  IF query throws error (network, permission, etc.):
  
  Response:
  {
    "response": "I'm having trouble fetching results right now. Let me connect you with an agent.",
    "properties": [],
  }
  ```
- Included error logging:
  ```
  [property-service] query failed
  {
    error: "Error message from Supabase",
    failedAttempt: 1,
    sessionId: "session-uuid"
  }
  ```
- Ensures graceful degradation and user experience maintained during failures

---

## 8. ✅ Remove Temporary State Pollution

**Section Modified:** Section 8 (Service Architecture) + Section 10 (Type Safety)

**Changes:**
- **Removed** instruction to store properties in conversation object
- **Updated** integration code to reflect properties-in-response-only pattern:
  ```
  // NOTE: Properties are returned in API response (see chat/route.ts)
  // Do NOT store in conversation object or persist to database
  ```
- **Removed** erroneous `properties` field from ConversationRecord type
- Updated API route to conditionally include properties only:
  ```typescript
  ...(conversation.step === ChatStep.SHOW_RESULTS && result.properties 
    ? { properties: result.properties } 
    : {}),
  ```
- Added clear note in types: "Properties only exist in API response, never in database state"

---

## 9. ✅ Logging Enhancement

**Section Modified:** Section 9 (Logging Requirements)

**Changes:**
- Expanded logging section with comprehensive retry tracking:
  ```
  RETRY 1: Remove BHK
  console.log('[property-service] retry 1: removed bhk filter', {
    resultCount: properties.length,
    filters_now_applied: { ... }
  })
  
  RETRY 2: Remove Price
  console.log('[property-service] retry 2: removed price filters', {
    resultCount: properties.length,
    filters_now_applied: { ... }
  })
  
  RETRY 3: Latest
  console.log('[property-service] retry 3: returning latest available properties', {
    resultCount: properties.length,
    filters_now_applied: { ... }
  })
  ```
- Added error logging with context
- Added logging best practices section:
  - Always log attempt number when retrying
  - Log which filters were removed in each retry
  - Log final result count
  - Include sessionId in every log for traceability
  - Use [property-service] vs [chat] prefixes for clarity

---

## Updated Sections (At-a-Glance)

| Section | What Changed | Why |
|---------|-------------|-----|
| **Section 2** | Location type updated to nullable + validation rules | Account for missing/vague locations |
| **Section 4** | Added null checks + location validation + BHK normalization | Prevent unsafe queries |
| **Section 6** | Added response message quality rules with location context | Improve UX with specific location info |
| **Section 7** | Complete rewrite with 3-step fallback + error handling | Ensure graceful degradation |
| **Section 8** | Remove in-memory storage, clarify response-only pattern | Prevent state pollution |
| **Section 9** | Added retry attempt logging + best practices | Enable debugging of fallback behavior |
| **Section 10** | Removed properties from ConversationRecord type | Enforce response-only pattern |
| **Section 11** | Expanded DO/DON'T list with all new constraints | Clarify safe/unsafe patterns |
| **Section 13** | Updated summary table with all refinements | Single-source reference |

---

## Impact on Implementation

### No Schema Changes
All corrections are implemented at the **query logic layer**. Database schema remains untouched.

### API Contract Impact
- **New field in response:** `properties?: PropertyResult[]` (optional, only when SHOW_RESULTS)
- **No breaking changes** - existing fields remain unchanged
- **Backward compatible** - clients that don't expect properties field continue to work

### Code Complexity
- **Increases** with retry logic and better error handling
- **Justifiable** for robustness and real-world reliability
- **Well-scoped** to propertyService.ts (single responsibility)

### Testing Considerations
New test cases required for:
- Location validation (null, empty, < 3 chars, generic terms)
- BHK normalization (various formats)
- Retry strategy (0 results → retry 1 → retry 2 → retry 3)
- Error handling (Supabase errors)
- Response message generation (with/without location)

---

## Validation Checklist

Before implementation approval:

- [x] Location assumptions fixed (nullable, validated)
- [x] Location matching improved (>= 3 chars, generic checks)
- [x] Over-filtering protection implemented (3-step fallback)
- [x] BHK normalization rules added (whitespace + uppercase)
- [x] Null/empty checks strengthened (all filters validated)
- [x] Response messages improved (include location context)
- [x] Query failure handling added (log + fallback)
- [x] State pollution removed (properties in response only)
- [x] Logging enhanced (retry attempts detailed)
- [x] No schema changes
- [x] No API contract breaking changes
- [x] No new features beyond scope

---

## Next Steps

1. **Review** this refinement summary and specification
2. **Approve** when satisfied with all corrections
3. **Implement** propertyService.ts with fallback retry logic
4. **Update** chatService.ts SHOW_RESULTS case
5. **Test** all scenarios including edge cases
6. **Deploy** when validation complete

---

**Specification Ready for Implementation**
