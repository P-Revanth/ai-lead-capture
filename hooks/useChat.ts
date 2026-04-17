'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    ChatApiResponse,
    ChatStep,
    ChatSuggestionsApiResponse,
    Language,
    PropertyResult,
    QuickReplyOption,
} from '@/types/chat'

type MessageRole = 'user' | 'sarah'

export interface UIMessage {
    id: string
    role: MessageRole
    text: string
    timestamp: string
    step?: ChatStep
    properties?: PropertyResult[]
}

interface PersistedChatState {
    sessionId: string
    messages: UIMessage[]
    latestStep: ChatStep | null
    preferredLanguage: Language | null
    quickReplies: QuickReplyOption[]
}

const CHAT_STATE_KEY = 'lead_ai_chat_state_v1'

function createId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function createSessionId(): string {
    return `session-${createId()}`
}

function nowIso(): string {
    return new Date().toISOString()
}

function toFallbackErrorMessage(): string {
    return 'Something went wrong. Please try again or resend your message.'
}

function isNonEmptyText(value: string): boolean {
    return value.trim().length > 0
}

export function useChat() {
    const [sessionId, setSessionId] = useState<string>('')
    const [messages, setMessages] = useState<UIMessage[]>([])
    const [latestStep, setLatestStep] = useState<ChatStep | null>(null)
    const [loading, setLoading] = useState<boolean>(false)
    const [isSearching, setIsSearching] = useState<boolean>(false)
    const [error, setError] = useState<string | null>(null)
    const [preferredLanguage, setPreferredLanguage] = useState<Language | null>(null)
    const [quickReplies, setQuickReplies] = useState<QuickReplyOption[]>([
        { label: 'English', value: 'English' },
        { label: 'తెలుగు', value: 'తెలుగు' },
        { label: 'हिंदी', value: 'हिंदी' },
    ])

    const fetchSuggestions = useCallback(async (targetSessionId: string) => {
        if (!targetSessionId) {
            return
        }

        const response = await fetch('/api/chat/suggestions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sessionId: targetSessionId }),
        })

        if (!response.ok) {
            throw new Error(`Suggestions API failed with status ${response.status}`)
        }

        const data = (await response.json()) as ChatSuggestionsApiResponse
        setPreferredLanguage(data.language ?? null)
        setQuickReplies(Array.isArray(data.options) ? data.options.slice(0, 5) : [])
    }, [])

    useEffect(() => {
        if (typeof window === 'undefined') {
            return
        }

        const raw = window.localStorage.getItem(CHAT_STATE_KEY)
        if (!raw) {
            const newSessionId = createSessionId()
            setSessionId(newSessionId)
            return
        }

        try {
            const parsed = JSON.parse(raw) as PersistedChatState
            if (parsed.sessionId && Array.isArray(parsed.messages)) {
                setSessionId(parsed.sessionId)
                setMessages(parsed.messages)
                setLatestStep(parsed.latestStep ?? null)
                setPreferredLanguage(parsed.preferredLanguage ?? null)
                setQuickReplies(Array.isArray(parsed.quickReplies) ? parsed.quickReplies : [])
                return
            }
        } catch {
            // ignore corrupted cache and start a new session
        }

        const fallbackSessionId = createSessionId()
        setSessionId(fallbackSessionId)
    }, [])

    useEffect(() => {
        if (typeof window === 'undefined' || !sessionId) {
            return
        }

        const payload: PersistedChatState = {
            sessionId,
            messages,
            latestStep,
            preferredLanguage,
            quickReplies,
        }

        window.localStorage.setItem(CHAT_STATE_KEY, JSON.stringify(payload))
    }, [sessionId, messages, latestStep, preferredLanguage, quickReplies])

    useEffect(() => {
        if (!sessionId) {
            return
        }

        void fetchSuggestions(sessionId).catch(() => {
            // keep last known quick replies
        })
    }, [sessionId, fetchSuggestions])

    const sendMessage = useCallback(
        async (input: string) => {
            const trimmed = input.trim()
            if (!sessionId || loading || !isNonEmptyText(trimmed)) {
                return
            }

            const userMessage: UIMessage = {
                id: createId(),
                role: 'user',
                text: trimmed,
                timestamp: nowIso(),
            }

            setMessages((prev) => [...prev, userMessage])
            setLoading(true)
            setError(null)

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        sessionId,
                        userMessage: trimmed,
                    }),
                })

                if (!response.ok) {
                    throw new Error(`API failed with status ${response.status}`)
                }

                const data = (await response.json()) as ChatApiResponse

                const botMessage: UIMessage = {
                    id: createId(),
                    role: 'sarah',
                    text: data.response,
                    timestamp: nowIso(),
                    step: data.step,
                    properties: data.properties,
                }

                setMessages((prev) => [...prev, botMessage])
                setLatestStep(data.step)
                setPreferredLanguage(data.language ?? null)
                void fetchSuggestions(sessionId).catch(() => {
                    // keep last known quick replies
                })
            } catch {
                setError(toFallbackErrorMessage())
            } finally {
                setLoading(false)
                setIsSearching(false)
            }
        },
        [fetchSuggestions, loading, sessionId],
    )

    // Auto-trigger search results fetch when transitioning to SHOW_RESULTS
    useEffect(() => {
        if (latestStep === ChatStep.SHOW_RESULTS && !isSearching && !loading && sessionId) {
            const lastMessage = messages[messages.length - 1]
            // Only auto-trigger if the last message doesn't have properties yet
            if (lastMessage && lastMessage.role === 'sarah' && !lastMessage.properties) {
                setIsSearching(true)

                // Directly call API to fetch results
                const fetchResults = async () => {
                    try {
                        const response = await fetch('/api/chat', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                sessionId,
                                userMessage: '',
                            }),
                        })

                        if (!response.ok) {
                            throw new Error(`API failed with status ${response.status}`)
                        }

                        const data = (await response.json()) as ChatApiResponse

                        const resultsMessage: UIMessage = {
                            id: createId(),
                            role: 'sarah',
                            text: data.response,
                            timestamp: nowIso(),
                            step: data.step,
                            properties: data.properties,
                        }

                        setMessages((prev) => {
                            // Replace the last message if it's from sarah with no properties
                            const updated = [...prev]
                            if (updated.length > 0 && updated[updated.length - 1].role === 'sarah' && !updated[updated.length - 1].properties) {
                                updated[updated.length - 1] = resultsMessage
                            } else {
                                updated.push(resultsMessage)
                            }
                            return updated
                        })
                        setLatestStep(data.step)
                        setPreferredLanguage(data.language ?? null)
                        void fetchSuggestions(sessionId).catch(() => {
                            // keep last known quick replies
                        })
                    } catch {
                        setError(toFallbackErrorMessage())
                    } finally {
                        setIsSearching(false)
                    }
                }

                void fetchResults()
            }
        }
    }, [fetchSuggestions, latestStep, sessionId, isSearching, loading, messages])

    const canShowQuickReplies = useMemo(() => {
        return latestStep === ChatStep.ASK_INTENT || latestStep === ChatStep.ASK_TIMELINE
    }, [latestStep])

    return {
        sessionId,
        messages,
        latestStep,
        loading,
        isSearching,
        error,
        preferredLanguage,
        quickReplies,
        sendMessage,
        canShowQuickReplies,
    }
}
