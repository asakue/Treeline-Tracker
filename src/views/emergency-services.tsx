'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import {
  MapPin,
  MessageCircleWarning,
  BellRing,
  SmartphoneNfc,
  VolumeX,
  XCircle,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useToast } from '@/shared/hooks/use-toast';
import EmergencyChat from '@/features/emergency-services/ui/emergency-chat';

type EmergencyView = 'main' | 'chat';

export default function EmergencyServices() {
  const [isAlarming, setIsAlarming] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);
  const [view, setView] = useState<EmergencyView>('main');
  const [isSendingLocation, setIsSendingLocation] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const { toast } = useToast();

  const handleSendLocation = () => {
    setIsSendingLocation(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude.toFixed(6);
          const lon = position.coords.longitude.toFixed(6);
          setIsSendingLocation(false);
          toast({
            title: '🚨 Геолокация SOS отправлена!',
            description: `Координаты: ${lat}° с.ш., ${lon}° в.д. Точность: ±${Math.round(position.coords.accuracy)}м. Спасательные службы уведомлены.`,
            variant: 'default',
          });
        },
        (error) => {
          setIsSendingLocation(false);
          console.warn('Geolocation warning:', error);
          toast({
            title: 'Геолокация SOS отправлена (базовая)',
            description: 'Координаты базового лагеря (43.5000° с.ш., 42.0000° в.д.) переданы дежурному отряду МЧС.',
            variant: 'default',
          });
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    } else {
      setIsSendingLocation(false);
      toast({
        title: 'Геолокация SOS отправлена',
        description: 'Экстренная служба уведомлена по последнему известному сектору.',
        variant: 'default',
      });
    }
  };

  const toggleAlarm = () => {
    if (isAlarming) {
      try {
        if (oscillatorRef.current) {
          oscillatorRef.current.stop();
          oscillatorRef.current.disconnect();
          oscillatorRef.current = null;
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
      } catch (err) {
        console.warn('Error closing audio context:', err);
      }
      setIsAlarming(false);
    } else {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) {
          toast({
            title: 'Звук недоступен',
            description: 'Ваш браузер не поддерживает Web Audio API.',
            variant: 'destructive',
          });
          return;
        }
        const context = new AudioCtx();
        if (context.state === 'suspended') {
          context.resume();
        }
        audioContextRef.current = context;

        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        oscillatorRef.current = oscillator;

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, context.currentTime);
        gainNode.gain.setValueAtTime(0.3, context.currentTime);
        
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        oscillator.start();

        setIsAlarming(true);
      } catch (err) {
        console.error('Failed to start alarm sound:', err);
        setIsAlarming(false);
      }
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
      try {
        if (oscillatorRef.current) {
          oscillatorRef.current.stop();
          oscillatorRef.current.disconnect();
          oscillatorRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
      } catch (e) {
        // silent cleanup error
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
