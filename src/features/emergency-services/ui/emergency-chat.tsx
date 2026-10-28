'use client';

import { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Send, Phone, ArrowLeft, AlertTriangle } from 'lucide-react';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { cn } from '@/shared/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card';
import { useToast } from '@/shared/hooks/use-toast';
import { TransportManager } from '@/core/transport/transport-manager';

interface EmergencyMessage {
  id: string;
  name: string;
  avatar: string;
  text: string;
  time: string;
  isSender: boolean;
}

const initialMessages: EmergencyMessage[] = [
  {
    id: '1',
    name: 'Система Treeline SOS',
    avatar: '',
    text: 'Экстренный канал связи открыт. Сообщения транслируются спасателям и участникам группы по mesh-сети и интернет-шлюзу. В критической ситуации незамедлительно вызывайте 112.',
    time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    isSender: false,
  },
];

type EmergencyChatProps = {
  onBack: () => void;
};

export default function EmergencyChat({ onBack }: EmergencyChatProps) {
  const { toast } = useToast();
  const [messagesList, setMessagesList] = useState<EmergencyMessage[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('emergency_chat_messages');
        if (saved) return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return initialMessages;
  });
  const [inputText, setInputText] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('emergency_chat_messages', JSON.stringify(messagesList));
      } catch {
        // ignore
      }
    }
  }, [messagesList]);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [messagesList.length]);

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text) return;

    let senderName = 'Вы';
    let senderId = 'user-emergency';
    try {
      const stored = localStorage.getItem('treeline_user_profile');
      if (stored) {
        const parsed = JSON.parse(stored);
        senderName = parsed.displayName || senderName;
        senderId = parsed.userId || parsed.id || senderId;
      }
    } catch {}

    const userMsg: EmergencyMessage = {
      id: `em-${Date.now()}`,
      name: senderName,
      avatar: 'https://picsum.photos/seed/user/40/40',
      text,
      time: new Date().toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      isSender: true,
    };

    setMessagesList((prev) => [...prev, userMsg]);
    setInputText('');

    try {
      await TransportManager.sendPacket({
        type: 'SOS_ALERT',
        priority: 'EMERGENCY_SOS',
        timestamp: Date.now(),
        payload: {
          senderId,
          senderName,
          timestamp: Date.now(),
          type: 'SOS_SIGNAL',
          message: text,
          status: 'ACTIVE',
          acknowledgedBy: [],
        },
      });

      toast({
        title: 'Экстренное сообщение передано',
        description: 'Сигнал транслирован по каналам Treeline (Mesh/Web).',
      });
    } catch (err) {
      console.warn('Transport manager SOS message dispatch error:', err);
      toast({
        title: 'Ошибка отправки',
        description: 'Не удалось передать сообщение в сеть. Попробуйте набрать 112.',
        variant: 'destructive',
      });
    }
  };

  const handleCall = () => {
    toast({
      title: 'Вызов экстренной службы 112',
      description: 'Инициализация прямого телефонного вызова 112...',
    });
    if (typeof window !== 'undefined') {
      window.location.href = 'tel:112';
    }
  };

  return (
    <div className="flex flex-col h-full p-2 sm:p-4 md:p-6">
      <Card className="flex flex-col h-full bg-destructive/10 border-destructive shadow-sm">
        <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-3">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="text-destructive-foreground hover:bg-destructive/20 hover:text-destructive-foreground shrink-0 size-8 sm:size-9"
            >
              <ArrowLeft className="size-4 sm:size-5" />
            </Button>
            <div className="text-center min-w-0">
              <CardTitle className="text-destructive-foreground text-base sm:text-lg truncate">Экстренный чат</CardTitle>
              <CardDescription className="text-destructive-foreground/80 text-[11px] sm:text-xs truncate">Канал экстренной связи Treeline</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCall}
              className="bg-transparent border-destructive-foreground/50 text-destructive-foreground hover:bg-destructive/20 h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-3 shrink-0"
            >
              <Phone className="mr-1.5 size-3.5 sm:size-4" />
              112
            </Button>
          </div>
          <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-destructive/20 text-destructive-foreground text-[11px]">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>Экстренный mesh-канал связи. Для прямого вызова государственных служб спасения нажмите «112».</span>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 gap-3 p-3 sm:p-6 pt-0 sm:pt-0 overflow-hidden">
          <ScrollArea className="flex-1 -mr-4 pr-4" viewportRef={scrollAreaRef}>
            <div className="space-y-4 pr-4">
              {messagesList.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex items-end gap-2',
                    message.isSender ? 'justify-end' : 'justify-start'
                  )}
                >
                  {!message.isSender && (
                    <Avatar className="size-8 shrink-0">
                      <AvatarImage
                        src={message.avatar}
                        alt={message.name}
                        width={40}
                        height={40}
                      />
                      <AvatarFallback>{message.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={cn(
                      'max-w-[75%] rounded-xl p-3',
                      message.isSender
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-card/80 text-card-foreground rounded-bl-none shadow-sm'
                    )}
                  >
                    {!message.isSender && (
                      <p className="text-xs font-semibold mb-1 text-destructive">
                        {message.name}
                      </p>
                    )}
                    <p className="text-sm break-words">{message.text}</p>
                    <p
                      className={cn(
                        'text-xs mt-1 text-right',
                        message.isSender
                          ? 'text-primary-foreground/70'
                          : 'text-muted-foreground/70'
                      )}
                    >
                      {message.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="mt-auto flex gap-2 pt-2 border-t border-destructive/20">
            <Input
              placeholder="Напишите сообщение диспетчеру..."
              className="bg-card/80 placeholder:text-muted-foreground focus:bg-card"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSendMessage();
                }
              }}
            />
            <Button
              variant="default"
              size="icon"
              className="shrink-0"
              onClick={handleSendMessage}
              disabled={!inputText.trim()}
            >
              <Send />
              <span className="sr-only">Отправить</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
