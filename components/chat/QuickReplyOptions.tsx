'use client'

import { QuickReplyOption } from '@/types/chat'

type QuickReplyInput = string | QuickReplyOption

interface QuickReplyOptionsProps {
    options: QuickReplyInput[]
    disabled?: boolean
    onSelect: (value: string) => void
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
                        onClick={() => onSelect(option.value)}
                        className="max-w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    )
}
