import { ChatStep, CollectedData, Language, PropertyType, QuickReplyOption } from '@/types/chat'
import { BudgetRangeSuggestion, getBHKOptionsByIntent, getBudgetRanges, getPropertyTypes, getTopLocationsByIntent } from '@/lib/suggestionService'
import { normalizeLanguage } from '@/lib/prompts'

const MAX_OPTIONS = 5
const DYNAMIC_LIMIT = 4
const WIDE_BUDGET_INPUT = '2000000 to 12000000'

type SupportedLanguage = Language

const LOCATION_LABELS: Record<SupportedLanguage, Record<string, string>> = {
    en: {},
    te: {
        gajuwaka: 'గాజువాక',
        madhurawada: 'మధురవాడ',
        rushikonda: 'రుషికొండ',
        anandapuram: 'ఆనందపురం',
        visakhapatnam: 'విశాఖపట్నం',
    },
    hi: {
        gajuwaka: 'गाजुवाका',
        madhurawada: 'मधुरवाडा',
        rushikonda: 'रुशिकोंडा',
        anandapuram: 'आनंदपुरम',
        visakhapatnam: 'विशाखापट्टनम',
    },
}

const TRANSLATIONS: Record<SupportedLanguage, {
    other: string
    notSure: string
    intent: {
        buy: string
        rent: string
        explore: string
    }
    timeline: {
        immediate: string
        withinThreeMonths: string
        flexible: string
        notSure: string
    }
    propertyTypes: Record<PropertyType, string>
    budget: {
        under: string
        above: string
    }
    noResultsActions: {
        talkToAgent: string
        seeAvailableOptions: string
    }
    visitDate: {
        tomorrow: string
        inTwoDays: string
        thisWeekend: string
        pickDate: string
    }
    visitTime: {
        morning: string
        afternoon: string
        evening: string
        pickTime: string
    }
}> = {
    en: {
        other: 'Other',
        notSure: 'Not sure',
        intent: {
            buy: 'Buy',
            rent: 'Rent',
            explore: 'Explore',
        },
        timeline: {
            immediate: 'Immediate',
            withinThreeMonths: 'Within 3 months',
            flexible: 'Flexible',
            notSure: 'Not sure',
        },
        propertyTypes: {
            apartment: 'Apartment',
            villa: 'Villa',
            plot: 'Plot',
            commercial: 'Commercial',
        },
        budget: {
            under: 'Under',
            above: 'Above',
        },
        noResultsActions: {
            talkToAgent: 'Talk to the agent',
            seeAvailableOptions: 'See available options',
        },
        visitDate: {
            tomorrow: 'Tomorrow',
            inTwoDays: 'In 2 Days',
            thisWeekend: 'This Weekend',
            pickDate: 'Pick Date',
        },
        visitTime: {
            morning: 'Morning (10:00 AM)',
            afternoon: 'Afternoon (2:00 PM)',
            evening: 'Evening (6:00 PM)',
            pickTime: 'Pick Time',
        },
    },
    te: {
        other: 'ఇతర (Other)',
        notSure: 'ఖచ్చితంగా తెలియదు (Not sure)',
        intent: {
            buy: 'కొనుగోలు',
            rent: 'అద్దె',
            explore: 'విచారిస్తున్నాను',
        },
        timeline: {
            immediate: 'తక్షణం',
            withinThreeMonths: '3 నెలల్లో',
            flexible: 'సౌకర్యంగా',
            notSure: 'ఖచ్చితంగా తెలియదు',
        },
        propertyTypes: {
            apartment: 'అపార్ట్‌మెంట్',
            villa: 'విల్లా',
            plot: 'ప్లాట్',
            commercial: 'కమర్షియల్',
        },
        budget: {
            under: 'లోపు',
            above: 'పైగా',
        },
        noResultsActions: {
            talkToAgent: 'ఏజెంట్‌తో మాట్లాడండి',
            seeAvailableOptions: 'అందుబాటులో ఉన్న ఎంపికలు చూడండి',
        },
        visitDate: {
            tomorrow: 'రేపు',
            inTwoDays: '2 రోజుల్లో',
            thisWeekend: 'ఈ వీకెండ్',
            pickDate: 'తేదీ ఎంచుకోండి',
        },
        visitTime: {
            morning: 'ఉదయం 10:00',
            afternoon: 'మధ్యాహ్నం 2:00',
            evening: 'సాయంత్రం 6:00',
            pickTime: 'సమయం ఎంచుకోండి',
        },
    },
    hi: {
        other: 'अन्य (Other)',
        notSure: 'पक्का नहीं (Not sure)',
        intent: {
            buy: 'खरीदना',
            rent: 'किराए पर',
            explore: 'देख रहा हूं',
        },
        timeline: {
            immediate: 'तुरंत',
            withinThreeMonths: '3 महीने में',
            flexible: 'लचीला',
            notSure: 'पक्का नहीं',
        },
        propertyTypes: {
            apartment: 'अपार्टमेंट',
            villa: 'विला',
            plot: 'प्लॉट',
            commercial: 'कमर्शियल',
        },
        budget: {
            under: 'से कम',
            above: 'से अधिक',
        },
        noResultsActions: {
            talkToAgent: 'एजेंट से बात करें',
            seeAvailableOptions: 'उपलब्ध विकल्प देखें',
        },
        visitDate: {
            tomorrow: 'कल',
            inTwoDays: '2 दिन में',
            thisWeekend: 'इस वीकेंड',
            pickDate: 'तारीख चुनें',
        },
        visitTime: {
            morning: 'सुबह 10:00',
            afternoon: 'दोपहर 2:00',
            evening: 'शाम 6:00',
            pickTime: 'समय चुनें',
        },
    },
}

function clampOptions(options: QuickReplyOption[]): QuickReplyOption[] {
    return options.slice(0, MAX_OPTIONS)
}

function dedupeByValue(options: QuickReplyOption[]): QuickReplyOption[] {
    const seen = new Set<string>()
    const result: QuickReplyOption[] = []

    for (const option of options) {
        const normalizedValue = option.value.trim().toLowerCase()
        if (!normalizedValue || seen.has(normalizedValue)) {
            continue
        }

        seen.add(normalizedValue)
        result.push(option)
    }

    return result
}

function formatBudget(value: number): string {
    if (value < 100000) {
        return `Rs ${new Intl.NumberFormat('en-IN').format(value)}`
    }

    if (value >= 10000000) {
        const crore = value / 10000000
        const formatted = Number.isInteger(crore) ? crore.toFixed(0) : crore.toFixed(1)
        return `Rs ${formatted}Cr`
    }

    const lakh = value / 100000
    const formatted = Number.isInteger(lakh) ? lakh.toFixed(0) : lakh.toFixed(1)
    return `Rs ${formatted}L`
}

function toBudgetInputValue(range: BudgetRangeSuggestion): string {
    if (typeof range.min === 'number' && typeof range.max === 'number') {
        return `${range.min} to ${range.max}`
    }

    if (range.min === null && typeof range.max === 'number') {
        const lowerBound = Math.max(1000, Math.floor(range.max * 0.25))
        return `${lowerBound} to ${range.max}`
    }

    if (typeof range.min === 'number' && range.max === null) {
        const growthMultiplier = range.min < 100000 ? 2.5 : 1.8
        const upperBound = Math.round(range.min * growthMultiplier)
        return `${range.min} to ${upperBound}`
    }

    return WIDE_BUDGET_INPUT
}

function toBudgetLabel(range: BudgetRangeSuggestion, language: SupportedLanguage): string {
    const copy = TRANSLATIONS[language].budget

    if (range.min === null && typeof range.max === 'number') {
        return language === 'en'
            ? `${copy.under} ${formatBudget(range.max)}`
            : `${formatBudget(range.max)} ${copy.under}`
    }

    if (typeof range.min === 'number' && typeof range.max === 'number') {
        return `${formatBudget(range.min)} - ${formatBudget(range.max)}`
    }

    if (typeof range.min === 'number' && range.max === null) {
        return language === 'en'
            ? `${copy.above} ${formatBudget(range.min)}`
            : `${formatBudget(range.min)} ${copy.above}`
    }

    return range.label
}

function hasUsableLocation(collectedData: CollectedData): boolean {
    return typeof collectedData.location === 'string' && collectedData.location.trim().length > 0
}

function localizePropertyType(value: string, language: SupportedLanguage): string {
    const normalized = value.trim().toLowerCase() as PropertyType
    const fallback = value.charAt(0).toUpperCase() + value.slice(1)
    return TRANSLATIONS[language].propertyTypes[normalized] ?? fallback
}

function localizeLocationLabel(label: string, value: string, language: SupportedLanguage): string {
    if (language === 'en') {
        return label
    }

    const map = LOCATION_LABELS[language]
    const valueKey = value.trim().toLowerCase()
    const labelKey = label.trim().toLowerCase()

    return map[valueKey] ?? map[labelKey] ?? label
}

function getLanguageOptions(): QuickReplyOption[] {
    return [
        { label: 'English', value: 'English' },
        { label: 'తెలుగు', value: 'తెలుగు' },
        { label: 'हिंदी', value: 'हिंदी' },
    ]
}

function getIntentOptions(language: SupportedLanguage): QuickReplyOption[] {
    const copy = TRANSLATIONS[language].intent
    return [
        { label: copy.buy, value: 'buy' },
        { label: copy.rent, value: 'rent' },
        { label: copy.explore, value: 'explore' },
    ]
}

async function getLocationOptions(collectedData: CollectedData, language: SupportedLanguage): Promise<QuickReplyOption[]> {
    const dynamic = await getTopLocationsByIntent(collectedData.intent, DYNAMIC_LIMIT)
    const options = dynamic.map((entry) => ({
        label: localizeLocationLabel(entry.label, entry.value, language),
        value: entry.value,
    }))

    options.push({
        label: TRANSLATIONS[language].other,
        value: 'Visakhapatnam',
    })

    return clampOptions(dedupeByValue(options))
}

async function getBudgetOptions(collectedData: CollectedData, language: SupportedLanguage): Promise<QuickReplyOption[]> {
    const location = hasUsableLocation(collectedData)
        ? collectedData.location!.trim()
        : 'visakhapatnam'

    const ranges = await getBudgetRanges(location, DYNAMIC_LIMIT, collectedData.intent)
    const options = ranges.map((range) => ({
        label: toBudgetLabel(range, language),
        value: toBudgetInputValue(range),
    }))

    options.push({
        label: TRANSLATIONS[language].notSure,
        value: WIDE_BUDGET_INPUT,
    })

    return clampOptions(dedupeByValue(options))
}

async function getPropertyTypeOptions(collectedData: CollectedData, language: SupportedLanguage): Promise<QuickReplyOption[]> {
    const location = hasUsableLocation(collectedData)
        ? collectedData.location!.trim()
        : 'visakhapatnam'

    const budget = {
        min: collectedData.budget_min ?? null,
        max: collectedData.budget_max ?? null,
    }

    const dynamic = await getPropertyTypes(location, budget, DYNAMIC_LIMIT, collectedData.intent)
    const options = dynamic.map((entry) => ({
        label: localizePropertyType(entry.value, language),
        value: entry.value,
    }))

    options.push({
        label: TRANSLATIONS[language].other,
        value: 'not sure property type',
    })

    return clampOptions(dedupeByValue(options))
}

async function getConfigOptions(collectedData: CollectedData, language: SupportedLanguage): Promise<QuickReplyOption[]> {
    const propertyType = collectedData.property_type
    if (propertyType !== 'apartment' && propertyType !== 'villa') {
        return []
    }

    const location = hasUsableLocation(collectedData)
        ? collectedData.location!.trim()
        : 'visakhapatnam'

    const dynamic = await getBHKOptionsByIntent(location, propertyType, DYNAMIC_LIMIT, collectedData.intent)
    const options = dynamic.map((entry) => ({
        label: entry.label,
        value: entry.value,
    }))

    options.push({
        label: TRANSLATIONS[language].notSure,
        value: 'not sure bhk',
    })

    return clampOptions(dedupeByValue(options))
}

function getTimelineOptions(language: SupportedLanguage): QuickReplyOption[] {
    const copy = TRANSLATIONS[language].timeline
    return [
        { label: copy.immediate, value: 'immediately' },
        { label: copy.withinThreeMonths, value: 'within 3 months' },
        { label: copy.flexible, value: 'flexible' },
        { label: copy.notSure, value: 'not sure' },
    ]
}

function getNoResultsActionOptions(language: SupportedLanguage): QuickReplyOption[] {
    const copy = TRANSLATIONS[language].noResultsActions
    return [
        { label: copy.talkToAgent, value: 'talk to the agent' },
        { label: copy.seeAvailableOptions, value: 'see available options' },
    ]
}

function getVisitDateOptions(language: SupportedLanguage): QuickReplyOption[] {
    const copy = TRANSLATIONS[language].visitDate
    return [
        { label: copy.tomorrow, value: 'tomorrow' },
        { label: copy.inTwoDays, value: 'in 2 days' },
        { label: copy.thisWeekend, value: 'this weekend' },
        { label: copy.pickDate, value: 'pick date' },
    ]
}

function getVisitTimeOptions(language: SupportedLanguage): QuickReplyOption[] {
    const copy = TRANSLATIONS[language].visitTime
    return [
        { label: copy.morning, value: 'morning' },
        { label: copy.afternoon, value: 'afternoon' },
        { label: copy.evening, value: 'evening' },
        { label: copy.pickTime, value: 'pick time' },
    ]
}

export async function getSuggestionOptionsForStep(
    step: ChatStep,
    collectedData: CollectedData,
    language?: string | null,
): Promise<QuickReplyOption[]> {
    const normalizedLanguage = normalizeLanguage(language)

    switch (step) {
        case ChatStep.ASK_LANGUAGE:
            return getLanguageOptions()
        case ChatStep.ASK_INTENT:
            return getIntentOptions(normalizedLanguage)
        case ChatStep.ASK_LOCATION:
            return getLocationOptions(collectedData, normalizedLanguage)
        case ChatStep.ASK_BUDGET:
            return getBudgetOptions(collectedData, normalizedLanguage)
        case ChatStep.ASK_PROPERTY_TYPE:
            return getPropertyTypeOptions(collectedData, normalizedLanguage)
        case ChatStep.ASK_CONFIG:
            return getConfigOptions(collectedData, normalizedLanguage)
        case ChatStep.ASK_TIMELINE:
            return getTimelineOptions(normalizedLanguage)
        case ChatStep.ASK_VISIT_DATE:
            return getVisitDateOptions(normalizedLanguage)
        case ChatStep.ASK_VISIT_TIME:
            return getVisitTimeOptions(normalizedLanguage)
        case ChatStep.ASK_NO_RESULTS_ACTION:
            return getNoResultsActionOptions(normalizedLanguage)
        default:
            return []
    }
}
