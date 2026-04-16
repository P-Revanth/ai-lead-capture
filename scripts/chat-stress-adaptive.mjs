const base = process.env.CHAT_BASE_URL ?? 'http://localhost:3000'

const stepOrder = [
    'ask_intent',
    'ask_location',
    'ask_budget',
    'ask_property_type',
    'ask_config',
    'ask_timeline',
    'show_results',
    'capture_name',
    'capture_phone',
    'escalate',
    'done',
]

const idx = (step) => stepOrder.indexOf(step)

async function post(sessionId, userMessage) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, userMessage }),
        signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId))

    const text = await response.text()
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text}`)
    }

    try {
        return JSON.parse(text)
    } catch {
        throw new Error(`Non-JSON response: ${text.slice(0, 200)}`)
    }
}

function assertForward(history, name) {
    for (let i = 1; i < history.length; i += 1) {
        const prev = idx(history[i - 1])
        const cur = idx(history[i])
        if (cur < prev) {
            throw new Error(`${name}: regressed ${history[i - 1]} -> ${history[i]} at turn ${i}`)
        }
    }
}

function assertNoIntentLocationLoop(history, name) {
    const a = 'ask_intent|ask_location|ask_intent'
    const b = 'ask_location|ask_intent|ask_location'

    for (let i = 0; i <= history.length - 3; i += 1) {
        const seq = history.slice(i, i + 3).join('|')
        if (seq === a || seq === b) {
            throw new Error(`${name}: detected loop pattern ${history.slice(i, i + 3).join(' -> ')}`)
        }
    }
}

function responseForStep(step, i) {
    switch (step) {
        case 'ask_intent':
            return i % 2 === 0 ? 'Buy' : 'Rent'
        case 'ask_location':
            return ['MVP', 'Madhurawada', 'Gajuwaka'][i % 3]
        case 'ask_budget':
            return i % 2 === 0 ? '40L - 55L' : '3500000-5000000'
        case 'ask_property_type':
            return i % 3 === 0 ? 'Apartment' : 'Villa'
        case 'ask_config':
            return i % 2 === 0 ? '2BHK' : '3BHK'
        case 'ask_timeline':
            return i % 2 === 0 ? 'soon' : 'urgent'
        case 'capture_name':
            return `User${i}`
        case 'capture_phone':
            return `9${String(100000000 + i).slice(0, 9)}`
        default:
            return 'ok'
    }
}

async function runAdaptiveConversation(name, maxTurns = 14) {
    const sessionId = `adaptive-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const history = []

    let data = await post(sessionId, '')
    history.push(data.step)

    for (let turn = 0; turn < maxTurns; turn += 1) {
        const currentStep = data.step
        if (currentStep === 'show_results' || currentStep === 'capture_name' || currentStep === 'done') {
            break
        }

        const input = responseForStep(currentStep, turn)
        data = await post(sessionId, input)
        history.push(data.step)

        if (data.step === 'show_results' || data.step === 'capture_name' || data.step === 'done') {
            break
        }
    }

    assertForward(history, name)
    assertNoIntentLocationLoop(history, name)

    const maxReached = history.reduce((m, s) => Math.max(m, idx(s)), -1)
    if (maxReached < idx('show_results')) {
        throw new Error(`${name}: did not reach show_results within ${maxTurns} turns; history=${history.join(' -> ')}`)
    }

    return history
}

async function runBurst(total) {
    const samples = []
    for (let i = 0; i < total; i += 1) {
        const history = await runAdaptiveConversation(`conv-${i}`)
        if (i < 10) {
            samples.push({ name: `conv-${i}`, history })
        }
        console.log(`Progress: ${i + 1}/${total}`)
    }
    return samples
}

; (async () => {
    const total = 8
    const samples = await runBurst(total)
    console.log('ADAPTIVE STRESS TEST PASSED')
    console.log(`Base URL: ${base}`)
    console.log(`Conversations executed: ${total}`)
    for (const sample of samples) {
        console.log(`${sample.name}: ${sample.history.join(' -> ')}`)
    }
})().catch((error) => {
    console.error('ADAPTIVE STRESS TEST FAILED')
    console.error(error.stack || error.message || error)
    process.exit(1)
})
