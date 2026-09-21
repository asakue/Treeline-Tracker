'use client';

import { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Send, Phone, ArrowLeft } from 'lucide-react';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { cn } from '@/shared/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card';
import { useToast } from '@/shared/hooks/use-toast';

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
    name: 'Диспетчер',
    avatar: 'https://picsum.photos/seed/dispatcher/40/40',
    text: 'Экстренная служба на связи. Какая у вас ситуация?',
    time: '11:01',
    isSender: false,
  },
  {
    id: '2',
    name: 'Вы',
    avatar: 'https://picsum.photos/seed/user/40/40',
    text: 'Я заблудился, кажется, подвернул ногу.',
    time: '11:02',
    isSender: true,
  },
  {
    id: '3',
    name: 'Диспетчер',
    avatar: 'https://picsum.photos/seed/dispatcher/40/40',
    text: 'Понятно. Мы получили ваши координаты. Оставайтесь на месте, помощь уже в пути. Вы один?',
    time: '11:03',
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

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const userMsg: EmergencyMessage = {
      id: `em-${Date.now()}`,
      name: 'Вы',
      avatar: 'https://picsum.photos/seed/user/40/40',
      text: inputText.trim(),
      time: new Date().toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      isSender: true,
    };

    setMessagesList((prev) => [...prev, userMsg]);
    setInputText('');

    // Simulate realistic response from emergency dispatcher after 1.5s
    setTimeout(() => {
      const responses = [
        'Сообщение принято. Диспетчер МЧС зафиксировал ваши данные. Спасательная группа ориентирована.',
        'Ваш сигнал в приоритете. Пожалуйста, экономьте заряд аккумулятора и оставайтесь на открытом месте.',
        'Информация передана дежурному координатору поисково-спасательного отряда. Мы отслеживаем ваши координаты.',
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      const dispatcherMsg: EmergencyMessage = {
        id: `em-disp-${Date.now()}`,
        name: 'Диспетчер',
        avatar: 'https://picsum.photos/seed/dispatcher/40/40',
        text: randomResponse,
        time: new Date().toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        isSender: false,
      };
      setMessagesList((prev) => [...prev, dispatcherMsg]);
    }, 1500);
  };

  const handleCall = () => {
    toast({
      title: 'Выполняется экстренный вызов...',
      description: 'Соединение с диспетчерской службой 112 (МЧС).',
    });
  };

  return (
    <div className="flex flex-col h-full p-4 md:p-6">
      <Card className="flex flex-col h-full bg-destructive/10 border-destructive">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="text-destructive-foreground hover:bg-destructive/20 hover:text-destructive-foreground"
            >
              <ArrowLeft />
            </Button>
            <div className="text-center">
              <CardTitle className="text-destructive-foreground">Экстренный чат</CardTitle>
              <CardDescription className="text-destructive-foreground/80">Чат с оперативным диспетчером 112</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCall}
              className="bg-transparent border-destructive-foreground/50 text-destructive-foreground hover:bg-destructive/20"
            >
              <Phone className="mr-2 size-4" />
              112
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 gap-4 overflow-hidden">
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
