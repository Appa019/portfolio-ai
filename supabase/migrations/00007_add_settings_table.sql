-- User settings (allocation targets, preferences)
CREATE TABLE IF NOT EXISTS user_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text NOT NULL UNIQUE,
    value jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed default allocation targets
INSERT INTO user_settings (key, value) VALUES
    ('allocation_targets', '{"fixed_income": 35, "stocks": 40, "crypto": 25}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all_user_settings ON user_settings
    FOR ALL USING (true) WITH CHECK (true);
