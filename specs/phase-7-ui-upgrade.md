# Phase 7: UI Upgrade Plan (Mobile-First Conversational Experience)

Status: Planning (Awaiting Approval)
Date: April 16, 2026
Objective: Redesign the chat UI into an immersive, guided, full-screen real estate conversation interface while preserving clarity, conversion flow, and deterministic backend behavior.

---

## 1. Scope and Constraints

### In Scope
- Full-screen chat layout redesign (mobile-first, desktop-safe)
- Step-focused interaction mode (current question as primary focus)
- Hybrid model: focused current step + subtle historical transcript
- Expanded quick actions for key steps
- Refined input bar and header
- Smooth and subtle transitions
- SHOW_RESULTS transition to clean property list mode

### Out of Scope
- Backend flow logic changes
- API contract changes
- Database/schema changes
- New product features outside chat experience

### Hard Constraints
- Do not copy the reference design literally
- No heavy gradients, flashy motion, or decorative clutter
- Keep a trust-first real estate visual language
- Maintain manual typing fallback at all times

---

## 2. Current UI Assessment (Delta Analysis)

### Strengths in current implementation
- Good deterministic flow integration via latestStep
- Existing quick reply support for ASK_INTENT and ASK_TIMELINE
- Property cards already integrated
- Stable input/send UX and loading protection

### Gaps relative to target experience
- Chat sits inside a boxed container with strong borders
- Current step is not visually dominant enough
- Quick actions are not fully step-guided (ASK_PROPERTY_TYPE missing)
- Input bar feels utilitarian, not floating/minimal
- Header lacks contextual trust copy
- History and focus mode are not clearly differentiated
- Results mode is present but not visually distinct as a state transition

---

## 3. UX Blueprint

### Core Interaction Model
1. User sees a prominent, centered current question.
2. User answers via quick action or typed input.
3. Focus panel transitions to next step.
4. Historical transcript remains visible but subdued.
5. At SHOW_RESULTS, layout shifts from question mode to results mode.

### Layout Zones
- Top zone: lightweight assistant header + context line
- Middle zone: focus panel (primary current-step prompt)
- Secondary transcript lane: recent history, lower visual weight
- Bottom zone: floating input bar + send action

---

## 4. Visual Design Direction

### Color System
- Background: soft neutral (white + zinc/slate tints)
- Surfaces: near-white cards/panels
- Accent: muted slate-blue only for emphasis/actions
- Text hierarchy:
  - Primary: near-black
  - Secondary: muted slate/zinc
  - Metadata: subtle grayscale

### Typography Hierarchy
- Focus question: large, bold, high-contrast
- Supporting/context line: small, muted
- Transcript bubbles: smaller body text, lower emphasis

### Motion Guidelines
- Use only subtle transitions:
  - fade/slide between focus states
  - gentle reveal for results list
- No bounce, elastic, or flashy effects

---

## 5. Component Refactor Plan

## 5.1 ChatContainer
- Remove heavy boxed shell and border framing.
- Move to full-height composition with spacing-defined sections.
- Introduce internal "mode" concept:
  - focus mode for active qualification steps
  - results mode at SHOW_RESULTS
- Keep transcript scrollable and auto-scroll behavior intact.

## 5.2 New/Refactored Focus Layer
- Add a focused step panel in ChatContainer (or a small extracted component if needed).
- Map step -> display prompt copy (from latest Sarah message where possible).
- Render dominant question text centrally with step-aware quick options.

## 5.3 QuickReplyOptions
- Expand option support:
  - ASK_INTENT: Buy / Rent / Exploring
  - ASK_PROPERTY_TYPE: Apartment / Villa / Plot / Commercial
  - ASK_TIMELINE: Urgent / Soon / Flexible
- Keep onSelect behavior unchanged (send immediately).
- Maintain disabled behavior while loading/searching.

## 5.4 ChatInput
- Redesign to a cleaner floating bar aesthetic:
  - reduced border weight
  - rounded container
  - stronger focus state, minimal chrome
- Preserve keyboard and accessibility behavior.

## 5.5 MessageBubble
- Keep role distinction, reduce visual dominance.
- Ensure transcript remains readable but secondary to focus panel.

## 5.6 PropertyCard
- Keep current clean vertical list style.
- Refine spacing and grouping to align with results mode transition.

---

## 6. State and Hook Usage Plan

- Continue using existing useChat contract:
  - messages
  - latestStep
  - loading / isSearching / error
  - sendMessage
- No API changes.
- Keep double-request safeguards:
  - blocked sends while loading
  - consistent disabled state for quick actions and input

Note: If required for cleaner focus rendering, derive focused prompt from latest Sarah message and latestStep in ChatContainer only (no hook contract changes in phase 1 of refactor).

---

## 7. Responsive Behavior

### Mobile-first
- Focus question centered and readable without zoom
- Quick actions fit in wrapped rows with comfortable tap targets
- Input remains anchored and reachable

### Desktop
- Keep single-column conversational center lane
- Maintain proportional spacing and readability

---

## 8. Implementation Sequence (After Approval)

1. Update ChatContainer structure to full-screen layered layout.
2. Add focus-mode panel and step-aware prompt rendering.
3. Expand QuickReplyOptions step mappings (include ASK_PROPERTY_TYPE).
4. Restyle input bar and transcript lane hierarchy.
5. Add results-mode visual transition behavior for SHOW_RESULTS.
6. Tune spacing/typography for mobile and desktop.
7. Run lint/type checks and manual interaction QA.

---

## 9. Acceptance Criteria

- Full-height chat experience with no heavy boxed shell
- Current question is visually dominant at each step
- Quick actions available for intent, property type, timeline
- Manual input remains fully functional
- Transcript remains visible but secondary
- SHOW_RESULTS clearly feels like mode transition to property list
- UI remains clean, professional, trust-first (no heavy gradients)
- No regressions in conversation progression or send behavior

---

## 10. Validation Checklist

### Functional
- Click quick actions sends correct message
- Input send still works for all steps
- Disabled states prevent duplicate sends while loading
- Search loading state still visible and non-blocking

### UX
- Focus hierarchy is obvious on first glance
- Property cards readable and visually consistent
- Header includes Sarah + assistant context line

### Technical
- No TypeScript errors
- No lint errors
- No API/request payload changes

---

## 11. Risks and Mitigations

- Risk: Focus panel could hide too much transcript context.
  - Mitigation: Keep transcript lane visible with reduced prominence.

- Risk: Overly aggressive visual restyling could hurt readability.
  - Mitigation: Keep neutral palette and conservative contrast system.

- Risk: Quick action overuse may constrain edge inputs.
  - Mitigation: Always preserve manual input fallback.
