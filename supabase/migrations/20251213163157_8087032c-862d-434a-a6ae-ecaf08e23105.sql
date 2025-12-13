-- Create a table for WebRTC signaling
CREATE TABLE public.webrtc_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'admin')),
  signal_type TEXT NOT NULL CHECK (signal_type IN ('offer', 'answer', 'ice-candidate')),
  signal_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webrtc_signals ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert signals
CREATE POLICY "Anyone can insert signals"
ON public.webrtc_signals
FOR INSERT
WITH CHECK (true);

-- Allow anyone to view signals
CREATE POLICY "Anyone can view signals"
ON public.webrtc_signals
FOR SELECT
USING (true);

-- Allow anyone to delete old signals
CREATE POLICY "Anyone can delete signals"
ON public.webrtc_signals
FOR DELETE
USING (true);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.webrtc_signals;