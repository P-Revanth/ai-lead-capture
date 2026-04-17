import { supabase } from '@/lib/supabaseClient'
import { LogContext, logEvent } from '@/lib/logger'

export interface PropertyFilter {
    location?: string | null
    budget_min?: number | null
    budget_max?: number | null
    property_type?: string
    bhk?: string
}

export interface PropertyResult {
    id: string
    title: string
    location: string
    price: number
    bhk?: string
}

export interface PropertyTraceContext extends LogContext {
    debugMode?: boolean
}

function hasBudgetConstraint(filters: PropertyFilter): boolean {
    return typeof filters.budget_min === 'number' || typeof filters.budget_max === 'number'
}

/**
 * Validates location before filtering.
 * Returns true if location is viable for filtering.
 */
export function isValidLocation(location: string | undefined | null): boolean {
    if (!location) return false
    const trimmed = location.trim()
    if (trimmed.length < 3) return false
    const generic = ['anywhere', 'all', 'vizag', 'visakhapatnam', 'unknown']
    return !generic.includes(trimmed.toLowerCase())
}

/**
 * Normalizes bhk input: removes whitespace, converts to uppercase.
 */
function normalizeBhk(bhk: string | undefined): string | undefined {
    if (!bhk) return undefined
    return bhk.replace(/\s+/g, '').toUpperCase()
}

/**
 * Builds initial query with all applicable filters.
 */
function buildInitialQuery(filters: PropertyFilter) {
    let query = supabase.from('properties').select('id,title,location,price,bhk').eq('is_available', true)

    if (isValidLocation(filters.location)) {
        query = query.ilike('location', `%${filters.location}%`)
    }

    if (filters.property_type) {
        query = query.eq('type', filters.property_type)
    }

    if (typeof filters.budget_max === 'number') {
        query = query.lte('price', filters.budget_max)
    }

    if (typeof filters.budget_min === 'number') {
        query = query.gte('price', filters.budget_min)
    }

    const normalizedBhk = normalizeBhk(filters.bhk)
    if (normalizedBhk) {
        // Match after normalizing the DB value
        query = query.filter('bhk', 'eq', normalizedBhk)
    }

    return query.order('created_at', { ascending: false }).limit(5)
}

/**
 * Retry 1: Remove bhk filter.
 */
function buildRetry1Query(filters: PropertyFilter) {
    let query = supabase.from('properties').select('id,title,location,price,bhk').eq('is_available', true)

    if (isValidLocation(filters.location)) {
        query = query.ilike('location', `%${filters.location}%`)
    }

    if (filters.property_type) {
        query = query.eq('type', filters.property_type)
    }

    if (typeof filters.budget_max === 'number') {
        query = query.lte('price', filters.budget_max)
    }

    if (typeof filters.budget_min === 'number') {
        query = query.gte('price', filters.budget_min)
    }

    return query.order('created_at', { ascending: false }).limit(5)
}

/**
 * Retry 2: Remove price filters.
 */
function buildRetry2Query(filters: PropertyFilter) {
    let query = supabase.from('properties').select('id,title,location,price,bhk').eq('is_available', true)

    if (isValidLocation(filters.location)) {
        query = query.ilike('location', `%${filters.location}%`)
    }

    if (filters.property_type) {
        query = query.eq('type', filters.property_type)
    }

    return query.order('created_at', { ascending: false }).limit(5)
}

/**
 * Retry 3: Return latest 5 available properties (minimal filtering).
 */
function buildRetry3Query() {
    return supabase.from('properties').select('id,title,location,price,bhk').eq('is_available', true).order('created_at', { ascending: false }).limit(5)
}

/**
 * Deterministic query to fetch matching properties with fallback retry strategy.
 *
 * Algorithm:
 * 1. Try query with all applicable filters
 * 2. If 0 results: Retry without bhk filter
 * 3. If still 0: Retry without price filters
 * 4. If still 0: Return latest 5 available properties
 *
 * @param filters - Conditional filter criteria (location already validated)
 * @returns Promise<PropertyResult[]> - Up to 5 matching properties
 */
export async function getMatchingProperties(
    filters: PropertyFilter,
    sessionId?: string,
    trace?: PropertyTraceContext,
): Promise<PropertyResult[]> {
    const startedAt = Date.now()
    const budgetConstrained = hasBudgetConstraint(filters)

    try {
        if (trace) {
            logEvent({
                ...trace,
                event: 'property_query_executed',
                level: 'info',
                data: {
                    stage: 'initial',
                    filters: {
                        location: filters.location,
                        budget_min: filters.budget_min,
                        budget_max: filters.budget_max,
                        property_type: filters.property_type,
                        bhk: filters.bhk,
                    },
                    sessionId,
                },
                decisionReason: 'property_query_initial',
            })
        }

        const { data, error } = await buildInitialQuery(filters)

        if (error) {
            throw new Error(`Initial query failed: ${error.message}`)
        }

        const properties = (data ?? []).map((row) => ({
            id: row.id,
            title: row.title,
            location: row.location,
            price: row.price,
            bhk: row.bhk ?? undefined,
        }))

        if (trace) {
            logEvent({
                ...trace,
                event: 'property_query_result',
                level: 'info',
                data: {
                    stage: 'initial',
                    count: properties.length,
                    maxResults: 5,
                    property_query_duration_ms: Date.now() - startedAt,
                    filters_applied: {
                        location: isValidLocation(filters.location),
                        budget_min: typeof filters.budget_min === 'number',
                        budget_max: typeof filters.budget_max === 'number',
                        property_type: !!filters.property_type,
                        bhk: !!filters.bhk,
                    },
                },
                decisionReason: properties.length > 0 ? 'property_query_initial_success' : 'property_query_initial_empty',
            })
        }

        if (properties.length > 0) {
            return properties
        }

        // Retry 1: Remove bhk filter
        if (trace) {
            logEvent({
                ...trace,
                event: 'property_query_executed',
                level: 'warn',
                data: { stage: 'retry_1_remove_bhk', sessionId },
                decisionReason: 'property_query_retry_remove_bhk',
            })
        }

        const { data: data1, error: error1 } = await buildRetry1Query(filters)

        if (error1) {
            throw new Error(`Retry 1 failed: ${error1.message}`)
        }

        const retry1Properties = (data1 ?? []).map((row) => ({
            id: row.id,
            title: row.title,
            location: row.location,
            price: row.price,
            bhk: row.bhk ?? undefined,
        }))

        if (trace) {
            logEvent({
                ...trace,
                event: 'property_query_result',
                level: 'info',
                data: {
                    stage: 'retry_1_remove_bhk',
                    count: retry1Properties.length,
                    property_query_duration_ms: Date.now() - startedAt,
                    filters_now_applied: {
                        location: isValidLocation(filters.location),
                        budget_min: typeof filters.budget_min === 'number',
                        budget_max: typeof filters.budget_max === 'number',
                        property_type: !!filters.property_type,
                        bhk: false,
                    },
                },
                decisionReason: retry1Properties.length > 0 ? 'property_query_retry_remove_bhk_success' : 'property_query_retry_remove_bhk_empty',
            })
        }

        if (retry1Properties.length > 0) {
            return retry1Properties
        }

        if (budgetConstrained) {
            if (trace) {
                logEvent({
                    ...trace,
                    event: 'property_query_result',
                    level: 'info',
                    data: {
                        stage: 'budget_strict_exit',
                        count: 0,
                        property_query_duration_ms: Date.now() - startedAt,
                        filters_now_applied: {
                            location: isValidLocation(filters.location),
                            budget_min: typeof filters.budget_min === 'number',
                            budget_max: typeof filters.budget_max === 'number',
                            property_type: !!filters.property_type,
                            bhk: false,
                        },
                    },
                    decisionReason: 'property_query_budget_strict_no_match',
                })
            }

            return []
        }

        // Retry 2: Remove price filters
        if (trace) {
            logEvent({
                ...trace,
                event: 'property_query_executed',
                level: 'warn',
                data: { stage: 'retry_2_remove_price', sessionId },
                decisionReason: 'property_query_retry_remove_price',
            })
        }

        const { data: data2, error: error2 } = await buildRetry2Query(filters)

        if (error2) {
            throw new Error(`Retry 2 failed: ${error2.message}`)
        }

        const retry2Properties = (data2 ?? []).map((row) => ({
            id: row.id,
            title: row.title,
            location: row.location,
            price: row.price,
            bhk: row.bhk ?? undefined,
        }))

        if (trace) {
            logEvent({
                ...trace,
                event: 'property_query_result',
                level: 'info',
                data: {
                    stage: 'retry_2_remove_price',
                    count: retry2Properties.length,
                    property_query_duration_ms: Date.now() - startedAt,
                    filters_now_applied: {
                        location: isValidLocation(filters.location),
                        budget_min: false,
                        budget_max: false,
                        property_type: !!filters.property_type,
                        bhk: false,
                    },
                },
                decisionReason: retry2Properties.length > 0 ? 'property_query_retry_remove_price_success' : 'property_query_retry_remove_price_empty',
            })
        }

        if (retry2Properties.length > 0) {
            return retry2Properties
        }

        // Retry 3: Return latest available properties
        if (trace) {
            logEvent({
                ...trace,
                event: 'property_query_executed',
                level: 'warn',
                data: { stage: 'retry_3_latest_available', sessionId },
                decisionReason: 'property_query_retry_latest_available',
            })
        }

        const { data: data3, error: error3 } = await buildRetry3Query()

        if (error3) {
            throw new Error(`Retry 3 failed: ${error3.message}`)
        }

        const retry3Properties = (data3 ?? []).map((row) => ({
            id: row.id,
            title: row.title,
            location: row.location,
            price: row.price,
            bhk: row.bhk ?? undefined,
        }))

        if (trace) {
            logEvent({
                ...trace,
                event: 'property_query_result',
                level: 'info',
                data: {
                    stage: 'retry_3_latest_available',
                    count: retry3Properties.length,
                    property_query_duration_ms: Date.now() - startedAt,
                    filters_now_applied: {
                        location: false,
                        budget_min: false,
                        budget_max: false,
                        property_type: false,
                        bhk: false,
                    },
                },
                decisionReason: 'property_query_retry_latest_available_success',
            })
        }

        return retry3Properties
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error during property query'
        if (trace) {
            logEvent({
                ...trace,
                event: 'property_query_result',
                level: 'error',
                data: {
                    error: message,
                    sessionId,
                    returnedEmptyArray: true,
                    property_query_duration_ms: Date.now() - startedAt,
                },
                decisionReason: 'property_query_failed',
            })
        }

        // Return empty array on error - caller will handle fallback message
        return []
    }
}
