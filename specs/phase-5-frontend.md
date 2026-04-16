# Phase 5: Frontend Chat UI (Next.js)

Status: Specification (Awaiting Approval)  
Date: April 12, 2026  
Objective: Build a clean, conversion-focused chat interface for the deterministic real estate lead system.

---

## 1. Scope and Intent

This phase adds a production-ready chat interface for the existing backend flow.

In scope:

- Chat container with message list and input
- Hook-based API integration and state management
- Property card rendering for results
- Loading and error UX
- Mobile-responsive clean layout

Out of scope:

- Backend logic changes
- API contract changes
- Schema changes
- Visual effects beyond basic transitions

---

## 2. Non-Negotiable UI Principles

1. Clean and minimal visual system.
2. Professional real-estate tone.
3. Readability and trust first.
4. No gradients.
5. No neon colors.
6. No heavy shadows.
7. No avatars.
8. No decorative typography.
9. No fancy typing animation.

---

## 3. Existing API Contract (Frontend Reference)

From backend route and types:

- Endpoint: POST /api/chat
- Response shape:
  - response
  - step
  - requiresEscalation
  - isCompleted
  - properties? (optional)

Important compatibility note:

- Current backend expects field name userMessage in request body.
- Frontend hook can still expose a sendMessage(message) API, but request payload must map message -> userMessage before network call.
- This preserves existing API contract and avoids backend changes.

---

## 4. Proposed File Structure

components/chat
- ChatContainer.tsx
- MessageBubble.tsx
- ChatInput.tsx
- PropertyCard.tsx
- QuickReplyOptions.tsx

hooks
- useChat.ts

Integration point:

- app/page.tsx should render ChatContainer as primary page content.

---

## 5. Visual System Specification

### 5.1 Color tokens

- Page background: light gray (zinc-50 style)
- Chat surface: white
- Primary text: near-black (zinc-900)
- Secondary text: slate/zinc mid-tone
- Accent (actions/links/buttons): muted blue or slate
- Borders: light gray (zinc-200)

### 5.2 Typography

- Sans-serif system stack or Inter
- Clear hierarchy:
  - Header title
  - Message body
  - Meta text (timestamp/name label if used)

### 5.3 Spacing and sizing

- Generous container padding
- Comfortable message spacing
- Adequate line height for readability
- Max content width for desktop readability

### 5.4 Motion constraints

- Only basic state transitions (hover/focus/disabled)
- No bouncy indicators
- No entrance animations

---

## 6. Component Specifications

### 6.1 ChatContainer

Path: components/chat/ChatContainer.tsx

Responsibilities:

- Render header with assistant identity:
  - Name: Sarah
  - Subtitle: Real Estate Assistant
  - Subtle divider below header
- Render message list from hook state
- Render property list when response includes properties
- Render conversion guidance after property results:
  - Would you like to schedule a visit or talk to the agent?
- Render typing/loading indicator (simple text)
- Render error banner/message
- Render ChatInput
- Render QuickReplyOptions for supported steps

Layout behavior:

- Desktop: centered column with max width
- Mobile: full width with safe paddings
- Message area must be independently scrollable
- Input area position must remain stable while messages update

### 6.2 MessageBubble

Path: components/chat/MessageBubble.tsx

Rules:

- User message: right aligned
- Sarah message: left aligned
- Sarah label should be used for bot role
- Subtle visual distinction:
  - User bubble: light slate/blue tint, readable contrast
  - Sarah bubble: white with light border

No avatar usage.

### 6.3 ChatInput

Path: components/chat/ChatInput.tsx

Features:

- Text input
- Send button
- Enter to send
- Trim whitespace before send
- Prevent sending empty trimmed input
- Disable send button while loading

Accessibility:

- Input label (visible or screen-reader)
- Keyboard focus ring
- Button accessible name

### 6.4 PropertyCard

Path: components/chat/PropertyCard.tsx

When shown:

- Render on steps where API returns properties (especially show_results stage output)

Fields per card:

- price (primary emphasis)
- title
- location
- bhk

Card style:

- Vertical list
- White background
- Light border
- Minimal shadow or none
- Structured text hierarchy with clear prominence:
  1. Price (bold, larger)
  2. Title
  3. Location (secondary)
  4. BHK (badge/tag style)
- Clear visual separation between cards

### 6.5 QuickReplyOptions

Path: components/chat/QuickReplyOptions.tsx

Purpose:

- Reduce typing friction on high-frequency decisions

Used for steps:

- ASK_INTENT
- ASK_TIMELINE

Example options:

- ASK_INTENT: Buy, Rent, Exploring
- ASK_TIMELINE: Immediately, Within 3 months, Just exploring

Behavior:

- Clicking an option sends the mapped message immediately
- Must not block or replace normal text-input flow
- Must follow same loading/disabled rules as ChatInput

---

## 7. Hook Specification

### 7.1 useChat

Path: hooks/useChat.ts

State managed:

- sessionId (stable per browser session)
- messages array
- latestStep
- latestProperties
- loading boolean
- error string | null
- autoScrollEnabled boolean

Suggested message model for UI layer:

- id
- role (user or sarah)
- text
- timestamp
- properties optional (for response-linked cards)

### 7.2 Session strategy

- Create sessionId once on first mount (crypto random UUID)
- Persist in local storage for continuity in same browser
- Reuse for all subsequent requests

### 7.3 Send flow

1. User sends input
2. Push user message immediately into UI state
3. Set loading true
4. POST to /api/chat
5. Map payload:
   - sessionId
   - userMessage: message
6. Parse response
7. Push Sarah message
8. Attach properties list if present
9. Set loading false
10. On failure: set error and loading false

Quick-reply flow:

1. User clicks a quick reply option
2. Option value is sent through same send pipeline
3. Preserve identical validation, loading, and error behavior

Auto-scroll behavior:

- Auto-scroll to latest message when:
  - a new message is added
  - user sends a message
- Do not auto-scroll if user has manually scrolled upward
- Re-enable auto-scroll when user returns near bottom

---

## 8. Loading and Error UX

### 8.1 Loading state

- Show simple line of text under messages:
  - Sarah is typing...
- Optional: subtle blinking cursor
- No animated dots or complex motion

### 8.2 Error handling

- On API/network failure show:
  - Something went wrong. Please try again or resend your message.
- Keep unsent text behavior predictable (clear or preserve as product choice, default preserve for user trust)
- Do not crash message list rendering

### 8.3 Initial empty state

- On first load with no messages, show:
  - Hi, I can help you find properties in Visakhapatnam. What are you looking for?
- Empty-state copy should appear in message area before first user input

---

## 9. Property Rendering Rules

1. If response.properties exists and length > 0:
   - Render a vertical PropertyCard list below the associated Sarah message block or in the flow section immediately after it.
  - Render subtle conversion guidance immediately after the list:
    - Would you like to schedule a visit or talk to the agent?
  - Preferred: quick reply options for follow-up intent (schedule visit / talk to agent)
2. If empty or missing:
   - Render no property cards.
3. Never fabricate fields.
4. Price should be formatted for readability (Indian grouping optional but recommended).

---

## 10. Responsiveness and Accessibility

Responsive requirements:

- Mobile-first width behavior
- Input fixed to bottom area or within card with clear visibility
- Message area scrollable without layout jump
- Scroll container must preserve stable layout with independent overflow handling

Accessibility requirements:

- Color contrast compliant for text
- Keyboard-only send flow works
- Focus states visible
- Semantic button/input roles preserved

---

## 11. Validation Checklist

Functional:

1. UI renders without runtime errors.
2. User messages appear instantly.
3. Loading indicator appears during request.
4. Sarah response appears after API response.
5. Property cards render when properties exist.
6. Error message appears on failures.
7. Initial empty-state guidance appears before first message.
8. Quick reply options send messages correctly on supported steps.
9. Auto-scroll works and respects manual upward scrolling.

Behavior:

1. Session persists and conversation continuity remains.
2. API integration uses existing backend contract.
3. No visual clutter or off-brand effects.
4. Conversion guidance appears after property results.

Design:

1. No gradients.
2. No heavy shadows.
3. No flashy colors.
4. Clean and professional appearance on desktop and mobile.

---

## 12. Implementation Order (Post-Approval)

1. Build useChat hook
2. Build MessageBubble
3. Build ChatInput
4. Build PropertyCard
5. Build ChatContainer and connect hook
6. Integrate ChatContainer in app/page.tsx
7. Validate full flow with backend

This is a specification-only document. No implementation code is included in this phase.
