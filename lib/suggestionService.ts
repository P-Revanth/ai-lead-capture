import { supabase } from '@/lib/supabaseClient'
import { Intent } from '@/types/chat'

const CACHE_TTL_MS = 5 * 60 * 1000
const MAX_OPTIONS = 5
const DEFAULT_LIMIT = 4
const LOCATION_PAGE_SIZE = 1000
const RANGE_ROUNDING_UNIT = 500000

type SearchIntent = Intent

const LOCATION_ALIASES: Record<string, string> = {
    vizag: 'visakhapatnam',
    vskp: 'visakhapatnam',
    'mvp': 'mvp colony',
    'mvp colony': 'mvp colony',
}

const PROPERTY_TYPE_ALIASES: Record<string, 'apartment' | 'villa' | 'plot' | 'commercial'> = {
    apartment: 'apartment',
    apartments: 'apartment',
    flat: 'apartment',
    flats: 'apartment',
    villa: 'villa',
    villas: 'villa',
    plot: 'plot',
    plots: 'plot',
    land: 'plot',
    commercial: 'commercial',
    office: 'commercial',
    retail: 'commercial',
    shop: 'commercial',
}

export interface SuggestionOption {
    value: string
    label: string
}

export interface LocationSuggestion extends SuggestionOption {
    count: number
}

export interface BudgetRangeSuggestion extends SuggestionOption {
    min: number | null
    max: number | null
}

export interface BudgetFilter {
    min?: number | null
    max?: number | null
}

export const FALLBACK_LOCATIONS: LocationSuggestion[] = [
    { value: 'madhurawada', label: 'Madhurawada', count: 0 },
    { value: 'rushikonda', label: 'Rushikonda', count: 0 },
    { value: 'mvp colony', label: 'MVP Colony', count: 0 },
    { value: 'gajuwaka', label: 'Gajuwaka', count: 0 },
]

export const FALLBACK_BUDGET_RANGES: BudgetRangeSuggestion[] = [
    { value: 'under_4000000', label: 'Under Rs 40L', min: null, max: 4000000 },
    { value: '4000000_6000000', label: 'Rs 40L - Rs 60L', min: 4000000, max: 6000000 },
    { value: '6000000_10000000', label: 'Rs 60L - Rs 1Cr', min: 6000000, max: 10000000 },
    { value: 'above_10000000', label: 'Above Rs 1Cr', min: 10000000, max: null },
]

export const FALLBACK_RENT_BUDGET_RANGES: BudgetRangeSuggestion[] = [
    { value: 'under_15000', label: 'Under Rs 15,000', min: null, max: 15000 },
    { value: '15000_30000', label: 'Rs 15,000 - Rs 30,000', min: 15000, max: 30000 },
    { value: '30000_60000', label: 'Rs 30,000 - Rs 60,000', min: 30000, max: 60000 },
    { value: 'above_60000', label: 'Above Rs 60,000', min: 60000, max: null },
]

export const FALLBACK_PROPERTY_TYPES: SuggestionOption[] = [
    { value: 'apartment', label: 'Apartment' },
    { value: 'villa', label: 'Villa' },
    { value: 'plot', label: 'Plot' },
    { value: 'commercial', label: 'Commercial' },
]

export const FALLBACK_BHK_OPTIONS: SuggestionOption[] = [
    { value: '1BHK', label: '1BHK' },
    { value: '2BHK', label: '2BHK' },
    { value: '3BHK', label: '3BHK' },
    { value: '4BHK', label: '4BHK' },
]

function normalizeIntent(intent?: string | null): SearchIntent {
    const normalized = (intent ?? '').trim().toLowerCase()
    if (normalized === 'rent' || normalized === 'explore') {
        return normalized as SearchIntent
    }

    return 'buy'
}

function getFallbackBudgetRanges(intent: SearchIntent, limit: number): BudgetRangeSuggestion[] {
    if (intent === 'rent') {
        return FALLBACK_RENT_BUDGET_RANGES.slice(0, limit)
    }

    return FALLBACK_BUDGET_RANGES.slice(0, limit)
}

function applyRentIntentFilter<T>(query: T, intent: SearchIntent): T {
    if (intent !== 'rent') {
        return query
    }

    const queryWithOr = query as T & { or?: (filters: string) => T }
    if (typeof queryWithOr.or !== 'function') {
        return query
    }

    return queryWithOr.or(
        'status.ilike.%rent%,status.ilike.%lease%,status.ilike.%month%,title.ilike.%rent%,title.ilike.%lease%,description.ilike.%rent%,description.ilike.%lease%,description.ilike.%month%',
    )
}

interface CacheEntry<T> {
    value: T
    expiresAt: number
}

const suggestionCache = new Map<string, CacheEntry<unknown>>()

function clampLimit(limit: number): number {
    if (!Number.isFinite(limit)) {
        return DEFAULT_LIMIT
    }

    const normalized = Math.floor(limit)
    return Math.min(MAX_OPTIONS, Math.max(1, normalized))
}

function getCacheKey(prefix: string, parts: Array<string | number | null | undefined>): string {
    return `${prefix}:${parts.map((part) => String(part ?? '')).join(':')}`
}

function readCache<T>(key: string): T | null {
    const entry = suggestionCache.get(key)
    if (!entry) {
        return null
    }

    if (entry.expiresAt < Date.now()) {
        suggestionCache.delete(key)
        return null
    }

    return entry.value as T
}

function writeCache<T>(key: string, value: T): T {
    suggestionCache.set(key, {
        value,
        expiresAt: Date.now() + CACHE_TTL_MS,
    })
    return value
}

async function withCache<T>(key: string, resolver: () => Promise<T>): Promise<T> {
    const cached = readCache<T>(key)
    if (cached) {
        return cached
    }

    const value = await resolver()
    return writeCache(key, value)
}

export function normalizeLocation(location: string): string {
    const normalized = location.trim().toLowerCase().replace(/\s+/g, ' ')
    return LOCATION_ALIASES[normalized] ?? normalized
}

export function normalizeBHK(value: string): string {
    const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ')
    const digitMatch = normalized.match(/(\d+)/)

    if (!digitMatch) {
        return value.replace(/\s+/g, '').toUpperCase()
    }

    return `${digitMatch[1]}BHK`
}

export function normalizePropertyType(value: string): 'apartment' | 'villa' | 'plot' | 'commercial' | null {
    const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ')
    return PROPERTY_TYPE_ALIASES[normalized] ?? null
}

function isValidInputLocation(location: string): boolean {
    return normalizeLocation(location).length > 1
}

function toTitleCase(value: string): string {
    return value
        .split(/\s+/)
        .filter((part) => part.length > 0)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ')
}

function formatPriceLabel(value: number): string {
    if (value >= 10000000) {
        const crores = value / 10000000
        const formatted = Number.isInteger(crores) ? crores.toFixed(0) : crores.toFixed(1)
        return `Rs ${formatted}Cr`
    }

    if (value >= 100000) {
        const lakhs = value / 100000
        const formatted = Number.isInteger(lakhs) ? lakhs.toFixed(0) : lakhs.toFixed(1)
        return `Rs ${formatted}L`
    }

    return `Rs ${new Intl.NumberFormat('en-IN').format(value)}`
}

function roundToNearest(value: number, unit: number): number {
    return Math.round(value / unit) * unit
}

function pickNiceStep(target: number): number {
    const candidates = [500000, 1000000, 1500000, 2000000, 2500000, 5000000, 10000000, 20000000]
    for (const candidate of candidates) {
        if (candidate >= target) {
            return candidate
        }
    }

    return Math.ceil(target / RANGE_ROUNDING_UNIT) * RANGE_ROUNDING_UNIT
}

function uniqueSortedNumbers(values: number[]): number[] {
    return [...new Set(values)].sort((a, b) => a - b)
}

function buildBoundaryCandidates(minPrice: number, maxPrice: number, boundaryCount: number): number[] {
    const spread = maxPrice - minPrice

    const seeds = boundaryCount >= 3
        ? [0.25, 0.5, 0.75]
        : boundaryCount === 2
            ? [0.35, 0.7]
            : [0.5]

    const fromPercentiles = seeds
        .slice(0, boundaryCount)
        .map((seed) => roundToNearest(minPrice + spread * seed, RANGE_ROUNDING_UNIT))
        .filter((value) => value > minPrice && value < maxPrice)

    const result = uniqueSortedNumbers(fromPercentiles)
    if (result.length >= boundaryCount) {
        return result.slice(0, boundaryCount)
    }

    const step = pickNiceStep(spread / (boundaryCount + 1))
    let cursor = Math.ceil((minPrice + step) / step) * step

    while (result.length < boundaryCount && cursor < maxPrice) {
        if (!result.includes(cursor)) {
            result.push(cursor)
        }
        cursor += step
    }

    return uniqueSortedNumbers(result).slice(0, boundaryCount)
}

function buildBudgetRanges(minPrice: number, maxPrice: number, limit: number): BudgetRangeSuggestion[] {
    if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice) || minPrice <= 0 || maxPrice <= 0 || minPrice >= maxPrice) {
        return []
    }

    const normalizedLimit = Math.min(limit, 4)
    const spread = maxPrice - minPrice
    const desiredOptions = spread >= 5000000 ? 4 : 3
    const optionCount = Math.min(normalizedLimit, desiredOptions)
    const boundaryCount = optionCount - 1

    if (boundaryCount < 2) {
        return []
    }

    const boundaries = buildBoundaryCandidates(minPrice, maxPrice, boundaryCount)
    if (boundaries.length < boundaryCount) {
        return []
    }

    const ranges: BudgetRangeSuggestion[] = []

    const firstBoundary = boundaries[0]
    ranges.push({
        value: `under_${firstBoundary}`,
        label: `Under ${formatPriceLabel(firstBoundary)}`,
        min: null,
        max: firstBoundary,
    })

    for (let index = 0; index < boundaries.length - 1; index += 1) {
        const left = boundaries[index]
        const right = boundaries[index + 1]
        ranges.push({
            value: `${left}_${right}`,
            label: `${formatPriceLabel(left)} - ${formatPriceLabel(right)}`,
            min: left,
            max: right,
        })
    }

    const lastBoundary = boundaries[boundaries.length - 1]
    ranges.push({
        value: `above_${lastBoundary}`,
        label: `Above ${formatPriceLabel(lastBoundary)}`,
        min: lastBoundary,
        max: null,
    })

    return ranges.slice(0, normalizedLimit)
}

function parseBhkRank(value: string): number {
    const match = value.match(/\d+/)
    if (!match) {
        return Number.MAX_SAFE_INTEGER
    }

    return Number(match[0])
}

async function fetchAllAvailableLocations(intent: SearchIntent): Promise<Array<{ location: string }>> {
    const rows: Array<{ location: string }> = []
    let offset = 0

    while (true) {
        const query = applyRentIntentFilter(
            supabase
                .from('properties')
                .select('location')
                .eq('is_available', true)
                .range(offset, offset + LOCATION_PAGE_SIZE - 1),
            intent,
        )

        const { data, error } = await query

        if (error) {
            throw new Error(`Failed to fetch locations: ${error.message}`)
        }

        const batch = data ?? []
        if (batch.length === 0) {
            break
        }

        for (const row of batch) {
            if (typeof row.location === 'string' && row.location.trim().length > 0) {
                rows.push({ location: row.location })
            }
        }

        if (batch.length < LOCATION_PAGE_SIZE) {
            break
        }

        offset += LOCATION_PAGE_SIZE
    }

    return rows
}

export async function getTopLocations(limit = DEFAULT_LIMIT): Promise<LocationSuggestion[]> {
    const normalizedLimit = clampLimit(limit)
    const intent = 'buy'
    const cacheKey = getCacheKey('top_locations', [intent, normalizedLimit])

    return withCache(cacheKey, async () => {
        try {
            const rows = await fetchAllAvailableLocations(intent)
            const counts = new Map<string, { count: number; label: string }>()

            for (const row of rows) {
                const normalized = normalizeLocation(row.location)
                const existing = counts.get(normalized)
                if (existing) {
                    existing.count += 1
                    continue
                }

                counts.set(normalized, {
                    count: 1,
                    label: toTitleCase(normalized),
                })
            }

            const ranked = [...counts.entries()]
                .map(([value, payload]) => ({ value, label: payload.label, count: payload.count }))
                .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))

            if (ranked.length === 0) {
                return FALLBACK_LOCATIONS.slice(0, normalizedLimit)
            }

            return ranked.slice(0, normalizedLimit)
        } catch {
            return FALLBACK_LOCATIONS.slice(0, normalizedLimit)
        }
    })
}

export async function getTopLocationsByIntent(intentInput: string | null | undefined, limit = DEFAULT_LIMIT): Promise<LocationSuggestion[]> {
    const normalizedLimit = clampLimit(limit)
    const intent = normalizeIntent(intentInput)
    const cacheKey = getCacheKey('top_locations', [intent, normalizedLimit])

    return withCache(cacheKey, async () => {
        try {
            const rows = await fetchAllAvailableLocations(intent)
            const counts = new Map<string, { count: number; label: string }>()

            for (const row of rows) {
                const normalized = normalizeLocation(row.location)
                const existing = counts.get(normalized)
                if (existing) {
                    existing.count += 1
                    continue
                }

                counts.set(normalized, {
                    count: 1,
                    label: toTitleCase(normalized),
                })
            }

            const ranked = [...counts.entries()]
                .map(([value, payload]) => ({ value, label: payload.label, count: payload.count }))
                .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))

            if (ranked.length === 0) {
                return FALLBACK_LOCATIONS.slice(0, normalizedLimit)
            }

            return ranked.slice(0, normalizedLimit)
        } catch {
            return FALLBACK_LOCATIONS.slice(0, normalizedLimit)
        }
    })
}

export async function getBudgetRanges(
    location: string,
    limit = DEFAULT_LIMIT,
    intentInput?: string | null,
): Promise<BudgetRangeSuggestion[]> {
    const normalizedLimit = clampLimit(limit)
    const intent = normalizeIntent(intentInput)

    if (!isValidInputLocation(location)) {
        return getFallbackBudgetRanges(intent, normalizedLimit)
    }

    const normalizedLocation = normalizeLocation(location)
    const cacheKey = getCacheKey('budget_ranges', [normalizedLocation, intent, normalizedLimit])

    return withCache(cacheKey, async () => {
        try {
            const [minResponse, maxResponse] = await Promise.all([
                applyRentIntentFilter(
                    supabase
                        .from('properties')
                        .select('price')
                        .eq('is_available', true)
                        .ilike('location', `%${normalizedLocation}%`),
                    intent,
                )
                    .order('price', { ascending: true })
                    .limit(1),
                applyRentIntentFilter(
                    supabase
                        .from('properties')
                        .select('price')
                        .eq('is_available', true)
                        .ilike('location', `%${normalizedLocation}%`),
                    intent,
                )
                    .order('price', { ascending: false })
                    .limit(1),
            ])

            if (minResponse.error) {
                throw new Error(`Failed to fetch minimum price: ${minResponse.error.message}`)
            }

            if (maxResponse.error) {
                throw new Error(`Failed to fetch maximum price: ${maxResponse.error.message}`)
            }

            const minPrice = minResponse.data?.[0]?.price
            const maxPrice = maxResponse.data?.[0]?.price

            if (typeof minPrice !== 'number' || typeof maxPrice !== 'number') {
                return getFallbackBudgetRanges(intent, normalizedLimit)
            }

            const dynamicRanges = buildBudgetRanges(minPrice, maxPrice, normalizedLimit)
            if (dynamicRanges.length === 0) {
                return getFallbackBudgetRanges(intent, normalizedLimit)
            }

            return dynamicRanges
        } catch {
            return getFallbackBudgetRanges(intent, normalizedLimit)
        }
    })
}

export async function getPropertyTypes(
    location: string,
    budget?: BudgetFilter,
    limit = DEFAULT_LIMIT,
    intentInput?: string | null,
): Promise<SuggestionOption[]> {
    const normalizedLimit = clampLimit(limit)
    const intent = normalizeIntent(intentInput)

    if (!isValidInputLocation(location)) {
        return FALLBACK_PROPERTY_TYPES.slice(0, normalizedLimit)
    }

    const normalizedLocation = normalizeLocation(location)
    const min = typeof budget?.min === 'number' ? budget.min : null
    const max = typeof budget?.max === 'number' ? budget.max : null
    const cacheKey = getCacheKey('property_types', [normalizedLocation, min, max, intent, normalizedLimit])

    return withCache(cacheKey, async () => {
        try {
            let query = applyRentIntentFilter(
                supabase
                    .from('properties')
                    .select('type')
                    .eq('is_available', true)
                    .ilike('location', `%${normalizedLocation}%`)
                    .not('type', 'is', null),
                intent,
            )

            if (typeof min === 'number') {
                query = query.gte('price', min)
            }

            if (typeof max === 'number') {
                query = query.lte('price', max)
            }

            const { data, error } = await query.limit(250)
            if (error) {
                throw new Error(`Failed to fetch property types: ${error.message}`)
            }

            const counts = new Map<string, number>()
            for (const row of data ?? []) {
                const type = typeof row.type === 'string' ? normalizePropertyType(row.type) : null
                if (!type) {
                    continue
                }

                counts.set(type, (counts.get(type) ?? 0) + 1)
            }

            const ranked = [...counts.entries()]
                .map(([value, count]) => ({ value, label: toTitleCase(value), count }))
                .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
                .map(({ value, label }) => ({ value, label }))

            if (ranked.length === 0) {
                return FALLBACK_PROPERTY_TYPES.slice(0, normalizedLimit)
            }

            return ranked.slice(0, normalizedLimit)
        } catch {
            return FALLBACK_PROPERTY_TYPES.slice(0, normalizedLimit)
        }
    })
}

export async function getBHKOptions(location: string, type: string, limit = DEFAULT_LIMIT): Promise<SuggestionOption[]> {
    const normalizedLimit = clampLimit(limit)
    const intent = 'buy'

    if (!isValidInputLocation(location) || type.trim().length === 0) {
        return FALLBACK_BHK_OPTIONS.slice(0, normalizedLimit)
    }

    const normalizedLocation = normalizeLocation(location)
    const normalizedType = normalizePropertyType(type) ?? type.trim().toLowerCase()
    const cacheKey = getCacheKey('bhk_options', [normalizedLocation, normalizedType, intent, normalizedLimit])

    return withCache(cacheKey, async () => {
        try {
            const { data, error } = await applyRentIntentFilter(
                supabase
                    .from('properties')
                    .select('bhk')
                    .eq('is_available', true)
                    .ilike('location', `%${normalizedLocation}%`)
                    .ilike('type', normalizedType)
                    .not('bhk', 'is', null),
                intent,
            )
                .limit(250)

            if (error) {
                throw new Error(`Failed to fetch BHK options: ${error.message}`)
            }

            const unique = new Set<string>()
            for (const row of data ?? []) {
                const value = typeof row.bhk === 'string' ? normalizeBHK(row.bhk) : ''
                if (!value) {
                    continue
                }

                unique.add(value)
            }

            const options = [...unique]
                .sort((left, right) => parseBhkRank(left) - parseBhkRank(right) || left.localeCompare(right))
                .map((value) => ({ value, label: value }))

            if (options.length === 0) {
                return FALLBACK_BHK_OPTIONS.slice(0, normalizedLimit)
            }

            return options.slice(0, normalizedLimit)
        } catch {
            return FALLBACK_BHK_OPTIONS.slice(0, normalizedLimit)
        }
    })
}

export async function getBHKOptionsByIntent(
    location: string,
    type: string,
    limit = DEFAULT_LIMIT,
    intentInput?: string | null,
): Promise<SuggestionOption[]> {
    const normalizedLimit = clampLimit(limit)
    const intent = normalizeIntent(intentInput)

    if (!isValidInputLocation(location) || type.trim().length === 0) {
        return FALLBACK_BHK_OPTIONS.slice(0, normalizedLimit)
    }

    const normalizedLocation = normalizeLocation(location)
    const normalizedType = normalizePropertyType(type) ?? type.trim().toLowerCase()
    const cacheKey = getCacheKey('bhk_options', [normalizedLocation, normalizedType, intent, normalizedLimit])

    return withCache(cacheKey, async () => {
        try {
            const { data, error } = await applyRentIntentFilter(
                supabase
                    .from('properties')
                    .select('bhk')
                    .eq('is_available', true)
                    .ilike('location', `%${normalizedLocation}%`)
                    .ilike('type', normalizedType)
                    .not('bhk', 'is', null),
                intent,
            )
                .limit(250)

            if (error) {
                throw new Error(`Failed to fetch BHK options: ${error.message}`)
            }

            const unique = new Set<string>()
            for (const row of data ?? []) {
                const value = typeof row.bhk === 'string' ? normalizeBHK(row.bhk) : ''
                if (!value) {
                    continue
                }

                unique.add(value)
            }

            const options = [...unique]
                .sort((left, right) => parseBhkRank(left) - parseBhkRank(right) || left.localeCompare(right))
                .map((value) => ({ value, label: value }))

            if (options.length === 0) {
                return FALLBACK_BHK_OPTIONS.slice(0, normalizedLimit)
            }

            return options.slice(0, normalizedLimit)
        } catch {
            return FALLBACK_BHK_OPTIONS.slice(0, normalizedLimit)
        }
    })
}

export function clearSuggestionCache(): void {
    suggestionCache.clear()
}
