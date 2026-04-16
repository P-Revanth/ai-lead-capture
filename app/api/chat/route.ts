import { NextRequest, NextResponse } from 'next/server'
import { loadOrCreateConversation, saveConversation, processConversationTurn, readConversationBySessionId } from '@/lib/chatService'
import { ChatApiResponse, ChatStep } from '@/types/chat'
import { createRequestId, isDebugMode, logEvent } from '@/lib/logger'

export async function POST(request: NextRequest) {
    const requestId = createRequestId()
    const debugMode = isDebugMode()
    const requestStartedAt = Date.now()
    const cookieSessionId = request.cookies.get('lead_ai_session_id')?.value ?? null

    let sessionId = 'unknown'
    let conversationStep: ChatStep = ChatStep.ASK_INTENT

    try {
        const body = await request.json()
        const { sessionId: incomingSessionId, userMessage } = body
        const requestedSessionId = typeof incomingSessionId === 'string' && incomingSessionId.trim().length > 0
            ? incomingSessionId.trim()
            : null

        if (!requestedSessionId && !cookieSessionId) {
            return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 })
        }

        if (cookieSessionId && requestedSessionId && cookieSessionId !== requestedSessionId) {
            logEvent({
                sessionId: requestedSessionId,
                requestId,
                step: ChatStep.ASK_INTENT,
                event: 'session_id_mismatch',
                level: 'warn',
                data: {
                    requestedSessionId,
                    cookieSessionId,
                },
                decisionReason: 'request_session_preferred',
            })
        }

        // Prefer the client-provided sessionId to keep frontend localStorage and backend continuity aligned.
        sessionId = requestedSessionId ?? cookieSessionId ?? 'unknown'

        const userMsg = typeof userMessage === 'string' ? userMessage : ''

        const conversation = await loadOrCreateConversation(sessionId)
        conversationStep = conversation.step

        logEvent({
            sessionId,
            requestId,
            step: conversation.step,
            event: 'state_before',
            level: 'info',
            data: {
                step: conversation.step,
                collectedData: conversation.collected_data,
            },
            decisionReason: 'state_loaded_from_db',
        })

        logEvent({
            sessionId,
            requestId,
            step: conversation.step,
            event: 'chat_request_received',
            level: 'info',
            data: {
                userMessageLength: userMsg.trim().length,
            },
            decisionReason: 'chat_request_received',
        })

        const result = await processConversationTurn(conversation, userMsg, {
            requestId,
            debugMode,
            requestStartedAt,
        })

        await saveConversation(conversation)

        logEvent({
            sessionId,
            requestId,
            step: conversation.step,
            event: 'state_after',
            level: 'info',
            data: {
                nextStep: conversation.step,
                collectedData: conversation.collected_data,
            },
            decisionReason: 'state_saved_to_db',
        })

        const verifiedConversation = await readConversationBySessionId(sessionId)
        if (!verifiedConversation) {
            throw new Error('Conversation missing after save')
        }

        logEvent({
            sessionId,
            requestId,
            step: verifiedConversation.step,
            event: 'db_verified',
            level: 'info',
            data: {
                step: verifiedConversation.step,
                collectedData: verifiedConversation.collected_data,
            },
            decisionReason: 'db_state_verified',
        })

        // Source of truth for response is verified persisted state.
        conversation.step = verifiedConversation.step
        conversation.collected_data = verifiedConversation.collected_data

        const response: ChatApiResponse = {
            response: result.response,
            step: verifiedConversation.step,
            requiresEscalation: result.requiresEscalation,
            isCompleted: result.isCompleted,
            requestId,
        }

        if (result.properties && result.properties.length > 0) {
            response.properties = result.properties
        }

        if (debugMode && result.debug) {
            response.debug = result.debug
        }

        logEvent({
            sessionId,
            requestId,
            step: verifiedConversation.step,
            event: 'step_transition',
            level: 'info',
            data: {
                total_request_duration_ms: Date.now() - requestStartedAt,
            },
            decisionReason: 'request_completed',
        })

        const responseJson = NextResponse.json(response)
        responseJson.cookies.set('lead_ai_session_id', sessionId, {
            path: '/',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30,
        })

        return responseJson
    } catch (error) {
        logEvent({
            sessionId,
            requestId,
            step: conversationStep,
            event: 'system_error',
            level: 'error',
            data: {
                error: error instanceof Error ? error.message : 'Unknown error',
                total_request_duration_ms: Date.now() - requestStartedAt,
            },
            decisionReason: 'chat_request_fallback',
        })

        const errorResponse = NextResponse.json({
            response: 'I am having trouble processing your request right now. Please try again.',
            step: conversationStep,
            requiresEscalation: false,
            isCompleted: false,
            requestId,
            debug: debugMode
                ? {
                    currentStep: conversationStep,
                    nextStep: conversationStep,
                    collectedData: {},
                    llmUsed: false,
                    fallbackTriggered: true,
                    decisionReason: 'chat_request_fallback',
                    rejectedFields: [],
                    retryCount: 0,
                }
                : undefined,
        } satisfies ChatApiResponse)

        if (sessionId !== 'unknown') {
            errorResponse.cookies.set('lead_ai_session_id', sessionId, {
                path: '/',
                sameSite: 'lax',
                maxAge: 60 * 60 * 24 * 30,
            })
        }

        return errorResponse
    }
}
