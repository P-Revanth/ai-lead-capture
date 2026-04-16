# Phase 4: LLM Integration (Gemini API) — Extraction + Response Layer

Status: Specification (Awaiting Approval)  
Date: April 12, 2026  
Objective: Add controlled Gemini usage for entity extraction and response phrasing while preserving deterministic state-machine behavior.

---

## 1. Scope and Intent

Phase 4 introduces LLM usage only for:

- Structured entity extraction (strict JSON)
- Natural response phrasing (formatting only)

Phase 4 does not change:

- Deterministic step transitions
- Database query ownership (still deterministic services)
- Escalation trigger logic from Phase 3
- API contract
- Database schema

---

## 2. Critical Constraints (Must Hold)

1. LLM must not decide next step.
2. LLM must not trigger escalation.
3. LLM must not query database.
4. LLM output must be validated before use.
5. Any invalid or failed LLM output must fallback to deterministic existing logic.
6. Phase 1/2/3 deterministic behavior remains source of truth.

---

## 3. Current Integration Points (Analysis Summary)

Current deterministic parsing and response areas:

- Intent parsing in ASK_INTENT
- Budget parsing in ASK_BUDGET
- Name capture in CAPTURE_NAME
- Phone parsing/validation in CAPTURE_PHONE
- Static prompts in chat step responses

Phase 4 adds an LLM assist layer around those points, not a replacement of flow control.

---

## 4. New Service: lib/llmService.ts

### 4.1 Entity extraction contract

```ts
extractEntities(message: string): Promise<{
  intent?: 'buy' | 'rent' | 'explore' | null
  location?: string | null
  budget_min?: number | null
  budget_max?: number | null
  property_type?: 'apartment' | 'villa' | 'plot' | 'commercial' | null
  bhk?: string | null
  timeline?: 'urgent' | 'soon' | 'flexible' | null
  name?: string | null
  phone?: string | null
}>
```

### 4.2 Response formatting contract

```ts
generateResponse(step: ChatStep, collectedData: CollectedData, fallback: string): Promise<string>
```

Rules:

- Returns concise wording for the already-determined step meaning.
- Must not add new questions or change task intent.
- On failure, returns fallback unchanged.

### 4.3 Temporary extraction buffer (non-persistent)

Add a transient in-memory extraction buffer per session/request context.

Rules:

- Store all validated extracted fields in the buffer.
- Commit only fields relevant to the current step into collected_data.
- Keep non-step fields in buffer until their step is reached.
- Buffer must not change database schema or API contracts.

---

## 5. Gemini Extraction Prompt (Strict JSON)

Use prompt template:

```text
Extract structured real estate intent data.

Return ONLY valid JSON.

Fields:
- intent (buy | rent | explore)
- location
- budget_min
- budget_max
- property_type
- bhk
- timeline (urgent | soon | flexible)
- name
- phone

Rules:
- If not present -> return null
- Do not guess
- Do not explain

User message: "{{message}}"
```

Output expectation:

- Exactly one JSON object
- No markdown fences
- No prose
- Unknown/missing as null

Prompt versioning requirement:

- Extraction prompt must be logged with prompt_version = extraction_prompt_v1.

---

## 6. Validation, Retry, and Fallback Pipeline

### 6.1 Extraction call policy

For every extraction request:

1. Try once
2. Retry once on parser/transport/validation failure
3. If retry fails, return all-null extraction payload
4. Enforce hard timeout per LLM call (2 seconds)
5. On timeout, abort LLM attempt and fallback to deterministic logic

LLM call guard (cost + stability):

- Do not call LLM when input length < 3 characters.
- Do not call LLM when required field for current step is already collected.
- Do not call LLM when a previous valid extraction already exists for the same step.
- Call LLM only when extraction is needed for current step.

### 6.2 Validation rules

After LLM returns text:

1. Parse JSON safely
2. Ensure object shape only includes allowed keys
3. Validate enum values:
   - intent: buy|rent|explore
   - property_type: apartment|villa|plot|commercial
   - timeline: urgent|soon|flexible
4. Validate numeric fields:
   - budget_min, budget_max must be numbers or null
5. Coerce unexpected types to null (never trust raw output)

Value sanity checks (critical):

- budget_min and budget_max must be within 100000 to 1000000000
- phone must pass strict deterministic phone validation regex
- location must not be generic (e.g., anywhere, all)
- Any sanity-check failure must set that value to null

Ambiguity/inconsistency handling:

- If a field group is incomplete or inconsistent, nullify the entire group and do not merge it.
- Example: budget_min present but budget_max missing when both expected for budget step.
- Example: partially extracted phone that fails strict validation.
- Group nullification must prevent collected_data corruption.

### 6.3 Normalization rules after validation

- Trim all string fields
- Lowercase: intent, property_type, timeline, location
- Keep original casing for name if needed for UX, but store normalized-safe value
- Normalize phone via existing deterministic phone normalization
- Normalize bhk via existing deterministic bhk normalization path

### 6.4 Fallback rules

- If extraction fails: use existing deterministic parser/logic path
- If response generation fails: use hardcoded step prompt
- LLM failure must never block step processing
- Timeout fallback must behave the same as extraction/response failure fallback

---

## 7. Step-Aware Merge Rules (Deterministic)

Only merge fields relevant to current step.

General safeguards:

- Never overwrite valid existing values with null
- Never overwrite higher-quality values with low-quality values
- Respect Phase 3 low-quality protections for lead-sensitive fields
- Apply ambiguity group nullification before merge decisions
- Merge from extraction buffer only for current-step fields
- If current-step extraction is invalid/ambiguous, skip merge and retain existing collected_data

Step-to-field matrix:

- ASK_INTENT: intent
- ASK_LOCATION: location
- ASK_BUDGET: budget_min, budget_max
- ASK_PROPERTY_TYPE: property_type
- ASK_CONFIG: bhk
- ASK_TIMELINE: timeline
- CAPTURE_NAME: name
- CAPTURE_PHONE: phone

No cross-step mass merge is allowed.

---

## 8. Controlled LLM Usage Points

LLM extraction is allowed only at:

- ASK_INTENT
- ASK_LOCATION
- ASK_BUDGET
- CAPTURE_NAME
- CAPTURE_PHONE

LLM extraction is not required at:

- SHOW_RESULTS (database-driven)
- ESCALATE (business-driven)
- DONE (terminal state)

LLM response formatting can be used for user-facing message phrasing only, with fallback to deterministic prompts.

---

## 9. Response Generation Rules

Prompt template for formatting:

```text
Generate a short, helpful response for a real estate assistant.

Step: {{step}}
Collected Data: {{json}}

Rules:
- Keep it concise
- Do NOT change meaning of step
- Do NOT add new questions
```

Constraints:

- Output is plain text only
- Output must be 1 to 2 sentences only
- Output must contain no emojis
- Output must remain neutral and concise
- Output must strictly preserve fallback prompt meaning
- Output must not introduce new questions
- Max concise length policy (implementation-defined, e.g., <= 240 chars)
- If malformed or empty output, fallback to hardcoded prompt

Prompt versioning requirement:

- Response prompt must be logged with prompt_version = response_prompt_v1.

---

## 10. Logging Requirements (Phase 4)

Required logs:

1. llm_extraction_request
   - sessionId
   - step
   - inputLength
   - prompt_version: extraction_prompt_v1

2. llm_extraction_response
   - sessionId
   - step
   - success
   - retryCount
   - prompt_version: extraction_prompt_v1

3. llm_validation_failed
   - sessionId
   - step
   - reason

4. llm_fallback_used
   - sessionId
   - step
   - fallbackType: extraction|response

5. llm_response_generated
   - sessionId
   - step
   - usedFallback(boolean)
   - prompt_version: response_prompt_v1

6. llm_merge_applied
   - sessionId
   - step
   - fields_updated
   - fields_skipped
   - reason (null|low_quality|sanity_check_failed|ambiguous_group)

Logging safety:

- Avoid logging raw sensitive PII in plaintext
- Prefer masked phone values

---

## 11. Failure Handling Matrix

- Gemini API timeout/error:
   - enforce 2-second timeout
  - retry once
  - fallback deterministic parser/response

- Invalid JSON response:
  - retry once
  - fallback null extraction payload

- Valid JSON but invalid enums/types:
  - sanitize invalid fields to null
  - continue deterministic flow

- Ambiguous or inconsistent field group extraction:
   - nullify group
   - skip merge for that group
   - continue deterministic flow

- Empty response from formatter:
  - fallback hardcoded response

No failure path can crash request processing.

---

## 12. Determinism Guardrails

Mandatory rule: step progression is still computed only by deterministic business code.

- ChatStep transitions remain unchanged from Phase 1–3 logic.
- LLM cannot set step values.
- LLM cannot call property retrieval, lead service, or escalation service.

---

## 13. Acceptance Criteria

1. Flow remains deterministic with no step skipping.
2. LLM extraction improves flexibility for user phrasing while preserving validations.
3. Invalid/malformed LLM output does not break API flow.
4. Hardcoded fallback prompts still work for every step.
5. Database writes remain controlled by deterministic services.
6. No API contract changes and no schema changes.
7. TypeScript strict mode remains clean.
8. Ambiguous partial extraction cannot corrupt collected_data.
9. LLM call guard prevents unnecessary calls for short/already-satisfied inputs.
10. LLM calls are timeout-bounded and fallback safely.

---

## 14. Anti-Patterns to Avoid

- Letting LLM decide next step
- Trusting LLM output without validation
- Overwriting high-quality stored values with null/generic extracted values
- Calling LLM for every message regardless of step
- Removing deterministic fallback behavior

---

## 15. Implementation Plan (After Approval)

1. Add llmService with Gemini client calls
2. Add extraction validation and normalization utilities
3. Integrate step-scoped extraction merges in chat service
4. Add response generation fallback chain
5. Add Phase 4 logs and retry behavior
6. Verify deterministic transitions and existing phase regressions

This phase document is specification-only and does not include code implementation.
