# Centralized CSS selectors for claude.ai
# Update these when the UI changes — single source of truth
# Last verified: 2026-03-31

# Chat input area
CHAT_INPUT = 'div[contenteditable="true"].ProseMirror'
CHAT_INPUT_FALLBACK = '[contenteditable="true"]'

# Send button (Portuguese UI: "Enviar mensagem")
SEND_BUTTON = 'button[aria-label="Enviar mensagem"]'
SEND_BUTTON_FALLBACK = 'button[aria-label="Send Message"]'

# Response indicators
RESPONSE_STREAMING = '[data-is-streaming="true"]'
RESPONSE_COMPLETE = '[data-is-streaming="false"]'

# Message containers — use streaming indicator as primary
ASSISTANT_MESSAGE = '[data-is-streaming="false"]'
ASSISTANT_MESSAGE_FALLBACK = '[data-testid*="message"]'

# Message action buttons (appear when response is complete)
COPY_BUTTON = 'button[aria-label="Copy"]'
COPY_BUTTON_FALLBACK = 'button[aria-label="Copiar"]'

# New chat
NEW_CHAT_BUTTON = 'a[href="/new"]'

# Research/search mode — checkbox in model selector dropdown
# The "Pesquisa" toggle is inside the model selector dropdown menu
RESEARCH_TOGGLE = '[role="menuitemcheckbox"]:has(div:text("Pesquisa"))'
RESEARCH_TOGGLE_FALLBACK = '[role="menuitemcheckbox"]:has(div:text("Search"))'

# Login-related
LOGIN_BUTTON = '[data-testid="login-button"]'

# Model selector
MODEL_SELECTOR = '[data-testid="model-selector-dropdown"]'

# User menu
USER_MENU = '[data-testid="user-menu-button"]'

# Sidebar
SIDEBAR_TOGGLE = '[data-testid="pin-sidebar-toggle"]'
