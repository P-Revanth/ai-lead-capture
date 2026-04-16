import { supabase } from '@/lib/supabaseClient'
import {
    ChatMessage,
    ChatStep,
    CollectedData,
    ChatDebugInfo,
    ConversationRecord,
    Intent,
    PropertyType,
    Timeline,
    ProcessResult,
} from '@/types/chat'
import { Json, Tables, TablesInsert, TablesUpdate } from '@/types/supabase'
import { getMatchingProperties, isValidLocation, PropertyFilter } from '@/lib/propertyService'
import { createOrUpdateLead } from '@/lib/leadService'
import { buildEscalationPayload, notifyAgent } from '@/lib/escalationService'
import { logEvent, incrementMetric, LogContext } from '@/lib/logger'
import {
    extractEntities,
    generateResponse,
    ExtractedEntities,
    EXTRACTION_PROMPT_VERSION,
    RESPONSE_PROMPT_VERSION,
    ExtractionResult,
} from '@/lib/llmService'

type ConversationRow = Tables<'conversations'>

function toJson(value: unknown): Json {
    return value as Json
}

const CONVERSATION_EXPIRY_MS = 30 * 60 * 1000

const STEP_PROMPTS: Record<ChatStep, string> = {
    [ChatStep.ASK_INTENT]: 'Are you looking to buy, rent, or just exploring?',
    [ChatStep.ASK_LOCATION]: 'Which area in Visakhapatnam are you interested in?',
    [ChatStep.ASK_BUDGET]: "What's your budget range for this property?",
    [ChatStep.ASK_PROPERTY_TYPE]: 'What type of property are you looking for? (apartment, villa, plot, or commercial)',
    [ChatStep.ASK_CONFIG]: 'What BHK configuration are you looking for? (e.g., 1BHK, 2BHK, 3BHK)',
    [ChatStep.ASK_TIMELINE]: 'When are you planning to make a decision? (urgent, soon, or flexible)',
    [ChatStep.SHOW_RESULTS]: 'Let me check matching properties for you.',
    [ChatStep.CAPTURE_NAME]: 'May I have your name?',
    [ChatStep.CAPTURE_PHONE]: 'Please share your phone number so the agent can contact you.',
    [ChatStep.ESCALATE]: 'I will connect you with our human agent now.',
    [ChatStep.DONE]: 'Thank you for using our service! A representative will contact you shortly.',
}

const STEP_ORDER: ChatStep[] = [
    ChatStep.ASK_INTENT,
    ChatStep.ASK_LOCATION,
    ChatStep.ASK_BUDGET,
    ChatStep.ASK_PROPERTY_TYPE,
    ChatStep.ASK_CONFIG,
    ChatStep.ASK_TIMELINE,
    ChatStep.SHOW_RESULTS,
    ChatStep.CAPTURE_NAME,
    ChatStep.CAPTURE_PHONE,
    ChatStep.ESCALATE,
    ChatStep.DONE,
]

const VALID_INTENTS: Intent[] = ['buy', 'rent', 'explore']
const VALID_PROPERTY_TYPES: PropertyType[] = ['apartment', 'villa', 'plot', 'commercial']
const VALID_TIMELINES: Timeline[] = ['urgent', 'soon', 'flexible']
const SESSION_ESCALATION_TRACKER = new Map<string, Set<string>>()
const EXTRACTION_BUFFER = new Map<string, ExtractedEntities>()
const VALID_EXTRACTION_STEP_TRACKER = new Map<string, Set<ChatStep>>()
const REQUEST_RUNTIME_STATE = new Map<string, RequestRuntimeState>()

type ExtractionField = keyof ExtractedEntities
type FieldReason = 'null' | 'low_quality' | 'sanity_check_failed' | 'ambiguous_group'

interface RequestRuntimeState {
    previousInputByStep: Partial<Record<ChatStep, string>>
    retryCountByStep: Partial<Record<ChatStep, number>>
}

interface ChatProcessContext {
    requestId: string
    debugMode: boolean
    requestStartedAt: number
}

function getRequestRuntimeState(sessionId: string): RequestRuntimeState {
    const existing = REQUEST_RUNTIME_STATE.get(sessionId)
    if (existing) {
        return existing
    }

    const created: RequestRuntimeState = {
        previousInputByStep: {},
        retryCountByStep: {},
    }
    REQUEST_RUNTIME_STATE.set(sessionId, created)
    return created
}

function getRetryCount(state: RequestRuntimeState, step: ChatStep): number {
    return state.retryCountByStep[step] ?? 0
}

function setRetryCount(state: RequestRuntimeState, step: ChatStep, count: number): void {
    state.retryCountByStep[step] = count
}

function incrementRetryCount(state: RequestRuntimeState, step: ChatStep): number {
    const next = getRetryCount(state, step) + 1
    setRetryCount(state, step, next)
    return next
}

function resetRetryCount(state: RequestRuntimeState, step: ChatStep): void {
    setRetryCount(state, step, 0)
}

function setPreviousInput(state: RequestRuntimeState, step: ChatStep, input: string): void {
    state.previousInputByStep[step] = input
}

function isRepeatedInput(state: RequestRuntimeState, step: ChatStep, input: string): boolean {
    return state.previousInputByStep[step] === input
}

function createTraceContext(sessionId: string, requestId: string, step: ChatStep, debugMode: boolean): LogContext & { debugMode: boolean } {
    return {
        sessionId,
        requestId,
        step,
        debugMode,
    }
}

function logTrace(
    trace: LogContext,
    event: string,
    level: 'info' | 'warn' | 'error',
    data?: unknown,
    decisionReason?: string,
): void {
    logEvent({
        ...trace,
        event,
        level,
        data,
        decisionReason,
    })
}

function createDebugInfo(
    currentStep: ChatStep,
    nextStep: ChatStep,
    collectedData: CollectedData,
    llmUsed: boolean,
    fallbackTriggered: boolean,
    decisionReason: string,
    rejectedFields: string[],
    retryCount: number,
): ChatDebugInfo {
    return {
        currentStep,
        nextStep,
        collectedData,
        llmUsed,
        fallbackTriggered,
        decisionReason,
        rejectedFields,
        retryCount,
    }
}

const STEP_EXTRACTION_FIELDS: Partial<Record<ChatStep, ExtractionField[]>> = {
    [ChatStep.ASK_INTENT]: ['intent'],
    [ChatStep.ASK_LOCATION]: ['location'],
    [ChatStep.ASK_BUDGET]: ['budget_min', 'budget_max'],
    [ChatStep.ASK_PROPERTY_TYPE]: ['property_type', 'bhk'],
    [ChatStep.ASK_CONFIG]: ['bhk'],
    [ChatStep.ASK_TIMELINE]: ['timeline'],
    [ChatStep.CAPTURE_NAME]: ['name'],
    [ChatStep.CAPTURE_PHONE]: ['phone'],
}

function createEmptyExtractionBuffer(): ExtractedEntities {
    return {
        intent: null,
        location: null,
        budget_min: null,
        budget_max: null,
        property_type: null,
        bhk: null,
        timeline: null,
        name: null,
        phone: null,
    }
}

function getExtractionBuffer(sessionId: string): ExtractedEntities {
    const existing = EXTRACTION_BUFFER.get(sessionId)
    if (existing) {
        return existing
    }
    const created = createEmptyExtractionBuffer()
    EXTRACTION_BUFFER.set(sessionId, created)
    return created
}

function getTrackedStepSet(sessionId: string): Set<ChatStep> {
    const existing = VALID_EXTRACTION_STEP_TRACKER.get(sessionId)
    if (existing) {
        return existing
    }
    const created = new Set<ChatStep>()
    VALID_EXTRACTION_STEP_TRACKER.set(sessionId, created)
    return created
}

function hasValidExtractionForStep(sessionId: string, step: ChatStep): boolean {
    return getTrackedStepSet(sessionId).has(step)
}

function markValidExtractionForStep(sessionId: string, step: ChatStep): void {
    getTrackedStepSet(sessionId).add(step)
}

function getStepFields(step: ChatStep): ExtractionField[] {
    return STEP_EXTRACTION_FIELDS[step] ?? []
}

function hasRequiredFieldCollected(step: ChatStep, collectedData: CollectedData): boolean {
    switch (step) {
        case ChatStep.ASK_INTENT:
            return !!collectedData.intent
        case ChatStep.ASK_LOCATION:
            return !!collectedData.location && collectedData.location.trim().length > 0
        case ChatStep.ASK_BUDGET:
            return typeof collectedData.budget_min === 'number' && typeof collectedData.budget_max === 'number'
        case ChatStep.CAPTURE_NAME:
            return !!collectedData.name && collectedData.name.trim().length > 0
        case ChatStep.CAPTURE_PHONE:
            return !!collectedData.phone && collectedData.phone.trim().length > 0
        default:
            return false
    }
}

function getLlmExtractionSkipReason(
    step: ChatStep,
    message: string,
    collectedData: CollectedData,
    sessionId: string,
): string | null {
    if (getStepFields(step).length === 0) {
        return 'llm_skipped_no_step_fields'
    }

    if (message.trim().length < 3) {
        return 'llm_skipped_due_to_short_input'
    }

    if (hasRequiredFieldCollected(step, collectedData)) {
        return 'llm_skipped_required_field_collected'
    }

    if (hasValidExtractionForStep(sessionId, step)) {
        return 'llm_skipped_existing_extraction'
    }

    return null
}

function logLlmMerge(
    trace: LogContext,
    fieldsUpdated: string[],
    fieldsSkipped: string[],
    reason: FieldReason,
    decisionReason: string,
): void {
    logEvent({
        ...trace,
        event: 'llm_merge_applied',
        level: reason === 'null' ? 'info' : 'warn',
        data: {
            fields_updated: fieldsUpdated,
            fields_skipped: fieldsSkipped,
            reason,
        },
        decisionReason,
    })
}

async function maybePopulateExtractionBuffer(
    conversation: ConversationRecord,
    step: ChatStep,
    message: string,
    trace: LogContext & { debugMode: boolean },
): Promise<ExtractionResult | null> {
    const skipReason = getLlmExtractionSkipReason(step, message, conversation.collected_data, conversation.session_id)
    if (skipReason) {
        logTrace(trace, 'extraction_result', 'info', {
            skipped: true,
            prompt_version: EXTRACTION_PROMPT_VERSION,
        }, skipReason)

        return null
    }

    logTrace(trace, 'llm_extraction_request', 'info', {
        inputLength: message.length,
        prompt_version: EXTRACTION_PROMPT_VERSION,
    }, 'llm_extraction_request')

    const result = await extractEntities(message, trace)

    const buffer = getExtractionBuffer(conversation.session_id)
    const sanitizedEntities = sanitizeExtractionForStep(step, result.entities)
    applyNonNullExtraction(buffer, sanitizedEntities)

    const relevantFields = getStepFields(step)
    const hasRelevantValue = relevantFields.some((field) => isPresent(buffer[field]))
    if (hasRelevantValue) {
        markValidExtractionForStep(conversation.session_id, step)
    }

    return result
}

async function formatResponseWithLlm(
    conversation: ConversationRecord,
    step: ChatStep,
    fallback: string,
    trace: LogContext & { debugMode: boolean },
): Promise<string> {
    const generated = await generateResponse(step, conversation.collected_data, fallback)
    const usedFallback = generated === fallback

    logTrace(trace, 'llm_response_generated', usedFallback ? 'warn' : 'info', {
        usedFallback,
        prompt_version: RESPONSE_PROMPT_VERSION,
    }, usedFallback ? 'response_fallback_used' : 'response_generated')

    if (usedFallback) {
        incrementMetric('fallback_trigger_count')
    }

    return generated
}

function nowIso(): string {
    return new Date().toISOString()
}

function parseDbTimestampToMs(value: string): number {
    // Postgres "timestamp without time zone" may be returned without offset; treat it as UTC.
    const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
    const normalized = hasOffset ? value : `${value}Z`
    return new Date(normalized).getTime()
}

function toChatStep(value: string | null | undefined): ChatStep {
    if (!value) {
        return ChatStep.ASK_INTENT
    }

    const steps = Object.values(ChatStep) as string[]
    const normalized = value.trim().toLowerCase()
    if (steps.includes(normalized)) {
        return normalized as ChatStep
    }

    // Backward compatibility for legacy uppercase enum-style values in DB.
    const legacyNormalized = value.trim().toLowerCase().replace(/\s+/g, '_')
    if (steps.includes(legacyNormalized)) {
        return legacyNormalized as ChatStep
    }

    return ChatStep.ASK_INTENT
}

function asCollectedData(value: unknown): CollectedData {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {}
    }
    return value as CollectedData
}

function asMessages(value: unknown): ChatMessage[] {
    if (!Array.isArray(value)) {
        return []
    }
    return value as ChatMessage[]
}

function findKeyword<T extends string>(message: string, values: readonly T[]): T | undefined {
    const normalized = message.trim().toLowerCase()
    return values.find((entry) => normalized.includes(entry))
}

function normalizeInput(input: string): string {
    return input.trim().toLowerCase()
}

function parseBudget(message: string): { min: number | null; max: number | null } {
    const normalized = normalizeInput(message).replace(/,/g, '')

    const lakhPattern = /^(\d+)\s*(?:l|lakh)\s*(?:-|to)\s*(\d+)\s*(?:l|lakh)$/i
    const rawPattern = /^(\d{5,})\s*(?:-|to)\s*(\d{5,})$/

    const lakhMatch = normalized.match(lakhPattern)
    if (lakhMatch) {
        const left = Number(lakhMatch[1]) * 100000
        const right = Number(lakhMatch[2]) * 100000
        const min = Math.min(left, right)
        const max = Math.max(left, right)
        return { min, max }
    }

    const rawMatch = normalized.match(rawPattern)
    if (rawMatch) {
        const left = Number(rawMatch[1])
        const right = Number(rawMatch[2])
        const min = Math.min(left, right)
        const max = Math.max(left, right)
        return { min, max }
    }

    return { min: null, max: null }
}

function parseTimelineInput(message: string): Timeline | undefined {
    const normalized = normalizeInput(message)

    if (/(urgent|immediate|immediately|asap|right away|now)/.test(normalized)) {
        return 'urgent'
    }

    if (/(soon|within|week|weeks|month|months|next)/.test(normalized)) {
        return 'soon'
    }

    if (/(flexible|explor|later|no hurry|no rush|sometime)/.test(normalized)) {
        return 'flexible'
    }

    return findKeyword(normalized, VALID_TIMELINES)
}

function normalizeIndianPhone(input: string): string | null {
    const digits = input.replace(/\D/g, '')
    const localDigits = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits
    if (!/^[6-9][0-9]{9}$/.test(localDigits)) {
        return null
    }
    return localDigits
}

function isValidName(name: string): boolean {
    const trimmed = name.trim()
    if (trimmed.length < 2) {
        return false
    }
    return !/^\d+$/.test(trimmed)
}

function isAgentHandoffIntent(message: string): boolean {
    const normalized = normalizeInput(message)
    if (!normalized) {
        return false
    }

    return /(talk to (an?|the)? ?agent|speak to (an?|the)? ?agent|human agent|real person|contact agent|schedule( a)? visit|site visit|arrange( a)? visit)/.test(normalized)
}

function hasEscalatedPhoneInSession(sessionId: string, phone: string): boolean {
    const set = SESSION_ESCALATION_TRACKER.get(sessionId)
    return set ? set.has(phone) : false
}

function markEscalatedPhoneInSession(sessionId: string, phone: string): void {
    const existing = SESSION_ESCALATION_TRACKER.get(sessionId)
    if (existing) {
        existing.add(phone)
        return
    }
    SESSION_ESCALATION_TRACKER.set(sessionId, new Set([phone]))
}

function shouldAppendMessage(messages: ChatMessage[], message: ChatMessage): boolean {
    const last = messages[messages.length - 1]
    if (!last) {
        return true
    }
    return !(last.role === message.role && last.content === message.content)
}

function appendMessageOnce(conversation: ConversationRecord, message: ChatMessage): void {
    if (shouldAppendMessage(conversation.messages, message)) {
        conversation.messages = [...conversation.messages, message]
    }
}

function getNextStep(step: ChatStep): ChatStep {
    const index = STEP_ORDER.indexOf(step)
    return STEP_ORDER[index + 1] ?? step
}

function getStepIndex(step: ChatStep): number {
    return STEP_ORDER.indexOf(step)
}

function isPresent(value: unknown): boolean {
    if (value === null || value === undefined) {
        return false
    }
    if (typeof value === 'string') {
        return value.trim().length > 0
    }
    return true
}

function applyNonNullExtraction(target: ExtractedEntities, source: ExtractedEntities): void {
    const entries = Object.entries(source) as [keyof ExtractedEntities, ExtractedEntities[keyof ExtractedEntities]][]
    const targetRecord = target as Record<ExtractionField, unknown>
    for (const [key, value] of entries) {
        if (isPresent(value)) {
            targetRecord[key as ExtractionField] = value
        }
    }
}

function shouldSkipStep(step: ChatStep, data: CollectedData): boolean {
    switch (step) {
        case ChatStep.ASK_INTENT:
            return !!data.intent
        case ChatStep.ASK_LOCATION:
            return !!data.location
        case ChatStep.ASK_BUDGET:
            return typeof data.budget_min === 'number' && typeof data.budget_max === 'number'
        case ChatStep.ASK_PROPERTY_TYPE:
            return !!data.property_type || !!data.bhk
        case ChatStep.ASK_CONFIG:
            return !!data.bhk
        case ChatStep.ASK_TIMELINE:
            return !!data.timeline
        default:
            return false
    }
}

function getForwardStep(step: ChatStep, data: CollectedData): ChatStep {
    let next = getNextStep(step)
    while (shouldSkipStep(next, data)) {
        const advanced = getNextStep(next)
        if (advanced === next) {
            break
        }
        next = advanced
    }

    if (getStepIndex(next) <= getStepIndex(step)) {
        next = getNextStep(step)
    }

    return next
}

function getFallbackStep(step: ChatStep): ChatStep {
    return getNextStep(step)
}

const FIELD_STEP_GUARD: Record<ExtractionField, ChatStep> = {
    intent: ChatStep.ASK_INTENT,
    location: ChatStep.ASK_LOCATION,
    budget_min: ChatStep.ASK_BUDGET,
    budget_max: ChatStep.ASK_BUDGET,
    property_type: ChatStep.ASK_PROPERTY_TYPE,
    bhk: ChatStep.ASK_CONFIG,
    timeline: ChatStep.ASK_TIMELINE,
    name: ChatStep.CAPTURE_NAME,
    phone: ChatStep.CAPTURE_PHONE,
}

function sanitizeExtractionForStep(step: ChatStep, entities: ExtractedEntities): ExtractedEntities {
    const currentIndex = getStepIndex(step)
    const sanitized = createEmptyExtractionBuffer()
    const sanitizedRecord = sanitized as Record<ExtractionField, unknown>
    const entries = Object.entries(entities) as [ExtractionField, ExtractedEntities[ExtractionField]][]

    for (const [field, value] of entries) {
        if (!isPresent(value)) {
            continue
        }

        const fieldIndex = getStepIndex(FIELD_STEP_GUARD[field])
        if (fieldIndex < currentIndex) {
            continue
        }

        sanitizedRecord[field] = value
    }

    return sanitized
}

export async function loadOrCreateConversation(sessionId: string): Promise<ConversationRecord> {
    const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('session_id', sessionId)
        .single()

    if (error && error.code !== 'PGRST116') {
        // Fallback for legacy sessions that accidentally have duplicate rows.
        const { data: duplicateRows, error: duplicateReadError } = await supabase
            .from('conversations')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false })
            .limit(1)

        if (duplicateReadError) {
            throw new Error(`Failed to load conversation: ${duplicateReadError.message}`)
        }

        if (duplicateRows && duplicateRows.length > 0) {
            const row = duplicateRows[0] as ConversationRow
            const createdAt = String(row.created_at ?? nowIso())
            const createdAtMs = parseDbTimestampToMs(createdAt)
            const isExpired = Number.isFinite(createdAtMs) && Date.now() - createdAtMs > CONVERSATION_EXPIRY_MS

            if (isExpired) {
                return {
                    id: String(row.id),
                    session_id: String(row.session_id ?? sessionId),
                    messages: asMessages(row.messages),
                    step: ChatStep.ASK_INTENT,
                    collected_data: {},
                    created_at: createdAt,
                }
            }

            return {
                id: String(row.id),
                session_id: String(row.session_id ?? sessionId),
                messages: asMessages(row.messages),
                step: toChatStep(row.step ?? ChatStep.ASK_INTENT),
                collected_data: asCollectedData(row.collected_data),
                created_at: createdAt,
            }
        }

        throw new Error(`Failed to load conversation: ${error.message}`)
    }

    if (data) {
        const row = data as ConversationRow
        const createdAt = String(row.created_at ?? nowIso())
        const createdAtMs = parseDbTimestampToMs(createdAt)
        const isExpired = Number.isFinite(createdAtMs) && Date.now() - createdAtMs > CONVERSATION_EXPIRY_MS

        if (isExpired) {
            return {
                id: String(row.id),
                session_id: String(row.session_id ?? sessionId),
                messages: asMessages(row.messages),
                step: ChatStep.ASK_INTENT,
                collected_data: {},
                created_at: createdAt,
            }
        }

        return {
            id: String(row.id),
            session_id: String(row.session_id ?? sessionId),
            messages: asMessages(row.messages),
            step: toChatStep(row.step ?? ChatStep.ASK_INTENT),
            collected_data: asCollectedData(row.collected_data),
            created_at: createdAt,
        }
    }

    if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to load conversation: ${error.message}`)
    }

    const insertPayload: TablesInsert<'conversations'> = {
        session_id: sessionId,
        messages: toJson([] as ChatMessage[]),
        step: ChatStep.ASK_INTENT,
        collected_data: toJson({} as CollectedData),
    }

    const { data: created, error: createError } = await supabase
        .from('conversations')
        .insert(insertPayload)
        .select('*')
        .single()

    if (createError || !created) {
        throw new Error(`Failed to create conversation: ${createError?.message ?? 'Unknown error'}`)
    }

    return {
        id: String(created.id),
        session_id: String(created.session_id),
        messages: asMessages(created.messages),
        step: toChatStep(created.step as string),
        collected_data: asCollectedData(created.collected_data),
        created_at: String(created.created_at),
    }
}

export async function saveConversation(conversation: ConversationRecord): Promise<void> {
    const payload: TablesUpdate<'conversations'> = {
        step: conversation.step,
        collected_data: toJson(conversation.collected_data),
        messages: toJson(conversation.messages),
    }

    const { error } = await supabase.from('conversations').update(payload).eq('id', conversation.id)
    if (error) {
        throw new Error(`Failed to save conversation: ${error.message}`)
    }
}

export async function readConversationBySessionId(sessionId: string): Promise<ConversationRecord | null> {
    const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('session_id', sessionId)
        .single()

    if (error && error.code === 'PGRST116') {
        return null
    }

    if (error || !data) {
        throw new Error(`Failed to verify conversation state: ${error?.message ?? 'Unknown error'}`)
    }

    const row = data as ConversationRow
    return {
        id: String(row.id),
        session_id: String(row.session_id ?? sessionId),
        messages: asMessages(row.messages),
        step: toChatStep(row.step ?? ChatStep.ASK_INTENT),
        collected_data: asCollectedData(row.collected_data),
        created_at: String(row.created_at ?? nowIso()),
    }
}

export async function processConversationTurn(
    conversation: ConversationRecord,
    userMessage: string,
    context: ChatProcessContext,
): Promise<ProcessResult> {
    const rawTrimmed = userMessage.trim()
    const normalized = normalizeInput(rawTrimmed)
    const runtimeState = getRequestRuntimeState(conversation.session_id)
    const traceFor = (step: ChatStep): LogContext & { debugMode: boolean } =>
        createTraceContext(conversation.session_id, context.requestId, step, context.debugMode)
    const initialStep = conversation.step
    const currentStep = conversation.step
    let nextStep = conversation.step
    let llmUsed = false
    let fallbackTriggered = false
    let decisionReason = 'request_received'
    const rejectedFields: string[] = []
    const initialRetryCount = getRetryCount(runtimeState, initialStep)

    logTrace(traceFor(currentStep), 'step_before_processing', 'info', {
        currentStep,
        total_request_started_at: context.requestStartedAt,
        retryCount: initialRetryCount,
    }, 'step_before_processing')

    logTrace(traceFor(currentStep), 'input_received', 'info', {
        rawInput: rawTrimmed,
    }, 'input_received')

    logTrace(traceFor(currentStep), 'input_normalized', 'info', {
        normalizedInput: normalized,
    }, 'input_normalized')

    conversation.collected_data = { ...conversation.collected_data }

    if (rawTrimmed.length > 0) {
        appendMessageOnce(conversation, {
            role: 'user',
            content: rawTrimmed,
            timestamp: nowIso(),
        })
    }

    if (rawTrimmed.length === 0 && conversation.messages.length === 0) {
        const prompt = STEP_PROMPTS[conversation.step]
        const stepTrace = traceFor(conversation.step)
        const formattedPrompt = await formatResponseWithLlm(conversation, conversation.step, prompt, stepTrace)
        llmUsed = true
        appendMessageOnce(conversation, {
            role: 'bot',
            content: formattedPrompt,
            timestamp: nowIso(),
        })

        nextStep = conversation.step
        decisionReason = 'initial_prompt'
        setPreviousInput(runtimeState, initialStep, normalized)

        logTrace(
            traceFor(initialStep),
            'step_transition',
            'info',
            {
                currentStep,
                nextStep: conversation.step,
                collectedData: conversation.collected_data,
                total_request_duration_ms: Date.now() - context.requestStartedAt,
                retryCount: getRetryCount(runtimeState, initialStep),
            },
            decisionReason,
        )

        return {
            response: formattedPrompt,
            requiresEscalation: conversation.step === ChatStep.ESCALATE,
            isCompleted: conversation.step === ChatStep.DONE,
            properties: undefined,
            requestId: context.requestId,
            debug: context.debugMode
                ? createDebugInfo(
                    initialStep,
                    conversation.step,
                    conversation.collected_data,
                    llmUsed,
                    fallbackTriggered,
                    decisionReason,
                    rejectedFields,
                    getRetryCount(runtimeState, initialStep),
                )
                : undefined,
        }
    }

    let response = STEP_PROMPTS[conversation.step]
    let properties = undefined

    if (
        rawTrimmed.length > 0
        && isAgentHandoffIntent(rawTrimmed)
        && getStepIndex(conversation.step) <= getStepIndex(ChatStep.SHOW_RESULTS)
    ) {
        const stepTrace = traceFor(conversation.step)
        conversation.step = ChatStep.CAPTURE_NAME
        nextStep = conversation.step
        decisionReason = 'agent_handoff_requested'

        logTrace(
            stepTrace,
            'handoff_intent_detected',
            'info',
            {
                nextStep: conversation.step,
                rawInput: rawTrimmed,
            },
            decisionReason,
        )
    }

    switch (conversation.step) {
        case ChatStep.ASK_INTENT: {
            const stepTrace = traceFor(conversation.step)
            const extraction = await maybePopulateExtractionBuffer(conversation, conversation.step, rawTrimmed, stepTrace)
            llmUsed = llmUsed || !!extraction
            const buffer = getExtractionBuffer(conversation.session_id)
            const fieldsUpdated: string[] = []
            const fieldsSkipped: string[] = []
            const repeatedInput = isRepeatedInput(runtimeState, conversation.step, normalized)

            const intent = buffer.intent ?? findKeyword(normalized, VALID_INTENTS) ?? null
            if (!intent) {
                const retryCount = incrementRetryCount(runtimeState, conversation.step)
                rejectedFields.push('intent')
                fieldsSkipped.push(`intent:${extraction?.fieldReasons.intent ?? 'null'}`)
                logTrace(
                    stepTrace,
                    'validation_failed',
                    'warn',
                    { reason: 'invalid intent', retryCount, fieldsSkipped },
                    'validation_failed_missing_intent',
                )

                if (repeatedInput || retryCount >= 2) {
                    fallbackTriggered = true
                    incrementMetric('step_stuck_count')
                    logTrace(
                        stepTrace,
                        'repeated_input_detected',
                        'warn',
                        { input: normalized, retryCount },
                        'repeated_input_detected',
                    )
                    logTrace(
                        stepTrace,
                        'step_stuck',
                        'warn',
                        { retryCount, currentStep: conversation.step },
                        'fallback_triggered_retry_limit',
                    )
                    conversation.step = getFallbackStep(conversation.step)
                    nextStep = conversation.step
                    decisionReason = 'fallback_triggered_retry_limit'
                    response = STEP_PROMPTS[conversation.step]
                    buffer.intent = null
                    break
                }

                logLlmMerge(stepTrace, fieldsUpdated, fieldsSkipped, 'null', 'validation_failed_missing_intent')
                response = STEP_PROMPTS[conversation.step]
                decisionReason = 'validation_failed_missing_intent'
                buffer.intent = null
                break
            }

            resetRetryCount(runtimeState, conversation.step)
            conversation.collected_data.intent = intent
            fieldsUpdated.push('intent')
            buffer.intent = null
            logLlmMerge(stepTrace, fieldsUpdated, fieldsSkipped, 'null', 'intent_normalized_success')

            conversation.step = getForwardStep(currentStep, conversation.collected_data)
            nextStep = conversation.step
            decisionReason = 'intent_normalized_success'
            response = STEP_PROMPTS[conversation.step]
            break
        }

        case ChatStep.ASK_LOCATION: {
            const stepTrace = traceFor(conversation.step)
            const extraction = await maybePopulateExtractionBuffer(conversation, conversation.step, rawTrimmed, stepTrace)
            llmUsed = llmUsed || !!extraction
            const buffer = getExtractionBuffer(conversation.session_id)
            const fieldsUpdated: string[] = []
            const fieldsSkipped: string[] = []
            const repeatedInput = isRepeatedInput(runtimeState, conversation.step, normalized)

            const existingLocation = conversation.collected_data.location?.trim()
            const extractedLocation = buffer.location
            const fallbackLocation = normalized.length > 0 ? normalized : null

            if (extractedLocation) {
                if (!existingLocation || extractedLocation.length >= existingLocation.length) {
                    conversation.collected_data.location = extractedLocation
                    fieldsUpdated.push('location')
                } else {
                    fieldsSkipped.push('location:low_quality')
                }
            } else if (fallbackLocation) {
                if (!existingLocation || fallbackLocation.length >= existingLocation.length) {
                    conversation.collected_data.location = fallbackLocation
                    fieldsUpdated.push('location')
                } else {
                    fieldsSkipped.push('location:low_quality')
                }
            } else {
                fieldsSkipped.push(`location:${extraction?.fieldReasons.location ?? 'null'}`)
            }

            if (!conversation.collected_data.location) {
                const retryCount = incrementRetryCount(runtimeState, conversation.step)
                rejectedFields.push('location')
                logTrace(
                    stepTrace,
                    'validation_failed',
                    'warn',
                    { reason: 'invalid location', retryCount, fieldsSkipped },
                    'validation_failed_missing_location',
                )

                if (repeatedInput || retryCount >= 2) {
                    fallbackTriggered = true
                    incrementMetric('step_stuck_count')
                    logTrace(
                        stepTrace,
                        'repeated_input_detected',
                        'warn',
                        { input: normalized, retryCount },
                        'repeated_input_detected',
                    )
                    logTrace(
                        stepTrace,
                        'step_stuck',
                        'warn',
                        { retryCount, currentStep: conversation.step },
                        'fallback_triggered_retry_limit',
                    )
                    conversation.step = getFallbackStep(conversation.step)
                    nextStep = conversation.step
                    decisionReason = 'fallback_triggered_retry_limit'
                    buffer.location = null
                    break
                }

                logLlmMerge(stepTrace, fieldsUpdated, fieldsSkipped, 'null', 'validation_failed_missing_location')
                response = STEP_PROMPTS[conversation.step]
                decisionReason = 'validation_failed_missing_location'
                buffer.location = null
                break
            }

            resetRetryCount(runtimeState, conversation.step)
            buffer.location = null

            logLlmMerge(
                stepTrace,
                fieldsUpdated,
                fieldsSkipped,
                fieldsSkipped.some((entry) => entry.includes('low_quality')) ? 'low_quality' : 'null',
                fieldsSkipped.some((entry) => entry.includes('low_quality')) ? 'validation_failed_low_quality_location' : 'location_normalized_success',
            )

            conversation.step = getForwardStep(currentStep, conversation.collected_data)
            nextStep = conversation.step
            decisionReason = fieldsSkipped.some((entry) => entry.includes('low_quality'))
                ? 'validation_failed_low_quality_location'
                : 'location_normalized_success'
            response = STEP_PROMPTS[conversation.step]
            break
        }

        case ChatStep.ASK_BUDGET: {
            const stepTrace = traceFor(conversation.step)
            const extraction = await maybePopulateExtractionBuffer(conversation, conversation.step, rawTrimmed, stepTrace)
            llmUsed = llmUsed || !!extraction
            const buffer = getExtractionBuffer(conversation.session_id)
            const fieldsUpdated: string[] = []
            const fieldsSkipped: string[] = []
            const repeatedInput = isRepeatedInput(runtimeState, conversation.step, normalized)

            const extractedMin = buffer.budget_min
            const extractedMax = buffer.budget_max
            const hasValidExtractedBudget = typeof extractedMin === 'number' && typeof extractedMax === 'number'

            if (hasValidExtractedBudget) {
                conversation.collected_data.budget_min = extractedMin
                conversation.collected_data.budget_max = extractedMax
                fieldsUpdated.push('budget_min', 'budget_max')
            } else {
                if (extractedMin != null || extractedMax != null) {
                    fieldsSkipped.push('budget:ambiguous_group')
                }

                const parsed = parseBudget(normalized)
                conversation.collected_data.budget_min = parsed.min
                conversation.collected_data.budget_max = parsed.max

                if (parsed.min != null && parsed.max != null) {
                    fieldsUpdated.push('budget_min', 'budget_max')
                } else {
                    fieldsSkipped.push(`budget_min:${extraction?.fieldReasons.budget_min ?? 'null'}`)
                    fieldsSkipped.push(`budget_max:${extraction?.fieldReasons.budget_max ?? 'null'}`)
                }
            }

            if (conversation.collected_data.budget_min == null || conversation.collected_data.budget_max == null) {
                const retryCount = incrementRetryCount(runtimeState, conversation.step)
                rejectedFields.push('budget_min', 'budget_max')
                logTrace(
                    stepTrace,
                    'validation_failed',
                    'warn',
                    { reason: 'invalid budget', retryCount, fieldsSkipped },
                    'validation_failed_missing_budget',
                )

                if (repeatedInput || retryCount >= 2) {
                    fallbackTriggered = true
                    incrementMetric('step_stuck_count')
                    logTrace(
                        stepTrace,
                        'repeated_input_detected',
                        'warn',
                        { input: normalized, retryCount },
                        'repeated_input_detected',
                    )
                    logTrace(
                        stepTrace,
                        'step_stuck',
                        'warn',
                        { retryCount, currentStep: conversation.step },
                        'fallback_triggered_retry_limit',
                    )
                    conversation.step = getFallbackStep(conversation.step)
                    nextStep = conversation.step
                    decisionReason = 'fallback_triggered_retry_limit'
                    buffer.budget_min = null
                    buffer.budget_max = null
                    break
                }

                logLlmMerge(stepTrace, fieldsUpdated, fieldsSkipped, 'ambiguous_group', 'validation_failed_missing_budget')
                response = STEP_PROMPTS[conversation.step]
                decisionReason = 'validation_failed_missing_budget'
                buffer.budget_min = null
                buffer.budget_max = null
                break
            }

            resetRetryCount(runtimeState, conversation.step)
            buffer.budget_min = null
            buffer.budget_max = null

            logLlmMerge(
                stepTrace,
                fieldsUpdated,
                fieldsSkipped,
                fieldsSkipped.some((entry) => entry.includes('ambiguous_group')) ? 'ambiguous_group' : 'null',
                fieldsSkipped.some((entry) => entry.includes('ambiguous_group'))
                    ? 'validation_failed_ambiguous_budget'
                    : 'budget_normalized_success',
            )

            conversation.step = getForwardStep(currentStep, conversation.collected_data)
            nextStep = conversation.step
            decisionReason = fieldsSkipped.some((entry) => entry.includes('ambiguous_group'))
                ? 'validation_failed_ambiguous_budget'
                : 'budget_normalized_success'
            response = STEP_PROMPTS[conversation.step]
            break
        }

        case ChatStep.ASK_PROPERTY_TYPE: {
            const stepTrace = traceFor(conversation.step)
            if (conversation.collected_data.property_type || conversation.collected_data.bhk) {
                conversation.step = getForwardStep(currentStep, conversation.collected_data)
                nextStep = conversation.step
                decisionReason = 'property_type_inferred_from_bhk'
                response = STEP_PROMPTS[conversation.step]
                break
            }

            const propertyType = findKeyword(normalized, VALID_PROPERTY_TYPES)
            if (!propertyType) {
                const retryCount = incrementRetryCount(runtimeState, conversation.step)
                rejectedFields.push('property_type')
                logTrace(
                    stepTrace,
                    'validation_failed',
                    'warn',
                    { reason: 'invalid property_type', retryCount },
                    'validation_failed_missing_property_type',
                )

                if (isRepeatedInput(runtimeState, conversation.step, normalized) || retryCount >= 2) {
                    fallbackTriggered = true
                    incrementMetric('step_stuck_count')
                    logTrace(stepTrace, 'repeated_input_detected', 'warn', { input: normalized, retryCount }, 'repeated_input_detected')
                    logTrace(stepTrace, 'step_stuck', 'warn', { retryCount, currentStep: conversation.step }, 'fallback_triggered_retry_limit')
                    conversation.step = getFallbackStep(conversation.step)
                    nextStep = conversation.step
                    decisionReason = 'fallback_triggered_retry_limit'
                } else {
                    decisionReason = 'validation_failed_missing_property_type'
                }

                response = STEP_PROMPTS[conversation.step]
                break
            }

            resetRetryCount(runtimeState, conversation.step)
            conversation.collected_data.property_type = propertyType
            conversation.step = getForwardStep(currentStep, conversation.collected_data)
            nextStep = conversation.step
            decisionReason = 'property_type_normalized_success'
            response = STEP_PROMPTS[conversation.step]
            break
        }

        case ChatStep.ASK_CONFIG: {
            const stepTrace = traceFor(conversation.step)

            if (conversation.collected_data.bhk) {
                logTrace(stepTrace, 'config_already_collected', 'info', { bhk: conversation.collected_data.bhk }, 'config_already_collected')
                conversation.step = getForwardStep(currentStep, conversation.collected_data)
                nextStep = conversation.step
                decisionReason = 'config_already_collected'
                response = STEP_PROMPTS[conversation.step]
                break
            }

            conversation.collected_data.bhk = rawTrimmed
            logLlmMerge(stepTrace, ['bhk'], [], 'null', 'config_captured')
            conversation.step = getForwardStep(currentStep, conversation.collected_data)
            nextStep = conversation.step
            decisionReason = 'config_captured'
            response = STEP_PROMPTS[conversation.step]
            break
        }

        case ChatStep.ASK_TIMELINE: {
            const stepTrace = traceFor(conversation.step)
            const timeline = parseTimelineInput(normalized)
            if (!timeline) {
                const retryCount = incrementRetryCount(runtimeState, conversation.step)
                rejectedFields.push('timeline')
                logTrace(
                    stepTrace,
                    'validation_failed',
                    'warn',
                    { reason: 'invalid timeline', retryCount },
                    'validation_failed_missing_timeline',
                )

                if (isRepeatedInput(runtimeState, conversation.step, normalized) || retryCount >= 2) {
                    fallbackTriggered = true
                    incrementMetric('step_stuck_count')
                    logTrace(stepTrace, 'repeated_input_detected', 'warn', { input: normalized, retryCount }, 'repeated_input_detected')
                    logTrace(stepTrace, 'step_stuck', 'warn', { retryCount, currentStep: conversation.step }, 'fallback_triggered_retry_limit')
                    conversation.step = ChatStep.SHOW_RESULTS
                    nextStep = conversation.step
                    decisionReason = 'fallback_triggered_retry_limit'
                    response = STEP_PROMPTS[conversation.step]
                    break
                }

                decisionReason = 'validation_failed_missing_timeline'
                response = STEP_PROMPTS[conversation.step]
                break
            }

            resetRetryCount(runtimeState, conversation.step)
            conversation.collected_data.timeline = timeline
            conversation.step = getForwardStep(currentStep, conversation.collected_data)
            nextStep = conversation.step
            decisionReason = 'timeline_normalized_success'
            response = STEP_PROMPTS[conversation.step]
            break
        }

        case ChatStep.SHOW_RESULTS: {
            const stepTrace = traceFor(conversation.step)
            const derivedPropertyType: PropertyType | undefined = conversation.collected_data.property_type
                ?? (conversation.collected_data.bhk ? 'apartment' : undefined)
            const filters: PropertyFilter = {
                location: conversation.collected_data.location,
                budget_min: conversation.collected_data.budget_min,
                budget_max: conversation.collected_data.budget_max,
                property_type: derivedPropertyType,
                bhk: conversation.collected_data.bhk,
            }

            properties = await getMatchingProperties(filters, conversation.session_id, stepTrace)
            const count = properties.length
            fallbackTriggered = fallbackTriggered || count === 0

            // Build response message with location context
            let message: string
            if (count === 0) {
                message = 'No exact matches found, but the agent can help you further.'
                decisionReason = 'property_query_no_results'
            } else if (isValidLocation(conversation.collected_data.location)) {
                message = `Great! I found ${count} properties in ${conversation.collected_data.location} matching your criteria.`
                decisionReason = 'property_query_success_with_location'
            } else {
                message = `Great! I found ${count} properties matching your criteria.`
                decisionReason = 'property_query_success'
            }

            response = message
            conversation.step = getForwardStep(currentStep, conversation.collected_data)
            nextStep = conversation.step

            appendMessageOnce(conversation, {
                role: 'bot',
                content: response,
                timestamp: nowIso(),
            })

            logTrace(
                stepTrace,
                'step_transition',
                'info',
                {
                    currentStep: ChatStep.SHOW_RESULTS,
                    nextStep: conversation.step,
                    collectedData: conversation.collected_data,
                    count: properties.length,
                    filters,
                },
                decisionReason,
            )

            response = await formatResponseWithLlm(conversation, ChatStep.SHOW_RESULTS, response, stepTrace)
            llmUsed = true

            return {
                response,
                requiresEscalation: false,
                isCompleted: false,
                properties,
                requestId: context.requestId,
                debug: createDebugInfo(
                    initialStep,
                    nextStep,
                    conversation.collected_data,
                    llmUsed,
                    fallbackTriggered,
                    decisionReason,
                    rejectedFields,
                    getRetryCount(runtimeState, initialStep),
                ),
            }
        }

        case ChatStep.CAPTURE_NAME: {
            const stepTrace = traceFor(conversation.step)

            if (isAgentHandoffIntent(rawTrimmed)) {
                resetRetryCount(runtimeState, conversation.step)
                nextStep = conversation.step
                decisionReason = decisionReason === 'agent_handoff_requested'
                    ? decisionReason
                    : 'agent_handoff_confirmed_request_name'
                response = STEP_PROMPTS[ChatStep.CAPTURE_NAME]
                break
            }

            const extraction = await maybePopulateExtractionBuffer(conversation, conversation.step, rawTrimmed, stepTrace)
            llmUsed = llmUsed || !!extraction
            const buffer = getExtractionBuffer(conversation.session_id)
            const fieldsUpdated: string[] = []
            const fieldsSkipped: string[] = []
            const repeatedInput = isRepeatedInput(runtimeState, conversation.step, normalized)

            const candidateName = buffer.name ?? rawTrimmed

            if (!isValidName(candidateName)) {
                const retryCount = incrementRetryCount(runtimeState, conversation.step)
                rejectedFields.push('name')
                fieldsSkipped.push(`name:${extraction?.fieldReasons.name ?? 'null'}`)
                logTrace(
                    stepTrace,
                    'validation_failed',
                    'warn',
                    { reason: 'invalid name', retryCount, fieldsSkipped },
                    'validation_failed_missing_name',
                )

                if (repeatedInput || retryCount >= 2) {
                    fallbackTriggered = true
                    incrementMetric('step_stuck_count')
                    logTrace(stepTrace, 'repeated_input_detected', 'warn', { input: normalized, retryCount }, 'repeated_input_detected')
                    logTrace(stepTrace, 'step_stuck', 'warn', { retryCount, currentStep: conversation.step }, 'fallback_triggered_retry_limit')
                    conversation.step = getFallbackStep(conversation.step)
                    nextStep = conversation.step
                    decisionReason = 'fallback_triggered_retry_limit'
                    buffer.name = null
                    response = STEP_PROMPTS[conversation.step]
                    break
                }

                logLlmMerge(stepTrace, fieldsUpdated, fieldsSkipped, 'sanity_check_failed', 'validation_failed_missing_name')
                response = STEP_PROMPTS[conversation.step]
                decisionReason = 'validation_failed_missing_name'
                buffer.name = null
                break
            }

            resetRetryCount(runtimeState, conversation.step)
            conversation.collected_data.name = candidateName
            fieldsUpdated.push('name')
            buffer.name = null
            logLlmMerge(stepTrace, fieldsUpdated, fieldsSkipped, 'null', 'name_normalized_success')
            conversation.step = getForwardStep(currentStep, conversation.collected_data)
            nextStep = conversation.step
            decisionReason = 'name_normalized_success'
            response = STEP_PROMPTS[conversation.step]
            break
        }

        case ChatStep.CAPTURE_PHONE: {
            const stepTrace = traceFor(conversation.step)

            if (isAgentHandoffIntent(rawTrimmed)) {
                resetRetryCount(runtimeState, conversation.step)
                nextStep = conversation.step
                decisionReason = 'agent_handoff_confirmed_request_phone'
                response = STEP_PROMPTS[ChatStep.CAPTURE_PHONE]
                break
            }

            const extraction = await maybePopulateExtractionBuffer(conversation, conversation.step, rawTrimmed, stepTrace)
            llmUsed = llmUsed || !!extraction
            const buffer = getExtractionBuffer(conversation.session_id)
            const fieldsUpdated: string[] = []
            const fieldsSkipped: string[] = []
            const repeatedInput = isRepeatedInput(runtimeState, conversation.step, normalized)

            const candidatePhoneInput = buffer.phone ?? rawTrimmed
            const phone = normalizeIndianPhone(candidatePhoneInput)
            if (!phone) {
                const retryCount = incrementRetryCount(runtimeState, conversation.step)
                rejectedFields.push('phone')
                fieldsSkipped.push(`phone:${extraction?.fieldReasons.phone ?? 'null'}`)
                logTrace(
                    stepTrace,
                    'validation_failed',
                    'warn',
                    { reason: 'invalid_phone', retryCount, fieldsSkipped },
                    'validation_failed_missing_phone',
                )

                if (repeatedInput || retryCount >= 2) {
                    fallbackTriggered = true
                    incrementMetric('step_stuck_count')
                    logTrace(stepTrace, 'repeated_input_detected', 'warn', { input: normalized, retryCount }, 'repeated_input_detected')
                    logTrace(stepTrace, 'step_stuck', 'warn', { retryCount, currentStep: conversation.step }, 'fallback_triggered_retry_limit')
                    conversation.step = ChatStep.DONE
                    nextStep = conversation.step
                    decisionReason = 'fallback_triggered_retry_limit'
                    buffer.phone = null
                    response = STEP_PROMPTS[conversation.step]
                    break
                }

                logLlmMerge(stepTrace, fieldsUpdated, fieldsSkipped, 'sanity_check_failed', 'validation_failed_missing_phone')
                response = STEP_PROMPTS[conversation.step]
                decisionReason = 'validation_failed_missing_phone'
                buffer.phone = null
                break
            }

            resetRetryCount(runtimeState, conversation.step)
            const firstPhoneCaptureInSession = !conversation.collected_data.phone
            conversation.collected_data.phone = phone
            conversation.collected_data.status = 'new'
            fieldsUpdated.push('phone')
            buffer.phone = null
            logLlmMerge(stepTrace, fieldsUpdated, fieldsSkipped, 'null', 'phone_normalized_success')

            let leadResult
            try {
                leadResult = await createOrUpdateLead({
                    name: conversation.collected_data.name,
                    phone,
                    collectedData: conversation.collected_data,
                }, stepTrace)
            } catch (firstError) {
                logTrace(
                    stepTrace,
                    'system_error',
                    'warn',
                    {
                        attempt: 1,
                        phone: `******${phone.slice(-4)}`,
                        error: firstError instanceof Error ? firstError.message : 'unknown_error',
                    },
                    'lead_persistence_retry',
                )

                try {
                    leadResult = await createOrUpdateLead({
                        name: conversation.collected_data.name,
                        phone,
                        collectedData: conversation.collected_data,
                    }, stepTrace)
                } catch (retryError) {
                    logTrace(
                        stepTrace,
                        'system_error',
                        'error',
                        {
                            phone: `******${phone.slice(-4)}`,
                            error: retryError instanceof Error ? retryError.message : 'unknown_error',
                        },
                        'lead_persistence_failed',
                    )
                    response = STEP_PROMPTS[conversation.step]
                    decisionReason = 'lead_persistence_failed'
                    break
                }
            }

            if (leadResult.skippedFields.length > 0) {
                rejectedFields.push(...leadResult.skippedFields)
                logTrace(
                    stepTrace,
                    'validation_failed',
                    'warn',
                    {
                        leadId: leadResult.lead.id,
                        skippedFields: leadResult.skippedFields,
                    },
                    'lead_update_skipped_fields',
                )
            }

            const alreadyEscalated = hasEscalatedPhoneInSession(conversation.session_id, phone)
            const shouldEscalate = !alreadyEscalated && (leadResult.action === 'created' || firstPhoneCaptureInSession)

            if (shouldEscalate) {
                try {
                    const escalationPayload = buildEscalationPayload(leadResult.lead)
                    await notifyAgent(escalationPayload)
                    markEscalatedPhoneInSession(conversation.session_id, phone)
                    conversation.collected_data.status = 'escalated'

                    logTrace(
                        stepTrace,
                        'escalation_triggered',
                        'info',
                        {
                            leadId: leadResult.lead.id,
                            channel: 'stub',
                        },
                        'escalation_triggered',
                    )
                } catch (notifyError) {
                    logTrace(
                        stepTrace,
                        'system_error',
                        'error',
                        {
                            leadId: leadResult.lead.id,
                            error: notifyError instanceof Error ? notifyError.message : 'unknown_error',
                        },
                        'escalation_failed',
                    )
                }
            } else {
                logTrace(
                    stepTrace,
                    'escalation_skipped',
                    'warn',
                    {
                        phone: `******${phone.slice(-4)}`,
                        reason: 'duplicate_prevention',
                    },
                    'escalation_skipped_duplicate_prevention',
                )
            }

            conversation.step = getForwardStep(currentStep, conversation.collected_data)
            nextStep = conversation.step
            decisionReason = leadResult.action === 'created' ? 'lead_created_and_escalated' : 'lead_updated_and_completed'
            response = STEP_PROMPTS[conversation.step]
            break
        }

        case ChatStep.ESCALATE: {
            const stepTrace = traceFor(conversation.step)
            conversation.collected_data.status = 'escalated'
            conversation.step = getForwardStep(currentStep, conversation.collected_data)
            nextStep = conversation.step
            decisionReason = 'manual_escalation_handled'
            logTrace(stepTrace, 'escalation_triggered', 'info', { channel: 'stub' }, 'manual_escalation_handled')
            response = STEP_PROMPTS[ChatStep.ESCALATE]
            break
        }

        case ChatStep.DONE: {
            decisionReason = 'conversation_completed'
            response = STEP_PROMPTS[ChatStep.DONE]
            break
        }

        default: {
            response = STEP_PROMPTS[ChatStep.ASK_INTENT]
            break
        }
    }

    llmUsed = true
    response = await formatResponseWithLlm(conversation, conversation.step, response, traceFor(conversation.step))

    appendMessageOnce(conversation, {
        role: 'bot',
        content: response,
        timestamp: nowIso(),
    })

    setPreviousInput(runtimeState, initialStep, normalized)

    const totalRequestDurationMs = Date.now() - context.requestStartedAt
    logTrace(
        traceFor(initialStep),
        'step_transition',
        fallbackTriggered ? 'warn' : 'info',
        {
            currentStep,
            nextStep,
            collectedData: conversation.collected_data,
            total_request_duration_ms: totalRequestDurationMs,
            retryCount: getRetryCount(runtimeState, initialStep),
        },
        decisionReason,
    )

    return {
        response,
        requiresEscalation: conversation.step === ChatStep.ESCALATE,
        isCompleted: conversation.step === ChatStep.DONE,
        properties,
        requestId: context.requestId,
        debug: context.debugMode
            ? createDebugInfo(
                initialStep,
                nextStep,
                conversation.collected_data,
                llmUsed,
                fallbackTriggered,
                decisionReason,
                rejectedFields,
                getRetryCount(runtimeState, initialStep),
            )
            : undefined,
    }
}
