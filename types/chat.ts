export enum ChatStep {
    ASK_INTENT = 'ask_intent',
    ASK_LOCATION = 'ask_location',
    ASK_BUDGET = 'ask_budget',
    ASK_PROPERTY_TYPE = 'ask_property_type',
    ASK_CONFIG = 'ask_config',
    ASK_TIMELINE = 'ask_timeline',
    SHOW_RESULTS = 'show_results',
    CAPTURE_NAME = 'capture_name',
    CAPTURE_PHONE = 'capture_phone',
    ESCALATE = 'escalate',
    DONE = 'done',
}

export type Intent = 'buy' | 'rent' | 'explore'
export type PropertyType = 'apartment' | 'villa' | 'plot' | 'commercial'
export type Timeline = 'urgent' | 'soon' | 'flexible'

export interface ChatMessage {
    role: 'user' | 'bot'
    content: string
    timestamp: string
}

export interface CollectedData {
    intent?: Intent
    location?: string
    budget_min?: number | null
    budget_max?: number | null
    property_type?: PropertyType
    bhk?: string
    timeline?: Timeline
    name?: string
    phone?: string
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

export interface ChatApiResponse {
    response: string
    step: ChatStep
    requiresEscalation: boolean
    isCompleted: boolean
    properties?: PropertyResult[]
    requestId?: string
    debug?: ChatDebugInfo
}
