'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card';
import {
  Zap,
  Target,
  Smile,
  Mountain,
  Activity,
  HardHat,
  Building2,
  ChevronDown,
  CheckCircle2,
  Shield,
  Radio,
  Users,
  Compass,
  Sparkles,
  Lock,
  HeartHandshake,
  MapPin,
  Cpu,
} from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';

const principles = [
  {
    id: 'principle-automation',
    icon: Zap,
    title: 'Принцип Автоматики',
    badge: 'Geofencing',
    description: 'Система работает автономно. Задайте безопасный радиус геозоны — если участник отстанет или отклонится, тревожный сигнал немедленно уведомит и его, и руководителя.',
  },
  {
    id: 'principle-accuracy',
    icon: Target,
    title: 'Принцип Точности',
    badge: 'GNSS & DEM',
    description: 'В экстренной ситуации достаточно одного действия: точные координаты, высотная отметка и заряд аккумулятора мгновенно передаются на карты всех членов группы.',
  },
  {
    id: 'principle-privacy',
    icon: Lock,
    title: 'Принцип Приватности',
    badge: 'Zero-Knowledge E2EE',
    description: 'Координаты принадлежат только вам. Сквозное шифрование AES-256-GCM и подписи Ed25519 гарантируют защиту геоданных от перехвата и подделки.',
  },
  {
    id: 'principle-calmness',
    icon: Smile,
    title: 'Принцип Уверенности',
    badge: 'Safety First',
    description: 'Новички избавляются от страха потеряться и получают удовольствие от природы. Гиды и руководители получают надежного цифрового ассистента.',
  },
];

const perspectives = [
  {
    id: 'perspective-resorts',
    icon: Mountain,
    title: 'Горнолыжные курорты',
    description: 'Контроль групп фрирайдеров и мониторинг безопасных трасс в лавиноопасных секторах.',
  },
  {
    id: 'perspective-rescue',
    icon: Activity,
    title: 'Поисковые отряды (SAR / МЧС)',
    description: 'Координация поисково-спасательных операций с ИИ-генерацией вероятных секторов нахождения.',
  },
  {
    id: 'perspective-industry',
    icon: HardHat,
    title: 'Промышленный мониторинг',
    description: 'Безопасность геологоразведочных партий, персонала на карьерах и удаленных объектах.',
  },
  {
    id: 'perspective-agriculture',
    icon: Building2,
    title: 'Лесничества и заповедники',
    description: 'Организация патрулирования национальных парков и мониторинг туристических троп.',
  },
];

const teamMembers = [
  {
    id: 'member-dmitry',
    name: 'Дмитрий',
    role: 'Автор идеи и полевой эксперт',
    badge: 'Vision & Safety',
    initials: 'ДМ',
    skills: ['Полевая безопасность', 'Концепция продукта', 'Тестирование в горах'],
    description: 'Инициатор проекта и эксперт по горным походам. Отвечает за проверку надежности технологий в реальных суровых условиях дикой природы.',
  },
  {
    id: 'member-daniil',
    name: 'Даниил',
    role: 'Главный архитектор и ведущий разработчик',
    badge: 'Lead Architect',
    initials: 'ДН',
    skills: ['FSD / Clean Architecture', 'Web Crypto E2EE', 'Gemini AI API', 'Next.js 15'],
    description: 'Спроектировал модульную архитектуру системы, криптографический контур E2EE, интеграцию с Google Gemini AI и отказоустойчивые репозитории.',
  },
  {
    id: 'member-ilya',
    name: 'Илья',
    role: 'Руководитель проекта',
    badge: 'Project Lead',
    initials: 'ИЛ',
    skills: ['Управление бэклогом', 'Стратегия развития', 'Связь с МЧС и сообществами'],
    description: 'Отвечает за стратегию проекта, координацию этапов разработки, взаимодействие со спасательными службами и туроператорами.',
  },
  {
    id: 'member-alexander',
    name: 'Александр',
    role: 'Разработчик картографии и рельефа',
    badge: 'Core Developer',
    initials: 'АЛ',
    skills: ['Leaflet & React-Leaflet', 'OpenTopoMap / CyclOSM', 'SRTM DEM Модель'],
    description: 'Разработал интерактивный модуль маршрутизации, интеграцию слоев рельефа OpenStreetMap и алгоритмы расчета набора/сброса высот.',
  },
  {
    id: 'member-kirill',
    name: 'Кирилл',
    role: 'Разработчик клиентских систем и UI',
    badge: 'Core Developer',
    initials: 'КР',
    skills: ['Оптимизация производительности', 'Geohashing', 'Адаптивный UI/UX'],
    description: 'Разработка отзывчивых интерфейсов, фильтрация пространственных гео-запросов и оптимизация энергопотребления в фоновом режиме.',
  },
];

export default function AboutUs() {
  return (
    <div className="bg-background text-foreground animate-fade-in-slow pb-16">
      
      {/* Hero Section */}
      <header className="relative flex flex-col items-center justify-center min-h-[50vh] md:min-h-[60vh] text-center p-6 overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background/60 to-background -z-10" />
        <div className="relative z-10 max-w-4xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider">
            <HeartHandshake className="size-3.5" />
            Команда Treeline Tracker
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-foreground via-foreground/90 to-muted-foreground">
            Проект «Дозор»
          </h1>
          <p className="text-lg md:text-2xl font-medium text-primary">
            Не искать, а предотвращать. Не реагировать на кризис, а не допускать его.
          </p>
          <p className="max-w-2xl mx-auto text-sm md:text-base text-muted-foreground leading-relaxed">
            Мы создаем интеллектуальную экосистему безопасности для походов любой сложности, объединяя децентрализованную криптографию, спутниковую картографию и искусственный интеллект.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 space-y-20">
        
        {/* Problem Section with Visual Metrics */}
        <section id="problem-section" className="space-y-8">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-2xl md:text-4xl font-bold tracking-tight">
              Корень проблемы — <span className="text-primary">информационный вакуум</span>
            </h2>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              В дикой природе сотовая связь исчезает за первым же перевалом. Достаточно на минуту остановиться поправить рюкзак — и группа уходит вперед. В условиях отсутствия ориентиров начинается паника, а поисковые операции стартуют вслепую.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-card/50 backdrop-blur-sm border-primary/20 shadow-sm text-center">
              <CardContent className="pt-6">
                <p className="text-4xl md:text-5xl font-extrabold text-primary font-mono">85%</p>
                <p className="text-xs md:text-sm text-muted-foreground mt-2 font-medium">
                  туристов хотя бы раз теряли визуальный контакт с группой на маршруте
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm border-amber-500/20 shadow-sm text-center">
              <CardContent className="pt-6">
                <p className="text-4xl md:text-5xl font-extrabold text-amber-500 font-mono">40%</p>
                <p className="text-xs md:text-sm text-muted-foreground mt-2 font-medium">
                  экспедиций включают локальные поисковые задержки внутри отряда
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm border-emerald-500/20 shadow-sm text-center">
              <CardContent className="pt-6">
                <p className="text-4xl md:text-5xl font-extrabold text-emerald-500 font-mono">3 сек</p>
                <p className="text-xs md:text-sm text-muted-foreground mt-2 font-medium">
                  время экстренной доставки сигнала бедствия и точных GPS-координат
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Principles */}
        <section className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Инженерные принципы платформы
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              Фундаментальные правила, на которых построена каждая строчка нашего кода
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {principles.map((principle) => {
              const IconComponent = principle.icon;
              return (
                <Card
                  key={principle.id}
                  className="bg-card/60 backdrop-blur border-border/50 hover:border-primary/40 transition-all duration-200"
                >
                  <CardHeader className="flex flex-row items-start justify-between pb-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                        <IconComponent className="size-5" />
                      </div>
                      <CardTitle className="text-base font-bold">
                        {principle.title}
                      </CardTitle>
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {principle.badge}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                      {principle.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Team Section */}
        <section className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Команда проекта
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              Инженеры, разработчики и энтузиасты активного туризма
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teamMembers.map((member) => (
              <Card
                key={member.id}
                className="bg-card/60 border-border/50 hover:border-primary/40 transition-all duration-200 flex flex-col justify-between"
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg border border-primary/20">
                      {member.initials}
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                      {member.badge}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg font-bold mt-3">
                    {member.name}
                  </CardTitle>
                  <p className="text-xs font-semibold text-primary">
                    {member.role}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {member.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {member.skills.map((skill, sIdx) => (
                      <Badge key={`skill-${sIdx}`} variant="secondary" className="text-[10px]">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Vision and Future Perspectives */}
        <section className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Перспективы и расширение платформы
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              Технология адаптируется для любых условий, где отсутствует сотовая связь, но требуется безопасность людей
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {perspectives.map((p) => {
              const IconComp = p.icon;
              return (
                <div
                  key={p.id}
                  className="p-5 rounded-xl bg-card/60 border border-border/50 hover:border-primary/30 transition-all flex flex-col items-center text-center space-y-3"
                >
                  <div className="p-3 bg-primary/10 text-primary rounded-xl">
                    <IconComp className="size-6" />
                  </div>
                  <h4 className="font-bold text-sm text-foreground">{p.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.description}</p>
                </div>
              );
            })}
          </div>

          <Card className="bg-muted/40 border-border/50 text-center p-6">
            <div className="max-w-2xl mx-auto space-y-4">
              <h3 className="text-lg font-bold flex items-center justify-center gap-2">
                <Cpu className="size-5 text-primary" />
                Аппаратный вектор развития: LoRa & Mesh-радиоканал
              </h3>
              <p className="text-xs md:text-sm text-muted-foreground">
                В дорожной карте проекта заложена прямая интеграция со спецификацией MeshCore и энергоэффективными радиомодулями LoRa (868/915 МГц) для полной независимости от сотовых операторов в радиусе до 15–20 км в горах.
              </p>
            </div>
          </Card>
        </section>

      </main>
    </div>
  );
}
