import { PropertyResult } from '@/types/chat'

interface PropertyCardProps {
    property: PropertyResult
}

function formatPrice(value: number): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(value)
}

export default function PropertyCard({ property }: PropertyCardProps) {
    return (
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-sm">
            <p className="text-xl font-semibold text-zinc-900">{formatPrice(property.price)}</p>
            <h3 className="mt-1 text-sm font-medium text-zinc-800">{property.title}</h3>
            <p className="mt-1 text-xs text-zinc-600 capitalize">{property.location}</p>
            {property.bhk ? (
                <span className="mt-3 inline-flex rounded-full border border-zinc-300 bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                    {property.bhk}
                </span>
            ) : null}
        </article>
    )
}
