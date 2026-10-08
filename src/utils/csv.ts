import { FlashcardItem } from '../types';

export function parseCsvToCards(csvText: string): FlashcardItem[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  const cards: FlashcardItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    // Skip header line if detected
    if (i === 0) {
      const lower = rawLine.toLowerCase();
      if (
        (lower.includes('word') || lower.includes('vocabulary') || lower.includes('คำศัพท์')) &&
        (lower.includes('meaning') || lower.includes('translation') || lower.includes('คำแปล'))
      ) {
        continue;
      }
    }

    // Split CSV respecting quotes
    const cols = splitCsvLine(rawLine);
    if (cols.length >= 2) {
      const word = cols[0].trim();
      const meaning = cols[1].trim();
      const sentence = cols[2] ? cols[2].trim() : undefined;

      if (word && meaning) {
        cards.push({
          id: `csv-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          word,
          meaning,
          sentence,
          step: 1,
          failCount: 0,
          successCount: 0
        });
      }
    }
  }

  return cards;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === ',' || char === '\t') && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Byte-order mark: without it Excel opens UTF-8 CSV as a legacy encoding and Thai turns to garbage
export const CSV_BOM = '﻿';

export function exportCardsToCsv(cards: FlashcardItem[]): string {
  const header = CSV_BOM + 'Word,Meaning,Sentence\n';
  const rows = cards.map(c => {
    const w = `"${c.word.replace(/"/g, '""')}"`;
    const m = `"${c.meaning.replace(/"/g, '""')}"`;
    const s = c.sentence ? `"${c.sentence.replace(/"/g, '""')}"` : '""';
    return `${w},${m},${s}`;
  });
  return header + rows.join('\n');
}
