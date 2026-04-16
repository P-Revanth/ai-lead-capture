import { randomUUID } from 'crypto'

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogContext {
    sessionId: string
    requestId: string
    step: string
}

export interface LogEventInput extends LogContext {
    event: string
    level: LogLevel
    data?: unknown
    decisionReason?: string
    timestamp?: string
}

export type MetricName =
    | 'extraction_failure_count'
    | 'fallback_trigger_count'
    | 'step_stuck_count'
    | 'lead_created_count'

const METRICS: Record<MetricName, number> = {
    extraction_failure_count: 0,
    fallback_trigger_count: 0,
    step_stuck_count: 0,
    lead_created_count: 0,
}

function normalizeData(data: unknown): unknown {
    if (data instanceof Error) {
        return {
            name: data.name,
            message: data.message,
            stack: data.stack,
        }
    }

    return data
}

export function createRequestId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }

    return randomUUID()
}

export function isDebugMode(): boolean {
    return process.env.DEBUG_MODE === 'true'
}

export function shouldLogVerbose(): boolean {
    return isDebugMode()
}

export function maskPhone(phone: string): string {
    if (phone.length <= 4) {
        return phone
    }

    return `${'*'.repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}`
}

export function incrementMetric(name: MetricName): void {
    METRICS[name] += 1
}

export function getMetricSnapshot(): Record<MetricName, number> {
    return { ...METRICS }
}

export function logEvent(input: LogEventInput): void {
    try {
        console.log('[obs]', {
            sessionId: input.sessionId,
            requestId: input.requestId,
            step: input.step,
            event: input.event,
            level: input.level,
            data: normalizeData(input.data),
            decisionReason: input.decisionReason,
            timestamp: input.timestamp ?? new Date().toISOString(),
        })
    } catch {
        // Logging must never block chat processing.
    }
}