-- Add user_name column to messages table
ALTER TABLE public.messages ADD COLUMN user_name text;

-- Add user_session_id to group messages by user session
ALTER TABLE public.messages ADD COLUMN user_session_id uuid;