export type SuggestSearchAreasInput = {
  lastKnownLocation: string;
  weatherConditions: string;
  plannedRoute: string;
};

export type SuggestSearchAreasOutput = {
  suggestedSearchAreas: string;
  confidenceLevel: string;
  searchAreaPolygon: [number, number][];
};
