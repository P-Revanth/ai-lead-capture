import { UIMessage } from '@/hooks/useChat'

interface MessageBubbleProps {
    message: UIMessage
}

export default function MessageBubble({ message }: MessageBubbleProps) {
    const isUser = message.role === 'user'

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <article
                className={`max-w-[82%] rounded-2xl border px-3.5 py-2.5 transition-colors sm:max-w-[72%] ${isUser
                    ? 'border-slate-200 bg-slate-100 text-zinc-900'
                    : 'border-zinc-200 bg-white text-zinc-800'
                    }`}
            >
                <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                    {isUser ? 'You' : 'Sarah'}
                </p>
                <p className="text-[13px] leading-6">{message.text}</p>
            </article>
        </div>
    )
}
