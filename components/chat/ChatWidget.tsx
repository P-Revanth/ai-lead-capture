'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ChatStep } from '@/types/chat'
import { useChat } from '@/hooks/useChat'
import ChatInput from '@/components/chat/ChatInput'
import MessageBubble from '@/components/chat/MessageBubble'
import PropertyCard from '@/components/chat/PropertyCard'
import QuickReplyOptions from '@/components/chat/QuickReplyOptions'
import { getShowResultsActionOptions, getShowResultsCta } from '@/lib/prompts'

const WIDGET_TITLE = 'Sarah'
const WIDGET_SUBTITLE = 'Real Estate Assistant'
const EMPTY_STATE = 'How can I help you find your next property?'
const HIDDEN_WIDGET_ROUTE_PREFIXES = ['/admin', '/auth']

export default function ChatWidget() {
    const [isOpen, setIsOpen] = useState<boolean>(false)
    const [lastReadSarahMessageId, setLastReadSarahMessageId] = useState<string | null>(null)
    const pathname = usePathname()
    const {
        messages,
        latestStep,
        loading,
        isSearching,
        error,
        sendMessage,
        preferredLanguage,
        quickReplies,
    } = useChat()

    const transcriptRef = useRef<HTMLDivElement | null>(null)

    const latestSarahMessageId = useMemo(() => {
        const reversed = [...messages].reverse()
        const latestSarahMessage = reversed.find((message) => message.role === 'sarah')
        return latestSarahMessage?.id ?? null
    }, [messages])

    const hasPropertyResults = useMemo(() => {
        return messages.some((message) => !!message.properties && message.properties.length > 0)
    }, [messages])

    const showResultsCta = useMemo(() => getShowResultsCta(preferredLanguage), [preferredLanguage])
    const showResultsActionOptions = useMemo(
        () => getShowResultsActionOptions(preferredLanguage),
        [preferredLanguage],
    )
    const shouldHideWidget = useMemo(() => {
        if (!pathname) {
            return false
        }

        return HIDDEN_WIDGET_ROUTE_PREFIXES.some(
            (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
        )
    }, [pathname])
    const hasUnread = useMemo(() => {
        if (isOpen || !latestSarahMessageId) {
            return false
        }

        if (!lastReadSarahMessageId) {
            return false
        }

        return lastReadSarahMessageId !== latestSarahMessageId
    }, [isOpen, latestSarahMessageId, lastReadSarahMessageId])

    useEffect(() => {
        if (!isOpen) {
            return
        }

        const container = transcriptRef.current
        if (!container) {
            return
        }

        container.scrollTop = container.scrollHeight
    }, [isOpen, messages, loading, isSearching])

    if (shouldHideWidget) {
        return null
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
            {isOpen ? (
                <section
                    className="fixed inset-0 flex h-dvh w-screen flex-col bg-white shadow-xl sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(74dvh,640px)] sm:w-[380px] sm:rounded-2xl sm:border sm:border-zinc-200"
                    aria-label="Chat widget"
                >
                    <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
                        <div>
                            <h2 className="text-sm font-semibold text-zinc-900">{WIDGET_TITLE}</h2>
                            <p className="text-xs text-zinc-500">{WIDGET_SUBTITLE}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setLastReadSarahMessageId(latestSarahMessageId)
                                setIsOpen(false)
                            }}
                            className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                            aria-label="Close chat"
                        >
                            Close
                        </button>
                    </header>

                    <div ref={transcriptRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
                        {messages.length === 0 ? (
                            <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">{EMPTY_STATE}</p>
                        ) : (
                            messages.map((message) => (
                                <div key={message.id} className="space-y-2">
                                    <MessageBubble message={message} />

                                    {message.properties && message.properties.length > 0 ? (
                                        <div className="space-y-2 pl-1">
                                            {message.properties.map((property) => (
                                                <PropertyCard key={property.id} property={property} />
                                            ))}
                                            <p className="text-xs text-zinc-700 capitalize">{showResultsCta}</p>
                                            <QuickReplyOptions
                                                options={showResultsActionOptions}
                                                align="left"
                                                disabled={loading || isSearching}
                                                onSelect={(value) => {
                                                    void sendMessage(value)
                                                }}
                                            />
                                        </div>
                                    ) : null}

                                    {quickReplies.length > 0
                                        && message.role === 'sarah'
                                        && message.id === latestSarahMessageId
                                        && !hasPropertyResults
                                        && latestStep !== ChatStep.SHOW_RESULTS ? (
                                        <QuickReplyOptions
                                            options={quickReplies}
                                            align="left"
                                            disabled={loading || isSearching}
                                            onSelect={(value) => {
                                                void sendMessage(value)
                                            }}
                                        />
                                    ) : null}
                                </div>
                            ))
                        )}

                        {isSearching ? (
                            <p className="text-xs text-zinc-500">Searching for matching properties...</p>
                        ) : loading ? (
                            <p className="text-xs text-zinc-500">Sarah is typing...</p>
                        ) : null}

                        {error ? <p className="text-xs text-red-700">{error}</p> : null}
                    </div>

                    <div className="border-t border-zinc-200 px-3 py-3">
                        <ChatInput loading={loading || isSearching} onSend={sendMessage} />
                    </div>
                </section>
            ) : null}

            {!isOpen ? (
                <button
                    type="button"
                    onClick={() => {
                        setLastReadSarahMessageId(latestSarahMessageId)
                        setIsOpen(true)
                    }}
                    className="flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-zinc-800"
                    aria-label={hasUnread ? 'Open chat with unread messages' : 'Open chat'}
                >
                    <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-white/15" aria-hidden="true">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 6h16v10H7l-3 3V6z" />
                        </svg>
                        {hasUnread ? (
                            <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-80" />
                                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                            </span>
                        ) : null}
                    </span>
                    <span>Chat with Sarah</span>
                </button>
            ) : null}
        </div>
    )
}
