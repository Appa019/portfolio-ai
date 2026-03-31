# Centralized CSS selectors for claude.ai
# Update these when the UI changes — single source of truth

# Chat input area
CHAT_INPUT = 'div[contenteditable="true"].ProseMirror'
CHAT_INPUT_FALLBACK = '[contenteditable="true"]'

# Send button
SEND_BUTTON = 'button[aria-label="Send Message"]'
SEND_BUTTON_FALLBACK = 'button[type="submit"]'

# Response indicators
RESPONSE_STREAMING = '[data-is-streaming="true"]'
RESPONSE_COMPLETE = '[data-is-streaming="false"]'

# Message containers
ASSISTANT_MESSAGE = '[data-testid="assistant-message"]'
ASSISTANT_MESSAGE_FALLBACK = "div.font-claude-message"

# Message action buttons (appear when response is complete)
MESSAGE_ACTIONS = '[data-testid="message-actions"]'
COPY_BUTTON = 'button[aria-label="Copy"]'

# New chat
NEW_CHAT_BUTTON = 'a[href="/new"]'

# Research/search mode toggle
RESEARCH_TOGGLE = 'button[aria-label="Search"]'
RESEARCH_TOGGLE_FALLBACK = '[data-testid="search-toggle"]'

# Login-related
LOGIN_BUTTON = '[data-testid="login-button"]'
GOOGLE_LOGIN_BUTTON = 'button:has-text("Continue with Google")'

# Google OAuth selectors
GOOGLE_EMAIL_INPUT = 'input[type="email"]'
GOOGLE_PASSWORD_INPUT = 'input[type="password"]'
GOOGLE_NEXT_BUTTON = "#identifierNext"
GOOGLE_PASSWORD_NEXT = "#passwordNext"

# Model selector
MODEL_SELECTOR = '[data-testid="model-selector"]'

# Navigation
SIDEBAR = 'nav[aria-label="Chat history"]'
