# Phase 1: Foundation — Basic Chat System (No AI)

**Status:** Planning  
**Date:** April 11, 2026  
**Objective:** Build a deterministic, hardcoded chat backend with persistent state management.

---

## 1. Overview

This phase establishes a fully working chat backend with:
- **Hardcoded conversation flow** (no AI/LLM logic)
- **Persistent conversation state** (stored in Supabase)
- **Deterministic step progression** (no dynamic decision-making)
- **Structured data capture** (intent, location, budget_min/budget_max, property_type, bhk, timeline, name, phone)

**Key Constraint:** Phase 1 is a **non-AI phase**. The LLM will be integrated in Phase 2.

---

## 2. Database Schema (Existing / No Changes)

### Tables Used (Read-Only)

#### `conversations` Table
Stores conversation state and history.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key (`default gen_random_uuid()`) |
| `session_id` | TEXT | Session identifier from client |
| `messages` | JSONB | Full message history |
| `step` | TEXT | Current enum value (`ASK_INTENT`, `ASK_LOCATION`, ...) |
| `collected_data` | JSONB | Structured data collected so far |
| `created_at` | TIMESTAMP | Creation timestamp (`default now()`) |

#### `leads` Table
Populated after conversation completes.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key (`default gen_random_uuid()`) |
| `name` | TEXT | Lead name |
| `phone` | TEXT | Lead phone number |
| `intent` | TEXT | buy/rent/explore |
| `location` | TEXT | Preferred area in Visakhapatnam |
| `budget_min` | INT | Lower budget bound |
| `budget_max` | INT | Upper budget bound |
| `property_type` | TEXT | apartment/villa/plot/commercial |
| `bhk` | TEXT | BHK preference |
| `status` | TEXT | Lead status |
| `timeline` | TEXT | Decision timeline |
| `created_at` | TIMESTAMP | Creation timestamp (`default now()`) |

#### `properties` Table
Property listings (reference data).

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key (`default gen_random_uuid()`) |
| `title` | TEXT | Listing title (`not null`) |
| `location` | TEXT | Area/locality (`not null`) |
| `price` | INT | Price (`not null`) |
| `bhk` | TEXT | BHK configuration |
| `type` | TEXT | Property category/type |
| `status` | TEXT | Listing status |
| `description` | TEXT | Listing description |
| `is_available` | BOOLEAN | Availability flag (`default true`) |
| `agent_id` | UUID | Assigned agent id |
| `created_at` | TIMESTAMP | Creation timestamp (`default now()`) |

---

## 3. ChatStep Enum

Defines the deterministic flow progression.

```typescript
enum ChatStep {
  ASK_INTENT = 'ASK_INTENT',
  ASK_LOCATION = 'ASK_LOCATION',
  ASK_BUDGET = 'ASK_BUDGET',
  ASK_PROPERTY_TYPE = 'ASK_PROPERTY_TYPE',
  ASK_CONFIG = 'ASK_CONFIG',
  ASK_TIMELINE = 'ASK_TIMELINE',
  SHOW_RESULTS = 'SHOW_RESULTS',
  CAPTURE_NAME = 'CAPTURE_NAME',
  CAPTURE_PHONE = 'CAPTURE_PHONE',
  ESCALATE = 'ESCALATE',
  DONE = 'DONE'
}
```

### Step Descriptions

| Step | Purpose | Data Collected |
|------|---------|-----------------|
| `ASK_INTENT` | Determine buy/rent/explore | `intent` |
| `ASK_LOCATION` | Get location preference | `location` |
| `ASK_BUDGET` | Get budget range | `budget_min`, `budget_max` |
| `ASK_PROPERTY_TYPE` | Get property type preference | `property_type` |
| `ASK_CONFIG` | Get configuration preference | `bhk` |
| `ASK_TIMELINE` | Get timeline for decision | `timeline` |
| `SHOW_RESULTS` | Display matched properties (hardcoded query) | — |
| `CAPTURE_NAME` | Capture lead name | `name` |
| `CAPTURE_PHONE` | Capture and validate lead phone | `phone` |
| `ESCALATE` | Escalate to human agent | — |
| `DONE` | Conversation complete | — |

---

## 4. Conversation State Structure

### Stored as `conversations.collected_data` (JSONB)

```typescript
interface CollectedData {
  intent?: 'buy' | 'rent' | 'explore',
  location?: string,
  budget_min?: number,
  budget_max?: number,
  property_type?: 'apartment' | 'villa' | 'plot' | 'commercial',
  bhk?: string,
  timeline?: 'urgent' | 'soon' | 'flexible',
  name?: string,
  phone?: string,
  status?: string
}
```

### Stored as `conversations.messages` (JSONB)

```typescript
interface Message {
  role: 'bot' | 'user',
  content: string,
  timestamp: string,
  step?: ChatStep
}
```

---

## 5. API Contract

### Endpoint: `POST /api/chat`

### API Behavior Rules

- If `sessionId` is missing, the API must generate a new UUID.
- The generated `sessionId` must be used for conversation tracking.
- The resolved `sessionId` (incoming or generated) must be returned in the response.

#### Request
```json
{
  "sessionId": "string (unique per user session)",
  "message": "string (user input)"
}
```

#### Response
```json
{
  "success": true,
  "sessionId": "string",
  "conversationId": "uuid",
  "step": "ASK_INTENT | ASK_LOCATION | ...",
  "response": "string (bot message)",
  "collectedData": { /* partial CollectedData */ },
  "requiresEscalation": false,
  "isCompleted": false
}
```

#### Error Response
```json
{
  "success": false,
  "sessionId": "string (resolved session id)",
  "error": "string (error message)",
  "conversationId": "uuid (if available)"
}
```

---

## 6. Hardcoded Flow Logic

### Global Validation Retry Rule

If validation fails:
- DO NOT update `collected_data`
- DO NOT change `step`
- Return the same step message again

This retry rule must apply to:
- `intent`
- `property_type`
- `timeline`
- `phone`

### Input Normalization Layer

Before validation and before storing user input:
- Trim leading/trailing whitespace
- Convert value to lowercase

This normalization rule must be applied to:
- `location`
- `intent`
- `property_type`
- `timeline`

### Step Progression Rules (Deterministic)

```
START
  ↓
ASK_INTENT
  • Store user input as intent
  • Validate: 'buy' | 'rent' | 'explore'
  • If invalid → repeat step
  • If valid → next step
  ↓
ASK_LOCATION
  • Store user input as location
  • No validation (accept any text)
  • Always proceed → next step
  ↓
ASK_BUDGET
  • Accept only deterministic budget patterns:
    - "30-50 lakh"
    - "30L to 50L"
    - "3000000-5000000"
  • Convert parsed values to integer rupees in `budget_min` and `budget_max`
  • If parsing fails:
    - set `budget_min = null`
    - set `budget_max = null`
    - DO NOT block flow
  • Always proceed → next step
  • No AI parsing or inference
  ↓
ASK_PROPERTY_TYPE
  • Store user input as property_type
  • Validate: 'apartment' | 'villa' | 'plot' | 'commercial'
  • If invalid → repeat step
  • If valid → next step
  ↓
ASK_CONFIG
  • Store user input as `bhk`
  • Always proceed → next step
  ↓
ASK_TIMELINE
  • Store user input as timeline
  • Validate: 'urgent' | 'soon' | 'flexible'
  • If invalid → repeat step
  • If valid → next step
  ↓
SHOW_RESULTS
  • Execute hardcoded query (filter by location, property type, availability, and budget range where possible)
  • Return only:
    - total count of matching properties
    - top 3 property titles (if available)
  • Do NOT return full property objects
  • Response shape example:
    - `{"count": 12, "topTitles": ["Skyline Heights 2BHK", "Palm Residency 2BHK", "Seaview Apartments 2BHK"]}`
  • Always proceed → next step
  ↓
CAPTURE_NAME
  • Store user input into `name`
  • Always proceed → next step
  ↓
CAPTURE_PHONE
  • Extract and validate phone with regex: `^(?:\\+91|91)?[6-9][0-9]{9}$`
  • If invalid:
    - keep same step
    - return same prompt
  • If valid:
    - store `phone`
    - immediately create or update lead in `leads` table
    - proceed to next step
  ↓
DONE
  • Mark conversation as completed
  • Return completion message
```

---

## 7. Hardcoded Response Messages

Each step has a fixed, predetermined message.

| Step | Message |
|------|---------|
| `ASK_INTENT` | "Are you looking to **buy**, **rent**, or just **exploring** properties in Visakhapatnam?" |
| `ASK_LOCATION` | "Which area or locality in Visakhapatnam are you interested in?" |
| `ASK_BUDGET` | "What's your budget range for this property?" |
| `ASK_PROPERTY_TYPE` | "What type of property are you looking for? (apartment, villa, plot, or commercial)" |
| `ASK_CONFIG` | "What BHK configuration are you looking for? (e.g., 1BHK, 2BHK, 3BHK)" |
| `ASK_TIMELINE` | "When are you planning to make a decision? (urgent, soon, or flexible)" |
| `SHOW_RESULTS` | "Great! I found {count} properties matching your criteria. Top matches: {title1}, {title2}, {title3}." |
| `CAPTURE_NAME` | "May I have your name?" |
| `CAPTURE_PHONE` | "Please share your phone number so the agent can contact you." |
| `DONE` | "Thank you for using our service! A representative will contact you shortly." |

---

## 8. Data Persistence Approach

### Load Conversation
1. Receive `sessionId` from client (or generate if missing)
2. Query `conversations` table: `WHERE session_id = ?`
3. If found → load existing conversation
4. If found and conversation age is greater than 30 minutes:
  - reset `step = ASK_INTENT`
  - clear `collected_data = {}`
  - keep same `session_id`
5. If not found → create new conversation with `step = ASK_INTENT`

### Update Conversation
1. Extract user message
2. Based on `step`, store message in `collected_data`
3. Validate data (if validation rules exist)
4. Determine next step using hardcoded logic
5. Update `conversations.step = nextStep`
6. Append message to `conversations.messages`
7. Message persistence must be idempotent:
  - append each user/bot message exactly once
  - never overwrite previous `messages`
  - prevent duplicate inserts for the same turn
8. Save to database via `supabase.from('conversations').upsert()`

### Create or Update Lead (On Phone Capture)
When `step = CAPTURE_PHONE` and phone validation succeeds:
1. Extract `collected_data` from conversation
2. Create or update the lead immediately in `leads` table
3. Map values to lead columns (`name`, `phone`, `intent`, `location`, `budget_min`, `budget_max`, `property_type`, `bhk`, `timeline`, `status`)
4. Do NOT wait for `DONE` step to persist lead

### Logging Rules

The API and service layer must log:
- Incoming request (session id and message metadata)
- Current step before processing
- Next step after processing
- Validation failures (with step and reason)

---

## 9. File Structure

```
types/
└── chat.ts              (ChatStep enum, Message, CollectedData types)
lib/
├── supabaseClient.ts    (Existing, verified)
└── chatService.ts       (NEW: Conversation state management logic)
app/
└── api/
  └── chat/
    └── route.ts     (NEW: POST /api/chat endpoint)
```

---

## 10. Implementation Steps (Sequential)

1. **Define Types** → Create `types/chat.ts` with `ChatStep` enum and interfaces
2. **Create Chat Service** → Create `lib/chatService.ts` with:
   - `loadConversation(sessionId)` → fetches or creates
   - `processMessage(conversation, userMessage)` → applies step logic
   - `saveConversation(conversation)` → persists to DB
  - `upsertLeadOnPhoneCapture(conversation)` → creates/updates lead when phone is validated
3. **Implement API Route** → Create `app/api/chat/route.ts`
   - Parse request
   - Load conversation
   - Process message via `chatService`
   - Return response
4. **Add Error Handling** → Validate all inputs and DB calls
5. **Test** → Manual testing via API calls or simple frontend

---

## 11. Validation Criteria

- [ ] TypeScript compiles without errors
- [ ] API returns correct JSON schema for all scenarios
- [ ] Conversation persists correctly across requests (same sessionId loads previous state)
- [ ] Step progression is deterministic (no skipping, no AI-based decisions)
- [ ] Hardcoded messages are used (no generation)
- [ ] Database schema is NOT modified
- [ ] All conversation data is stored in Supabase
- [ ] Test: Create new conversation → validate state progression → verify DB storage

---

## 12. Out of Scope (Phase 2+)

- LLM entity extraction
- Dynamic property filtering
- Natural language understanding
- AI-based step skipping
- Multi-language support
- WhatsApp integration
- Escalation logic (basic placeholder only)

---

## 13. Next Immediate Actions

1. ✅ Analysis complete (this document)
2. ⏳ **Await user approval of this specification**
3. Implement types
4. Implement chat service
5. Implement API route
6. Test end-to-end
