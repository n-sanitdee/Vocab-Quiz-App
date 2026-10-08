export interface FlashcardItem {
  id: string;
  word: string; // คำศัพท์
  meaning: string; // คำแปลภาษาไทย
  sentence?: string; // ตัวอย่างประโยคบริบท (แสดงหน้าเฉลย)
  step: number; // 1-5 stair-pacing level
  failCount: number; // จำนวนครั้งที่กดเฉลย (ยังจำไม่ได้)
  successCount: number; // จำนวนครั้งที่กด Next (จำได้)
  lastStudied?: string;
}

export interface UserProgress {
  currentStreak: number;
  lastStudiedDate: string;
  todayCount: number;
}
