'use client';

import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  Wind,
  Droplets,
  Sunrise,
  Sunset,
  Cloudy,
  CloudSun,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/shared/ui/chart';
import { ScrollArea, ScrollBar } from '@/shared/ui/scroll-area';

const hourlyForecast = [
  { time: '14:00', temp: 18, Icon: Sun },
  { time: '15:00', temp: 19, Icon: Sun },
  { time: '16:00', temp: 18, Icon: CloudSun },
  { time: '17:00', temp: 17, Icon: CloudSun },
  { time: '18:00', temp: 16, Icon: Cloud },
  { time: '19:00', temp: 14, Icon: Cloudy },
  { time: '20:00', temp: 13, Icon: Cloudy },
  { time: '21:00', temp: 12, Icon: Cloud },
  { time: '22:00', temp: 11, Icon: Cloud },
  { time: '23:00', temp: 10, Icon: Cloud },
  { time: '00:00', temp: 9, Icon: Cloud },
];

const dailyForecast = [
  { day: 'Вт', Icon: Sun, temp: '15°/7°' },
  { day: 'Ср', Icon: Cloud, temp: '12°/5°' },
  { day: 'Чт', Icon: CloudRain, temp: '9°/4°' },
  { day: 'Пт', Icon: Cloud, temp: '11°/6°' },
  { day: 'Сб', Icon: CloudSnow, temp: '5°/0°' },
  { day: 'Вс', Icon: Sun, temp: '13°/4°' },
  { day: 'Пн', Icon: Cloud, temp: '10°/3°' },
];

const chartConfig = {
  temp: {
    label: 'Температура',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

export default function WeatherForecast() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Погода</h2>
        <p className="text-sm text-muted-foreground">
          Прогноз для Орлиного пика.
        </p>
      </div>

      <Card className="bg-gradient-to-br from-primary via-primary/80 to-accent/60 border-border text-primary-foreground shadow-lg">
        <CardContent className="p-4 relative">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-5xl font-bold">18°C</p>
              <p>В основном солнечно</p>
              <p className="text-sm opacity-80">Ощущается как 17°C</p>
            </div>
            <Sun className="size-20 opacity-90 -mt-2" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 text-sm">
            <div className="flex items-center gap-2">
              <Wind className="size-5 opacity-80" />
              <div>
                <p className="opacity-80">Ветер</p>
                <p className="font-semibold">12 км/ч</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Droplets className="size-5 opacity-80" />
              <div>
                <p className="opacity-80">Влажность</p>
                <p className="font-semibold">65%</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Sunrise className="size-5 opacity-80" />
              <div>
                <p className="opacity-80">Восход</p>
                <p className="font-semibold">05:45</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Sunset className="size-5 opacity-80" />
              <div>
                <p className="opacity-80">Закат</p>
                <p className="font-semibold">20:30</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Почасовой прогноз</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <ScrollArea>
              <div className="flex space-x-4 pb-4">
                {hourlyForecast.map(({ time, Icon, temp }, index) => (
                  <div key={index} className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg bg-muted/50 min-w-[6rem]">
                    <p className="text-sm text-muted-foreground">{time}</p>
                    <Icon className="size-6 text-accent" />
                    <p className="font-bold">{temp}°</p>
                  </div>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>График температуры</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[150px] w-full">
            <AreaChart
              accessibilityLayer
              data={hourlyForecast}
              margin={{
                left: -20,
                right: 20,
              }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => value.slice(0, 2)}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                domain={['dataMin - 2', 'dataMax + 2']}
                tickFormatter={(value) => `${value}°`}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    formatter={(value) => `${value}°C`}
                    indicator="line"
                  />
                }
              />
              <defs>
                <linearGradient id="fillTemp" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-temp)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-temp)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <Area
                dataKey="temp"
                type="natural"
                fill="url(#fillTemp)"
                stroke="var(--color-temp)"
                stackId="a"
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Прогноз на 7 дней</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {dailyForecast.map(({ day, Icon, temp }) => (
            <div
              key={day}
              className="grid grid-cols-3 items-center gap-4 rounded-lg p-2 -m-2 hover:bg-muted/50"
            >
              <p className="font-semibold text-muted-foreground">{day}</p>
              <Icon className="size-6 text-accent justify-self-center" />
              <p className="font-bold text-foreground justify-self-end">
                {temp}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
