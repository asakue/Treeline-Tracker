'use client';

import { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Send, Users } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { groupChats as initialGroupChats } from '@/entities/group/model/groups-data';
import { useAppContext } from '@/entities/app';
import { useToast } from '@/shared/hooks/use-toast';
import { ScrollArea } from '@/shared/ui/scroll-area';

export default function GroupChat() {
  const { groupsHook, activeGroupId, setActiveGroupId } = useAppContext();
  const { groups } = groupsHook;

  const [selectedGroupId, setSelectedGroupId] = useState(
    activeGroupId || (groups.length > 0 ? groups[0].id : '')
  );

  const [newMessage, setNewMessage] = useState('');
  const [allChats, setAllChats] = useState(() => {
    try {
      if (typeof window === 'undefined') return initialGroupChats;
      const savedChats = localStorage.getItem('groupChats');
      return savedChats ? JSON.parse(savedChats) : initialGroupChats;
    } catch (error) {
      return initialGroupChats;
    }
  });

  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('groupChats', JSON.stringify(allChats));
      }
    } catch (error) {
      console.error('Failed to save chats to localStorage', error);
    }
  }, [allChats]);

  const currentMessages = allChats[selectedGroupId]?.messages || [];

  useEffect(() => {
    if (groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groups[0].id);
    }
    if (activeGroupId && activeGroupId !== selectedGroupId) {
      setSelectedGroupId(activeGroupId);
    }
  }, [activeGroupId, selectedGroupId, groups]);

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
  }, [selectedGroupId, currentMessages.length]);

  const handleGroupChange = (groupId: string) => {
    setSelectedGroupId(groupId);
    if (setActiveGroupId) {
      setActiveGroupId(groupId);
    }
  };

  const handleSendMessage = () => {
    if (newMessage.trim() === '' || !selectedGroupId) return;

    const message = {
      id: `g${selectedGroupId}m${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 9)}`,
      name: 'Вы',
      avatar: 'https://picsum.photos/seed/user/40/40',
      text: newMessage,
      time: new Date().toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      isSender: true,
    };

    setAllChats((prevChats:any) => {
      const currentGroupChat = prevChats[selectedGroupId] || { messages: [] };
      const updatedMessages = [...currentGroupChat.messages, message];
      return {
        ...prevChats,
        [selectedGroupId]: { ...currentGroupChat, messages: updatedMessages },
      };
    });

    setNewMessage('');

    toast({
      title: 'Сообщение отправлено!',
    });
  };

  if (groups.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-background p-4">
        <div className="text-center">
          <Users className="size-12 mx-auto text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">Группы не найдены</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Создайте группу в разделе "Трекер", чтобы начать общение.
          </p>
        </div>
      </div>
    );
  }

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b p-4 shrink-0 z-10 bg-background">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-lg font-semibold truncate">
            {selectedGroup?.name || 'Выберите группу'}
          </h2>
          <Select value={selectedGroupId} onValueChange={handleGroupChange}>
            <SelectTrigger className="w-full sm:w-[250px]">
              <SelectValue placeholder="Выберите группу" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col overflow-y-hidden">
        <ScrollArea className="flex-1" viewportRef={scrollAreaRef}>
          <div className="p-4 space-y-4">
            {currentMessages.map((message: any) => (
              <div
                key={message.id}
                className={cn(
                  'flex items-end gap-2',
                  message.isSender ? 'justify-end' : 'justify-start'
                )}
              >
                {!message.isSender && (
                  <Avatar className="size-8 self-end">
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
                    'max-w-[80%] rounded-xl p-3',
                    message.isSender
                      ? 'bg-primary text-primary-foreground rounded-br-none'
                      : 'bg-muted text-muted-foreground rounded-bl-none'
                  )}
                >
                  {!message.isSender && (
                    <p className="text-sm font-medium mb-1">{message.name}</p>
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

        <div className="shrink-0 border-t bg-background/80 p-4 backdrop-blur-sm">
          <div className="flex gap-2">
            <Input
              placeholder="Напишите сообщение..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={!selectedGroupId}
            />
            <Button
              variant="default"
              size="icon"
              className="shrink-0"
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || !selectedGroupId}
            >
              <Send />
              <span className="sr-only">Отправить</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
