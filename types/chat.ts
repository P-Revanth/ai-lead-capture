export enum ChatStep {
    ASK_LANGUAGE = 'ask_language',
    ASK_INTENT = 'ask_intent',
    ASK_LOCATION = 'ask_location',
    ASK_BUDGET = 'ask_budget',
    ASK_PROPERTY_TYPE = 'ask_property_type',
    ASK_CONFIG = 'ask_config',
    ASK_TIMELINE = 'ask_timeline',
    SHOW_RESULTS = 'show_results',
    ASK_NO_RESULTS_ACTION = 'ask_no_results_action',
    CAPTURE_NAME = 'capture_name',
    CAPTURE_PHONE = 'capture_phone',
    ASK_VISIT_DATE = 'ask_visit_date',
    ASK_VISIT_TIME = 'ask_visit_time',
    ESCALATE = 'escalate',
    DONE = 'done',
}

export type Language = 'en' | 'te' | 'hi'
export type Intent = 'buy' | 'rent' | 'explore'
export type PropertyType = 'apartment' | 'villa' | 'plot' | 'commercial'
export type Timeline = 'urgent' | 'soon' | 'flexible'

export interface ChatMessage {
    role: 'user' | 'bot'
    content: string
    timestamp: string
}

export interface CollectedData {
    language?: Language
    intent?: Intent
    location?: string
    budget_min?: number | null
    budget_max?: number | null
    property_type?: PropertyType
    bhk?: string
    timeline?: Timeline
    name?: string
    phone?: string
    visit_date?: string
    visit_time?: string
    status?: string
}

export interface ConversationRecord {
    id: string
    session_id: string
    messages: ChatMessage[]
    step: ChatStep
    collected_data: CollectedData
    created_at: string
}

export interface PropertyResult {
    id: string
    title: string
    location: string
    price: number
    bhk?: string
}

export interface ProcessResult {
    response: string
    requiresEscalation: boolean
    isCompleted: boolean
    properties?: PropertyResult[]
    debug?: ChatDebugInfo
    requestId?: string
}

export interface ChatDebugInfo {
    currentStep: ChatStep
    nextStep: ChatStep
    collectedData: CollectedData
    llmUsed: boolean
    fallbackTriggered: boolean
    decisionReason: string
    rejectedFields: string[]
    retryCount: number
}

export interface ChatApiRequest {
    sessionId: string
    userMessage: string
}

export interface QuickReplyOption {
    label: string
    value: string
}

export interface ChatSuggestionsApiRequest {
    sessionId: string
}

export interface ChatSuggestionsApiResponse {
    step: ChatStep
    language: Language
    options: QuickReplyOption[]
}

export interface ChatApiResponse {
    response: string
    step: ChatStep
    language?: Language
    requiresEscalation: boolean
    isCompleted: boolean
    properties?: PropertyResult[]
    requestId?: string
    debug?: ChatDebugInfo
}
