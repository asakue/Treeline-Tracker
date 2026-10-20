import { z } from 'zod';

export const SuggestSearchAreasInputSchema = z.object({
  lastKnownLocation: z.string().min(1, 'Требуется последняя известная точка'),
  weatherConditions: z.string().min(1, 'Требуются погодные условия'),
  plannedRoute: z.string().min(1, 'Требуется запланированный маршрут'),
});

export const SuggestSearchAreasOutputSchema = z.object({
  suggestedSearchAreas: z.string(),
  confidenceLevel: z.string(),
  searchAreaPolygon: z.array(z.tuple([z.number(), z.number()])),
});

export type SuggestSearchAreasInput = z.infer<typeof SuggestSearchAreasInputSchema>;
export type SuggestSearchAreasOutput = z.infer<typeof SuggestSearchAreasOutputSchema>;

