# Phase 6: Hardening, Debugging, and Observability

Status: Specification (Awaiting Approval)  
Date: April 12, 2026  
Objective: Add structured logging, step safety guards, debug visibility, and failure handling without changing business logic or database schema.

---

## 1. Scope and Intent

This phase hardens the existing deterministic chat system and makes every important action traceable, measurable, and easier to debug in production.

In scope:

- Structured logging for request, step, LLM, property, lead, and escalation events
- Step transition guards to prevent infinite loops and stuck states
- Retry counters per step for deterministic fallback behavior
- Request tracing with request-level IDs and severity-aware logs
- Timing metrics for extraction, property search, and total request duration
- Debug mode response enrichment behind an environment flag
- Error boundary behavior for critical backend sections
- Earlier failure detection and safer fallback responses

Out of scope:

- Business logic changes
- Database schema changes
- API contract breakage
- UI changes
- New AI behavior
- Flow redesign

---

## 2. Non-Negotiable Rules

1. Do not change the deterministic state machine.
2. Do not let the LLM control flow.
3. Do not introduce silent failures.
4. Do not create infinite retries or infinite step loops.
5. Do not modify schema unless a future approved logging table is explicitly required.
6. Do not overwrite existing valid data with lower-quality data.
7. Do not break the existing request/response behavior unless the change is strictly additive and gated.

---

## 3. Current System Baseline

This phase builds on the existing backend layers:

- [lib/chatService.ts](../lib/chatService.ts) controls deterministic conversation flow and step progression.
- [lib/llmService.ts](../lib/llmService.ts) handles controlled Gemini extraction and response phrasing.
- [lib/propertyService.ts](../lib/propertyService.ts) handles deterministic property query execution and fallback retry behavior.
- [lib/leadService.ts](../lib/leadService.ts) handles deterministic lead persistence and escalation visibility.

The existing system already has deterministic flow control, validation, and fallback logic. Phase 6 does not replace that behavior. It only makes the system easier to observe, safer under bad input, and less likely to stall.

---

## 4. Phase 6 Goals

1. Make every step traceable.
2. Detect and log failures early.
3. Prevent step stagnation and infinite loops.
4. Expose debug information when explicitly enabled.
5. Improve resilience around LLM, property, and lead operations.
6. Preserve deterministic behavior and existing contracts.

---

## 5. Structured Logging System

### 5.1 New Module

Create a new backend utility at:

- [lib/logger.ts](../lib/logger.ts)

### 5.2 Required Log Format

Every structured log entry must follow this shape:

```ts
{
  sessionId: string
  requestId: string
  step: string
  event: string
  level: 'info' | 'warn' | 'error'
  data?: unknown
  timestamp: string
}
```

### 5.3 Logging Principles

- Logs must be structured and machine-readable.
- Logs must not overwrite prior events.
- Logs must include session and step context whenever available.
- Logs must include a requestId for full request-level traceability.
- Logs must include a severity level so production systems can prioritize issues.
- Sensitive values should be masked when applicable.
- Logging must be additive and non-blocking.
- Logging failures must not stop chat processing.
- Logging volume must be reduced in production mode and expanded in DEBUG_MODE.

### 5.4 Mandatory Events

The following events must be logged at minimum:

- `chat_request_received`
- `step_before_processing`
- `extraction_started`
- `extraction_result`
- `extraction_failed`
- `validation_failed`
- `normalization_applied`
- `step_transition`
- `step_stuck`
- `property_query_executed`
- `property_query_result`
- `lead_created`
- `lead_updated`
- `escalation_triggered`
- `escalation_skipped`
- `system_error`
- `input_received`
- `input_normalized`
- `repeated_input_detected`
- `extraction_raw_output`

### 5.5 Severity Mapping

Log severity must be assigned consistently:

- `info` → normal request, step, persistence, and success flow events
- `warn` → recoverable issues, validation failures, fallback usage, repeated input, and step-stuck conditions
- `error` → critical failures, unexpected backend errors, and unrecoverable service failures

### 5.6 Timing Metrics

The logging system must record lightweight latency measurements for key operations:

- `extraction_duration_ms`
- `property_query_duration_ms`
- `total_request_duration_ms`

These values should be attached to the relevant events and remain non-blocking.

### 5.7 Log Volume Control

Logging behavior must vary by mode:

- `DEBUG_MODE=true` → emit full trace logs, including verbose diagnostics such as raw LLM output
- production mode → emit reduced logs and skip verbose payloads unless an error or alert-worthy condition occurs

### 5.8 Lightweight System Metrics

Track internal diagnostic counters in memory for quick health visibility:

- `extraction_failure_count`
- `fallback_trigger_count`
- `step_stuck_count`
- `lead_created_count`

These counters are for internal diagnostics only and must not affect business logic.

### 5.9 Alert Conditions

The system should mark the following situations as alert-worthy in logs when thresholds are exceeded:

- repeated `step_stuck`
- repeated `extraction_failed`
- `system_error`

When alert thresholds are exceeded, logs should clearly indicate the abnormal pattern using the same structured event stream.

### 5.10 Logging Placement

Logs should be emitted around key checkpoints only:

- Request ingress
- Before step processing
- Before and after extraction
- On validation and normalization outcomes
- On step transition decisions
- On property query execution and result counts
- On lead persistence outcomes
- On escalation decisions
- On fatal or guarded backend errors

Where possible, include decisionReason in log data so the trace explains why a branch, fallback, or retry was chosen.

---

## 6. Step Transition Guard

### 6.1 Problem Being Solved

The system must not remain stuck on the same step when the user has already provided input and the collected data does not change.

### 6.2 Guard Rule

If the following are both true:

- `currentStep === previousStep`
- no new data was updated for the current request

then:

1. Log `step_stuck`.
2. Increment the step retry counter.
3. Force a safe fallback path or move to the next deterministic step.

### 6.3 Proactive Loop Prevention

Before normal validation and merge processing, detect repeated user input for the same step.

If:

- current input equals previous input
- and no new fields were extracted

then:

1. Log `repeated_input_detected`.
2. Skip normal validation for that turn.
3. Trigger fallback or forced progression using the deterministic safe path.
4. Record a decisionReason describing why normal processing was bypassed.

### 6.4 Safe Fallback Behavior

The safe fallback path must be step-specific and deterministic.

Example rule:

- If `ASK_TIMELINE` becomes stuck after repeated failed attempts, force progress to `SHOW_RESULTS`.

General rule:

- Prefer forward progress with partial data over indefinite repetition.
- If a step can no longer safely collect more data, move to the next safe step and preserve existing collected data.

---

## 7. Retry Counter Per Step

### 7.1 Requirement

Track retry counts per step in memory.

Required shape:

- `retryCountByStep`

The step retry state should be scoped to the current request/session processing context and reflected in debug output when enabled.

### 7.2 Behavior

- The retry counter is transient.
- The counter is scoped to the active processing context/session.
- Each time a step fails validation without making progress, increment the counter.
- Maximum retries per step: `2`.
- After the limit is reached, force progress.
- When the retry limit is exceeded, the log entry should include a decisionReason such as `fallback_triggered_retry_limit`.

### 7.3 Required Outcome

The system must never loop forever at the same step because of invalid or partial input.

---

## 8. Debug Mode

### 8.1 Environment Flag

Enable via:

- `DEBUG_MODE=true`

### 8.2 Response Behavior

When debug mode is enabled, the chat API response should include an additional debug block without altering the normal fields.

Required debug shape:

```ts
{
  currentStep: string
  nextStep: string
  collectedData: unknown
  llmUsed: boolean
  fallbackTriggered: boolean
  decisionReason: string
  rejectedFields: string[]
  retryCount: number
}
```

### 8.3 Debug Rules

- Debug data must be additive only.
- Debug data must not change business decisions.
- Debug data must not expose secrets or raw credentials.
- Debug data should help trace the exact path through the state machine.
- Debug data should explain why the request advanced, fell back, or skipped validation.

### 8.4 Scope

Debug info should reflect the final decision path for the request, including whether fallback logic was used.

---

## 9. LLM Observability Layer

### 9.1 Requirement

All LLM calls must be wrapped with trace logging.

### 9.2 Minimum Events

- `extraction_started`
- `extraction_raw_output`
- `extraction_result`
- `extraction_failed`
- `validation_failed`

### 9.3 Observability Rules

- Log the start of every extraction attempt.
- Log the result of each extraction attempt.
- Log the raw LLM output before validation when DEBUG_MODE is enabled, or on error in production mode.
- Log validation failures separately from transport failures.
- Keep prompt version visibility available in logs.
- Do not let LLM failures block the request path.

### 9.3 Timing and Reasoning

LLM observability must also include:

- `extraction_duration_ms`
- `decisionReason` describing the extraction outcome, skip reason, or fallback path

Examples include:

- `llm_skipped_due_to_short_input`
- `validation_failed_missing_budget`
- `fallback_triggered_retry_limit`

### 9.4 Fallback Expectations

If LLM extraction fails, times out, or returns invalid data:

- fall back to deterministic parsing or safe defaults
- continue processing the step
- log the failure path clearly

---

## 10. Property Query Logging

### 10.1 Requirement

The property search path must log both query intent and result count.

### 10.2 Required Events

- `property_query_executed`
- `property_query_result`

### 10.3 Logged Data

The query log should include deterministic filter context such as:

- sessionId
- requestId
- step
- filters used
- retry stage, if any
- result count

Property query logs should also include `property_query_duration_ms` and a decisionReason indicating whether the initial query or a fallback retry produced the final result.

### 10.4 Goal

Make it possible to answer:

- What filters were used?
- Did the query return anything?
- Which fallback stage returned the final results?

---

## 11. Lead Tracking Visibility

### 11.1 Requirement

Lead persistence must log create/update outcomes.

### 11.2 Required Events

- `lead_created`
- `lead_updated`

### 11.3 Logged Data

Logs should capture:

- lead identifier
- sessionId
- requestId
- masked phone if needed
- updated fields or changed fields
- skipped fields when low-quality input was ignored

Lead logs should also include `lead_created_count` updates in the lightweight metrics and the decisionReason for create versus update selection.

### 11.4 Goal

Make lead persistence explainable without opening the database manually.

---

## 12. Escalation Visibility

### 12.1 Requirement

Escalation decisions must be visible in logs.

### 12.2 Required Events

- `escalation_triggered`
- `escalation_skipped`

### 12.3 Logging Goal

The system must clearly show:

- when escalation happened
- why it happened
- when escalation was skipped
- whether the skip was due to duplicate protection or a deterministic rule

Escalation logs should include severity and decisionReason so repeated escalation triggers are easy to distinguish from recoverable skips.

---

## 13. Input Echo Debugging

### 13.1 Requirement

Every request must log the raw input and the normalized input.

### 13.2 Required Events

- `input_received`
- `input_normalized`

### 13.3 Rules

- Log raw input before normalization.
- Log normalized input after trimming/canonicalization.
- Mask sensitive values where necessary.
- Keep the logs deterministic and aligned to the current step.
- Include requestId and decisionReason in the input trace when available.

---

## 14. Backend Error Boundary

### 14.1 Requirement

Wrap critical backend sections with a defensive error boundary.

### 14.2 Expected Behavior

If an unexpected error occurs during message processing:

1. Log `system_error`.
2. Return a safe fallback response.
3. Preserve conversation state if possible.
4. Avoid crashing the request path.

System errors must be logged at `error` level and should include total_request_duration_ms when available.

### 14.3 Fallback Response Policy

The fallback response must be safe, deterministic, and user-friendly.

It should avoid exposing internals and should preserve the ability to continue the conversation.

---

## 15. Failure Handling Principles

1. Never crash on bad input.
2. Never hide a failure.
3. Never loop indefinitely.
4. Never discard state silently.
5. Never let logging failures block chat processing.
6. Prefer partial forward progress over total stall when validation repeatedly fails.
7. When a threshold is exceeded for repeated step_stuck, repeated extraction_failed, or system_error, mark the event as alert-worthy in the log stream.

---

## 16. Compatibility Rules

- Existing request and response fields must remain intact.
- Any debug field must be additive and gated by `DEBUG_MODE=true`.
- Any new tracing or severity fields must be additive and must not alter existing business decisions.
- The deterministic chat flow remains the source of truth.
- LLM remains assistive only.
- No new schema is required for the baseline phase.

---

## 17. Validation Checklist

Functional:

1. Every request logs receipt and step context.
2. Every request has a requestId in the log trail.
3. Step transitions are logged.
4. Repeated invalid input cannot trap the user forever.
5. Retry counters force progress after the limit.
6. Debug mode returns extra diagnostics only when enabled.
7. LLM failures log clearly and fall back safely.
8. Property queries log filters, duration, and result counts.
9. Lead create/update actions are visible in logs.
10. Escalation decisions are visible in logs.
11. Unexpected backend errors return a safe fallback response.
12. Severity and timing metadata are attached to important operational logs.

Behavioral:

1. No infinite loops.
2. No silent failures.
3. No flow breaks.
4. No business logic changes.
5. No schema changes.
6. Production logging stays reduced while DEBUG_MODE provides full diagnostics.

---

## 18. Implementation Order After Approval

1. Add structured logger utility.
2. Add request and step tracing in chat service.
3. Add step-stuck guard and retry counters.
4. Wrap LLM calls with observability logs.
5. Add property query logging.
6. Add lead and escalation visibility logs.
7. Add debug mode response extension.
8. Add backend error boundary and safe fallback responses.
9. Validate no TypeScript errors and no contract regressions.

This document is specification-only. No implementation code is included in this phase.
