import { logEvent, LogContext, maskPhone } from '@/lib/logger'
import { Tables } from '@/types/supabase'

type LeadRow = Tables<'leads'>

type NotificationChannel = 'email' | 'whatsapp'

interface NotificationChannelResult {
    channel: NotificationChannel
    success: boolean
    detail: string
}

interface TwilioSenderSource {
    label: 'messaging_service' | 'configured_from' | 'fallback_from'
    from?: string
    messagingServiceSid?: string
}

interface TwilioAttemptResult {
    success: boolean
    detail: string
    errorCode?: number
    errorMessage?: string
}

export interface NotifyAgentResult {
    delivered: boolean
    channels: NotificationChannelResult[]
}

export interface NotificationTraceContext extends LogContext {
    debugMode?: boolean
}

function parseCsvList(value: string | undefined): string[] {
    if (!value) {
        return []
    }

    return value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
}

function normalizeWhatsAppAddress(value: string): string {
    const trimmed = value.trim()
    if (trimmed.toLowerCase().startsWith('whatsapp:')) {
        return trimmed
    }

    const digitsOnly = trimmed.replace(/\D/g, '')
    if (digitsOnly.length > 0 && !trimmed.startsWith('+')) {
        return `whatsapp:+${digitsOnly}`
    }

    return `whatsapp:${trimmed}`
}

function createTwilioAuthHeader(accountSid: string, authToken: string): string {
    const raw = `${accountSid}:${authToken}`
    return `Basic ${Buffer.from(raw).toString('base64')}`
}

function normalizeText(value: string | null | undefined, fallback = 'N/A'): string {
    const trimmed = value?.trim()
    return trimmed && trimmed.length > 0 ? trimmed : fallback
}

function formatBudget(min: number | null, max: number | null): string {
    if (typeof min === 'number' && typeof max === 'number') {
        return `${formatMoney(min)} - ${formatMoney(max)}`
    }

    if (typeof min === 'number') {
        return `${formatMoney(min)}+`
    }

    if (typeof max === 'number') {
        return `Up to ${formatMoney(max)}`
    }

    return 'N/A'
}

function formatMoney(value: number): string {
    if (value >= 10000000) {
        const crore = value / 10000000
        return `Rs ${Number.isInteger(crore) ? crore.toFixed(0) : crore.toFixed(1)}Cr`
    }

    if (value >= 100000) {
        const lakh = value / 100000
        return `Rs ${Number.isInteger(lakh) ? lakh.toFixed(0) : lakh.toFixed(1)}L`
    }

    return `Rs ${new Intl.NumberFormat('en-IN').format(value)}`
}

function buildLeadMessage(lead: LeadRow): string {
    const lines = [
        'New Lead Alert',
        '',
        `Name: ${normalizeText(lead.name)}`,
        `Phone: ${normalizeText(lead.phone)}`,
        `Intent: ${normalizeText(lead.intent)}`,
        `Location: ${normalizeText(lead.location)}`,
        `Budget: ${formatBudget(lead.budget_min, lead.budget_max)}`,
        `Timeline: ${normalizeText(lead.timeline)}`,
        `Captured At: ${normalizeText(lead.created_at, new Date().toISOString())}`,
    ]

    return lines.join('\n')
}

function buildLeadEmailSubject(lead: LeadRow): string {
    const intent = normalizeText(lead.intent, 'lead')
    const location = normalizeText(lead.location, 'unknown-location').replace(/\s+/g, '-')
    const leadIdShort = String(lead.id ?? 'unknown').slice(0, 8)
    return `New Lead Alert: ${intent} | ${location} | ${leadIdShort}`
}

function buildLeadEmailHtml(lead: LeadRow): string {
    const rows = [
        ['Name', normalizeText(lead.name)],
        ['Phone', normalizeText(lead.phone)],
        ['Intent', normalizeText(lead.intent)],
        ['Location', normalizeText(lead.location)],
        ['Budget', formatBudget(lead.budget_min, lead.budget_max)],
        ['Timeline', normalizeText(lead.timeline)],
        ['Captured At', normalizeText(lead.created_at, new Date().toISOString())],
    ]

    const tableRows = rows
        .map(([label, value]) => `<tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;">${label}</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">${value}</td></tr>`)
        .join('')

    return [
        '<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;">',
        '<h2 style="margin:0 0 12px;">New Lead Alert</h2>',
        '<p style="margin:0 0 16px;">A new qualified lead was captured from Lead AI.</p>',
        '<table style="border-collapse:collapse;width:100%;max-width:640px;">',
        tableRows,
        '</table>',
        '</div>',
    ].join('')
}

function withDisplayName(email: string, displayName: string): string {
    const trimmed = email.trim()
    if (trimmed.length === 0) {
        return trimmed
    }

    if (trimmed.includes('<') && trimmed.includes('>')) {
        return trimmed
    }

    const safeName = displayName.trim()
    return safeName.length > 0 ? `${safeName} <${trimmed}>` : trimmed
}

async function sendEmailNotification(
    lead: LeadRow,
    trace?: NotificationTraceContext,
): Promise<NotificationChannelResult> {
    const apiKey = process.env.RESEND_API_KEY
    const to = process.env.AGENT_NOTIFICATION_EMAIL
    const from = process.env.NOTIFICATION_FROM_EMAIL
    const fromName = process.env.NOTIFICATION_FROM_NAME ?? 'Lead AI'
    const replyTo = process.env.NOTIFICATION_REPLY_TO_EMAIL

    if (!apiKey || !to || !from) {
        if (trace) {
            logEvent({
                ...trace,
                event: 'notification_channel_skipped',
                level: 'warn',
                data: {
                    channel: 'email',
                    reason: 'missing_email_config',
                },
                decisionReason: 'notification_email_skipped_missing_config',
            })
        }

        return {
            channel: 'email',
            success: false,
            detail: 'missing_email_config',
        }
    }

    const payload = {
        from: withDisplayName(from, fromName),
        to: to
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0),
        subject: buildLeadEmailSubject(lead),
        text: buildLeadMessage(lead),
        html: buildLeadEmailHtml(lead),
        reply_to: replyTo,
        tags: [
            { name: 'source', value: 'lead-ai' },
            { name: 'lead_id', value: String(lead.id) },
        ],
    }

    if (trace && from.toLowerCase().includes('@resend.dev')) {
        logEvent({
            ...trace,
            event: 'notification_channel_warning',
            level: 'warn',
            data: {
                channel: 'email',
                reason: 'using_resend_onboarding_sender',
                from,
            },
            decisionReason: 'notification_email_onboarding_sender_deliverability_risk',
        })
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        })

        if (!response.ok) {
            const body = await response.text()
            throw new Error(`Resend API failed with status ${response.status}: ${body}`)
        }

        const responseBody = (await response.json()) as { id?: string }
        const messageId = responseBody.id ?? 'unknown'

        if (trace) {
            logEvent({
                ...trace,
                event: 'notification_channel_sent',
                level: 'info',
                data: {
                    channel: 'email',
                    phone: maskPhone(normalizeText(lead.phone, '')),
                    messageId,
                },
                decisionReason: 'notification_email_sent',
            })
        }

        return {
            channel: 'email',
            success: true,
            detail: `sent:${messageId}`,
        }
    } catch (error) {
        if (trace) {
            logEvent({
                ...trace,
                event: 'notification_channel_failed',
                level: 'error',
                data: {
                    channel: 'email',
                    error: error instanceof Error ? error.message : 'unknown_error',
                },
                decisionReason: 'notification_email_failed',
            })
        }

        return {
            channel: 'email',
            success: false,
            detail: error instanceof Error ? error.message : 'unknown_error',
        }
    }
}

function parseTwilioError(rawBody: string): { code?: number; message?: string } {
    try {
        const parsed = JSON.parse(rawBody) as { code?: number; message?: string }
        return {
            code: typeof parsed.code === 'number' ? parsed.code : undefined,
            message: typeof parsed.message === 'string' ? parsed.message : undefined,
        }
    } catch {
        return {
            code: undefined,
            message: rawBody,
        }
    }
}

async function sendTwilioWhatsAppMessage(
    endpoint: string,
    authHeader: string,
    recipient: string,
    messageBody: string,
    source: TwilioSenderSource,
): Promise<TwilioAttemptResult> {
    const payload = new URLSearchParams({
        To: recipient,
        Body: messageBody,
    })

    if (source.messagingServiceSid) {
        payload.set('MessagingServiceSid', source.messagingServiceSid)
    }

    if (source.from) {
        payload.set('From', source.from)
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload.toString(),
    })

    const rawBody = await response.text()

    if (response.ok) {
        return {
            success: true,
            detail: `sent_via_${source.label}`,
        }
    }

    const twilioError = parseTwilioError(rawBody)
    return {
        success: false,
        detail: `Twilio API failed with status ${response.status}: ${twilioError.message ?? rawBody}`,
        errorCode: twilioError.code,
        errorMessage: twilioError.message,
    }
}

async function sendWhatsAppNotification(
    lead: LeadRow,
    trace?: NotificationTraceContext,
): Promise<NotificationChannelResult> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromRaw = process.env.TWILIO_WHATSAPP_FROM
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim()
    const fallbackFromRaw = process.env.TWILIO_WHATSAPP_FALLBACK_FROM ?? 'whatsapp:+14155238886'
    const toRaw = process.env.AGENT_NOTIFICATION_WHATSAPP_TO

    if (!accountSid || !authToken || !toRaw) {
        if (trace) {
            logEvent({
                ...trace,
                event: 'notification_channel_skipped',
                level: 'warn',
                data: {
                    channel: 'whatsapp',
                    reason: 'missing_whatsapp_config',
                },
                decisionReason: 'notification_whatsapp_skipped_missing_config',
            })
        }

        return {
            channel: 'whatsapp',
            success: false,
            detail: 'missing_whatsapp_config',
        }
    }

    const recipients = parseCsvList(toRaw).map(normalizeWhatsAppAddress)
    if (recipients.length === 0) {
        if (trace) {
            logEvent({
                ...trace,
                event: 'notification_channel_skipped',
                level: 'warn',
                data: {
                    channel: 'whatsapp',
                    reason: 'missing_whatsapp_recipients',
                },
                decisionReason: 'notification_whatsapp_skipped_missing_recipients',
            })
        }

        return {
            channel: 'whatsapp',
            success: false,
            detail: 'missing_whatsapp_recipients',
        }
    }

    const configuredFrom = fromRaw ? normalizeWhatsAppAddress(fromRaw) : null
    const fallbackFrom = normalizeWhatsAppAddress(fallbackFromRaw)

    const senderSources: TwilioSenderSource[] = []
    if (messagingServiceSid) {
        senderSources.push({
            label: 'messaging_service',
            messagingServiceSid,
        })
    }
    if (configuredFrom) {
        senderSources.push({
            label: 'configured_from',
            from: configuredFrom,
        })
    }
    if (!configuredFrom || fallbackFrom !== configuredFrom) {
        senderSources.push({
            label: 'fallback_from',
            from: fallbackFrom,
        })
    }

    if (senderSources.length === 0) {
        if (trace) {
            logEvent({
                ...trace,
                event: 'notification_channel_skipped',
                level: 'warn',
                data: {
                    channel: 'whatsapp',
                    reason: 'missing_whatsapp_sender_source',
                },
                decisionReason: 'notification_whatsapp_skipped_missing_sender_source',
            })
        }

        return {
            channel: 'whatsapp',
            success: false,
            detail: 'missing_whatsapp_sender_source',
        }
    }

    const authHeader = createTwilioAuthHeader(accountSid, authToken)
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const messageBody = buildLeadMessage(lead)

    const deliveryResults = await Promise.all(
        recipients.map(async (recipient) => {
            let lastAttempt: TwilioAttemptResult | null = null
            for (let index = 0; index < senderSources.length; index += 1) {
                const source = senderSources[index]
                const attempt = await sendTwilioWhatsAppMessage(
                    endpoint,
                    authHeader,
                    recipient,
                    messageBody,
                    source,
                )
                lastAttempt = attempt

                if (attempt.success) {
                    return {
                        success: true,
                        recipient,
                        source: source.label,
                    }
                }

                const isInvalidFromAddress = attempt.errorCode === 63007
                const hasAnotherSource = index < senderSources.length - 1

                if (isInvalidFromAddress && hasAnotherSource) {
                    continue
                }

                break
            }

            return {
                success: false,
                recipient,
                error: lastAttempt?.detail ?? 'unknown_error',
                errorCode: lastAttempt?.errorCode,
            }
        }),
    )

    const deliveredCount = deliveryResults.filter((result) => result.success).length
    const failedResults = deliveryResults.filter((result) => !result.success)

    if (deliveredCount > 0) {
        if (trace) {
            logEvent({
                ...trace,
                event: 'notification_channel_sent',
                level: 'info',
                data: {
                    channel: 'whatsapp',
                    deliveredCount,
                    totalRecipients: recipients.length,
                    leadPhone: maskPhone(normalizeText(lead.phone, '')),
                    failedCount: failedResults.length,
                    senderSourcesTried: senderSources.map((source) => source.label),
                },
                decisionReason: failedResults.length > 0
                    ? 'notification_whatsapp_partial_success'
                    : 'notification_whatsapp_sent',
            })
        }

        return {
            channel: 'whatsapp',
            success: true,
            detail: `sent:${deliveredCount}/${recipients.length}`,
        }
    }

    const firstError = failedResults[0]?.error ?? 'all_recipients_failed'
    if (trace) {
        logEvent({
            ...trace,
            event: 'notification_channel_failed',
            level: 'error',
            data: {
                channel: 'whatsapp',
                totalRecipients: recipients.length,
                error: firstError,
                errorCode: failedResults[0]?.errorCode,
                senderSourcesTried: senderSources.map((source) => source.label),
            },
            decisionReason: 'notification_whatsapp_failed',
        })
    }

    return {
        channel: 'whatsapp',
        success: false,
        detail: firstError,
    }
}

export async function notifyAgent(
    lead: LeadRow,
    trace?: NotificationTraceContext,
): Promise<NotifyAgentResult> {
    const [emailResult, whatsappResult] = await Promise.all([
        sendEmailNotification(lead, trace),
        sendWhatsAppNotification(lead, trace),
    ])

    const channels = [emailResult, whatsappResult]
    const delivered = channels.some((result) => result.success)

    if (trace) {
        logEvent({
            ...trace,
            event: 'notification_dispatch_complete',
            level: delivered ? 'info' : 'warn',
            data: {
                leadId: lead.id,
                delivered,
                channels,
            },
            decisionReason: delivered
                ? 'notification_dispatch_success'
                : 'notification_dispatch_no_channel_delivered',
        })
    }

    return {
        delivered,
        channels,
    }
}
