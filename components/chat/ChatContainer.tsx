'use client'

import { useEffect, useMemo, useRef } from 'react'
import { ChatStep } from '@/types/chat'
import ChatInput from '@/components/chat/ChatInput'
import MessageBubble from '@/components/chat/MessageBubble'
import PropertyCard from '@/components/chat/PropertyCard'
import QuickReplyOptions from '@/components/chat/QuickReplyOptions'
import { useChat } from '@/hooks/useChat'

const INITIAL_EMPTY_STATE = 'Hi, What are you looking for?'
const SHOW_RESULTS_CTA = 'Would you like to schedule a visit or talk to the agent?'

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

function getStepQuickReplies(step: ChatStep | null): string[] {
    if (step === ChatStep.ASK_INTENT) {
        return ['Buy', 'Rent', 'Exploring']
    }
    if (step === ChatStep.ASK_PROPERTY_TYPE) {
        return ['Apartment', 'Villa', 'Plot', 'Commercial']
    }
    if (step === ChatStep.ASK_TIMELINE) {
        return ['Urgent', 'Soon', 'Flexible']
    }
    return []
}

export default function ChatContainer() {
    const { messages, latestStep, loading, isSearching, error, sendMessage } = useChat()

    const scrollContainerRef = useRef<HTMLDivElement | null>(null)
    const bottomRef = useRef<HTMLDivElement | null>(null)
    const autoScrollEnabledRef = useRef<boolean>(true)

    const quickReplies = useMemo(() => getStepQuickReplies(latestStep), [latestStep])
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
    const showQuickReplies = quickReplies.length > 0 && !isResultsMode
    const showQuickRepliesInFocus = showFocusPanel && showQuickReplies
    const showTranscript = hasMessages || loading || isSearching || !!error

    return (
        <section className="relative flex h-dvh w-full overflow-hidden bg-zinc-50 text-zinc-900">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.9),rgba(244,244,245,0.8)_40%,rgba(228,228,231,0.65)_100%)]" />

            <main className="relative mx-auto flex h-full w-full max-w-4xl flex-col px-5 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
                <header className="shrink-0 pt-2 text-center">
                    <h1 className="text-[2.1rem] font-semibold tracking-tight text-zinc-900 sm:text-[2.4rem]">Sarah</h1>
                    <p className="text-sm text-zinc-600 sm:text-base">Real Estate Assistant</p>
                    {/* <p className="mt-1 text-xs text-zinc-500 sm:text-sm">Helping you find homes in Visakhapatnam</p> */}
                </header>

                <section className="relative flex min-h-0 flex-1 flex-col">
                    {showFocusPanel ? (
                        <div className="flex shrink-0 flex-col items-center justify-center py-6 text-center sm:py-8">
                            <div className="max-w-3xl px-2 sm:px-0">
                                <p className="text-sm text-zinc-500 sm:text-base">
                                    {isResultsMode ? 'Your curated options are ready.' : 'A few guided questions will narrow things down quickly.'}
                                </p>
                                <h2 className="mt-5 text-[clamp(2.1rem,5vw,4.6rem)] font-medium leading-[1.02] tracking-tight text-zinc-900">
                                    {INITIAL_EMPTY_STATE}
                                </h2>

                                {showQuickRepliesInFocus ? (
                                    <div className="mt-7">
                                        <QuickReplyOptions
                                            options={quickReplies}
                                            disabled={loading || isSearching}
                                            onSelect={(value) => {
                                                void sendMessage(value)
                                            }}
                                        />
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ) : null}

                    <section
                        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-0 pb-35 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        ref={scrollContainerRef}
                        onScroll={handleScroll}
                    >
                        {showTranscript ? (
                            <div className="space-y-4">
                                {!hasMessages ? (
                                    <p className="px-1 text-sm text-zinc-600">{INITIAL_EMPTY_STATE}</p>
                                ) : (
                                    messages.map((message) => (
                                        <div key={message.id} className="space-y-3 transition-all duration-300">
                                            <MessageBubble message={message} />

                                            {!showFocusPanel && showQuickReplies && message.role === 'sarah' && message.id === latestSarahMessageId ? (
                                                <QuickReplyOptions
                                                    options={quickReplies}
                                                    align="left"
                                                    disabled={loading || isSearching}
                                                    onSelect={(value) => {
                                                        void sendMessage(value)
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
                                                    <p className="text-sm text-zinc-700">{SHOW_RESULTS_CTA}</p>
                                                    <QuickReplyOptions
                                                        options={['Schedule a visit', 'Talk to the agent']}
                                                        align="left"
                                                        disabled={loading || isSearching}
                                                        onSelect={(value) => {
                                                            void sendMessage(value)
                                                        }}
                                                    />
                                                </div>
                                            ) : null}
                                        </div>
                                    ))
                                )}

                                {isSearching ? (
                                    <div className="flex items-center gap-2 px-1 text-sm text-zinc-600">
                                        <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400" />
                                        <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400" style={{ animationDelay: '0.15s' }} />
                                        <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400" style={{ animationDelay: '0.3s' }} />
                                        <span className="ml-1">Searching for matching properties...</span>
                                    </div>
                                ) : loading ? (
                                    <p className="px-1 text-sm text-zinc-500">Sarah is typing...</p>
                                ) : null}

                                {error ? <p className="px-1 text-sm text-red-700">{error}</p> : null}
                            </div>
                        ) : null}
                        <div ref={bottomRef} />
                    </section>

                    <div className="absolute inset-x-0 bottom-0 z-20 bg-linear-to-t from-zinc-50 via-zinc-50/95 to-transparent px-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-8">
                        <ChatInput loading={loading || isSearching} onSend={sendMessage} />
                    </div>
                </section>
            </main>
        </section>
    )
}
