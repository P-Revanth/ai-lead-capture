'use client'

import { useEffect, useMemo, useRef } from 'react'
import { ChatStep } from '@/types/chat'
import ChatInput from '@/components/chat/ChatInput'
import MessageBubble from '@/components/chat/MessageBubble'
import PropertyCard from '@/components/chat/PropertyCard'
import QuickReplyOptions from '@/components/chat/QuickReplyOptions'
import { useChat } from '@/hooks/useChat'
import { getShowResultsActionOptions, getShowResultsCta } from '@/lib/prompts'

const INITIAL_EMPTY_STATE = 'Hello, What are you looking for?'

// const STEP_PROMPT_FALLBACKS: Partial<Record<ChatStep, string>> = {
//     [ChatStep.ASK_INTENT]: 'Are you looking to buy, rent, or just exploring?',
//     [ChatStep.ASK_LOCATION]: 'Which area in Visakhapatnam are you interested in?',
//     [ChatStep.ASK_BUDGET]: "What's your budget range for this property?",
//     [ChatStep.ASK_PROPERTY_TYPE]: 'What type of property are you looking for?',
//     [ChatStep.ASK_CONFIG]: 'What BHK configuration are you looking for?',
//     [ChatStep.ASK_TIMELINE]: 'When are you planning to make a decision?',
//     [ChatStep.CAPTURE_NAME]: 'May I have your name?',
//     [ChatStep.CAPTURE_PHONE]: 'Please share your phone number so the agent can contact you.',
// }

export default function ChatContainer() {
    const { messages, latestStep, loading, isSearching, error, sendMessage, preferredLanguage, quickReplies } = useChat()

    const scrollContainerRef = useRef<HTMLDivElement | null>(null)
    const bottomRef = useRef<HTMLDivElement | null>(null)
    const autoScrollEnabledRef = useRef<boolean>(true)

    const showResultsCta = useMemo(() => getShowResultsCta(preferredLanguage), [preferredLanguage])
    const showResultsActionOptions = useMemo(
        () => getShowResultsActionOptions(preferredLanguage),
        [preferredLanguage],
    )
    const latestSarahMessageId = useMemo(() => {
        const reversed = [...messages].reverse()
        const latestSarahMessage = reversed.find((message) => message.role === 'sarah')
        return latestSarahMessage?.id ?? null
    }, [messages])

    const hasPropertyResults = useMemo(() => {
        return messages.some((message) => !!message.properties && message.properties.length > 0)
    }, [messages])

    const isResultsMode = hasPropertyResults || latestStep === ChatStep.SHOW_RESULTS

    // const focusedPrompt = useMemo(() => {
    //     if (isResultsMode) {
    //         return 'Here are matching homes based on your preferences.'
    //     }

    //     if (latestSarahMessage && latestSarahMessage.text.trim().length > 0) {
    //         return latestSarahMessage.text
    //     }

    //     if (latestStep && STEP_PROMPT_FALLBACKS[latestStep]) {
    //         return STEP_PROMPT_FALLBACKS[latestStep] as string
    //     }

    //     return INITIAL_EMPTY_STATE
    // }, [isResultsMode, latestSarahMessage, latestStep])

    useEffect(() => {
        if (!autoScrollEnabledRef.current) {
            return
        }

        const container = scrollContainerRef.current
        if (!container) {
            return
        }

        container.scrollTo({
            top: container.scrollHeight,
            behavior: 'auto',
        })
    }, [messages, loading, isSearching])

    const handleScroll = () => {
        const container = scrollContainerRef.current
        if (!container) {
            return
        }

        const distanceFromBottom = container.scrollHeight - (container.scrollTop + container.clientHeight)
        const nearBottom = distanceFromBottom < 48
        if (autoScrollEnabledRef.current !== nearBottom) {
            autoScrollEnabledRef.current = nearBottom
        }
    }

    const hasMessages = messages.length > 0
    const hasUserStartedChat = useMemo(() => {
        return messages.some((message) => message.role === 'user')
    }, [messages])

    const showFocusPanel = !hasUserStartedChat
    const showQuickReplies = quickReplies.length > 0 && latestStep !== ChatStep.SHOW_RESULTS
    const showQuickRepliesInFocus = showFocusPanel && showQuickReplies
    const showTranscript = hasMessages || loading || isSearching || !!error

    return (
        <section className="relative flex h-dvh w-full overflow-hidden bg-white text-zinc-900">
            <div className="pointer-events-none absolute inset-0 bg-white" />

            <main className="relative mx-auto flex h-full w-full max-w-4xl flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
                <header className="flex shrink-0 items-center justify-between border-b border-zinc-100 pb-4 pt-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.15)]">
                            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 20V10l8-6 8 6v10" />
                                <path d="M9 20v-6h6v6" />
                            </svg>
                        </div>
                        <div className="text-left">
                            <h1 className="text-lg font-bold tracking-tight text-zinc-900">Sarah</h1>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">Real Estate Assistant</p>
                        </div>
                    </div>
                </header>

                <section className="relative flex min-h-0 flex-1 flex-col">
                    {showFocusPanel ? (
                        <div className="absolute inset-x-0 top-0 bottom-28 flex items-center justify-center px-4 sm:px-0">
                            <div className="w-full max-w-2xl text-center">
                                <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
                                    {INITIAL_EMPTY_STATE}
                                </h2>
                                <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-zinc-500 sm:text-[16px]">
                                    I am Sarah, your AI Real Estate Assistant. I can help you search for properties, check availability, or find the perfect neighborhood for your budget.
                                </p>
                                <div className="mt-8 flex flex-col items-center justify-center">
                                    <p className="mb-4 text-xs font-bold uppercase tracking-wider text-emerald-600/80">
                                        {isResultsMode ? 'Your curated options are ready' : 'Select your preferred language'}
                                    </p>
                                    {showQuickRepliesInFocus ? (
                                        <div className="w-full">
                                            <QuickReplyOptions
                                                options={quickReplies}
                                                disabled={loading || isSearching}
                                                onSelect={(option) => {
                                                    void sendMessage(option.value, option.label)
                                                }}
                                            />
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <section
                        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-0 pb-35 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        ref={scrollContainerRef}
                        onScroll={handleScroll}
                    >
                        {showTranscript ? (
                            <div className="space-y-5">
                                {!hasMessages ? (
                                    <div className="my-2 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
                                        <p className="text-sm font-medium text-zinc-800">{INITIAL_EMPTY_STATE}</p>
                                    </div>
                                ) : (
                                    messages.map((message) => (
                                        <div key={message.id} className="space-y-4 transition-all duration-300">
                                            <MessageBubble message={message} />

                                            {!showFocusPanel && showQuickReplies && message.role === 'sarah' && message.id === latestSarahMessageId ? (
                                                <QuickReplyOptions
                                                    options={quickReplies}
                                                    align="left"
                                                    disabled={loading || isSearching}
                                                    onSelect={(option) => {
                                                        void sendMessage(option.value, option.label)
                                                    }}
                                                />
                                            ) : null}

                                            {message.properties && message.properties.length > 0 ? (
                                                <div className="space-y-3 pl-1">
                                                    <div className="space-y-2">
                                                        {message.properties.map((property) => (
                                                            <PropertyCard key={property.id} property={property} />
                                                        ))}
                                                    </div>
                                                    <p className="text-sm text-zinc-700 capitalize">{showResultsCta}</p>
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
                                        </div>
                                    ))
                                )}

                                {isSearching ? (
                                    <div className="flex w-fit items-center gap-2 rounded-2xl bg-zinc-100 px-4 py-3 text-sm text-zinc-600 shadow-sm">
                                        <div className="flex gap-1">
                                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" />
                                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: '0.15s' }} />
                                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: '0.3s' }} />
                                        </div>
                                        <span className="ml-1 font-medium">Searching for matching properties...</span>
                                    </div>
                                ) : loading ? (
                                    <div className="flex w-fit items-center gap-2 rounded-2xl bg-zinc-100 px-4 py-3 text-sm text-zinc-600 shadow-sm">
                                        <div className="flex gap-1">
                                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" />
                                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: '0.15s' }} />
                                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: '0.3s' }} />
                                        </div>
                                        <span className="ml-1 font-medium">Sarah is typing...</span>
                                    </div>
                                ) : null}

                                {error ? (
                                    <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                                        <div className="flex items-center gap-2">
                                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="12" cy="12" r="10"></circle>
                                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                            </svg>
                                            <span className="font-semibold">Oops! Something went wrong</span>
                                        </div>
                                        <p className="mt-1 pl-6 opacity-90">{error}</p>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                        <div ref={bottomRef} className="h-8" />
                    </section>

                    <div className="absolute inset-x-0 bottom-0 z-20 bg-linear-to-t from-white via-white/95 to-transparent px-0 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10">
                        <ChatInput loading={loading || isSearching} onSend={sendMessage} />
                    </div>
                </section>
            </main>
        </section>
    )
}
