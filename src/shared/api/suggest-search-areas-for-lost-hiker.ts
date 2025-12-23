'use server';

/**
 * @fileOverview Агент ИИ, который предлагает зоны поиска для пропавшего туриста на основе его последнего известного местоположения,
 * погодных условий и запланированных маршрутов.
 *
 * - suggestSearchAreas - Функция, которая предлагает зоны поиска для пропавшего туриста.
 * - SuggestSearchAreasInput - Тип входных данных для функции suggestSearchAreas.
 * - SuggestSearchAreasOutput - Тип возвращаемых данных для функции suggestSearchAreas.
 */

import {ai} from './genkit';
import {z} from 'genkit';

const SuggestSearchAreasInputSchema = z.object({
  lastKnownLocation: z
    .string()
    .describe('Последние известные GPS-координаты пропавшего туриста.'),
  weatherConditions: z
    .string()
    .describe('Текущие погодные условия в районе поиска.'),
  plannedRoute: z
    .string()
    .describe('Описание запланированного маршрута пропавшего туриста.'),
});
export type SuggestSearchAreasInput = z.infer<typeof SuggestSearchAreasInputSchema>;

const SuggestSearchAreasOutputSchema = z.object({
  suggestedSearchAreas: z
    .string()
    .describe('Описание предлагаемых зон поиска для пропавшего туриста.'),
  confidenceLevel: z
    .string()
    .describe('Уровень уверенности в предложенных зонах поиска.'),
  searchAreaPolygon: z.array(z.array(z.number())).describe('Массив массивов с GPS-координатами [широта, долгота], образующими многоугольник зоны поиска.'),
});
export type SuggestSearchAreasOutput = z.infer<typeof SuggestSearchAreasOutputSchema>;

export async function suggestSearchAreas(input: SuggestSearchAreasInput): Promise<SuggestSearchAreasOutput> {
  // Вызываем поток напрямую, так как мы находимся на сервере
  return await suggestSearchAreasFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestSearchAreasPrompt',
  input: {schema: SuggestSearchAreasInputSchema},
  output: {schema: SuggestSearchAreasOutputSchema},
  prompt: `Ты — эксперт-стратег по поисково-спасательным операциям.

  На основе последнего известного местоположения, погодных условий и запланированного маршрута пропавшего туриста, ты предложишь наиболее вероятные зоны для поиска.

  Последнее известное местоположение: {{{lastKnownLocation}}}
  Погодные условия: {{{weatherConditions}}}
  Планируемый маршрут: {{{plannedRoute}}}

  При предложении зон поиска учитывай следующие факторы:
  - Уровень опыта туриста
  - Рельеф местности
  - Погодные условия
  - Время суток
  - Любую другую релевантную информацию

  Выведи список предложенных зон поиска и уровень уверенности для каждой зоны.
  Также предоставь массив координат [широта, долгота], образующих многоугольник для наиболее вероятной зоны поиска. Координаты должны быть в непосредственной близости от последнего известного местоположения.
`,
});

export const suggestSearchAreasFlow = ai.defineFlow(
  {
    name: 'suggestSearchAreasFlow',
    inputSchema: SuggestSearchAreasInputSchema,
    outputSchema: SuggestSearchAreasOutputSchema,
  },
  async input => {
    try {
      const {output} = await prompt(input);
      if (!output) {
        throw new Error('ИИ не смог сгенерировать ответ.');
      }
      return output;
    } catch (e: any) {
      console.error(`Ошибка в потоке suggestSearchAreasFlow: ${e.message}`);
      // Передаем ошибку дальше, чтобы клиент мог ее обработать
      throw new Error(`Ошибка при обработке запроса ИИ: ${e.message}`);
    }
  }
);
