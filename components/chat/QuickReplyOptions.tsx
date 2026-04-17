'use client'

import { QuickReplyOption } from '@/types/chat'

type QuickReplyInput = string | QuickReplyOption

interface QuickReplyOptionsProps {
    options: QuickReplyInput[]
    disabled?: boolean
    onSelect: (option: QuickReplyOption) => void
    align?: 'left' | 'center'
}

export default function QuickReplyOptions({ options, disabled = false, onSelect, align = 'center' }: QuickReplyOptionsProps) {
    const normalizedOptions = options
        .slice(0, 5)
        .map((option) => {
            if (typeof option === 'string') {
                return { label: option, value: option }
            }
            return option
        })

    if (normalizedOptions.length === 0) {
        return null
    }

    return (
        <div className={`flex w-full pb-1 ${align === 'left' ? 'justify-start' : 'justify-center'}`}>
            <div className={`flex w-full flex-wrap gap-2 ${align === 'left' ? 'justify-start' : 'justify-center'}`}>
                {normalizedOptions.map((option) => (
                    <button
                        key={`${option.label}:${option.value}`}
                        type="button"
                        disabled={disabled}
                        onClick={() => onSelect(option)}
                        className="max-w-full rounded-2xl border border-emerald-100 bg-emerald-50/60 px-5 py-2.5 text-[14px] font-semibold text-emerald-800 shadow-sm shadow-emerald-500/5 transition-all hover:-translate-y-0.5 hover:bg-emerald-100 hover:shadow hover:shadow-emerald-500/10 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 disabled:border-zinc-200 disabled:shadow-none"
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    )
}
