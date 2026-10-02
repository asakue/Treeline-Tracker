'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card';
import {
  Code,
  Terminal,
  FolderTree,
  Rocket,
  Github,
  Newspaper,
  Loader2,
  ShieldCheck,
  Compass,
  Layers,
  Cpu,
  Bot,
  Activity,
  Map,
  Radio,
  FileCode2,
  CheckCircle2,
  Share2,
  Lock,
} from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

const coreCapabilities = [
  {
    icon: Compass,
    title: 'Пешеходная навигация и BRouter',
    badge: 'Маршрутизация',
    description: 'Умный расчет горных и лесных треков по тропам OpenStreetMap с учетом перепадов высот, уклонов рельефа и проходимости.',
  },
  {
    icon: ShieldCheck,
    title: 'Сквозное E2EE-шифрование',
    badge: 'Web Crypto API',
    description: 'Цифровые подписи Ed25519, симметричное шифрование AES-256-GCM, защита от replay-атак и фильтр приватности геоданных.',
  },
  {
    icon: Layers,
    title: 'Топография и SRTM DEM',
    badge: 'OpenTopoMap & CyclOSM',
    description: 'Отображение горизонталей, высотных отметок, теневой отмывки рельефа и расчет суммарного набора и сброса высоты.',
  },
  {
    icon: Bot,
    title: 'Поиск пропавших с Gemini AI',
    badge: 'Google Gemini 3.8 Flash',
    description: 'Интеллектуальный расчет наиболее вероятных секторов поиска туриста на базе погодных условий, опыта и топографии местности.',
  },
  {
    icon: Activity,
    title: 'Геозоны и безопасный радиус',
    badge: 'Geofencing',
    description: 'Автоматический мониторинг удаления участников от лидера с мгновенной звуковой и визуальной тревогой при выходе из зоны.',
  },
  {
    icon: Radio,
    title: 'SOS и стробоскоп Морзе',
    badge: 'Emergency 112',
    description: 'Высокоприоритетный сигнал бедствия, передача координат экстренным службам и встроенный оптический SOS-маяк экраном.',
  },
];

const techStack = [
  { name: 'Next.js 15 (App Router)', category: 'Frontend / Fullstack', description: 'Современный React-фреймворк со standalone-сборкой и API роутами.' },
  { name: 'React 18 & TypeScript 5', category: 'Ядро и Типизация', description: 'Строгая типизация всех слоев предметной области и UI-компонентов.' },
  { name: 'Google Gemini 3.8 Flash', category: 'Искусственный интеллект', description: 'Серверная генерация секторов поиска пропавших и анализ геометрии полигонов.' },
  { name: 'Leaflet & React-Leaflet', category: 'Картография', description: 'Высокопроизводительный движок интерактивных карт с кастомными слоями.' },
  { name: 'OpenTopoMap & CyclOSM', category: 'Топо-слои', description: 'Карты с изолиниями высот, рельефом и горной классификацией троп.' },
  { name: 'BRouter Routing Engine', category: 'Навигация', description: 'Оптимизированный пешеходный алгоритм прокладки треков по тропам.' },
  { name: 'Open-Elevation DEM API', category: 'Высотный профиль', description: 'Цифровая модель рельефа SRTM для расчета профиля и набора высоты.' },
  { name: 'W3C Web Crypto API', category: 'Безопасность', description: 'Аппаратно-ускоренная криптография (Ed25519 подписи + AES-256-GCM AEAD).' },
  { name: 'Tailwind CSS & shadcn/ui', category: 'Интерфейс', description: 'Адаптивный дизайн, поддержка светлой и темной тем, доступность WCAG.' },
  { name: 'Recharts', category: 'Визуализация', description: 'Интерактивные графики перепада высот и профиля маршрута.' },
  { name: 'Vitest & Testing Library', category: 'Тестирование', description: 'Комплексные юнит- и интеграционные тесты криптографии и компонентов.' },
  { name: 'Firebase Firestore & Auth', category: 'Хранилище / Синхронизация', description: 'Real-time синхронизация данных групп и ролевая безопасность (RBAC).' },
];

const projectStructure = `
treeline-tracker/
├── docs/                        # Полная архитектурная и продуктовая документация
│   ├── 01-product/              # Концепция, персоны, Use Cases (UC-01..10)
│   ├── 02-requirements/         # Функциональные (FR) и нефункциональные (NFR)
│   ├── 03-architecture/         # C4-модель, UML Class Diagram, ADR-решения
│   ├── 04-security/             # E2EE, Ed25519, threat-model, privacy policy
│   └── 05-mesh/                 # Спецификация и симуляция протокола MeshCore
├── src/
│   ├── app/                     # Next.js 15 App Router и API эндпоинты (/api/*)
│   │   ├── api/search-areas/    # Серверный Gemini 3.8 Flash AI эндпоинт
│   │   ├── api/routes/          # CRUD операции с маршрутами
│   │   └── api/emergency/       # Обработка экстренных сигналов бедствия SOS
│   ├── views/                   # Полноэкранные представления (MapView, Profile, Tracker, etc.)
│   ├── features/                # Функциональные модули (Hiker Search, Route Drawing, SOS)
│   ├── entities/                # Доменные модели данных и контексты (App, Group, Route, Hiker)
│   ├── core/                    # Чистая предметная область и криптографическое ядро
│   │   ├── domain/              # Сущности (GeoCoordinate, HikerLocation, Route, Group)
│   │   ├── repositories/        # Интерфейсы репозиториев и LocalStorage драйверы
│   │   ├── security/            # CryptoService, IdentityManager, PrivacyFilter
│   │   └── utils/               # GPX Exporter, конвертеры координат
│   └── shared/                  # Переиспользуемые UI-компоненты (shadcn), утилиты и хуки
├── public/                      # Статические файлы, иконки, манифест, update.md
├── package.json                 # Зависимости и скрипты
└── vitest.config.ts             # Конфигурация тестового раннера
`;

const scripts = [
  { command: 'npm run dev', description: 'Запуск приложения в режиме разработки на порту 3000.' },
  { command: 'npm run build', description: 'Production-сборка приложения с оптимизацией standalone.' },
  { command: 'npm run start', description: 'Запуск собранного production-сервера.' },
  { command: 'npm run lint', description: 'Статическая проверка кода линтером ESLint 9.' },
  { command: 'npm test', description: 'Запуск полного сьюта автоматических тестов Vitest.' },
  { command: 'npm run typecheck', description: 'Проверка типов TypeScript без генерации файлов.' },
  { command: 'npm run security:scan', description: 'Сканирование кодовой базы на отсутствие секретов и ключей.' },
];

export default function AboutApp() {
  const [updatesLog, setUpdatesLog] = useState('');
  const [isLoadingLog, setIsLoadingLog] = useState(true);

  useEffect(() => {
    fetch('/update.md')
      .then((response) => response.text())
      .then((text) => {
        setUpdatesLog(text);
        setIsLoadingLog(false);
      })
      .catch((error) => {
        console.error('Failed to fetch update log:', error);
        setUpdatesLog('Не удалось загрузить журнал обновлений.');
        setIsLoadingLog(false);
      });
  }, []);

  return (
    <div className="bg-background text-foreground animate-fade-in-slow p-4 md:p-8 min-h-screen">
      <main className="max-w-5xl mx-auto space-y-8">
        
        {/* Header Hero */}
        <section className="text-center space-y-4 pt-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider">
            <Compass className="size-3.5" />
            Версия 0.5.0 Production Ready
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground via-primary to-foreground">
            О приложении Treeline Tracker
          </h1>
          <p className="max-w-3xl mx-auto text-base md:text-lg text-muted-foreground leading-relaxed">
            Архитектурный и технический обзор защищенной системы мониторинга, навигации и содействия поисково-спасательным операциям в условиях дикой природы.
          </p>
        </section>

        {/* Navigation Tabs */}
        <Tabs defaultValue="features" className="w-full">
          <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 h-auto p-1 bg-muted/60 backdrop-blur rounded-xl gap-1">
            <TabsTrigger value="features" className="text-xs md:text-sm py-2">
              Возможности
            </TabsTrigger>
            <TabsTrigger value="architecture" className="text-xs md:text-sm py-2">
              Архитектура
            </TabsTrigger>
            <TabsTrigger value="stack" className="text-xs md:text-sm py-2">
              Стек
            </TabsTrigger>
            <TabsTrigger value="structure" className="text-xs md:text-sm py-2">
              Структура
            </TabsTrigger>
            <TabsTrigger value="changelog" className="text-xs md:text-sm py-2">
              Журнал
            </TabsTrigger>
            <TabsTrigger value="scripts" className="text-xs md:text-sm py-2">
              Команды
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Capabilities */}
          <TabsContent value="features" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {coreCapabilities.map((item, idx) => {
                const IconComponent = item.icon;
                return (
                  <Card key={`cap-${idx}`} className="bg-card/60 backdrop-blur-sm border-border/50 hover:border-primary/40 transition-all duration-200 hover:shadow-md">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="p-2.5 bg-primary/10 rounded-lg text-primary">
                          <IconComponent className="size-5" />
                        </div>
                        <Badge variant="secondary" className="text-xs font-mono">
                          {item.badge}
                        </Badge>
                      </div>
                      <CardTitle className="text-base font-bold mt-3">
                        {item.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                        {item.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <Github className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Открытый исходный код</CardTitle>
                    <CardDescription>Проект полностью открыт для сообщества спасателей и туристов</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-3">
                <a
                  href="https://github.com/asakue/Treeline-Tracker"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button className="w-full gap-2 font-medium">
                    <Github className="size-4" />
                    Перейти в GitHub репозиторий
                  </Button>
                </a>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: Architecture & Diagrams */}
          <TabsContent value="architecture" className="space-y-6 mt-6">
            <Card className="bg-card/60 border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Layers className="size-5 text-primary" />
                      Многоуровневая C4 & FSD Архитектура
                    </CardTitle>
                    <CardDescription>
                      Четкое разделение зон ответственности по методологии Feature-Sliced Design и Clean Architecture
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    UML Compliant
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-muted/40 border border-border/40 space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-sm text-primary">
                      <Compass className="size-4" />
                      1. Presentation & Views Layer
                    </div>
                    <p className="text-xs text-muted-foreground">
                      React 18 компоненты (Map, Routes, SOS, Lost Hiker Tool), хуки состояний, отзывчивый интерфейс с темами.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-muted/40 border border-border/40 space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-sm text-primary">
                      <Cpu className="size-4" />
                      2. Application & Coordination
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Expedition Manager, контроль геозон, симулятор движения туристов и оркестрация API.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-muted/40 border border-border/40 space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-sm text-primary">
                      <Lock className="size-4" />
                      3. Security & Crypto Core
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Криптографический модуль Ed25519 + AES-256-GCM, защита от replay-атак и фильтрация точности геоданных.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-muted/40 border border-border/40 space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-sm text-primary">
                      <FolderTree className="size-4" />
                      4. Domain & Repositories
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Сущности (Group, Route, Location), абстракция интерфейсов `IRepository` и локальные/облачные драйверы.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-xs font-mono space-y-1">
                  <div className="text-primary font-bold mb-2">📋 Спецификации диаграмм в каталоге /docs:</div>
                  <div>• <span className="text-foreground">docs/01-product/use-cases.md</span> — Диаграмма прецедентов (UC-01..10) + Sequence-диаграммы</div>
                  <div>• <span className="text-foreground">docs/03-architecture/system.md</span> — Полная диаграмма классов UML (ClassDiagram)</div>
                  <div>• <span className="text-foreground">docs/04-security/threat-model.md</span> — Модель угроз безопасности STRIDE/LINDDUN</div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: Tech Stack */}
          <TabsContent value="stack" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {techStack.map((tech, idx) => (
                <div
                  key={`tech-item-${idx}-${tech.name}`}
                  className="p-4 bg-card/60 border border-border/50 rounded-xl space-y-2 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-foreground">{tech.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {tech.category}
                  </Badge>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {tech.description}
                  </p>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* TAB 4: Project Structure */}
          <TabsContent value="structure" className="space-y-6 mt-6">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 rounded-lg text-primary">
                    <FolderTree className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Структура кодовой базы</CardTitle>
                    <CardDescription>Логическая организация директорий и модулей проекта</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="p-4 bg-muted/40 rounded-xl text-xs md:text-sm text-muted-foreground whitespace-pre-wrap font-mono overflow-x-auto border border-border/40">
                  {projectStructure.trim()}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 5: Changelog */}
          <TabsContent value="changelog" className="space-y-6 mt-6">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 rounded-lg text-primary">
                    <Newspaper className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Журнал версий и обновлений</CardTitle>
                    <CardDescription>История релизов и внедренных улучшений</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[480px] w-full rounded-xl border border-border/50 p-4 bg-muted/20">
                  {isLoadingLog ? (
                    <div className="flex items-center justify-center h-48">
                      <Loader2 className="size-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="space-y-2 text-xs md:text-sm font-sans">
                      {updatesLog.trim().split('\n').map((line, index) => {
                        const lineKey = `upd-log-${index}`;
                        if (line.startsWith('## ')) {
                          return (
                            <div key={lineKey} className="pt-4 pb-1 border-b border-border/40 flex items-center gap-2">
                              <Badge variant="default" className="bg-primary text-primary-foreground font-mono text-xs">
                                {line.substring(3).trim()}
                              </Badge>
                            </div>
                          );
                        }
                        if (line.startsWith('### ')) {
                          return (
                            <h3 key={lineKey} className="text-sm font-semibold mt-3 mb-1 text-primary flex items-center gap-1.5">
                              <CheckCircle2 className="size-3.5" />
                              {line.substring(4)}
                            </h3>
                          );
                        }
                        if (line.startsWith('- **')) {
                          const boldEnd = line.indexOf('**', 4);
                          if (boldEnd !== -1) {
                            const boldText = line.substring(4, boldEnd);
                            const restText = line.substring(boldEnd + 2);
                            return (
                              <p key={lineKey} className="my-1 pl-2 border-l-2 border-primary/40 text-muted-foreground">
                                <strong className="text-foreground">{boldText}</strong>
                                {restText}
                              </p>
                            );
                          }
                        }
                        if (line.startsWith('- ')) {
                          return (
                            <p key={lineKey} className="my-1 pl-2 border-l-2 border-muted-foreground/30 text-muted-foreground">
                              {line.substring(2)}
                            </p>
                          );
                        }
                        if (line.startsWith('---')) {
                          return <hr key={lineKey} className="my-3 border-border/40" />;
                        }
                        if (!line.trim()) {
                          return <div key={lineKey} className="h-1.5" />;
                        }
                        return <p key={lineKey} className="my-1 text-muted-foreground leading-relaxed">{line}</p>;
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 6: Commands */}
          <TabsContent value="scripts" className="space-y-6 mt-6">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 rounded-lg text-primary">
                    <Terminal className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Команды и скрипты CLI</CardTitle>
                    <CardDescription>Управление разработкой, тестированием и сборкой</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {scripts.map((script, idx) => (
                  <div
                    key={`script-item-${idx}-${script.command}`}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-muted/40 rounded-xl border border-border/30 gap-2"
                  >
                    <Badge variant="outline" className="font-mono text-xs max-w-max border-primary/30 text-primary">
                      {script.command}
                    </Badge>
                    <p className="text-xs text-muted-foreground sm:text-right">{script.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground border-0 shadow-lg">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Rocket className="size-5" />
                  <CardTitle className="text-base">Быстрый старт</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs opacity-90">
                  Клонируйте репозиторий, установите зависимости и запустите локальный сервер разработки:
                </p>
                <pre className="p-3 bg-black/30 rounded-lg text-xs font-mono text-white/95 overflow-x-auto">
                  {`git clone https://github.com/asakue/Treeline-Tracker.git\ncd Treeline-Tracker\nnpm install\nnpm run dev`}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </main>
    </div>
  );
}
