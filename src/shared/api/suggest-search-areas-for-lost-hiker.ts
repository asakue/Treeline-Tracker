/**
 * @fileOverview Сервисный клиент для вызова рекомендаций поиска пропавшего туриста.
 */

export interface SuggestSearchAreasInput {
  lastKnownLocation: string;
  weatherConditions: string;
  plannedRoute: string;
}

export interface SuggestSearchAreasOutput {
  suggestedSearchAreas: string;
  confidenceLevel: string;
  searchAreaPolygon: [number, number][];
}

export async function suggestSearchAreas(input: SuggestSearchAreasInput): Promise<SuggestSearchAreasOutput> {
  const response = await fetch('/api/search-areas', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Ошибка сервера (${response.status})`);
  }

  const result = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Не удалось получить рекомендации по поиску');
  }

  return result.data as SuggestSearchAreasOutput;
}
