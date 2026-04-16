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

const stepIndex = (step) => stepOrder.indexOf(step)

async function post(sessionId, userMessage) {
    const response = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, userMessage }),
    })

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

function assertForward(history, label) {
    for (let i = 1; i < history.length; i += 1) {
        const prev = stepIndex(history[i - 1])
        const cur = stepIndex(history[i])
        if (cur < prev) {
            throw new Error(`${label}: step regressed ${history[i - 1]} -> ${history[i]} at turn ${i}`)
        }
    }
}

function assertNoAnsweredRepeat(history, answered, label) {
    const answeredSet = new Set(answered)
    for (let i = 1; i < history.length; i += 1) {
        if (history[i] === history[i - 1] && answeredSet.has(history[i])) {
            throw new Error(`${label}: repeated answered step ${history[i]} at turn ${i}`)
        }
    }
}

function assertNoIntentLocationLoop(history, label) {
    const loopPatternA = ['ask_intent', 'ask_location', 'ask_intent']
    const loopPatternB = ['ask_location', 'ask_intent', 'ask_location']

    for (let i = 0; i <= history.length - 3; i += 1) {
        const window = history.slice(i, i + 3)
        if (window.join('|') === loopPatternA.join('|') || window.join('|') === loopPatternB.join('|')) {
            throw new Error(`${label}: detected loop pattern ${window.join(' -> ')} at window ${i}`)
        }
    }
}

async function runScenario(name, turns, expectedMinStep) {
    const sessionId = `stress-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const history = []
    const answeredSteps = []

    const initial = await post(sessionId, '')
    history.push(initial.step)

    for (const turn of turns) {
        const response = await post(sessionId, turn.input)
        history.push(response.step)
        if (turn.answersStep) {
            answeredSteps.push(turn.answersStep)
        }
    }

    assertForward(history, name)
    assertNoAnsweredRepeat(history, answeredSteps, name)
    assertNoIntentLocationLoop(history, name)

    const maxReached = history.reduce((max, step) => Math.max(max, stepIndex(step)), -1)
    if (maxReached < stepIndex(expectedMinStep)) {
        throw new Error(
            `${name}: did not reach ${expectedMinStep}; max reached ${stepOrder[maxReached]} history=${history.join(' -> ')}`,
        )
    }

    return { name, history, final: history[history.length - 1] }
}

async function main() {
    const results = []

    results.push(
        await runScenario(
            'compressed',
            [
                { input: 'I want to buy a 2BHK in MVP', answersStep: 'ask_intent' },
                { input: '40L - 50L', answersStep: 'ask_budget' },
                { input: 'Apartment', answersStep: 'ask_property_type' },
                { input: '2BHK', answersStep: 'ask_config' },
                { input: 'soon', answersStep: 'ask_timeline' },
            ],
            'show_results',
        ),
    )

    results.push(
        await runScenario(
            'explicit',
            [
                { input: 'Buy', answersStep: 'ask_intent' },
                { input: 'MVP', answersStep: 'ask_location' },
                { input: '40L - 50L', answersStep: 'ask_budget' },
                { input: 'Apartment', answersStep: 'ask_property_type' },
                { input: '2BHK', answersStep: 'ask_config' },
                { input: 'urgent', answersStep: 'ask_timeline' },
            ],
            'show_results',
        ),
    )

    results.push(
        await runScenario(
            'invalid-retries',
            [
                { input: 'Buy', answersStep: 'ask_intent' },
                { input: 'MVP', answersStep: 'ask_location' },
                { input: '40L - 50L', answersStep: 'ask_budget' },
                { input: 'Apartment', answersStep: 'ask_property_type' },
                { input: '2BHK', answersStep: 'ask_config' },
                { input: 'blahblah', answersStep: 'ask_timeline' },
                { input: 'stillblah', answersStep: 'ask_timeline' },
            ],
            'show_results',
        ),
    )

    for (let i = 0; i < 100; i += 1) {
        const turnSet = [
            { input: i % 2 === 0 ? 'Buy' : 'Rent', answersStep: 'ask_intent' },
            { input: ['MVP', 'Madhurawada', 'Gajuwaka'][i % 3], answersStep: 'ask_location' },
            { input: i % 3 === 0 ? '35L - 60L' : '4000000-5500000', answersStep: 'ask_budget' },
            { input: i % 4 === 0 ? 'Apartment' : 'Villa', answersStep: 'ask_property_type' },
            { input: i % 4 === 0 ? '2BHK' : '3BHK', answersStep: 'ask_config' },
            { input: i % 3 === 0 ? 'soon' : 'urgent', answersStep: 'ask_timeline' },
        ]

        results.push(await runScenario(`bulk-${i}`, turnSet, 'show_results'))
    }

    console.log('STRESS TEST PASSED')
    console.log(`Base URL: ${base}`)
    console.log(`Scenarios executed: ${results.length}`)
    for (const result of results.slice(0, 10)) {
        console.log(`${result.name}: ${result.history.join(' -> ')}`)
    }
    console.log('...')
    console.log(`Last scenario final step: ${results[results.length - 1].final}`)
}

main().catch((error) => {
    console.error('STRESS TEST FAILED')
    console.error(error.stack || error.message || error)
    process.exit(1)
})
