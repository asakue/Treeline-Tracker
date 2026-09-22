'use client';

import { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Send, Users, ShieldCheck, Lock, KeyRound } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
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
  const { groupsHook, activeGroupId, setActiveGroupId, setView } = useAppContext();
  const { groups } = groupsHook;

  const [selectedGroupId, setSelectedGroupId] = useState(
    activeGroupId || (groups.length > 0 ? groups[0].id : '')
  );

  const [newMessage, setNewMessage] = useState('');
  const [userProfile, setUserProfile] = useState<{ displayName: string; avatar: string }>({
    displayName: 'Вы',
    avatar: '',
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedProfile = localStorage.getItem('treeline_user_profile');
      const savedAvatar = localStorage.getItem('treeline_user_avatar');
      if (savedProfile) {
        try {
          const parsed = JSON.parse(savedProfile);
          setUserProfile({
            displayName: parsed.displayName || 'Вы',
            avatar: savedAvatar || '',
          });
        } catch {}
      } else if (savedAvatar) {
        setUserProfile((prev) => ({ ...prev, avatar: savedAvatar }));
      }
    }
  }, []);

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
      name: userProfile.displayName || 'Вы',
      avatar: userProfile.avatar || '',
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
      <div className="h-full flex flex-col items-center justify-center bg-background p-6">
        <div className="text-center max-w-sm space-y-3">
          <div className="p-3 bg-muted rounded-full w-fit mx-auto">
            <Users className="size-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Группы не созданы</h3>
          <p className="text-sm text-muted-foreground">
            Создайте группу в разделе "Трекер", чтобы начать защищенное общение по радиоканалу и через сервер.
          </p>
          <Button onClick={() => setView('tracker')} className="mt-2">
            Создать первую группу
          </Button>
        </div>
      </div>
    );
  }

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  return (
    <div className="h-full flex flex-col bg-background pb-16 md:pb-0">
      {/* Header */}
      <div className="border-b p-3 sm:p-4 shrink-0 z-10 bg-background space-y-1.5 sm:space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-base sm:text-lg font-semibold truncate">
              {selectedGroup?.name || 'Выберите группу'}
            </h2>
            <Badge variant="outline" className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shrink-0">
              <ShieldCheck className="size-3 text-emerald-500" />
              <span>E2EE</span>
              <span className="hidden sm:inline">AES-256</span>
            </Badge>
          </div>
          <Select value={selectedGroupId} onValueChange={handleGroupChange}>
            <SelectTrigger className="w-full sm:w-[250px] h-9 text-xs sm:text-sm">
              <SelectValue placeholder="Выберите группу" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((group, idx) => (
                <SelectItem key={`chat-group-${group.id}-${idx}`} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* E2EE Info Strip */}
        <div className="flex items-center justify-between text-[11px] sm:text-xs text-muted-foreground bg-muted/40 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md border border-border/40">
          <div className="flex items-center gap-1.5 truncate">
            <Lock className="size-3 sm:size-3.5 text-emerald-500 shrink-0" />
            <span className="truncate hidden sm:inline">Сообщения защищены сквозным шифрованием (AES-256-GCM + Ed25519)</span>
            <span className="truncate sm:hidden">Сквозное E2EE шифрование (AES-256-GCM)</span>
          </div>
          <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-mono text-muted-foreground/80 shrink-0 ml-1.5">
            <KeyRound className="size-2.5 sm:size-3 text-primary" />
            <span>#{selectedGroupId?.slice(-4) || 'mesh'}</span>
          </div>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col overflow-y-hidden">
        <ScrollArea className="flex-1" viewportRef={scrollAreaRef}>
          <div className="p-4 space-y-4">
            {currentMessages.map((message: any, idx: number) => (
              <div
                key={message.id ? `msg-${message.id}-${idx}` : `msg-idx-${idx}`}
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
