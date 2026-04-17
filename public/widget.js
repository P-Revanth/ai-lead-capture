(function () {
    'use strict'

    if (window.__CHAT_WIDGET_LOADED__) {
        return
    }
    window.__CHAT_WIDGET_LOADED__ = true

    var DEFAULT_BASE_URL = 'https://ai-lead-capture-two.vercel.app'
    var SESSION_STORAGE_KEY = 'chat_session_id'
    var OPEN_STORAGE_KEY = 'chat_widget_open'
    var MOBILE_BREAKPOINT = 768

    var config = window.ChatWidgetConfig || {}
    var themeColor = typeof config.themeColor === 'string' && config.themeColor.trim()
        ? config.themeColor.trim()
        : '#111827'
    var agentId = typeof config.agentId === 'string' ? config.agentId : ''
    var buttonText = typeof config.buttonText === 'string' && config.buttonText.trim()
        ? config.buttonText.trim()
        : 'Chat'
    var baseUrl = typeof config.baseUrl === 'string' && config.baseUrl.trim()
        ? config.baseUrl.trim().replace(/\/+$/, '')
        : DEFAULT_BASE_URL
    var onOpen = typeof config.onOpen === 'function' ? config.onOpen : null
    var onClose = typeof config.onClose === 'function' ? config.onClose : null

    function setStyles(element, styles) {
        var keys = Object.keys(styles)
        for (var i = 0; i < keys.length; i += 1) {
            element.style[keys[i]] = styles[keys[i]]
        }
    }

    function createSessionId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID()
        }

        return 'session-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10)
    }

    function getOrCreateSessionId() {
        try {
            var existing = window.localStorage.getItem(SESSION_STORAGE_KEY)
            if (existing) {
                return existing
            }

            var sessionId = createSessionId()
            window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId)
            return sessionId
        } catch {
            return createSessionId()
        }
    }

    function getSavedOpenState() {
        try {
            return window.localStorage.getItem(OPEN_STORAGE_KEY) === '1'
        } catch {
            return false
        }
    }

    function saveOpenState(isOpen) {
        try {
            window.localStorage.setItem(OPEN_STORAGE_KEY, isOpen ? '1' : '0')
        } catch {
            // no-op for restricted storage contexts
        }
    }

    function buildIframeSrc(sessionId) {
        var url

        try {
            url = new URL(baseUrl + '/embed')
        } catch {
            url = new URL(DEFAULT_BASE_URL + '/embed')
        }

        url.searchParams.set('sessionId', sessionId)

        if (agentId) {
            url.searchParams.set('agentId', agentId)
        }

        return url.toString()
    }

    function invokeLifecycleCallback(callback, detail) {
        if (typeof callback !== 'function') {
            return
        }

        try {
            callback(detail)
        } catch {
            // no-op to avoid host-page breakage from callback errors
        }
    }

    function mountWidget() {
        if (document.getElementById('chat-widget-root')) {
            return
        }

        var sessionId = getOrCreateSessionId()
        var isOpen = getSavedOpenState()

        var root = document.createElement('div')
        root.id = 'chat-widget-root'
        setStyles(root, {
            all: 'initial',
            position: 'fixed',
            right: '20px',
            bottom: '20px',
            zIndex: '2147483647',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        })

        var panel = document.createElement('div')
        panel.setAttribute('aria-hidden', 'true')
        setStyles(panel, {
            position: 'fixed',
            right: '20px',
            bottom: '84px',
            width: '350px',
            height: '500px',
            backgroundColor: '#ffffff',
            border: '1px solid #e4e4e7',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18)',
            opacity: '0',
            visibility: 'hidden',
            transform: 'translateY(8px)',
            transition: 'opacity 160ms ease, transform 160ms ease, visibility 160ms ease',
            pointerEvents: 'none'
        })

        var iframe = document.createElement('iframe')
        iframe.src = buildIframeSrc(sessionId)
        iframe.title = 'Chat assistant'
        iframe.loading = 'lazy'
        iframe.referrerPolicy = 'strict-origin-when-cross-origin'
        setStyles(iframe, {
            display: 'block',
            width: '100%',
            height: '100%',
            border: '0',
            backgroundColor: '#ffffff'
        })
        panel.appendChild(iframe)

        var button = document.createElement('button')
        button.type = 'button'
        button.setAttribute('aria-label', 'Open chat')
        setStyles(button, {
            appearance: 'none',
            border: '0',
            margin: '0',
            width: '56px',
            height: '56px',
            borderRadius: '9999px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backgroundColor: themeColor,
            color: '#ffffff',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.24)',
            fontSize: '14px',
            fontWeight: '600',
            lineHeight: '1'
        })

        var icon = document.createElement('span')
        icon.setAttribute('aria-hidden', 'true')
        icon.textContent = buttonText
        setStyles(icon, {
            userSelect: 'none',
            letterSpacing: '0.01em'
        })
        button.appendChild(icon)

        function applyResponsiveStyles() {
            if (window.innerWidth < MOBILE_BREAKPOINT) {
                setStyles(panel, {
                    top: '0',
                    right: '0',
                    bottom: '0',
                    left: '0',
                    width: '100vw',
                    height: '100vh',
                    border: '0',
                    borderRadius: '0'
                })
                return
            }

            setStyles(panel, {
                top: 'auto',
                left: 'auto',
                right: '20px',
                bottom: '84px',
                width: '350px',
                height: '500px',
                border: '1px solid #e4e4e7',
                borderRadius: '16px'
            })
        }

        function setOpenState(nextOpen) {
            var options = arguments.length > 1 ? arguments[1] : null
            var emitLifecycleEvent = !options || options.emitLifecycleEvent !== false
            isOpen = !!nextOpen

            if (isOpen) {
                setStyles(panel, {
                    opacity: '1',
                    visibility: 'visible',
                    transform: 'translateY(0)',
                    pointerEvents: 'auto'
                })
                panel.setAttribute('aria-hidden', 'false')
                button.setAttribute('aria-label', 'Close chat')
            } else {
                setStyles(panel, {
                    opacity: '0',
                    visibility: 'hidden',
                    transform: 'translateY(8px)',
                    pointerEvents: 'none'
                })
                panel.setAttribute('aria-hidden', 'true')
                button.setAttribute('aria-label', 'Open chat')
            }

            saveOpenState(isOpen)

            if (!emitLifecycleEvent) {
                return
            }

            var detail = {
                sessionId: sessionId,
                agentId: agentId || null,
                isOpen: isOpen,
                root: root,
                panel: panel,
                button: button,
                iframe: iframe
            }

            if (isOpen) {
                invokeLifecycleCallback(onOpen, detail)
            } else {
                invokeLifecycleCallback(onClose, detail)
            }
        }

        button.addEventListener('click', function () {
            setOpenState(!isOpen)
        })

        window.addEventListener('resize', applyResponsiveStyles)

        root.appendChild(panel)
        root.appendChild(button)
        document.body.appendChild(root)

        applyResponsiveStyles()
        setOpenState(isOpen, { emitLifecycleEvent: false })
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountWidget, { once: true })
    } else {
        mountWidget()
    }
})()
