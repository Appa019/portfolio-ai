-- Persistent conversation sessions per agent/topic
-- Each agent reuses its own Claude.ai conversation thread
CREATE TABLE IF NOT EXISTS conversation_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_key text NOT NULL UNIQUE,
    conversation_url text NOT NULL,
    agent_name text NOT NULL,
    topic text,
    message_count int NOT NULL DEFAULT 0,
    max_messages int NOT NULL DEFAULT 20,
    last_used_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_sessions_key
    ON conversation_sessions(session_key);

CREATE INDEX IF NOT EXISTS idx_conversation_sessions_last_used
    ON conversation_sessions(last_used_at);

ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all_conversation_sessions ON conversation_sessions
    FOR ALL USING (true) WITH CHECK (true);
