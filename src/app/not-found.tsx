export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <h2 className="text-2xl font-bold mb-2">Страница не найдена</h2>
      <p className="text-muted-foreground mb-4">Запрашиваемая страница не существует.</p>
      <a href="/" className="px-4 py-2 bg-primary text-primary-foreground rounded-md">
        Вернуться на главную
      </a>
    </div>
  );
}
