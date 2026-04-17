import { ChatStep, Language } from '@/types/chat'

const DEFAULT_LANGUAGE: Language = 'en'

type StepPrompts = Record<ChatStep, Record<Language, string>>

export const PROMPTS: StepPrompts = {
    [ChatStep.ASK_LANGUAGE]: {
        en: 'Please choose your preferred language: English, తెలుగు, or हिंदी.',
        te: 'దయచేసి మీకు ఇష్టమైన భాషను ఎంచుకోండి: English, తెలుగు, లేదా हिंदी.',
        hi: 'कृपया अपनी पसंदीदा भाषा चुनें: English, తెలుగు, या हिंदी।',
    },
    [ChatStep.ASK_INTENT]: {
        en: 'Are you looking to buy, rent, or just exploring?',
        te: 'మీరు కొనాలనుకుంటున్నారా, అద్దెకు తీసుకోవాలనుకుంటున్నారా, లేక కేవలం చూస్తున్నారా?',
        hi: 'क्या आप खरीदना चाहते हैं, किराए पर लेना चाहते हैं, या सिर्फ देख रहे हैं?',
    },
    [ChatStep.ASK_LOCATION]: {
        en: 'Which area in Visakhapatnam are you interested in?',
        te: 'విశాఖపట్నంలో మీకు ఏ ప్రాంతం కావాలి?',
        hi: 'विशाखापट्टनम में आपको कौन सा इलाका पसंद है?',
    },
    [ChatStep.ASK_BUDGET]: {
        en: "What's your budget range for this property?",
        te: 'ఈ ప్రాపర్టీకి మీ బడ్జెట్ పరిధి ఎంత?',
        hi: 'इस प्रॉपर्टी के लिए आपका बजट रेंज क्या है?',
    },
    [ChatStep.ASK_PROPERTY_TYPE]: {
        en: 'What type of property are you looking for? (apartment, villa, plot, or commercial)',
        te: 'మీరు ఏ రకమైన ప్రాపర్టీ చూస్తున్నారు? (apartment, villa, plot, లేదా commercial)',
        hi: 'आप किस प्रकार की प्रॉपर्टी चाहते हैं? (apartment, villa, plot, या commercial)',
    },
    [ChatStep.ASK_CONFIG]: {
        en: 'What BHK configuration are you looking for? (e.g., 1BHK, 2BHK, 3BHK)',
        te: 'మీకు ఏ BHK కాన్ఫిగరేషన్ కావాలి? (ఉదా: 1BHK, 2BHK, 3BHK)',
        hi: 'आपको कौन सा BHK कॉन्फ़िगरेशन चाहिए? (जैसे 1BHK, 2BHK, 3BHK)',
    },
    [ChatStep.ASK_TIMELINE]: {
        en: 'When are you planning to make a decision? (urgent, soon, or flexible)',
        te: 'మీరు ఎప్పుడు నిర్ణయం తీసుకోవాలనుకుంటున్నారు? (urgent, soon, లేదా flexible)',
        hi: 'आप कब निर्णय लेने की योजना बना रहे हैं? (urgent, soon, या flexible)',
    },
    [ChatStep.SHOW_RESULTS]: {
        en: 'Let me check matching properties for you.',
        te: 'మీ కోసం సరిపడే ప్రాపర్టీలను చూసి చెబుతాను.',
        hi: 'मैं आपके लिए उपयुक्त प्रॉपर्टीज़ देखता हूं।',
    },
    [ChatStep.ASK_NO_RESULTS_ACTION]: {
        en: 'No exact matches found. Would you like to talk to the agent or see available options in this area?',
        te: 'సరిగ్గా సరిపోయే ఫలితాలు లేవు. మీరు ఏజెంట్‌తో మాట్లాడాలనుకుంటున్నారా లేదా ఈ ప్రాంతంలో అందుబాటులో ఉన్న ఎంపికలను చూడాలనుకుంటున్నారా?',
        hi: 'सटीक मैच नहीं मिले। क्या आप एजेंट से बात करना चाहेंगे या इस इलाके में उपलब्ध विकल्प देखना चाहेंगे?',
    },
    [ChatStep.CAPTURE_NAME]: {
        en: 'May I have your name?',
        te: 'మీ పేరు చెప్పగలరా?',
        hi: 'क्या मैं आपका नाम जान सकता हूं?',
    },
    [ChatStep.CAPTURE_PHONE]: {
        en: 'Please share your phone number so the agent can contact you.',
        te: 'ఏజెంట్ మిమ్మల్ని సంప్రదించడానికి మీ ఫోన్ నంబర్ ఇవ్వండి.',
        hi: 'कृपया अपना फोन नंबर साझा करें ताकि एजेंट आपसे संपर्क कर सके।',
    },
    [ChatStep.ESCALATE]: {
        en: 'I will connect you with our human agent now.',
        te: 'ఇప్పుడు మిమ్మల్ని మా హ్యూమన్ ఏజెంట్‌తో కలుపుతాను.',
        hi: 'मैं अब आपको हमारे मानव एजेंट से जोड़ता हूं।',
    },
    [ChatStep.DONE]: {
        en: 'Thank you for using our service! A representative will contact you shortly.',
        te: 'మా సేవను ఉపయోగించినందుకు ధన్యవాదాలు! ప్రతినిధి త్వరలో మిమ్మల్ని సంప్రదిస్తారు.',
        hi: 'हमारी सेवा का उपयोग करने के लिए धन्यवाद! एक प्रतिनिधि जल्द ही आपसे संपर्क करेगा।',
    },
}

const SHOW_RESULTS_CTA_PROMPTS: Record<Language, string> = {
    en: 'Would you like to schedule a visit or talk to the agent?',
    te: 'మీరు సైట్ విజిట్ షెడ్యూల్ చేయాలనుకుంటున్నారా లేదా ఏజెంట్‌తో మాట్లాడాలనుకుంటున్నారా?',
    hi: 'क्या आप विजिट शेड्यूल करना चाहेंगे या एजेंट से बात करना चाहेंगे?',
}

const SHOW_RESULTS_ACTION_OPTIONS: Record<Language, [string, string]> = {
    en: ['Schedule a visit', 'Talk to the agent'],
    te: ['సైట్ విజిట్ షెడ్యూల్ చేయండి (Schedule a visit)', 'ఏజెంట్‌తో మాట్లాడండి (Talk to the agent)'],
    hi: ['विजिट शेड्यूल करें (Schedule a visit)', 'एजेंट से बात करें (Talk to the agent)'],
}

const NO_RESULTS_ACTION_OPTIONS: Record<Language, [string, string]> = {
    en: ['Talk to the agent', 'See available options'],
    te: ['ఏజెంట్‌తో మాట్లాడండి (Talk to the agent)', 'అందుబాటులో ఉన్న ఎంపికలు చూడండి (See available options)'],
    hi: ['एजेंट से बात करें (Talk to the agent)', 'उपलब्ध विकल्प देखें (See available options)'],
}

const RESTART_SESSION_PROMPTS: Record<Language, string> = {
    en: 'This session is complete. Please start a new session by clicking the "+" button at the top.',
    te: 'ఈ సెషన్ పూర్తైంది. పై భాగంలో ఉన్న "+" బటన్‌పై క్లిక్ చేసి కొత్త సెషన్ ప్రారంభించండి.',
    hi: 'यह सत्र पूरा हो चुका है। कृपया ऊपर दिए गए "+" बटन पर क्लिक करके नया सत्र शुरू करें।',
}

export function normalizeLanguage(language?: string | null): Language {
    if (language === 'te' || language === 'hi' || language === 'en') {
        return language
    }

    return DEFAULT_LANGUAGE
}

export function getPrompt(step: ChatStep, language?: string | null): string {
    const normalizedLanguage = normalizeLanguage(language)
    return PROMPTS[step][normalizedLanguage] ?? PROMPTS[step][DEFAULT_LANGUAGE]
}

export function getShowResultsCta(language?: string | null): string {
    const normalizedLanguage = normalizeLanguage(language)
    return SHOW_RESULTS_CTA_PROMPTS[normalizedLanguage] ?? SHOW_RESULTS_CTA_PROMPTS[DEFAULT_LANGUAGE]
}

export function getShowResultsActionOptions(language?: string | null): [string, string] {
    const normalizedLanguage = normalizeLanguage(language)
    return SHOW_RESULTS_ACTION_OPTIONS[normalizedLanguage] ?? SHOW_RESULTS_ACTION_OPTIONS[DEFAULT_LANGUAGE]
}

export function getRestartSessionPrompt(language?: string | null): string {
    const normalizedLanguage = normalizeLanguage(language)
    return RESTART_SESSION_PROMPTS[normalizedLanguage] ?? RESTART_SESSION_PROMPTS[DEFAULT_LANGUAGE]
}

export function getNoResultsActionPrompt(language?: string | null, location?: string | null): string {
    const normalizedLanguage = normalizeLanguage(language)
    const hasLocation = !!location && location.trim().length > 0

    if (normalizedLanguage === 'te') {
        if (hasLocation) {
            return `సరిగ్గా సరిపోయే ఫలితాలు లేవు, కానీ మా ఏజెంట్ మిమ్మల్ని ఇంకా బాగా సహాయపడగలరు. ${location}లో అందుబాటులో ఉన్న ఎంపికలు చూడాలా లేక ఏజెంట్‌తో మాట్లాడాలా?`
        }
        return 'సరిగ్గా సరిపోయే ఫలితాలు లేవు, కానీ మా ఏజెంట్ మిమ్మల్ని ఇంకా బాగా సహాయపడగలరు. అందుబాటులో ఉన్న ఎంపికలు చూడాలా లేక ఏజెంట్‌తో మాట్లాడాలా?'
    }

    if (normalizedLanguage === 'hi') {
        if (hasLocation) {
            return `सटीक मैच नहीं मिले, लेकिन हमारा एजेंट आपकी आगे मदद कर सकता है। क्या आप ${location} में उपलब्ध विकल्प देखना चाहेंगे या एजेंट से बात करना चाहेंगे?`
        }
        return 'सटीक मैच नहीं मिले, लेकिन हमारा एजेंट आपकी आगे मदद कर सकता है। क्या आप उपलब्ध विकल्प देखना चाहेंगे या एजेंट से बात करना चाहेंगे?'
    }

    if (hasLocation) {
        return `No exact matches found, but our agent can help you further. Would you like to see available options in ${location} or talk to the agent?`
    }
    return 'No exact matches found, but our agent can help you further. Would you like to see available options or talk to the agent?'
}

export function getLocalizedQuickReplies(step: ChatStep | null, language?: string | null): string[] {
    const normalizedLanguage = normalizeLanguage(language)

    if (step === null || step === ChatStep.ASK_LANGUAGE) {
        return ['English', 'తెలుగు', 'हिंदी']
    }

    if (step === ChatStep.ASK_INTENT) {
        if (normalizedLanguage === 'te') {
            return ['కొనుగోలు (Buy)', 'అద్దె (Rent)', 'విచారిస్తున్నాను (Exploring)']
        }
        if (normalizedLanguage === 'hi') {
            return ['खरीदना (Buy)', 'किराए पर (Rent)', 'देख रहा हूं (Exploring)']
        }
        return ['Buy', 'Rent', 'Exploring']
    }

    if (step === ChatStep.ASK_PROPERTY_TYPE) {
        if (normalizedLanguage === 'te') {
            return ['అపార్ట్‌మెంట్ (Apartment)', 'విల్లా (Villa)', 'ప్లాట్ (Plot)', 'కమర్షియల్ (Commercial)']
        }
        if (normalizedLanguage === 'hi') {
            return ['अपार्टमेंट (Apartment)', 'विला (Villa)', 'प्लॉट (Plot)', 'कमर्शियल (Commercial)']
        }
        return ['Apartment', 'Villa', 'Plot', 'Commercial']
    }

    if (step === ChatStep.ASK_TIMELINE) {
        if (normalizedLanguage === 'te') {
            return ['తక్షణం (Urgent)', 'త్వరలో (Soon)', 'సౌకర్యంగా (Flexible)']
        }
        if (normalizedLanguage === 'hi') {
            return ['तुरंत (Urgent)', 'जल्द (Soon)', 'लचीला (Flexible)']
        }
        return ['Urgent', 'Soon', 'Flexible']
    }

    if (step === ChatStep.ASK_NO_RESULTS_ACTION) {
        const [talkToAgent, seeAvailableOptions] = NO_RESULTS_ACTION_OPTIONS[normalizedLanguage] ?? NO_RESULTS_ACTION_OPTIONS[DEFAULT_LANGUAGE]
        return [talkToAgent, seeAvailableOptions]
    }

    return []
}

export function getResultsSummaryPrompt(count: number, language?: string | null, location?: string | null): string {
    const normalizedLanguage = normalizeLanguage(language)
    const hasLocation = !!location && location.trim().length > 0

    if (count === 0) {
        if (normalizedLanguage === 'te') {
            return 'సరిగ్గా సరిపోయే ఫలితాలు లేవు, కానీ మా ఏజెంట్ మిమ్మల్ని ఇంకా బాగా సహాయపడగలరు.'
        }
        if (normalizedLanguage === 'hi') {
            return 'सटीक मैच नहीं मिले, लेकिन हमारा एजेंट आपकी आगे मदद कर सकता है।'
        }
        return 'No exact matches found, but the agent can help you further.'
    }

    if (hasLocation) {
        if (normalizedLanguage === 'te') {
            return `చాలా బాగుంది! మీ అవసరాలకు సరిపోయే ${count} ప్రాపర్టీలు ${location}లో కనుగొన్నాను.`
        }
        if (normalizedLanguage === 'hi') {
            return `बहुत बढ़िया! आपकी ज़रूरतों के अनुसार ${location} में ${count} प्रॉपर्टीज़ मिलीं।`
        }
        return `Great! I found ${count} properties in ${location} matching your criteria.`
    }

    if (normalizedLanguage === 'te') {
        return `చాలా బాగుంది! మీ అవసరాలకు సరిపోయే ${count} ప్రాపర్టీలు కనుగొన్నాను.`
    }
    if (normalizedLanguage === 'hi') {
        return `बहुत बढ़िया! आपकी ज़रूरतों के अनुसार ${count} प्रॉपर्टीज़ मिलीं।`
    }
    return `Great! I found ${count} properties matching your criteria.`
}
