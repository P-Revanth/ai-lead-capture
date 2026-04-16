import { ChatStep, CollectedData, Intent, PropertyType, Timeline } from '@/types/chat'
import { incrementMetric, isDebugMode, logEvent, LogContext, shouldLogVerbose } from '@/lib/logger'

export const EXTRACTION_PROMPT_VERSION = 'extraction_prompt_v1'
export const RESPONSE_PROMPT_VERSION = 'response_prompt_v1'

const GEMINI_MODEL = 'gemini-2.0-flash'
const GEMINI_TIMEOUT_MS = 2000

const VALID_INTENTS: Intent[] = ['buy', 'rent', 'explore']
const VALID_PROPERTY_TYPES: PropertyType[] = ['apartment', 'villa', 'plot', 'commercial']
const VALID_TIMELINES: Timeline[] = ['urgent', 'soon', 'flexible']
const LOW_QUALITY_LOCATIONS = new Set(['anywhere', 'all', 'vizag', 'india'])

type FieldReason = 'null' | 'low_quality' | 'sanity_check_failed' | 'ambiguous_group'

export interface ExtractedEntities {
    intent: Intent | null
    location: string | null
    budget_min: number | null
    budget_max: number | null
    property_type: PropertyType | null
    bhk: string | null
    timeline: Timeline | null
    name: string | null
    phone: string | null
}

export interface ExtractionResult {
    entities: ExtractedEntities
    success: boolean
    retries: number
    usedFallback: boolean
    fieldReasons: Partial<Record<keyof ExtractedEntities, FieldReason>>
}

export interface LlmTraceContext extends LogContext {
    debugMode?: boolean
}

const EMPTY_EXTRACTION: ExtractedEntities = {
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

function normalizeText(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null
    }
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
}

function normalizePhone(value: string): string | null {
    const digits = value.replace(/\D/g, '')
    const localDigits = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits
    if (!/^[6-9][0-9]{9}$/.test(localDigits)) {
        return null
    }
    return localDigits
}

function normalizeBhk(value: string): string {
    return value.replace(/\s+/g, '').toUpperCase()
}

function isEmojiPresent(value: string): boolean {
    return /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(value)
}

function countSentences(value: string): number {
    const parts = value
        .split(/[.!?]+/)
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0)

    return parts.length
}

function buildExtractionPrompt(message: string): string {
    return [
        'Extract structured real estate intent data.',
        '',
        'Return ONLY valid JSON.',
        '',
        'Fields:',
        '- intent (buy | rent | explore)',
        '- location',
        '- budget_min',
        '- budget_max',
        '- property_type',
        '- bhk',
        '- timeline (urgent | soon | flexible)',
        '- name',
        '- phone',
        '',
        'Rules:',
        '- If not present -> return null',
        '- Do not guess',
        '- Do not explain',
        '',
        `User message: "${message}"`,
    ].join('\n')
}

function buildResponsePrompt(step: ChatStep, collectedData: CollectedData): string {
    return [
        'Generate a short, helpful response for a real estate assistant.',
        '',
        `Step: ${step}`,
        `Collected Data: ${JSON.stringify(collectedData)}`,
        '',
        'Rules:',
        '- Keep it concise',
        '- Do NOT change meaning of step',
        '- Do NOT add new questions',
        '- Output must be 1 to 2 sentences only',
        '- Output must contain no emojis',
        '- Keep neutral tone',
    ].join('\n')
}

function getGeminiApiKey(): string | null {
    const key = process.env.GEMINI_API_KEY
    return key && key.trim().length > 0 ? key.trim() : null
}

async function callGemini(prompt: string): Promise<string> {
    const key = getGeminiApiKey()
    if (!key) {
        throw new Error('Missing GEMINI_API_KEY')
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [
                        {
                            role: 'user',
                            parts: [{ text: prompt }],
                        },
                    ],
                    generationConfig: {
                        temperature: 0,
                        topP: 0.1,
                        maxOutputTokens: 512,
                    },
                }),
                signal: controller.signal,
            },
        )

        if (!response.ok) {
            throw new Error(`Gemini HTTP error: ${response.status}`)
        }

        const payload = (await response.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        }

        const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? ''
        const trimmed = text.trim()

        if (trimmed.length === 0) {
            throw new Error('Gemini returned empty text')
        }

        return trimmed
    } finally {
        clearTimeout(timeout)
    }
}

function parseStrictJsonObject(text: string): Record<string, unknown> {
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```/, '').replace(/```$/, '').trim()
    const parsed = JSON.parse(cleaned) as unknown

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('LLM output is not a JSON object')
    }

    return parsed as Record<string, unknown>
}

function sanitizeExtractedObject(input: Record<string, unknown>): {
    entities: ExtractedEntities
    fieldReasons: Partial<Record<keyof ExtractedEntities, FieldReason>>
} {
    const fieldReasons: Partial<Record<keyof ExtractedEntities, FieldReason>> = {}

    const intentRaw = normalizeText(input.intent)
    const intent = intentRaw && VALID_INTENTS.includes(intentRaw.toLowerCase() as Intent) ? (intentRaw.toLowerCase() as Intent) : null
    if (!intent) {
        fieldReasons.intent = 'null'
    }

    const locationRaw = normalizeText(input.location)
    let location: string | null = locationRaw ? locationRaw.toLowerCase() : null
    if (location && LOW_QUALITY_LOCATIONS.has(location)) {
        location = null
        fieldReasons.location = 'low_quality'
    }
    if (!location) {
        fieldReasons.location = fieldReasons.location ?? 'null'
    }

    const budgetMinRaw = typeof input.budget_min === 'number' ? input.budget_min : null
    const budgetMaxRaw = typeof input.budget_max === 'number' ? input.budget_max : null
    let budget_min = budgetMinRaw
    let budget_max = budgetMaxRaw

    const minInRange = budget_min != null && budget_min >= 100000 && budget_min <= 1000000000
    const maxInRange = budget_max != null && budget_max >= 100000 && budget_max <= 1000000000

    if (budget_min != null && !minInRange) {
        budget_min = null
        fieldReasons.budget_min = 'sanity_check_failed'
    }
    if (budget_max != null && !maxInRange) {
        budget_max = null
        fieldReasons.budget_max = 'sanity_check_failed'
    }

    const budgetGroupAmbiguous = (budget_min == null) !== (budget_max == null)
    if (budgetGroupAmbiguous) {
        budget_min = null
        budget_max = null
        fieldReasons.budget_min = 'ambiguous_group'
        fieldReasons.budget_max = 'ambiguous_group'
    }

    if (budget_min != null && budget_max != null && budget_min > budget_max) {
        budget_min = null
        budget_max = null
        fieldReasons.budget_min = 'ambiguous_group'
        fieldReasons.budget_max = 'ambiguous_group'
    }

    if (budget_min == null && !fieldReasons.budget_min) {
        fieldReasons.budget_min = 'null'
    }
    if (budget_max == null && !fieldReasons.budget_max) {
        fieldReasons.budget_max = 'null'
    }

    const propertyTypeRaw = normalizeText(input.property_type)
    const property_type =
        propertyTypeRaw && VALID_PROPERTY_TYPES.includes(propertyTypeRaw.toLowerCase() as PropertyType)
            ? (propertyTypeRaw.toLowerCase() as PropertyType)
            : null
    if (!property_type) {
        fieldReasons.property_type = 'null'
    }

    const bhkRaw = normalizeText(input.bhk)
    const bhk = bhkRaw ? normalizeBhk(bhkRaw) : null
    if (!bhk) {
        fieldReasons.bhk = 'null'
    }

    const timelineRaw = normalizeText(input.timeline)
    const timeline =
        timelineRaw && VALID_TIMELINES.includes(timelineRaw.toLowerCase() as Timeline)
            ? (timelineRaw.toLowerCase() as Timeline)
            : null
    if (!timeline) {
        fieldReasons.timeline = 'null'
    }

    const name = normalizeText(input.name)
    if (!name) {
        fieldReasons.name = 'null'
    }

    const phoneRaw = normalizeText(input.phone)
    let phone = phoneRaw ? normalizePhone(phoneRaw) : null
    if (phoneRaw && !phone) {
        fieldReasons.phone = 'ambiguous_group'
    }
    if (!phone) {
        phone = null
        fieldReasons.phone = fieldReasons.phone ?? 'null'
    }

    return {
        entities: {
            intent,
            location,
            budget_min,
            budget_max,
            property_type,
            bhk,
            timeline,
            name,
            phone,
        },
        fieldReasons,
    }
}

export async function extractEntities(message: string, trace?: LlmTraceContext): Promise<ExtractionResult> {
    const prompt = buildExtractionPrompt(message)
    let retries = 0
    const startedAt = Date.now()
    const debugMode = trace?.debugMode ?? isDebugMode()
    let rawOutput: string | null = null

    for (let attempt = 0; attempt < 2; attempt++) {
        if (trace) {
            logEvent({
                ...trace,
                event: 'extraction_started',
                level: 'info',
                data: {
                    inputLength: message.length,
                    attempt,
                    prompt_version: EXTRACTION_PROMPT_VERSION,
                },
                decisionReason: 'llm_extraction_attempt_started',
            })
        }

        try {
            rawOutput = await callGemini(prompt)

            if (trace && shouldLogVerbose() && debugMode) {
                logEvent({
                    ...trace,
                    event: 'extraction_raw_output',
                    level: 'info',
                    data: { rawOutput },
                    decisionReason: 'raw_output_before_validation',
                })
            }

            const parsed = parseStrictJsonObject(rawOutput)
            const { entities, fieldReasons } = sanitizeExtractedObject(parsed)
            const invalidReasons = Object.entries(fieldReasons)
                .filter(([, reason]) => reason && reason !== 'null')
                .map(([field, reason]) => `${field}:${reason}`)

            if (trace && invalidReasons.length > 0) {
                logEvent({
                    ...trace,
                    event: 'validation_failed',
                    level: 'warn',
                    data: {
                        reason: invalidReasons.join(','),
                        fieldReasons,
                    },
                    decisionReason: invalidReasons[0] ?? 'validation_failed',
                })
            }

            const extractionDurationMs = Date.now() - startedAt

            if (trace) {
                logEvent({
                    ...trace,
                    event: 'extraction_result',
                    level: 'info',
                    data: {
                        success: true,
                        retryCount: retries,
                        extraction_duration_ms: extractionDurationMs,
                        prompt_version: EXTRACTION_PROMPT_VERSION,
                        fieldReasons,
                    },
                    decisionReason: invalidReasons.length > 0 ? 'extraction_completed_with_validation_warnings' : 'extraction_success',
                })
            }

            return {
                entities,
                success: true,
                retries,
                usedFallback: false,
                fieldReasons,
            }
        } catch (error) {
            const extractionDurationMs = Date.now() - startedAt
            incrementMetric('extraction_failure_count')

            if (trace && rawOutput && !debugMode) {
                logEvent({
                    ...trace,
                    event: 'extraction_raw_output',
                    level: 'error',
                    data: {
                        rawOutput,
                        error: error instanceof Error ? error.message : 'unknown_error',
                    },
                    decisionReason: 'raw_output_captured_on_error',
                })
            }

            if (trace) {
                logEvent({
                    ...trace,
                    event: 'extraction_failed',
                    level: 'error',
                    data: {
                        retryCount: retries,
                        attempt,
                        extraction_duration_ms: extractionDurationMs,
                        prompt_version: EXTRACTION_PROMPT_VERSION,
                        error: error instanceof Error ? error.message : 'unknown_error',
                    },
                    decisionReason: attempt === 1 ? 'fallback_triggered_retry_limit' : 'extraction_failed_retrying',
                })
            }

            retries += 1
        }
    }

    if (trace) {
        logEvent({
            ...trace,
            event: 'extraction_result',
            level: 'warn',
            data: {
                success: false,
                retryCount: retries,
                usedFallback: true,
                extraction_duration_ms: Date.now() - startedAt,
                prompt_version: EXTRACTION_PROMPT_VERSION,
            },
            decisionReason: 'fallback_triggered_retry_limit',
        })
    }

    return {
        entities: { ...EMPTY_EXTRACTION },
        success: false,
        retries,
        usedFallback: true,
        fieldReasons: {
            intent: 'null',
            location: 'null',
            budget_min: 'null',
            budget_max: 'null',
            property_type: 'null',
            bhk: 'null',
            timeline: 'null',
            name: 'null',
            phone: 'null',
        },
    }
}

export async function generateResponse(
    step: ChatStep,
    collectedData: CollectedData,
    fallback: string,
): Promise<string> {
    const prompt = buildResponsePrompt(step, collectedData)

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const raw = await callGemini(prompt)
            const text = raw.replace(/\s+/g, ' ').trim()

            if (text.length === 0) {
                continue
            }

            if (isEmojiPresent(text)) {
                continue
            }

            if (text.includes('?')) {
                continue
            }

            const sentenceCount = countSentences(text)
            if (sentenceCount < 1 || sentenceCount > 2) {
                continue
            }

            return text
        } catch {
            // retry once then fallback
        }
    }

    return fallback
}
