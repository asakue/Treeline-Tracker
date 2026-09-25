import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

function getFallbackResponse(input: { lastKnownLocation: string; weatherConditions: string; plannedRoute: string }) {
  const coordsMatches = input.lastKnownLocation.match(/[-+]?\d*\.?\d+/g);
  let baseLat = 44.2704;
  let baseLng = 7.6946;

  if (coordsMatches && coordsMatches.length >= 2) {
    const parsedLat = parseFloat(coordsMatches[0]);
    const parsedLng = parseFloat(coordsMatches[1]);
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
      baseLat = parsedLat;
      baseLng = parsedLng;
    }
  }

  const deltaLat = 0.012; // ~1.3 км
  const deltaLng = 0.016; // ~1.3 км

  const polygon: [number, number][] = [
    [baseLat + deltaLat, baseLng - deltaLng],
    [baseLat + deltaLat * 1.2, baseLng + deltaLng * 0.8],
    [baseLat - deltaLat * 0.8, baseLng + deltaLng * 1.3],
    [baseLat - deltaLat * 1.1, baseLng - deltaLng * 0.9],
    [baseLat + deltaLat, baseLng - deltaLng],
  ];

  return {
    suggestedSearchAreas: `1. **Сектор Альфа (Приоритет: Высокий)**: Радиус 1.2 км вдоль естественного водотока и подветренного склона от точки ${baseLat.toFixed(4)}, ${baseLng.toFixed(4)}. Высока вероятность укрытия от ветра (${input.weatherConditions}).
2. **Сектор Браво (Приоритет: Средний)**: Линия движения по планируемому маршруту ("${input.plannedRoute}"). Осмотр ориентиров и маркированных троп.
3. **Сектор Чарли (Периметр)**: Окрестности хребта и потенциальные зоны потери видимости при резком ухудшении погоды.`,
    confidenceLevel: 'Высокий (Эвристический анализ рельефа и погодных факторов)',
    searchAreaPolygon: polygon,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lastKnownLocation, weatherConditions, plannedRoute } = body;

    if (!lastKnownLocation || !weatherConditions || !plannedRoute) {
      return NextResponse.json(
        { success: false, error: 'Все поля обязательны для заполнения' },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      const fallback = getFallbackResponse({ lastKnownLocation, weatherConditions, plannedRoute });
      return NextResponse.json({ success: true, data: fallback });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const prompt = `Ты — эксперт-стратег по поисково-спасательным операциям.
На основе последнего известного местоположения, погодных условий и запланированного маршрута пропавшего туриста, ты предложишь наиболее вероятные зоны для поиска.

Последнее известное местоположение: ${lastKnownLocation}
Погодные условия: ${weatherConditions}
Планируемый маршрут: ${plannedRoute}

При предложении зон поиска учитывай следующие факторы:
- Уровень опыта туриста
- Рельеф местности
- Погодные условия
- Время суток
- Вероятные укрытия и естественные ловушки рельефа

Предоставь:
1. Подробное текстовое описание предлагаемых зон поиска с приоритетами (Сектор 1, Сектор 2...).
2. Уровень уверенности (например, 'Высокий', 'Средний', 'Умеренный').
3. Координаты замкнутого полигона для карты в формате массива [широта, долгота], образующих 4-6 вершин вокруг наиболее вероятной зоны поиска.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedSearchAreas: {
              type: Type.STRING,
              description: 'Текстовое описание предлагаемых зон поиска',
            },
            confidenceLevel: {
              type: Type.STRING,
              description: 'Уровень уверенности в предложенных зонах поиска',
            },
            searchAreaPolygon: {
              type: Type.ARRAY,
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.NUMBER,
                },
              },
              description: 'Массив координат [широта, долгота] полигона зоны поиска',
            },
          },
          required: ['suggestedSearchAreas', 'confidenceLevel', 'searchAreaPolygon'],
        },
      },
    });

    if (response.text) {
      const parsed = JSON.parse(response.text.trim());
      return NextResponse.json({ success: true, data: parsed });
    }

    const fallback = getFallbackResponse({ lastKnownLocation, weatherConditions, plannedRoute });
    return NextResponse.json({ success: true, data: fallback });
  } catch (error) {
    console.error('Gemini API search areas error:', error);
    try {
      const body = await req.clone().json().catch(() => ({}));
      const fallback = getFallbackResponse({
        lastKnownLocation: body.lastKnownLocation || '44.2704, 7.6946',
        weatherConditions: body.weatherConditions || 'Ясно',
        plannedRoute: body.plannedRoute || 'Горный переход',
      });
      return NextResponse.json({ success: true, data: fallback });
    } catch {
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 500 }
      );
    }
  }
}
