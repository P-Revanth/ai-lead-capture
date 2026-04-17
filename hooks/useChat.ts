'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

interface SuggestionsExpectation {
    expectedStep?: ChatStep | null
    expectedLanguage?: Language | null
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

function getFallbackQuickRepliesForStep(step: ChatStep, language?: Language | null): QuickReplyOption[] {
    const normalizedLanguage: Language = language === 'te' || language === 'hi' ? language : 'en'

    if (step === ChatStep.ASK_LANGUAGE) {
        return [
            { label: 'English', value: 'English' },
            { label: 'తెలుగు', value: 'తెలుగు' },
            { label: 'हिंदी', value: 'हिंदी' },
        ]
    }

    if (step === ChatStep.ASK_INTENT) {
        if (normalizedLanguage === 'te') {
            return [
                { label: 'కొనుగోలు', value: 'buy' },
                { label: 'అద్దె', value: 'rent' },
                { label: 'విచారిస్తున్నాను', value: 'explore' },
            ]
        }

        if (normalizedLanguage === 'hi') {
            return [
                { label: 'खरीदना', value: 'buy' },
                { label: 'किराए पर', value: 'rent' },
                { label: 'देख रहा हूं', value: 'explore' },
            ]
        }

        return [
            { label: 'Buy', value: 'buy' },
            { label: 'Rent', value: 'rent' },
            { label: 'Explore', value: 'explore' },
        ]
    }

    if (step === ChatStep.ASK_PROPERTY_TYPE) {
        if (normalizedLanguage === 'te') {
            return [
                { label: 'అపార్ట్‌మెంట్', value: 'apartment' },
                { label: 'విల్లా', value: 'villa' },
                { label: 'ప్లాట్', value: 'plot' },
                { label: 'కమర్షియల్', value: 'commercial' },
            ]
        }

        if (normalizedLanguage === 'hi') {
            return [
                { label: 'अपार्टमेंट', value: 'apartment' },
                { label: 'विला', value: 'villa' },
                { label: 'प्लॉट', value: 'plot' },
                { label: 'कमर्शियल', value: 'commercial' },
            ]
        }

        return [
            { label: 'Apartment', value: 'apartment' },
            { label: 'Villa', value: 'villa' },
            { label: 'Plot', value: 'plot' },
            { label: 'Commercial', value: 'commercial' },
        ]
    }

    if (step === ChatStep.ASK_TIMELINE) {
        if (normalizedLanguage === 'te') {
            return [
                { label: 'తక్షణం', value: 'immediately' },
                { label: '3 నెలల్లో', value: 'within 3 months' },
                { label: 'సౌకర్యంగా', value: 'flexible' },
                { label: 'ఖచ్చితంగా తెలియదు', value: 'not sure' },
            ]
        }

        if (normalizedLanguage === 'hi') {
            return [
                { label: 'तुरंत', value: 'immediately' },
                { label: '3 महीने में', value: 'within 3 months' },
                { label: 'लचीला', value: 'flexible' },
                { label: 'पक्का नहीं', value: 'not sure' },
            ]
        }

        return [
            { label: 'Immediate', value: 'immediately' },
            { label: 'Within 3 months', value: 'within 3 months' },
            { label: 'Flexible', value: 'flexible' },
            { label: 'Not sure', value: 'not sure' },
        ]
    }

    if (step === ChatStep.ASK_VISIT_DATE) {
        if (normalizedLanguage === 'te') {
            return [
                { label: 'రేపు', value: 'tomorrow' },
                { label: '2 రోజుల్లో', value: 'in 2 days' },
                { label: 'ఈ వీకెండ్', value: 'this weekend' },
                { label: 'తేదీ ఎంచుకోండి', value: 'pick date' },
            ]
        }

        if (normalizedLanguage === 'hi') {
            return [
                { label: 'कल', value: 'tomorrow' },
                { label: '2 दिन में', value: 'in 2 days' },
                { label: 'इस वीकेंड', value: 'this weekend' },
                { label: 'तारीख चुनें', value: 'pick date' },
            ]
        }

        return [
            { label: 'Tomorrow', value: 'tomorrow' },
            { label: 'In 2 Days', value: 'in 2 days' },
            { label: 'This Weekend', value: 'this weekend' },
            { label: 'Pick Date', value: 'pick date' },
        ]
    }

    if (step === ChatStep.ASK_VISIT_TIME) {
        if (normalizedLanguage === 'te') {
            return [
                { label: 'ఉదయం 10:00', value: 'morning' },
                { label: 'మధ్యాహ్నం 2:00', value: 'afternoon' },
                { label: 'సాయంత్రం 6:00', value: 'evening' },
                { label: 'సమయం ఎంచుకోండి', value: 'pick time' },
            ]
        }

        if (normalizedLanguage === 'hi') {
            return [
                { label: 'सुबह 10:00', value: 'morning' },
                { label: 'दोपहर 2:00', value: 'afternoon' },
                { label: 'शाम 6:00', value: 'evening' },
                { label: 'समय चुनें', value: 'pick time' },
            ]
        }

        return [
            { label: 'Morning (10:00 AM)', value: 'morning' },
            { label: 'Afternoon (2:00 PM)', value: 'afternoon' },
            { label: 'Evening (6:00 PM)', value: 'evening' },
            { label: 'Pick Time', value: 'pick time' },
        ]
    }

    if (step === ChatStep.ASK_NO_RESULTS_ACTION) {
        if (normalizedLanguage === 'te') {
            return [
                { label: 'ఏజెంట్‌తో మాట్లాడండి', value: 'talk to the agent' },
                { label: 'అందుబాటులో ఉన్న ఎంపికలు చూడండి', value: 'see available options' },
            ]
        }

        if (normalizedLanguage === 'hi') {
            return [
                { label: 'एजेंट से बात करें', value: 'talk to the agent' },
                { label: 'उपलब्ध विकल्प देखें', value: 'see available options' },
            ]
        }

        return [
            { label: 'Talk to the agent', value: 'talk to the agent' },
            { label: 'See available options', value: 'see available options' },
        ]
    }

    return []
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
    const latestSuggestionsRequestRef = useRef<number>(0)

    const fetchSuggestions = useCallback(async (targetSessionId: string, expectation?: SuggestionsExpectation) => {
        if (!targetSessionId) {
            return
        }

        const requestVersion = latestSuggestionsRequestRef.current + 1
        latestSuggestionsRequestRef.current = requestVersion

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

        // Ignore stale out-of-order responses so old step options cannot overwrite current flow.
        if (requestVersion !== latestSuggestionsRequestRef.current) {
            return
        }

        if (expectation?.expectedStep != null && data.step !== expectation.expectedStep) {
            return
        }

        if (expectation?.expectedLanguage != null && data.language !== expectation.expectedLanguage) {
            return
        }

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
        async (input: string, displayText?: string) => {
            const trimmed = input.trim()
            if (!sessionId || loading || !isNonEmptyText(trimmed)) {
                return
            }

            const displayTrimmed = typeof displayText === 'string' ? displayText.trim() : ''

            const userMessage: UIMessage = {
                id: createId(),
                role: 'user',
                text: displayTrimmed.length > 0 ? displayTrimmed : trimmed,
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
                setQuickReplies(getFallbackQuickRepliesForStep(data.step, data.language ?? null))
                void fetchSuggestions(sessionId, {
                    expectedStep: data.step,
                    expectedLanguage: data.language ?? null,
                }).catch(() => {
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

    const resetSession = useCallback(() => {
        const nextSessionId = createSessionId()
        latestSuggestionsRequestRef.current += 1

        if (typeof window !== 'undefined') {
            window.localStorage.removeItem(CHAT_STATE_KEY)
        }

        setSessionId(nextSessionId)
        setMessages([])
        setLatestStep(null)
        setPreferredLanguage(null)
        setQuickReplies([
            { label: 'English', value: 'English' },
            { label: 'తెలుగు', value: 'తెలుగు' },
            { label: 'हिंदी', value: 'हिंदी' },
        ])
        setError(null)
        setLoading(false)
        setIsSearching(false)
    }, [])

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
                        setQuickReplies(getFallbackQuickRepliesForStep(data.step, data.language ?? null))
                        void fetchSuggestions(sessionId, {
                            expectedStep: data.step,
                            expectedLanguage: data.language ?? null,
                        }).catch(() => {
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
        return (
            latestStep === ChatStep.ASK_INTENT
            || latestStep === ChatStep.ASK_TIMELINE
            || latestStep === ChatStep.ASK_VISIT_DATE
            || latestStep === ChatStep.ASK_VISIT_TIME
        )
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
        resetSession,
        canShowQuickReplies,
    }
}
