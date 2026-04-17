# Phase 2 Suggestions Plan

Status: Draft (Implementation design only; UI integration pending approval)
Date: April 17, 2026

## Objective
Upgrade chat guidance from static quick replies to dynamic, data-driven suggestions while preserving deterministic step progression and typed-input fallback.

## Repository Path Mapping
The current codebase does not use a `src/` root. Equivalent paths are:
- `/src/lib/suggestionService.ts` -> `lib/suggestionService.ts`
- `/src/components/chat/*` -> `components/chat/*`
- `/src/hooks/useChat.ts` -> `hooks/useChat.ts`
- `/src/lib/propertyService.ts` -> `lib/propertyService.ts`
- `/src/app/api/chat/route.ts` -> `app/api/chat/route.ts`

## Scope for This Stage
Implemented now:
1. `lib/suggestionService.ts`
2. Caching and fallback strategy in suggestion service
3. Query-backed helper functions for dynamic quick options

Not implemented yet (awaiting approval):
1. UI wiring in chat components
2. Step-level integration into the existing quick-reply renderer
3. Runtime orchestration between chat step and suggestion function

## Suggestion Service Contract

### 1. getTopLocations(limit = 4)
Source: available properties grouped by location and sorted by count (application-level aggregation).
Output: top location options (max 4-5).
Fallback: static location list.

### 2. getBudgetRanges(location, limit = 4)
Source: min and max price for chosen location from available properties.
Output: 3-4 generated budget bands, e.g.:
- Under Rs 40L
- Rs 40L - Rs 60L
- Rs 60L - Rs 1Cr
- Above Rs 1Cr
Rules:
- Budget range generation must handle skewed data.
- If price distribution is uneven, use simple percentile-based splitting or fall back to predefined ranges.
- Avoid emitting ranges that contain very few or no properties.
Fallback: static budget bands.

### 3. getPropertyTypes(location, budget, limit = 4)
Source: available properties filtered by location and optional budget.
Output: distinct types ranked by frequency (max 4-5).
Query behavior:
- Must work when budget is missing.
- Use location-only filtering if budget is not selected.
- Effective condition:
	- `WHERE location = $1`
	- `AND (price BETWEEN $2 AND $3 OR budget is null)`
Fallback: static type list.

### 4. getBHKOptions(location, type, limit = 4)
Source: available properties filtered by location and type.
Output: distinct BHK values sorted naturally (1BHK, 2BHK, ...).
Fallback: static BHK list.

## Guardrails and UX Constraints
1. Maximum 5 options from service APIs.
2. Service returns clean, UI-ready labels and normalized values.
3. No forced choice: typed input remains valid and must continue through existing parser.
4. No step regression: suggestions inform UX only; state machine remains source of truth.
5. Every suggestion step must include one fallback option: `Other` or `Not sure`.
6. `Other` or `Not sure` must be present for location, budget, property type, and optionally BHK.

## Data Normalization Rules
All suggestion inputs and outputs must be normalized before processing.

Required normalization functions:
1. `normalizeLocation(value)`
- Lowercase
- Trim spaces
- Standardize known aliases/naming variants

2. `normalizeBHK(value)`
- Convert formats like `2 bhk`, `2 bedroom`, `2-bed` into `2BHK`

3. `normalizePropertyType(value)`
- Map values to enum: `apartment | villa | plot | commercial`

Normalization must happen before:
1. deduplication
2. sorting
3. suggestion generation

## Performance and Caching
1. In-memory TTL cache (5 minutes).
2. Cache key includes relevant filters (`location`, `budget`, `type`, `limit`).
3. Prevent repeated heavy reads for stable suggestion sets.
4. Provide `clearSuggestionCache()` for manual invalidation/testing.
5. Cache consistency is eventual (not real-time).
6. Newly added properties may not appear immediately within the TTL window.
7. No complex invalidation logic is required.

## Empty Result Handling Strategy
If no properties match selected filters:
1. Show message: `No exact matches found. Showing closest options.`
2. Relax filters automatically in deterministic order:
- expand budget range, or
- remove BHK constraint, or
- broaden location match
3. Continue showing results; never dead-end the conversation due to empty strict matches.

## Integration Plan (Pending Approval)
1. Update quick option renderer to consume dynamic `SuggestionOption[]`.
2. Add step-to-suggestion mapping:
- ASK_INTENT -> static (Buy/Rent/Explore)
- ASK_LOCATION -> getTopLocations + Other
- ASK_BUDGET -> getBudgetRanges(selected location) + Not sure
- ASK_PROPERTY_TYPE -> getPropertyTypes(location, budget?) + Other
- ASK_CONFIG -> getBHKOptions(location, type) when type is apartment/villa (+ optional Not sure)
- ASK_TIMELINE -> static + Not sure
3. Keep typed fallback active at all steps.
4. Add fallback-to-static behavior if dynamic calls return empty/error.

## Validation Checklist
1. Suggestions change with previous filters (location, budget, type).
2. No more than 5 visible options.
3. No irrelevant options for later steps.
4. Full flow possible via clicks only.
5. Full flow still works via typing only.
6. Deterministic step order remains unchanged.
7. Suggestions are always usable (no empty option lists).
8. Users are never trapped due to missing options.
9. Messy real-world input data is safely normalized before suggestion generation.
10. UI remains minimal and uncluttered while showing question + options together.

## Risks and Mitigations
1. Large property table scans for location counts:
- Mitigation: TTL cache + paginated fetch.
2. Sparse data creating weak range boundaries:
- Mitigation: generated ranges fall back to static ranges.
3. Type/BHK inconsistencies in data:
- Mitigation: normalize values before dedupe/sort.
