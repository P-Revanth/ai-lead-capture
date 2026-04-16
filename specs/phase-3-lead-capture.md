# Phase 3: Lead Capture + Escalation (Business Layer)

Status: Specification (Awaiting Approval)  
Date: April 12, 2026  
Objective: Implement deterministic, immediate lead capture and escalation once phone is validated, without schema changes and without dependency on conversation completion.

---

## 1. Scope and Intent

Phase 3 introduces business-layer hardening for lead handling:

- Capture and validate name and phone deterministically
- Create or update lead immediately when phone is captured
- Trigger escalation immediately after successful lead persistence
- Prevent duplicate leads by phone
- Add deterministic logging for observability

Out of scope for this phase:

- Any database schema change
- Any AI-driven routing, scoring, or decision logic
- WhatsApp/Twilio delivery integration (stub only)
- UI redesign or API contract changes beyond additive internal behavior

---

## 2. Non-Negotiable Rules (Phase 3)

1. Do not modify database schema.
2. Do not delay lead creation until DONE.
3. Do not rely on user completing full flow.
4. Do not introduce AI logic.
5. Phone validation must be deterministic and strict.
6. Duplicate leads by phone are not allowed.
7. Escalation must be deterministic and duplicate-safe within a session.

---

## 3. Current State Summary

Based on current implementation:

- CAPTURE_PHONE already validates and normalizes Indian phone format.
- Lead upsert behavior exists inline inside chat service.
- Escalation step exists in enum/flow but does not trigger agent notification from CAPTURE_PHONE path.
- Lead business logic is embedded in chat service rather than isolated business services.

Phase 3 formalizes this into dedicated services and explicit deterministic contracts.

---

## 4. Database Contract (Read-Only)

Reference: [types/supabase.ts](types/supabase.ts)

Table used: leads

Fields used in write mapping:

- name
- phone
- intent
- location
- budget_min
- budget_max
- property_type
- bhk
- timeline
- status

Schema constraints for this phase:

- No new columns
- No field renames
- No new table requirements

---

## 5. Deterministic Business Rules

### 5.1 Name Capture

- Step: CAPTURE_NAME
- Name must be a trimmed string with length >= 2
- Name must not be purely numeric
- If invalid, re-prompt CAPTURE_NAME and do not advance
- Store as collected_data.name
- Progress to CAPTURE_PHONE

### 5.2 Phone Validation (Strict)

Input accepted from user may include spaces, dashes, and country prefix.

Normalization algorithm:

1. Remove all non-digit characters.
2. If digits start with 91 and length is 12, strip leading 91.
3. Final normalized number must match regex: ^[6-9][0-9]{9}$
4. Store only normalized 10-digit value.

Validation behavior:

- Invalid phone:
  - Do not progress step
  - Do not create/update lead
  - Return same CAPTURE_PHONE prompt
  - Log invalid phone attempt
- Valid phone:
  - Persist phone in collected_data
  - Persist lead immediately (create/update)
  - Trigger escalation
  - Move flow forward to DONE

### 5.3 Low-Quality Input Definition

The following values are low-quality and must not overwrite existing lead data during updates:

- location: anywhere, all, vizag, india
- budget_min or budget_max: null
- property_type: null

Low-quality values are ignored in update payload merge logic and must be logged as skipped fields.

### 5.4 Lead Upsert Rule

Uniqueness key: phone

- If existing lead found by phone:
   - Update only with non-null, non-empty, higher-quality values
   - Never overwrite non-null values with null/empty values
   - Never overwrite specific values with generic/low-quality values
- If no lead found:
   - Perform insert path with concurrency-safe double-check:
      - first existence check by phone
      - second existence check by phone immediately before insert
      - if found on second check, switch to update flow

No duplicate creation for same phone is allowed.

### 5.5 Escalation Trigger Rule

Trigger escalation when all are true:

1. Current step is CAPTURE_PHONE
2. Phone is valid and normalized
3. Lead persistence succeeds
4. Escalation has not already been triggered for the same phone in the current session
5. Lead was newly created OR phone is captured for the first time in the current session

Then:

- Trigger notifyAgent(lead)
- Mark collected_data.status = escalated (or equivalent deterministic status update)
- Continue deterministic flow to DONE

Skip escalation when phone has already been escalated in the current session, and log escalation_skipped.

If escalation notification fails:

- Do not lose lead
- Log escalation failure
- Continue flow to DONE with safe fallback message policy

---

## 6. Service Design (Business Layer)

### 6.1 New Service: lib/leadService.ts

Purpose: isolate deterministic lead persistence logic.

Contract:

```ts
createOrUpdateLead(data: {
  name?: string
  phone: string
  collectedData: CollectedData
}): Promise<LeadRecord>
```

Deterministic behavior:

- Query leads by phone
- Update if found, otherwise insert
- On update, apply field protection merge rules:
   - update only if incoming value is non-null, non-empty, and more specific
   - do not downgrade existing values with generic/low-quality input
   - capture skipped fields for audit logging
- On insert path, perform second pre-insert check by phone to reduce race-condition duplicates
- Return persisted lead payload (or minimal required subset)
- Throw typed error on persistence failure

Field mapping:

- name <- data.name or collectedData.name
- phone <- normalized validated phone
- intent <- collectedData.intent
- location <- collectedData.location
- budget_min <- collectedData.budget_min
- budget_max <- collectedData.budget_max
- property_type <- collectedData.property_type
- bhk <- collectedData.bhk
- timeline <- collectedData.timeline
- status <- escalated/new per deterministic rule

### 6.2 New Service: lib/escalationService.ts

Purpose: isolate escalation side effect for agent notification.

Contract:

```ts
notifyAgent(lead: LeadEscalationPayload): Promise<void>
```

MVP behavior:

- Console log deterministic escalation message
- No external API call yet

Escalation payload must include:

- name
- phone
- intent
- location
- budget (min-max)
- property_type
- timeline
- deterministic summary

Summary format example:

"User looking for 2BHK in Madhurawada within 3 months."

Expected log format (example):

```text
New Lead Alert
Name: Ravi
Phone: 9XXXXXXXXX
Location: MVP Colony
Budget: 3000000-5000000
Type: apartment
Timeline: soon
```

Notes:

- Keep payload deterministic and structured
- WhatsApp integration deferred to later phase

---

## 7. Chat Flow Integration Plan

Primary integration file: [lib/chatService.ts](lib/chatService.ts)

Target step behavior updates:

### CAPTURE_PHONE branch

1. Normalize and validate phone
2. If invalid:
   - stay at CAPTURE_PHONE
   - same prompt
   - log invalid attempt
3. If valid:
   - set collected_data.phone
   - call createOrUpdateLead(...) with one retry on persistence failure
   - on first failure, log lead_retry_attempt and retry once
   - if retry fails, keep CAPTURE_PHONE and do not advance
   - call notifyAgent(...) only when escalation rule conditions pass
   - update status deterministically
   - move to DONE

### Session-level escalation tracking

Use transient runtime flag (non-persisted): escalation_triggered: boolean

- default false at request start
- set true after successful notifyAgent call
- use to prevent duplicate escalation calls in current session execution path
- must not require schema change or API contract change

Important:

- Lead write must happen before DONE
- Escalation must not spam for the same phone in the same session
- No dependency on ESCALATE step being manually entered by user

---

## 8. Logging Requirements

Mandatory logs:

1. invalid_phone_attempt
   - sessionId
   - step
   - raw_input (masked if needed)
   - reason

2. lead_created
   - sessionId
   - leadId
   - phone (masked)

3. lead_updated
   - sessionId
   - leadId
   - phone (masked)

4. escalation_triggered
   - sessionId
   - leadId
   - channel: stub

5. escalation_failed
   - sessionId
   - leadId (if available)
   - error

6. escalation_skipped
   - sessionId
   - phone (masked)
   - reason: duplicate_prevention

7. lead_update_skipped_fields
   - sessionId
   - leadId
   - skippedFields
   - reason: low_quality_or_null

8. lead_retry_attempt
   - sessionId
   - phone (masked)
   - attempt: 1

Logging constraints:

- Do not log full sensitive phone in plaintext in production-style logs
- Keep logs structured and deterministic

---

## 9. Failure Handling Rules

### Phone validation failure

- No DB writes
- No step advance
- Prompt retry

### Lead persistence failure

- Retry once deterministically
- If retry succeeds, continue normal flow
- If retry fails:
   - return deterministic fallback response
   - keep step at CAPTURE_PHONE to avoid lead loss
   - log persistence failure

### Escalation notification failure

- Lead remains persisted
- Log escalation error
- Continue to DONE (do not force user retry for notifier-only failures)

---

## 10. API Contract Considerations

Primary route: [app/api/chat/route.ts](app/api/chat/route.ts)

Phase 3 should preserve existing request/response contract unless additive fields are explicitly approved.

No breaking changes allowed for:

- request shape
- required response fields
- existing response semantics

---

## 11. Anti-Patterns to Avoid

- Creating lead only at DONE
- Accepting invalid phone values
- Inserting duplicate lead rows for same phone
- Missing escalation trigger after valid phone
- Blocking flow for non-critical notifier failures
- Introducing AI/LLM in business decisions

---

## 12. Implementation Checklist (for approval phase)

1. Add lead service file and types
2. Add escalation service stub
3. Refactor CAPTURE_PHONE in chat service to call new services
4. Ensure strict phone normalization and validation behavior remains deterministic
5. Add structured logs for lead and escalation lifecycle
6. Verify no schema changes, no API contract breakages

---

## 13. Validation and Acceptance Criteria

Functional checks:

1. Invalid phone keeps user in CAPTURE_PHONE and writes nothing.
2. Valid phone creates lead immediately if phone not found.
3. Valid phone updates existing lead if phone already exists.
4. Escalation notification is triggered only when duplicate-prevention conditions pass.
5. Flow reaches DONE without requiring extra user steps after successful capture.
6. No duplicate lead records for same phone in repeated runs.
7. Name validation rejects values shorter than 2 chars and purely numeric names.

Data checks:

1. Leads table fields map exactly from collected_data.
2. status is deterministically assigned.
3. No schema drift introduced.
4. Existing high-quality lead values are not degraded by null/generic updates.

Operational checks:

1. Logs emitted for invalid phone, created/updated lead, escalation trigger/failure.
2. TypeScript strict mode remains clean.
3. Existing Phase 1/2 behavior remains intact.

---

## 14. Approval Gate

This document is specification-only.

No implementation code is included in this phase per instruction.

Next step after approval: implement services and CAPTURE_PHONE integration in small deterministic batches.
