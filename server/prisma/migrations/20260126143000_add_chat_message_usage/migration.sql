-- Alter chat_messages to include token tracking
ALTER TABLE chat_messages
  ADD COLUMN prompt_tokens INT DEFAULT 0,
  ADD COLUMN completion_tokens INT DEFAULT 0,
  ADD COLUMN total_tokens INT DEFAULT 0,
  ADD COLUMN cost_usd DECIMAL(10,6) DEFAULT 0;

