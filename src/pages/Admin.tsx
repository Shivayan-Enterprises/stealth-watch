import { useState, useRef, useEffect } from 'react';
import { MapPin, Send, Lock, Users, ArrowLeft, Video, VideoOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWebRTCViewer } from '@/hooks/useWebRTCViewer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  content: string | null;
  image_url: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  sender_role: string;
  user_name: string | null;
  user_session_id: string | null;
}

interface UserSession {
  session_id: string;
  user_name: string;
  last_message: string;
  unread_count: number;
}

const Admin = () => {
  const { toast } = useToast();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [userSessions, setUserSessions] = useState<UserSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showVideo, setShowVideo] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // WebRTC viewer for live video from user
  const { isConnected: videoConnected, isConnecting: videoConnecting } = useWebRTCViewer({
    sessionId: selectedSession,
    videoRef,
  });

  const handleLogin = () => {
    if (username === 'prathmesh' && password === 'pAS2905@') {
      setIsLoggedIn(true);
      localStorage.setItem('admin_logged_in', 'true');
    } else {
      toast({
        title: 'Invalid credentials',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('admin_logged_in');
    if (stored === 'true') {
      setIsLoggedIn(true);
    }
  }, []);


  // Fetch all messages and group by user session
  useEffect(() => {
    if (!isLoggedIn) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }

      const allMessages = (data as Message[]) || [];
      setMessages(allMessages);

      // Group messages by user session
      const sessionMap = new Map<string, UserSession>();
      allMessages.forEach((msg) => {
        if (msg.user_session_id && msg.sender_role === 'user') {
          const existing = sessionMap.get(msg.user_session_id);
          if (existing) {
            existing.last_message = msg.content || 'Image';
          } else {
            sessionMap.set(msg.user_session_id, {
              session_id: msg.user_session_id,
              user_name: msg.user_name || 'Unknown',
              last_message: msg.content || 'Image',
              unread_count: 0,
            });
          }
        }
      });

      setUserSessions(Array.from(sessionMap.values()));
      setIsLoading(false);
    };

    fetchMessages();

    // Realtime subscription
    const channel = supabase
      .channel('admin-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);

          // Update user sessions
          if (newMsg.user_session_id && newMsg.sender_role === 'user') {
            setUserSessions((prev) => {
              const existing = prev.find(s => s.session_id === newMsg.user_session_id);
              if (existing) {
                return prev.map(s =>
                  s.session_id === newMsg.user_session_id
                    ? { ...s, last_message: newMsg.content || 'Image' }
                    : s
                );
              } else {
                return [...prev, {
                  session_id: newMsg.user_session_id!,
                  user_name: newMsg.user_name || 'Unknown',
                  last_message: newMsg.content || 'Image',
                  unread_count: 1,
                }];
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLoggedIn]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedSession]);

  const handleSend = async () => {
    if (!inputValue.trim() || !selectedSession) return;
    
    setIsSending(true);

    const { error } = await supabase.from('messages').insert({
      content: inputValue,
      sender_role: 'admin',
      user_session_id: selectedSession,
      user_name: 'Admin',
    });

    if (error) {
      toast({
        title: 'Failed to send',
        variant: 'destructive',
      });
    } else {
      setInputValue('');
    }

    setIsSending(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_logged_in');
    setIsLoggedIn(false);
    setSelectedSession(null);
  };

  const filteredMessages = selectedSession
    ? messages.filter(m => m.user_session_id === selectedSession)
    : [];

  const selectedUser = userSessions.find(s => s.session_id === selectedSession);

  // Login screen
  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center h-screen bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Lock className="h-12 w-12 mx-auto text-primary mb-2" />
            <CardTitle className="text-2xl">Admin Login</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            <Button onClick={handleLogin} className="w-full">
              Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User list view
  if (!selectedSession) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <header className="p-4 border-b bg-primary text-primary-foreground flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
            <p className="text-sm opacity-80">Select a user to chat</p>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="text-primary-foreground">
            Logout
          </Button>
        </header>

        <ScrollArea className="flex-1 p-4">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">Loading...</div>
          ) : userSessions.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No users have started chatting yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {userSessions.map((session) => (
                <Card
                  key={session.session_id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedSession(session.session_id)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                      {session.user_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{session.user_name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {session.last_message}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    );
  }

  // Chat view with selected user
  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="p-4 border-b bg-primary text-primary-foreground flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedSession(null)}
          className="text-primary-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">{selectedUser?.user_name}</h1>
          <p className="text-xs opacity-80 flex items-center gap-1">
            {videoConnecting ? (
              <>Connecting video...</>
            ) : videoConnected ? (
              <><Video className="h-3 w-3" /> Live video connected</>
            ) : (
              <><VideoOff className="h-3 w-3" /> Waiting for video...</>
            )}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowVideo(!showVideo)}
          className="text-primary-foreground"
        >
          {showVideo ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </Button>
        <Button variant="ghost" onClick={handleLogout} className="text-primary-foreground">
          Logout
        </Button>
      </header>

      {/* Live Video Preview */}
      {showVideo && (
        <div className="p-4 bg-muted/50 border-b">
          <div className="relative aspect-video max-w-sm mx-auto bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {!videoConnected && (
              <div className="absolute inset-0 flex items-center justify-center text-white/70">
                {videoConnecting ? (
                  <div className="animate-pulse">Connecting...</div>
                ) : (
                  <div className="text-center">
                    <VideoOff className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">Waiting for user's camera</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4">
            {filteredMessages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No messages yet</div>
            ) : (
              <div className="space-y-3">
                {filteredMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender_role === 'admin' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs rounded-lg p-3 ${
                        message.sender_role === 'admin'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      {message.image_url && (
                        <img
                          src={message.image_url}
                          alt="Captured"
                          className="rounded-lg w-full mb-2"
                        />
                      )}
                      {message.content && <p>{message.content}</p>}
                      {message.latitude && message.longitude && (
                        <div className="flex items-center gap-1 text-xs mt-1 opacity-70">
                          <MapPin className="h-3 w-3" />
                          <span>
                            {message.latitude.toFixed(4)}, {message.longitude.toFixed(4)}
                          </span>
                        </div>
                      )}
                      <span className="text-xs opacity-50 block mt-1">
                        {new Date(message.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a message..."
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={isSending}
          />
          <Button onClick={handleSend} disabled={isSending || !inputValue.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Admin;