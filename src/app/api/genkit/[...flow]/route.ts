import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import '@/shared/api/suggest-search-areas-for-lost-hiker';

// Инициализируем плагин Google AI, если он еще не был добавлен
if (!genkit.hasPlugin('google-ai')) {
  genkit.plugin('google-ai', googleAI({apiKey: process.env.GEMINI_API_KEY}));
}

export {genkit as GET, genkit as POST};
