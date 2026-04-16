# Project: Real Estate AI Lead Engine (Visakhapatnam)

## Core Principle

This is a **deterministic lead qualification system**, NOT an AI-driven chatbot.

- Business logic MUST be deterministic.
- LLM is ONLY used for:
  - Entity extraction
  - Natural language formatting
- LLM must NEVER control flow, database queries, or decision-making.

---

## Non-Negotiable Rules

### 1. Flow Control

- The chatbot flow is defined using a strict state machine (`ChatStep` enum).
- DO NOT introduce dynamic or AI-based step transitions.
- DO NOT skip steps unless explicitly coded.

---

### 2. Database Integrity

- DO NOT modify database schema unless explicitly instructed.
- DO NOT rename fields.
- DO NOT introduce new columns.
- All queries must strictly match existing schema.

---

### 3. API Contracts

- DO NOT change request/response formats of existing APIs.
- Maintain strict typing for all API responses.
- Any new API must follow existing patterns.

---

### 4. LLM Usage Constraints

- LLM is ONLY used for:

  - Extracting structured data (JSON)
  - Generating user-facing responses
- LLM must:

  - Return valid JSON when extracting data
  - Never decide next steps
  - Never query the database

---

### 5. State Management

- Conversation state MUST be stored in database (`conversations` table).
- Do NOT rely on in-memory state.
- Every chat request must:
  - Load state
  - Update state
  - Persist state

---

### 6. Code Discipline

- Use TypeScript strictly (no `any`)
- Keep functions small and deterministic
- Avoid over-engineering
- Follow existing folder structure

---

### 7. Error Handling

- Validate all external inputs (LLM, API, DB)
- Never assume correct format
- Add fallback logic for failures

---

### 8. Scope Control

- Implement ONLY what is asked
- Do NOT add extra features
- Do NOT refactor unrelated code

## Supabase Awareness Rule

- The database schema is defined in Supabase.
- The agent must rely on:
  - Supabase types file (`types/supabase.ts`)
  - Existing queries in code
- If a table is not visible in code, DO NOT assume it does not exist.
- NEVER suggest schema issues without verification.

---

## Development Workflow

### Plan Mode (MANDATORY)

Before writing any code:

1. Analyze context files
2. Write a step-by-step plan
3. Wait for approval

---

### Execution Mode

- Implement in small batches:
  1. Types
  2. Services
  3. API
  4. UI (if needed)

---

### Verification

- Ensure:
  - No TypeScript errors
  - API responses match contract
  - No schema mismatch

---

## Architecture Summary

- Frontend: Next.js (App Router)
- Backend: Next.js API routes
- Database: Supabase (Postgres)
- LLM: Gemini API
- Messaging: WhatsApp (Twilio)

---

## Final Reminder

This system is a **lead conversion engine**, not a general chatbot.

Every decision must optimize for:

- Structured data capture
- Lead qualification
- Fast escalation
