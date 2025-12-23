
'use client';

import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Zap, Target, Smile, Mountain, Activity, HardHat, Building, ChevronDown, CheckCircle, Code } from 'lucide-react';

const principles = [
    {
        icon: <Zap className="size-8 text-primary" />,
        title: "Принцип Автоматики",
        description: "Система работает сама. Задайте безопасный радиус, и если кто-то его покинет — у него и у руководителя группы раздастся сигнал. Система бдит, пока вы наслаждаетесь походом.",
    },
    {
        icon: <Target className="size-8 text-primary" />,
        title: "Принцип Точности",
        description: "В случае ЧС достаточно одного нажатия на кнопку SOS. Точные GPS-координаты пострадавшего мгновенно отправляются на карты всех участников группы.",
    },
    {
        icon: <Smile className="size-8 text-primary" />,
        title: "Принцип Спокойствия",
        description: "Новички перестают панически бояться отстать и могут наслаждаться природой. Гиды получают цифрового помощника, который многократно повышает безопасность группы.",
    }
]

const perspectives = [
    { icon: Mountain, title: "Горнолыжные курорты", description: "Контроль групп фрирайдеров в лавиноопасных зонах." },
    { icon: Activity, title: "Поисковые отряды", description: "Передача SOS-сигнала напрямую в диспетчерскую службу спасателей." },
    { icon: HardHat, title: "Промышленность", description: "Мониторинг персонала на удалённых стройках, карьерах и вышках." },
    { icon: Building, title: "Сельское хозяйство", description: "Учёт и координация работы на огромных территориях." },
];

export default function AboutUs() {
  return (
    <div className="bg-background text-foreground animate-fade-in-slow">
      <header className="relative flex flex-col items-center justify-center h-[60vh] md:h-[70vh] text-center p-4 overflow-hidden">
         <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background -z-10 animate-gradient-move bg-size-200" />
        <div className="absolute inset-0 bg-background/50 dark:bg-black/50 backdrop-blur-sm z-0" />
        <div className="relative z-10 animate-fade-in-up">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70 dark:from-white dark:to-neutral-300">
                Проект "Дозор"
            </h1>
            <p className="mt-4 text-lg md:text-xl max-w-3xl text-muted-foreground dark:text-neutral-200">
               Меняем правила игры: не искать, а предотвращать. <br/> Не реагировать на кризис, а не допускать его.
            </p>
            <a href="#problem-section" className="mt-8 inline-block animate-bounce">
                <ChevronDown className="size-10 text-muted-foreground/70 dark:text-white/70" />
            </a>
        </div>
      </header>
      
      <main className="max-w-5xl mx-auto px-4 py-16 sm:px-6 lg:px-8 space-y-24">
        <section id="problem-section" className="scroll-mt-20">
            <div className="text-center">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Корень проблемы — <span className="text-primary">информационный вакуум</span></h2>
                <p className="max-w-3xl mx-auto text-lg text-muted-foreground mt-4">
                   Представьте: поход, вы на секунду остановились, а через десять минут понимаете — вы одни. Без связи. В тишине. Начинается паника. Поиски в такой ситуации ведутся вслепую, от точки, где человека видели в последний раз. Это поиск иголки в стоге сена, где каждый час на вес золота.
                </p>
            </div>
             <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="bg-card/50 backdrop-blur-sm border-primary/20 shadow-lg hover:shadow-primary/20 transition-shadow duration-300">
                    <CardContent className="p-6 text-center">
                        <p className="text-6xl font-bold text-primary">85%</p>
                        <p className="text-muted-foreground mt-2">туристов хотя бы раз теряли визуальный контакт с группой в походе.</p>
                    </CardContent>
                </Card>
                <Card className="bg-card/50 backdrop-blur-sm border-accent/20 shadow-lg hover:shadow-accent/20 transition-shadow duration-300">
                    <CardContent className="p-6 text-center">
                        <p className="text-6xl font-bold text-accent">40%</p>
                        <p className="text-muted-foreground mt-2">походов включают в себя мини-поисковую операцию внутри самой группы.</p>
                    </CardContent>
                </Card>
            </div>
        </section>

        <section>
            <div className="text-center">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-12">Как мы решаем эту проблему</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {principles.map((feature, index) => (
                     <Card key={index} className="text-center bg-card border-border/50 shadow-md hover:-translate-y-2 transition-transform duration-300">
                        <CardHeader className="items-center">
                            <div className="p-4 bg-primary/10 rounded-full">
                                {feature.icon}
                            </div>
                            <CardTitle className="mt-4">{feature.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">{feature.description}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </section>

        <section>
            <div className="text-center">
                 <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-12">Перспективы и видение</h2>
            </div>
            <Card className="bg-card/50 border-border/50 shadow-xl overflow-hidden">
                <CardContent className="p-8 md:p-12">
                     <p className="text-center text-muted-foreground mb-12 max-w-3xl mx-auto text-lg">
                        Наша технология не ограничивается лесом. Мы создаём платформу для безопасности в любой среде, где нет стабильной связи, но есть люди, за которых кто-то отвечает.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-center">
                        {perspectives.map((p, i) => (
                            <div key={i} className="flex flex-col items-center gap-3 p-4 rounded-xl bg-background transition-all duration-300 hover:bg-muted/80 hover:shadow-lg">
                                <div className="bg-primary/10 p-4 rounded-full">
                                    <p.icon className="size-8 text-primary" />
                                </div>
                                <h4 className="font-semibold text-lg">{p.title}</h4>
                                <p className="text-sm text-muted-foreground">{p.description}</p>
                            </div>
                        ))}
                    </div>
                     <div className="mt-12 text-center">
                         <h3 className="text-xl font-semibold mb-4 text-foreground">Технологический стек будущего:</h3>
                         <div className="flex justify-center items-center gap-6 flex-wrap">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <CheckCircle className="text-primary size-5"/>
                                <span>Высокоточный GPS</span>
                            </div>
                             <div className="flex items-center gap-2 text-muted-foreground">
                                <CheckCircle className="text-primary size-5"/>
                                <span>Энергоэффективная LoRa</span>
                             </div>
                             <div className="flex items-center gap-2 text-muted-foreground">
                                <CheckCircle className="text-primary size-5"/>
                                <span>Ударопрочный корпус</span>
                             </div>
                         </div>
                     </div>
                </CardContent>
            </Card>
        </section>

        <section>
            <div className="text-center">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-12">Наша команда</h2>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="flex flex-col items-center text-center p-6 bg-card rounded-lg border-border/50 shadow-md">
                    <h3 className="text-2xl font-bold">Дмитрий</h3>
                    <p className="text-primary font-semibold mt-1">Автор идеи</p>
                    <p className="text-muted-foreground mt-3 text-sm">Отвечает за надежность и простоту технологии в полевых условиях.</p>
                </div>
                 <div className="flex flex-col items-center text-center p-6 bg-card rounded-lg border-border/50 shadow-md">
                    <h3 className="text-2xl font-bold">Даниил</h3>
                    <p className="text-primary font-semibold mt-1">Главный архитектор и разработчик</p>
                    <p className="text-muted-foreground mt-3 text-sm">Превращает идеи в работающий код и надёжную архитектуру.</p>
                </div>
                 <div className="flex flex-col items-center text-center p-6 bg-card rounded-lg border-border/50 shadow-md">
                    <h3 className="text-2xl font-bold">Илья</h3>
                    <p className="text-primary font-semibold mt-1">Руководитель проекта</p>
                    <p className="text-muted-foreground mt-3 text-sm">Отвечает за стратегию, продвижение и связь с пользователями.</p>
                </div>
            </div>
        </section>

      </main>
    </div>
  );
}
