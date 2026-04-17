import { supabase } from '@/lib/supabaseClient'
import { CollectedData } from '@/types/chat'
import { Tables, TablesInsert, TablesUpdate } from '@/types/supabase'
import { incrementMetric, LogContext, logEvent, maskPhone } from '@/lib/logger'

type LeadRow = Tables<'leads'>

export interface CreateOrUpdateLeadInput {
    name?: string
    phone: string
    collectedData: CollectedData
}

export interface CreateOrUpdateLeadResult {
    lead: LeadRow
    action: 'created' | 'updated'
    skippedFields: string[]
}

export interface LeadTraceContext extends LogContext {
    debugMode?: boolean
}

const LOW_QUALITY_LOCATIONS = new Set(['anywhere', 'all', 'vizag', 'india'])

function hasMissingEscalationTriggeredColumnError(message: string | undefined): boolean {
    if (!message) {
        return false
    }

    const normalized = message.toLowerCase()
    return normalized.includes('escalation_triggered')
        && (normalized.includes('column') || normalized.includes('schema cache'))
}

function normalizeLeadRow(row: LeadRow): LeadRow {
    if (typeof row.escalation_triggered === 'boolean') {
        return row
    }

    return {
        ...row,
        escalation_triggered: row.status === 'escalated',
    }
}

function normalizeText(value: string | null | undefined): string | null {
    if (value == null) {
        return null
    }
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
}

function isLowQualityLocation(value: string | null | undefined): boolean {
    const normalized = normalizeText(value)
    if (!normalized) {
        return true
    }
    return LOW_QUALITY_LOCATIONS.has(normalized.toLowerCase())
}

function isMoreSpecificText(existing: string | null | undefined, incoming: string): boolean {
    const current = normalizeText(existing)
    if (!current) {
        return true
    }
    return incoming.length > current.length
}

function shouldApplyStringField(
    field: string,
    existing: string | null | undefined,
    incoming: string | null | undefined,
): { apply: boolean; reason?: string } {
    const nextValue = normalizeText(incoming)
    if (!nextValue) {
        return { apply: false, reason: `${field}:incoming_null_or_empty` }
    }

    if (field === 'location') {
        if (isLowQualityLocation(nextValue)) {
            return { apply: false, reason: 'location:low_quality' }
        }

        const current = normalizeText(existing)
        if (!current) {
            return { apply: true }
        }

        if (isLowQualityLocation(current)) {
            return { apply: true }
        }

        return isMoreSpecificText(current, nextValue)
            ? { apply: true }
            : { apply: false, reason: 'location:not_more_specific' }
    }

    const current = normalizeText(existing)
    if (!current) {
        return { apply: true }
    }

    if (isMoreSpecificText(current, nextValue)) {
        return { apply: true }
    }

    return { apply: false, reason: `${field}:not_more_specific` }
}

function applyNumberField(
    field: string,
    existing: number | null | undefined,
    incoming: number | null | undefined,
): { apply: boolean; value?: number; reason?: string } {
    if (incoming == null) {
        return { apply: false, reason: `${field}:incoming_null` }
    }

    if (existing == null) {
        return { apply: true, value: incoming }
    }

    return { apply: false, reason: `${field}:not_more_specific` }
}

async function findLeadByPhone(phone: string): Promise<LeadRow | null> {
    const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('phone', phone)
        .order('created_at', { ascending: false })
        .limit(1)

    if (error) {
        throw new Error(`Failed to query lead by phone: ${error.message}`)
    }

    return data && data.length > 0 ? (data[0] as LeadRow) : null
}

function buildInsertPayload(input: CreateOrUpdateLeadInput): TablesInsert<'leads'> {
    const collected = input.collectedData
    const normalizedName = normalizeText(input.name ?? collected.name)
    const normalizedLocation = normalizeText(collected.location)

    return {
        name: normalizedName,
        phone: input.phone,
        intent: collected.intent ?? null,
        location: isLowQualityLocation(normalizedLocation) ? null : normalizedLocation,
        budget_min: collected.budget_min ?? null,
        budget_max: collected.budget_max ?? null,
        property_type: collected.property_type ?? null,
        bhk: normalizeText(collected.bhk),
        timeline: collected.timeline ?? null,
        status: collected.status ?? 'new',
        escalation_triggered: false,
    }
}

function buildUpdatePayload(existing: LeadRow, input: CreateOrUpdateLeadInput): { payload: TablesUpdate<'leads'>; skippedFields: string[] } {
    const collected = input.collectedData
    const skippedFields: string[] = []
    const payload: TablesUpdate<'leads'> = {}

    const nameDecision = shouldApplyStringField('name', existing.name, input.name ?? collected.name)
    if (nameDecision.apply) {
        payload.name = normalizeText(input.name ?? collected.name)
    } else if (nameDecision.reason) {
        skippedFields.push(nameDecision.reason)
    }

    const locationDecision = shouldApplyStringField('location', existing.location, collected.location)
    if (locationDecision.apply) {
        payload.location = normalizeText(collected.location)
    } else if (locationDecision.reason) {
        skippedFields.push(locationDecision.reason)
    }

    const bhkDecision = shouldApplyStringField('bhk', existing.bhk, collected.bhk)
    if (bhkDecision.apply) {
        payload.bhk = normalizeText(collected.bhk)
    } else if (bhkDecision.reason) {
        skippedFields.push(bhkDecision.reason)
    }

    const budgetMinDecision = applyNumberField('budget_min', existing.budget_min, collected.budget_min)
    if (budgetMinDecision.apply) {
        payload.budget_min = budgetMinDecision.value ?? null
    } else if (budgetMinDecision.reason) {
        skippedFields.push(budgetMinDecision.reason)
    }

    const budgetMaxDecision = applyNumberField('budget_max', existing.budget_max, collected.budget_max)
    if (budgetMaxDecision.apply) {
        payload.budget_max = budgetMaxDecision.value ?? null
    } else if (budgetMaxDecision.reason) {
        skippedFields.push(budgetMaxDecision.reason)
    }

    if (!existing.intent && collected.intent) {
        payload.intent = collected.intent
    } else if (existing.intent && !collected.intent) {
        skippedFields.push('intent:incoming_null_or_empty')
    }

    if (!existing.property_type && collected.property_type) {
        payload.property_type = collected.property_type
    } else if (existing.property_type && !collected.property_type) {
        skippedFields.push('property_type:incoming_null')
    }

    if (!existing.timeline && collected.timeline) {
        payload.timeline = collected.timeline
    } else if (existing.timeline && !collected.timeline) {
        skippedFields.push('timeline:incoming_null_or_empty')
    }

    if (collected.status) {
        payload.status = collected.status
    }

    return { payload, skippedFields }
}

async function updateLead(
    existing: LeadRow,
    input: CreateOrUpdateLeadInput,
    trace?: LeadTraceContext,
): Promise<CreateOrUpdateLeadResult> {
    const { payload, skippedFields } = buildUpdatePayload(existing, input)

    if (Object.keys(payload).length === 0) {
        return {
            lead: existing,
            action: 'updated',
            skippedFields,
        }
    }

    const { data, error } = await supabase.from('leads').update(payload).eq('id', existing.id).select('*').single()

    if (error || !data) {
        throw new Error(`Failed to update lead: ${error?.message ?? 'Unknown update error'}`)
    }

    if (trace) {
        logEvent({
            ...trace,
            event: 'lead_updated',
            level: 'info',
            data: {
                leadId: data.id,
                phone: maskPhone(String(data.phone ?? input.phone)),
                updatedFields: Object.keys(payload),
                skippedFields,
            },
            decisionReason: 'lead_update_applied',
        })
    }

    return {
        lead: normalizeLeadRow(data as LeadRow),
        action: 'updated',
        skippedFields,
    }
}

async function insertLead(input: CreateOrUpdateLeadInput, trace?: LeadTraceContext): Promise<CreateOrUpdateLeadResult> {
    const payload = buildInsertPayload(input)

    let { data, error } = await supabase.from('leads').insert(payload).select('*').single()

    if ((error || !data) && hasMissingEscalationTriggeredColumnError(error?.message)) {
        const legacyPayload: TablesInsert<'leads'> = { ...payload }
        delete (legacyPayload as { escalation_triggered?: boolean | null }).escalation_triggered
        const fallbackResult = await supabase.from('leads').insert(legacyPayload).select('*').single()
        data = fallbackResult.data
        error = fallbackResult.error

        if (trace) {
            logEvent({
                ...trace,
                event: 'lead_create_legacy_schema_fallback',
                level: 'warn',
                data: {
                    reason: 'missing_escalation_triggered_column',
                },
                decisionReason: 'lead_create_fallback_without_escalation_triggered',
            })
        }
    }

    if (error || !data) {
        throw new Error(`Failed to create lead: ${error?.message ?? 'Unknown insert error'}`)
    }

    incrementMetric('lead_created_count')

    if (trace) {
        logEvent({
            ...trace,
            event: 'lead_created',
            level: 'info',
            data: {
                leadId: data.id,
                phone: maskPhone(String(data.phone ?? input.phone)),
            },
            decisionReason: 'lead_create_applied',
        })
    }

    return {
        lead: normalizeLeadRow(data as LeadRow),
        action: 'created',
        skippedFields: [],
    }
}

export async function createOrUpdateLead(input: CreateOrUpdateLeadInput, trace?: LeadTraceContext): Promise<CreateOrUpdateLeadResult> {
    const initial = await findLeadByPhone(input.phone)
    if (initial) {
        return updateLead(initial, input, trace)
    }

    // Concurrency safeguard: second check before insert.
    const secondCheck = await findLeadByPhone(input.phone)
    if (secondCheck) {
        return updateLead(secondCheck, input, trace)
    }

    return insertLead(input, trace)
}

export async function markLeadEscalationTriggered(
    leadId: string,
    trace?: LeadTraceContext,
): Promise<LeadRow> {
    let { data, error } = await supabase
        .from('leads')
        .update({
            escalation_triggered: true,
            status: 'escalated',
        })
        .eq('id', leadId)
        .select('*')
        .single()

    if ((error || !data) && hasMissingEscalationTriggeredColumnError(error?.message)) {
        const fallbackResult = await supabase
            .from('leads')
            .update({ status: 'escalated' })
            .eq('id', leadId)
            .select('*')
            .single()

        data = fallbackResult.data
        error = fallbackResult.error

        if (trace) {
            logEvent({
                ...trace,
                event: 'lead_mark_legacy_schema_fallback',
                level: 'warn',
                data: {
                    leadId,
                    reason: 'missing_escalation_triggered_column',
                },
                decisionReason: 'lead_mark_fallback_without_escalation_triggered',
            })
        }
    }

    if (error || !data) {
        throw new Error(`Failed to mark lead escalation_triggered: ${error?.message ?? 'Unknown update error'}`)
    }

    if (trace) {
        logEvent({
            ...trace,
            event: 'lead_notification_marked',
            level: 'info',
            data: {
                leadId: data.id,
                escalation_triggered: data.escalation_triggered,
            },
            decisionReason: 'lead_notification_marked_success',
        })
    }

    return normalizeLeadRow(data as LeadRow)
}
