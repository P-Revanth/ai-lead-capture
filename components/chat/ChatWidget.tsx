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
const HIDDEN_WIDGET_ROUTE_PREFIXES = ['/admin', '/auth', '/embed']

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
        resetSession,
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
                    className="fixed inset-0 flex h-dvh w-screen flex-col overflow-hidden bg-white shadow-2xl sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(74dvh,680px)] sm:w-96 sm:rounded-[2.5rem] sm:border sm:border-zinc-100"
                    aria-label="Chat widget"
                >
                    <header className="flex items-center justify-between border-b border-zinc-100 bg-white px-6 py-5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.1)]">
                                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 20V10l8-6 8 6v10" />
                                    <path d="M9 20v-6h6v6" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-base font-bold tracking-tight text-zinc-900">{WIDGET_TITLE}</h2>
                                <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">{WIDGET_SUBTITLE}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setLastReadSarahMessageId(null)
                                    resetSession()
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-50 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                                aria-label="Start a new session"
                            >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                                </svg>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setLastReadSarahMessageId(latestSarahMessageId)
                                    setIsOpen(false)
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-50 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                                aria-label="Close chat"
                            >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </header>

                    <div ref={transcriptRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                        {messages.length === 0 ? (
                            <>
                                <div className="mx-auto mt-4 max-w-[90%] rounded-[1.25rem] border border-emerald-100 bg-emerald-50/50 p-4 text-center shadow-sm">
                                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100/50 text-emerald-500">
                                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M4 20V10l8-6 8 6v10" />
                                            <path d="M9 20v-6h6v6" />
                                        </svg>
                                    </div>
                                    <h3 className="mb-1 text-sm font-bold text-zinc-900">Welcome!</h3>
                                    <p className="text-[13px] leading-snug text-zinc-600">{EMPTY_STATE}</p>
                                </div>

                                {quickReplies.length > 0 && latestStep !== ChatStep.SHOW_RESULTS ? (
                                    <div className="mx-auto w-full max-w-[90%]">
                                        <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-widest text-emerald-600/80">
                                            Select your preferred language
                                        </p>
                                        <QuickReplyOptions
                                            options={quickReplies}
                                            disabled={loading || isSearching}
                                            onSelect={(option) => {
                                                void sendMessage(option.value, option.label)
                                            }}
                                        />
                                    </div>
                                ) : null}
                            </>
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
                                                onSelect={(option) => {
                                                    void sendMessage(option.value, option.label)
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
                                            onSelect={(option) => {
                                                void sendMessage(option.value, option.label)
                                            }}
                                        />
                                    ) : null}
                                </div>
                            ))
                        )}

                        {isSearching ? (
                            <div className="my-2 flex w-fit items-center gap-2 rounded-2xl border border-zinc-100 bg-zinc-50 px-3.5 py-2.5 shadow-[0px_2px_4px_rgba(0,0,0,0.02)]">
                                <div className="flex gap-1">
                                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" />
                                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: '0.15s' }} />
                                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: '0.3s' }} />
                                </div>
                                <span className="ml-1 text-[13px] font-medium text-emerald-700/80">Searching for matches...</span>
                            </div>
                        ) : loading ? (
                            <div className="my-2 flex w-fit items-center gap-2 rounded-2xl border border-zinc-100 bg-zinc-50 px-3.5 py-2.5 shadow-[0px_2px_4px_rgba(0,0,0,0.02)]">
                                <div className="flex gap-1">
                                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" />
                                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: '0.15s' }} />
                                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: '0.3s' }} />
                                </div>
                                <span className="ml-1 text-[13px] font-medium text-zinc-500">Sarah is typing...</span>
                            </div>
                        ) : null}

                        {error ? (
                            <div className="my-2 rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-700">
                                <div className="flex items-center gap-1.5">
                                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="12" y1="8" x2="12" y2="12"></line>
                                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                    </svg>
                                    <span className="font-semibold">Oops! Something went wrong</span>
                                </div>
                            </div>
                        ) : null}
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
                    className="flex items-center gap-3 rounded-full bg-emerald-500 px-6 py-4 text-[15px] font-bold text-white shadow-xl shadow-emerald-500/20 transition-all hover:-translate-y-1 hover:bg-emerald-600 hover:shadow-2xl hover:shadow-emerald-500/30"
                    aria-label={hasUnread ? 'Open chat with unread messages' : 'Open chat'}
                >
                    <span className="relative flex h-6 w-6 items-center justify-center text-white" aria-hidden="true">
                        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        {hasUnread ? (
                            <span className="absolute -right-1 -top-1 flex h-3 w-3">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-80" />
                                <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-400 border-2 border-emerald-500" />
                            </span>
                        ) : null}
                    </span>
                    <span>Chat with Assistant</span>
                </button>
            ) : null}
        </div>
    )
}
