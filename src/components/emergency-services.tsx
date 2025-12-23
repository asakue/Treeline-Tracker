
'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  MapPin,
  MessageCircleWarning,
  BellRing,
  SmartphoneNfc,
  VolumeX,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import EmergencyChat from './emergency-chat';

type EmergencyView = 'main' | 'chat';

export default function EmergencyServices() {
  const [isAlarming, setIsAlarming] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);
  const [view, setView] = useState<EmergencyView>('main');
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const { toast } = useToast();

  const handleSendLocation = () => {
    toast({
      title: 'Геолокация отправлена',
      description: 'Экстренная служба уже в пути.',
      variant: 'default',
    });
  };

  const toggleAlarm = () => {
    if (isAlarming) {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
        oscillatorRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setIsAlarming(false);
    } else {
      const context = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      audioContextRef.current = context;

      const oscillator = context.createOscillator();
      oscillatorRef.current = oscillator;

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1000, context.currentTime);
      oscillator.connect(context.destination);
      oscillator.start();

      setIsAlarming(true);
    }
  };

  const toggleBlink = () => {
    setIsBlinking(!isBlinking);
  };

  useEffect(() => {
    if (isBlinking) {
      document.body.classList.add('sos-blink-animation');
    } else {
      document.body.classList.remove('sos-blink-animation');
    }

    return () => {
      document.body.classList.remove('sos-blink-animation');
    };
  }, [isBlinking]);


  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      document.body.classList.remove('sos-blink-animation');
    };
  }, []);

  if (view === 'chat') {
    return <EmergencyChat onBack={() => setView('main')} />;
  }

  return (
    <div className="p-4 md:p-6 h-full flex flex-col items-center justify-center">
      <Card className="w-full max-w-2xl bg-destructive/10 border-destructive">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-destructive-foreground">
            Экстренная Помощь
          </CardTitle>
          <CardDescription className="text-destructive-foreground/80">
            Используйте эти функции только в случае реальной чрезвычайной
            ситуации.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 xs:grid-cols-2 gap-4 p-6">
          <Button
            variant="outline"
            className="h-24 text-lg md:h-28 border-destructive text-destructive-foreground hover:bg-destructive/20 hover:text-destructive-foreground flex flex-col gap-2"
            onClick={handleSendLocation}
          >
            <MapPin className="size-8" />
            <span>Отправить местоположение</span>
          </Button>
          <Button
            variant="outline"
            className="h-24 text-lg md:h-28 border-destructive text-destructive-foreground hover:bg-destructive/20 hover:text-destructive-foreground flex flex-col gap-2"
            onClick={() => setView('chat')}
          >
            <MessageCircleWarning className="size-8" />
            <span>Экстренный чат</span>
          </Button>
          <Button
            variant="outline"
            onClick={toggleAlarm}
            className={cn(
              'h-24 text-lg md:h-28 border-destructive text-destructive-foreground hover:bg-destructive/20 hover:text-destructive-foreground flex flex-col gap-2',
              isAlarming && 'bg-destructive/30'
            )}
          >
            {isAlarming ? (
              <>
                <VolumeX className="size-8" />
                <span>Выключить сигнал</span>
              </>
            ) : (
              <>
                <BellRing className="size-8" />
                <span>Включить звуковой сигнал</span>
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={toggleBlink}
            className={cn(
              'h-24 text-lg md:h-28 border-destructive text-destructive-foreground hover:bg-destructive/20 hover:text-destructive-foreground flex flex-col gap-2',
              isBlinking && 'bg-destructive/30'
            )}
          >
            {isBlinking ? (
              <>
                <XCircle className="size-8" />
                <span>Остановить SOS-сигнал</span>
              </>
            ) : (
              <>
                <SmartphoneNfc className="size-8" />
                <span>Мигать экраном (SOS)</span>
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
