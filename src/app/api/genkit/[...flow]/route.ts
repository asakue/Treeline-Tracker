'use server';

import {genkit} from 'genkit';
import '@/shared/api/suggest-search-areas-for-lost-hiker';

// Этот файл теперь просто реэкспортирует настроенный genkit.
// Вся конфигурация плагинов происходит в src/ai/genkit.ts
// или других местах, где определяются flows.

export {genkit as GET, genkit as POST};
