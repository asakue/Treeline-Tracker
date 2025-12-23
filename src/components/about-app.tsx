
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import {
  Code,
  Terminal,
  FolderTree,
  Rocket,
  Github,
  Newspaper,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';

const techStack = [
  { name: 'Next.js', description: 'React-фреймворк для production.' },
  { name: 'React', description: 'Библиотека для создания пользовательских интерфейсов.' },
  { name: 'TypeScript', description: 'Строгая типизация для JavaScript.' },
  { name: 'Tailwind CSS', description: 'Утилитарный CSS-фреймворк.' },
  { name: 'Genkit', description: 'Платформа для разработки AI-приложений.' },
  { name: 'shadcn/ui', description: 'Коллекция повторно используемых компонентов.' },
  { name: 'Leaflet', description: 'Библиотека для интерактивных карт.' },
  { name: 'Recharts', description: 'Библиотека для создания диаграмм.' },
  { name: 'Firebase', description: 'Платформа для веб- и мобильных приложений.' },
];

const scripts = [
  { command: 'npm run dev', description: 'Запуск приложения в режиме разработки.' },
  { command: 'npm run build', description: 'Сборка приложения для production.' },
  { command: 'npm run start', description: 'Запуск собранного приложения.' },
  { command: 'npm run lint', description: 'Проверка кода с помощью линтера.' },
];

const projectStructure = `
.
├── public/       # Статические ассеты
├── src/
│   ├── app/      # Основные файлы приложения Next.js
│   ├── components/ # Компоненты React
│   ├── lib/      # Вспомогательные функции
│   └── ai/       # Файлы, связанные с Genkit
├── .env.local    # Локальные переменные окружения
├── package.json
└── README.md
`;

const updatesLog = `
## v0.1 (19.12.2025)

Это первый стабильный релиз приложения "Дозор" с базовой функциональностью.

### ✨ Новые функции и улучшения UX

- **Приветственный экран:** Добавлена красивая анимация загрузки при первом входе в приложение с надписью "Добро пожаловать в Дозор".
- **Индикаторы загрузки:** Улучшены экраны загрузки для всех разделов. Теперь, если загрузка затягивается, появляется сообщение с просьбой проверить интернет-соединение.
- **Исправление "мигания" темы:** Устранена проблема, из-за которой при загрузке приложения на короткое время появлялась светлая тема перед переключением на тёмную. Теперь темная тема включена по умолчанию и отображается корректно с самого начала.

### 🎨 Стилизация и UI

- **Цветовые схемы:** Восстановлена оригинальная цветовая схема для тёмной темы и исправлено отображение бокового меню в светлой теме.
- **Адаптация хедера:** Заголовок на странице "О нас" теперь корректно отображается в светлой теме.

### 🛠️ Рефакторинг и исправления

- **Логика чата:** Улучшена логика обновления сообщений в компоненте чата для повышения стабильности и предсказуемости.
- **Логика карты:** Проведен рефакторинг компонента карты. Вспомогательные функции вынесены в отдельный файл \`map-utils.ts\`, а код избавлен от небезопасных практик изменения глобальных прототипов.
- **Система обновлений:** Добавлен этот раздел, чтобы вы всегда были в курсе последних изменений!
`;

export default function AboutApp() {
  return (
    <div className="bg-background text-foreground animate-fade-in-slow p-4 md:p-6 space-y-6">
      <main className="max-w-4xl mx-auto space-y-12">
        <section className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            О приложении "Дозор"
          </h1>
          <p className="max-w-2xl mx-auto text-lg text-muted-foreground mt-4">
            Технический обзор архитектуры, технологий и структуры проекта.
          </p>
        </section>

        <Card className="bg-card/50 border-border/50 shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Newspaper className="size-6 text-primary" />
              </div>
              <CardTitle>Журнал обновлений</CardTitle>
            </div>
            <CardDescription>
              Список последних изменений и улучшений в приложении.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] w-full rounded-md border p-4 bg-muted/30">
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-mono">
                {updatesLog.trim().split('\n').map((line, index) => {
                    if (line.startsWith('## ')) {
                      return <h2 key={index} className="text-xl font-bold mt-4 mb-2">{line.substring(3)}</h2>;
                    }
                    if (line.startsWith('### ')) {
                      return <h3 key={index} className="text-lg font-semibold mt-3 mb-1">{line.substring(4)}</h3>;
                    }
                     if (line.startsWith('- **')) {
                      const boldEnd = line.indexOf('**', 3);
                      const boldText = line.substring(3, boldEnd);
                      const restText = line.substring(boldEnd + 2);
                      return <p key={index} className="my-1.5"><strong className="text-foreground">{boldText}</strong>{restText}</p>;
                    }
                    return <p key={index} className="my-1">{line}</p>;
                  })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50 border-border/50 shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Github className="size-6 text-primary" />
              </div>
              <CardTitle>Исходный код</CardTitle>
            </div>
            <CardDescription>
              Проект имеет открытый исходный код. Вы можете ознакомиться с ним на GitHub и внести свой вклад.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href="https://github.com/asakue/Treeline-Tracker" target="_blank" rel="noopener noreferrer">
              <Button className="w-full">
                <Github className="mr-2" />
                Перейти в репозиторий
              </Button>
            </a>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50 shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Code className="size-6 text-primary" />
              </div>
              <CardTitle>Технологический стек</CardTitle>
            </div>
            <CardDescription>
              Приложение построено на современном и надежном стеке технологий для
              обеспечения производительности и масштабируемости.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {techStack.map((tech) => (
                <div
                  key={tech.name}
                  className="p-4 bg-muted/50 rounded-lg"
                >
                  <p className="font-semibold text-foreground">{tech.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {tech.description}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50 shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <FolderTree className="size-6 text-primary" />
              </div>
              <CardTitle>Структура проекта</CardTitle>
            </div>
            <CardDescription>
              Логическая организация файлов и директорий в проекте.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground whitespace-pre-wrap font-mono">
              {projectStructure.trim()}
            </pre>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50 border-border/50 shadow-lg">
          <CardHeader>
             <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Terminal className="size-6 text-primary" />
              </div>
              <CardTitle>Скрипты для запуска</CardTitle>
            </div>
            <CardDescription>
              Основные команды для работы с приложением.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {scripts.map((script) => (
              <div key={script.command} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-muted/50 rounded-lg">
                <Badge variant="outline" className="font-mono text-sm max-w-max mb-2 sm:mb-0">
                  {script.command}
                </Badge>
                <p className="text-sm text-muted-foreground sm:text-right text-left">{script.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-primary to-accent text-primary-foreground border-0">
            <CardHeader>
                 <div className="flex items-center gap-4">
                    <Rocket className="size-6" />
                    <CardTitle>Начало работы</CardTitle>
                 </div>
            </CardHeader>
            <CardContent>
                 <p className="text-sm opacity-90 mb-4">
                    Клонируйте репозиторий, установите зависимости и запустите сервер для разработки.
                  </p>
                  <pre className="p-3 bg-black/20 rounded-md text-sm text-white/80 whitespace-pre-wrap font-mono">
                    <code>
                      git clone [URL репозитория]
                      <br />
                      npm install
                      <br />
                      npm run dev
                    </code>
                  </pre>
            </CardContent>
        </Card>
      </main>
    </div>
  );
}
