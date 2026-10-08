import { FlashcardItem } from '../types';
import { parseCsvToCards } from '../utils/csv';
import ge5072Csv from '../../vocab/GE5072_vocab.csv?raw';

// ชุดคำศัพท์เริ่มต้น = คำศัพท์รายวิชา GE5072 จาก vocab/GE5072_vocab.csv
// (คอลัมน์: Word, Meaning, Sentence, Lesson — แอปใช้ 3 คอลัมน์แรก)
export const DEFAULT_CARDS: FlashcardItem[] = parseCsvToCards(ge5072Csv).map((card, i) => ({
  ...card,
  id: `ge5072-${i + 1}`
}));
