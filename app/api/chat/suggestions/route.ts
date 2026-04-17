import { NextRequest, NextResponse } from 'next/server'
import { ChatStep, ChatSuggestionsApiResponse } from '@/types/chat'
import { loadOrCreateConversation } from '@/lib/chatService'
import { normalizeLanguage } from '@/lib/prompts'
import { getSuggestionOptionsForStep } from '@/lib/quickReplyService'

export async function POST(request: NextRequest) {
    const cookieSessionId = request.cookies.get('lead_ai_session_id')?.value ?? null

    try {
        const body = await request.json().catch(() => ({})) as { sessionId?: string }
        const requestedSessionId = typeof body.sessionId === 'string' && body.sessionId.trim().length > 0
            ? body.sessionId.trim()
            : null

        const sessionId = requestedSessionId ?? cookieSessionId
        if (!sessionId) {
            return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 })
        }

        const conversation = await loadOrCreateConversation(sessionId)
        const language = normalizeLanguage(conversation.collected_data.language)
        const options = await getSuggestionOptionsForStep(
            conversation.step,
            conversation.collected_data,
            language,
        )

        const response: ChatSuggestionsApiResponse = {
            step: conversation.step,
            language,
            options,
        }

        return NextResponse.json(response)
    } catch {
        return NextResponse.json({
            step: ChatStep.ASK_LANGUAGE,
            language: 'en',
            options: [
                { label: 'English', value: 'English' },
                { label: 'తెలుగు', value: 'తెలుగు' },
                { label: 'हिंदी', value: 'हिंदी' },
            ],
        } satisfies ChatSuggestionsApiResponse)
    }
}
