import { Tables } from '@/types/supabase'

type LeadRow = Tables<'leads'>

export interface LeadEscalationPayload {
    leadId: string
    name: string
    phone: string
    intent: string
    location: string
    budgetMin: number | null
    budgetMax: number | null
    propertyType: string
    timeline: string
    summary: string
}

function normalizeText(value: string | null | undefined, fallback = 'N/A'): string {
    const text = value?.trim()
    return text && text.length > 0 ? text : fallback
}

function mapTimelinePhrase(timeline: string): string {
    switch (timeline.toLowerCase()) {
        case 'urgent':
            return 'immediately'
        case 'soon':
            return 'within 3 months'
        case 'flexible':
            return 'with flexible timeline'
        default:
            return 'with unspecified timeline'
    }
}

function formatBudget(min: number | null, max: number | null): string {
    if (typeof min === 'number' && typeof max === 'number') {
        return `${min}-${max}`
    }
    if (typeof min === 'number') {
        return `${min}+`
    }
    if (typeof max === 'number') {
        return `up to ${max}`
    }
    return 'N/A'
}

export function buildEscalationPayload(lead: LeadRow): LeadEscalationPayload {
    const name = normalizeText(lead.name)
    const phone = normalizeText(lead.phone)
    const intent = normalizeText(lead.intent)
    const location = normalizeText(lead.location)
    const propertyType = normalizeText(lead.property_type)
    const timeline = normalizeText(lead.timeline)
    const bhk = normalizeText(lead.bhk, '')

    const timelinePhrase = mapTimelinePhrase(timeline)
    const summary = `${name} is looking for ${bhk || 'a property'} in ${location} ${timelinePhrase}.`

    return {
        leadId: lead.id,
        name,
        phone,
        intent,
        location,
        budgetMin: lead.budget_min,
        budgetMax: lead.budget_max,
        propertyType,
        timeline,
        summary,
    }
}

export async function notifyAgent(payload: LeadEscalationPayload): Promise<void> {
    const message = [
        'New Lead Alert',
        `Name: ${payload.name}`,
        `Phone: ${payload.phone}`,
        `Intent: ${payload.intent}`,
        `Location: ${payload.location}`,
        `Budget: ${formatBudget(payload.budgetMin, payload.budgetMax)}`,
        `Type: ${payload.propertyType}`,
        `Timeline: ${payload.timeline}`,
        `Summary: ${payload.summary}`,
    ].join('\n')

    console.log('[escalation] notify_agent', {
        leadId: payload.leadId,
        message,
    })
}
