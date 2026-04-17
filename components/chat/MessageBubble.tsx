import { UIMessage } from '@/hooks/useChat'

interface MessageBubbleProps {
    message: UIMessage
}

export default function MessageBubble({ message }: MessageBubbleProps) {
    const isUser = message.role === 'user'

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <article
                className={`max-w-[85%] rounded-3xl px-5 py-3.5 shadow-[0px_2px_4px_rgba(0,0,0,0.02)] sm:max-w-[75%] ${isUser
                    ? 'border-emerald-100 bg-emerald-50 text-emerald-950 font-medium rounded-tr-md'
                    : 'border-zinc-100 bg-zinc-50 text-zinc-800 rounded-tl-md'
                    } border`}
            >
                <p className={`mb-1.5 text-[0.65rem] font-bold uppercase tracking-widest ${isUser ? 'text-emerald-600/70' : 'text-zinc-400'}`}>
                    {isUser ? 'You' : 'Sarah'}
                </p>
                <p className="text-[15px] leading-relaxed tracking-normal">{message.text}</p>
            </article>
        </div>
    )
}
