'use client'

import { FormEvent, useState } from 'react'

interface ChatInputProps {
    loading: boolean
    onSend: (message: string) => Promise<void> | void
}

export default function ChatInput({ loading, onSend }: ChatInputProps) {
    const [value, setValue] = useState<string>('')

    const trimmed = value.trim()
    const disabled = loading || trimmed.length === 0

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (disabled) {
            return
        }

        const nextValue = value.trim()
        setValue('')
        await onSend(nextValue)
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 rounded-[26px] border border-zinc-200 bg-white/90 px-3 py-2 shadow-sm backdrop-blur-sm"
        >
            <label htmlFor="chat-message" className="sr-only">
                Message Sarah
            </label>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 20V10l8-6 8 6v10" />
                    <path d="M9 20v-6h6v6" />
                </svg>
            </div>
            <input
                id="chat-message"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="Ask about area, budget, or property type"
                className="h-11 min-w-0 flex-1 rounded-xl capitalize border border-transparent bg-transparent px-2 text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400 transition focus:bg-transparent"
                autoComplete="off"
                disabled={loading}
            />
            <button
                type="submit"
                disabled={disabled}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-700 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                aria-label="Send message"
            >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h13" />
                    <path d="M13 6l6 6-6 6" />
                </svg>
            </button>
        </form>
    )
}
