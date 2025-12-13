-- Add sender_role column to differentiate admin vs user messages
ALTER TABLE public.messages ADD COLUMN sender_role text NOT NULL DEFAULT 'user';

-- Update existing messages to be from 'user'
UPDATE public.messages SET sender_role = 'user' WHERE sender_role IS NULL;