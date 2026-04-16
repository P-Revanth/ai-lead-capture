'use client'

interface QuickReplyOptionsProps {
    options: string[]
    disabled?: boolean
    onSelect: (value: string) => void
    align?: 'left' | 'center'
}

export default function QuickReplyOptions({ options, disabled = false, onSelect, align = 'center' }: QuickReplyOptionsProps) {
    if (options.length === 0) {
        return null
    }

    return (
        <div className={`flex w-full overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${align === 'left' ? 'justify-start' : 'justify-center'}`}>
            <div className="flex flex-nowrap gap-2">
                {options.map((option) => (
                    <button
                        key={option}
                        type="button"
                        disabled={disabled}
                        onClick={() => onSelect(option)}
                        className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {option}
                    </button>
                ))}
            </div>
        </div>
    )
}
