'use client';

import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Send, Phone, ArrowLeft } from 'lucide-react';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { cn } from '@/shared/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card';
import { useToast } from '@/shared/hooks/use-toast';

const messages = [
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

  const handleCall = () => {
    toast({
      title: 'Выполняется звонок...',
      description: 'Соединяем вас с экстренным диспетчером.',
    });
  };

  return (
    <div className="flex flex-col h-full p-4 md:p-6">
      <Card className="flex flex-col h-full bg-destructive/10 border-destructive">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="icon" onClick={onBack} className="text-destructive-foreground hover:bg-destructive/20 hover:text-destructive-foreground">
              <ArrowLeft />
            </Button>
            <div className='text-center'>
              <CardTitle className="text-destructive-foreground">Экстренный чат</CardTitle>
              <CardDescription className="text-destructive-foreground/80">Чат с диспетчером</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleCall} className="bg-transparent border-destructive-foreground/50 text-destructive-foreground hover:bg-destructive/20">
              <Phone className="mr-2 size-4" />
              Позвонить
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 gap-4">
          <ScrollArea className="flex-1 -mr-4 pr-4">
            <div className="space-y-4 pr-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex items-end gap-2',
                    message.isSender ? 'justify-end' : 'justify-start'
                  )}
                >
                  {!message.isSender && (
                    <Avatar className="size-8">
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
                        : 'bg-card/80 text-card-foreground rounded-bl-none'
                    )}
                  >
                    <p className="text-sm">{message.text}</p>
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

          <div className="mt-auto flex gap-2">
            <Input placeholder="Напишите сообщение..." className="bg-card/80 placeholder:text-muted-foreground focus:bg-card"/>
            <Button variant="default" size="icon" className="shrink-0">
              <Send />
              <span className="sr-only">Отправить</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
