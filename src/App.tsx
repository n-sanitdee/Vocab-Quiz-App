import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  Plus,
  Upload,
  Download,
  Trash2,
  RotateCcw,
  Flame,
  Check,
  FileText,
  HelpCircle,
  Eye,
  ArrowRight,
  List,
  Edit2
} from 'lucide-react';
import { FlashcardItem, UserProgress } from './types';
import { DEFAULT_CARDS } from './data/defaultCards';
import { parseCsvToCards, exportCardsToCsv, CSV_BOM } from './utils/csv';
import { soundEffects } from './utils/sound';
import { speakText } from './utils/speech';

// v3: default deck changed to the GE5072 list, so browsers holding the old 10-word deck start fresh
const STORAGE_KEYS = {
  CARDS: 'plain_flashcards_items_v3',
  PROGRESS: 'plain_flashcards_progress_v3'
};

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function App() {
  // 1. Cards State
  const [cards, setCards] = useState<FlashcardItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CARDS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_CARDS;
  });

  // 2. Progress & Daily Streak State
  const [progress, setProgress] = useState<UserProgress>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROGRESS);
      if (saved) {
        const parsed = JSON.parse(saved);
        const today = getTodayStr();
        const yesterday = getYesterdayStr();
        if (parsed.lastStudiedDate !== today) {
          if (parsed.lastStudiedDate !== yesterday) {
            parsed.currentStreak = 0;
          }
          parsed.todayCount = 0;
        }
        return parsed;
      }
    } catch {
      // ignore
    }
    // Nothing studied yet: an empty date means the first answer starts the streak at 1
    return {
      currentStreak: 0,
      lastStudiedDate: '',
      todayCount: 0
    };
  });

  // 3. Active Study Queue & Batch Size (Optimized for Learning Capacity)
  // Research indicates 7-10 words per batch is the optimal cognitive capacity for spaced repetition.
  const [batchSize, setBatchSize] = useState<number | 'all'>(10);
  const [customBatchInput, setCustomBatchInput] = useState<string>('10');
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [studyQueue, setStudyQueue] = useState<FlashcardItem[]>([]);
  const [initialCount, setInitialCount] = useState(0);
  const [rememberedCount, setRememberedCount] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false); // false = หน้าคำศัพท์, true = หน้าเฉลย
  const [currentCardWasMissed, setCurrentCardWasMissed] = useState(false);
  const [isRoundFinished, setIsRoundFinished] = useState(false);
  const [activeTab, setActiveTab] = useState<'study' | 'manage'>('study');

  // 4. Form inputs for manual entry
  const [inputWord, setInputWord] = useState('');
  const [inputMeaning, setInputMeaning] = useState('');
  const [inputSentence, setInputSentence] = useState('');
  const [pasteCsvText, setPasteCsvText] = useState('');
  const [csvNotice, setCsvNotice] = useState<string | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Function to extract optimized batch of cards based on learning priority
  const getOptimizedBatch = (allCards: FlashcardItem[], size: number | 'all') => {
    if (allCards.length === 0) return [];
    if (size === 'all' || size >= allCards.length) return [...allCards];

    // Priority sorting: cards on lower stair step or with higher fail count come first
    const prioritized = [...allCards].sort((a, b) => {
      if (a.step !== b.step) return a.step - b.step;
      return b.failCount - a.failCount;
    });

    return prioritized.slice(0, size);
  };

  // Start or restart a study session with a specific batch size
  const startStudySession = (targetSize: number | 'all' = batchSize) => {
    if (cards.length === 0) {
      setStudyQueue([]);
      setInitialCount(0);
      return;
    }
    const batch = getOptimizedBatch(cards, targetSize);
    setStudyQueue(batch);
    setInitialCount(batch.length);
    setRememberedCount(0);
    setIsRevealed(false);
    setCurrentCardWasMissed(false);
    setIsRoundFinished(false);
  };

  // Initialize study queue when the deck changes (keyed on ids, so importing
  // a list of the same length still restarts; answering a card does not)
  const deckKey = cards.map(c => c.id).join('|');
  useEffect(() => {
    startStudySession(batchSize);
  }, [deckKey]);

  // Persist cards
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(cards));
    } catch {
      // ignore
    }
  }, [cards]);

  // Persist progress
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress));
    } catch {
      // ignore
    }
  }, [progress]);

  const currentCard = studyQueue[0] || null;

  // Track progress count & streak
  const recordStudyAttempt = (recalled: boolean) => {
    const today = getTodayStr();
    const yesterday = getYesterdayStr();
    let streak = progress.currentStreak;

    if (progress.lastStudiedDate !== today) {
      if (progress.lastStudiedDate === yesterday) {
        streak += 1;
      } else {
        streak = 1;
      }
    }

    setProgress(prev => ({
      ...prev,
      currentStreak: streak,
      lastStudiedDate: today,
      todayCount: (prev.lastStudiedDate === today ? prev.todayCount : 0) + 1
    }));
  };

  // Toggle card flip by clicking the card
  const handleToggleFlip = () => {
    soundEffects.playFlip(true);
    setIsRevealed(prev => !prev);
  };

  // Option 1: "ยังจำไม่ได้" -> Immediately proceeds to the next word & re-queues this card!
  const handleNotRemembered = () => {
    if (!currentCard) return;

    soundEffects.playMissed(true);
    recordStudyAttempt(false);

    // Update card statistics (failCount increases, step drops to 1)
    setCards(prev =>
      prev.map(c =>
        c.id === currentCard.id
          ? { ...c, failCount: c.failCount + 1, step: 1 }
          : c
      )
    );

    // QUIZLET-STYLE RE-QUEUE:
    // Move currentCard to later in the session queue so it appears again until remembered
    const remaining = studyQueue.slice(1);
    let nextQueue: FlashcardItem[];

    if (remaining.length <= 2) {
      nextQueue = [...remaining, currentCard];
    } else {
      // Re-insert 2-3 positions later so student encounters it again soon
      const insertIdx = Math.min(3, remaining.length);
      nextQueue = [
        ...remaining.slice(0, insertIdx),
        currentCard,
        ...remaining.slice(insertIdx)
      ];
    }

    // Immediately proceed to the next word!
    setStudyQueue(nextQueue);
    setIsRevealed(false);
    setCurrentCardWasMissed(false);
  };

  // Option 2 (Second option): "Next (จำได้)" -> Mark as remembered and proceed to the next word!
  const handleNextRemembered = () => {
    if (!currentCard) return;
    soundEffects.playSuccess(true);
    recordStudyAttempt(true);

    // Stair-pacing: step increases
    setCards(prev =>
      prev.map(c =>
        c.id === currentCard.id
          ? { ...c, successCount: c.successCount + 1, step: Math.min(5, c.step + 1) }
          : c
      )
    );

    setRememberedCount(prev => prev + 1);

    const remaining = studyQueue.slice(1);
    if (remaining.length === 0) {
      setIsRoundFinished(true);
      soundEffects.playFanfare(true);
    } else {
      setStudyQueue(remaining);
      setIsRevealed(false);
      setCurrentCardWasMissed(false);
    }
  };

  // Restart Round
  const handleRestartRound = () => {
    startStudySession(batchSize);
  };

  // Change batch size handler
  const handleSelectBatchSize = (size: number | 'all') => {
    setBatchSize(size);
    startStudySession(size);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (activeTab !== 'study' || isRoundFinished || !currentCard) return;

      // [1] = Option 1: ยังจำไม่ได้
      // [2] = Option 2: Next (จำได้)
      // [Space] = พลิกการ์ด (Flip card)
      if (e.key === '1') {
        e.preventDefault();
        handleNotRemembered();
      } else if (e.key === '2' || e.code === 'Enter') {
        e.preventDefault();
        handleNextRemembered();
      } else if (e.code === 'Space') {
        e.preventDefault();
        handleToggleFlip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRevealed, currentCard, studyQueue, activeTab, isRoundFinished, currentCardWasMissed]);

  // Audio Pronunciation
  const handlePronounce = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentCard) {
      speakText(currentCard.word);
    }
  };

  // Add Card Manually
  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputWord.trim() || !inputMeaning.trim()) return;

    const newCard: FlashcardItem = {
      id: `manual-${Date.now()}`,
      word: inputWord.trim(),
      meaning: inputMeaning.trim(),
      sentence: inputSentence.trim() || undefined,
      step: 1,
      failCount: 0,
      successCount: 0
    };

    const updated = [...cards, newCard];
    setCards(updated);
    setInputWord('');
    setInputMeaning('');
    setInputSentence('');
    setCsvNotice('เพิ่มคำศัพท์สำเร็จแล้ว!');
    setTimeout(() => setCsvNotice(null), 2500);
  };

  // Delete Card
  const handleDeleteCard = (id: string) => {
    if (cards.length <= 1) {
      alert('ควรมีคำศัพท์เหลืออย่างน้อย 1 คำ');
      return;
    }
    const updated = cards.filter(c => c.id !== id);
    setCards(updated);
  };

  // Upload CSV
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCsvToCards(text);
        if (parsed.length === 0) {
          alert('ไม่พบข้อมูลคำศัพท์ในไฟล์ CSV กรุณาตรวจสอบว่ามีอย่างน้อย 2 คอลัมน์ (คำศัพท์, คำแปล)');
          return;
        }
        setCards(parsed);
        setCsvNotice(`อัปโหลดสำเร็จ! นำเข้า ${parsed.length} คำศัพท์`);
        setTimeout(() => setCsvNotice(null), 3000);
      } catch {
        alert('เกิดข้อผิดพลาดในการอ่านไฟล์ CSV');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Paste CSV
  const handleImportPastedCsv = () => {
    if (!pasteCsvText.trim()) return;
    const parsed = parseCsvToCards(pasteCsvText);
    if (parsed.length === 0) {
      alert('ไม่พบข้อมูลคำศัพท์ที่ถูกต้อง กรุณาใส่รูปแบบ: คำศัพท์,คำแปล');
      return;
    }
    setCards(parsed);
    setPasteCsvText('');
    setCsvNotice(`นำเข้าข้อมูลสำเร็จ ${parsed.length} คำศัพท์!`);
    setTimeout(() => setCsvNotice(null), 3000);
  };

  // Export CSV
  const handleExportCsv = () => {
    const csvContent = exportCardsToCsv(cards);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flashcards_vocabulary.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download Sample CSV
  const handleDownloadSampleCsv = () => {
    const sample = CSV_BOM + 'Word,Meaning,Sentence\narticulate,พูดหรืออธิบายได้ชัดเจน,She was remarkably articulate during the meeting.\nmeticulous,พิถีพิถัน ละเอียดรอบคอบ,He kept meticulous notes throughout the experiment.\nresilient,ยืดหยุ่น ฟื้นตัวได้เร็ว,The city proved resilient after the crisis.\n';
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_flashcards_2column.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Reset to default cards
  const handleResetDefaults = () => {
    if (confirm(`ต้องการรีเซ็ตคำศัพท์กลับเป็นชุดเริ่มต้น GE5072 (${DEFAULT_CARDS.length} คำ) หรือไม่? ความคืบหน้าเดิมจะถูกล้าง`)) {
      setCards(DEFAULT_CARDS);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans">
      {/* 1. Header (Plain & Minimal) */}
      <header className="border-b border-slate-200 px-4 py-3 sm:py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 font-serif-display">
              Flashcard
            </h1>
            <span className="hidden sm:inline text-xs text-slate-400">· บัตรคำศัพท์ภาษาอังกฤษ</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Streak Counter */}
            <div
              title={`เรียนต่อเนื่อง ${progress.currentStreak} วัน (ทบทวนวันนี้ ${progress.todayCount} ครั้ง)`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-200 text-xs font-medium text-slate-700 bg-slate-50 whitespace-nowrap"
            >
              <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>{progress.currentStreak} วัน</span>
            </div>

            {/* Navigation Tabs (Plain Text Links) */}
            <div className="flex items-center border border-slate-200 rounded p-0.5 bg-slate-50 text-xs">
              <button
                onClick={() => setActiveTab('study')}
                className={`px-3 py-1 rounded font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'study'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                ท่องจำ
              </button>
              <button
                onClick={() => setActiveTab('manage')}
                className={`px-3 py-1 rounded font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'manage'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                คำศัพท์<span className="hidden sm:inline"> & CSV</span> ({cards.length})
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Body */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 flex flex-col">
        {/* Notice Message */}
        {csvNotice && (
          <div className="mb-4 p-3 text-xs bg-slate-100 border border-slate-300 rounded text-slate-800">
            {csvNotice}
          </div>
        )}

        {/* TAB 1: STUDY FLASHCARD (The core plain study view) */}
        {activeTab === 'study' && (
          <div className="flex-1 flex flex-col justify-center max-w-xl w-full mx-auto my-auto py-6">
            {cards.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-slate-300 rounded-lg p-6">
                <p className="text-slate-600 text-sm mb-3">ยังไม่มีคำศัพท์ในระบบ</p>
                <button
                  onClick={() => setActiveTab('manage')}
                  className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded hover:bg-slate-800 cursor-pointer"
                >
                  เพิ่มคำศัพท์หรืออัปโหลด CSV
                </button>
              </div>
            ) : isRoundFinished ? (
              /* Round Complete View */
              <div className="border border-slate-200 rounded-xl p-8 text-center space-y-4 bg-slate-50 max-w-lg mx-auto w-full">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold font-serif-display text-slate-900">
                  จำคำศัพท์ครบทั้งหมดในรอบนี้แล้ว!
                </h2>
                <p className="text-xs text-slate-600">
                  คุณทบทวนคำศัพท์ชุดนี้จนจำได้ครบทั้ง {initialCount} คำอย่างมีประสิทธิภาพ
                </p>

                <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-2">
                  <button
                    onClick={handleRestartRound}
                    className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 cursor-pointer transition-colors shadow-xs"
                  >
                    เริ่มรอบถัดไป ({batchSize === 'all' ? 'ทุกคำ' : `${batchSize} คำ`})
                  </button>
                  <button
                    onClick={() => handleSelectBatchSize(10)}
                    className="w-full sm:w-auto px-4 py-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    รอบมาตรฐาน (10 คำ แนะนำ)
                  </button>
                </div>
              </div>
            ) : currentCard ? (
              <div className="space-y-4 max-w-lg mx-auto w-full">
                {/* Learning Capacity & Batch Size Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500 font-medium">รอบละ:</span>
                    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                      {[5, 10, 15, 'all' as const].map((preset) => {
                        const isSelected = batchSize === preset;
                        const label =
                          preset === 'all'
                            ? `ทั้งหมด (${cards.length})`
                            : preset === 10
                            ? '10 คำ ⭐'
                            : `${preset} คำ`;
                        return (
                          <button
                            key={preset}
                            onClick={() => handleSelectBatchSize(preset)}
                            title={
                              preset === 10
                                ? 'เหมาะสมกับความจุสมอง (Optimal Cognitive Capacity): ~5-7 นาที ไม่ล้นความจำระยะสั้น'
                                : undefined
                            }
                            className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <span
                    title="Cognitive Load Theory: การเรียนครั้งละ 7-10 คำช่วยให้สมองจัดเก็บเข้าความจำระยะยาวได้ดีที่สุด"
                    className="text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-200/80 rounded px-2 py-0.5 font-medium self-start sm:self-center"
                  >
                    ความจุเหมาะสม: 10 คำ/รอบ
                  </span>
                </div>

                {/* Status Bar */}
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>
                    เหลือในรอบนี้: <strong>{studyQueue.length}</strong> คำ
                  </span>
                  <span>
                    จำได้แล้ว: <strong>{rememberedCount}</strong> / {initialCount} คำ
                  </span>
                </div>

                {/* Progress Bar (Plain line) */}
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (rememberedCount / (initialCount || 1)) * 100)}%`
                    }}
                  />
                </div>

                {/* 3D Flipping Flashcard with Fixed Dimensions & Colorful Styling */}
                <div
                  onClick={handleToggleFlip}
                  className="perspective-1000 w-full max-w-lg mx-auto h-[360px] cursor-pointer select-none"
                >
                  <div className={`relative w-full h-full card-flip-inner ${isRevealed ? 'is-flipped' : ''}`}>
                    {/* ================= FRONT SIDE (คำศัพท์) ================= */}
                    <div className="absolute inset-0 w-full h-full rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 text-white shadow-xl shadow-indigo-950/20 border border-indigo-400/30 p-8 flex flex-col justify-between backface-hidden">
                      {/* Top Bar: Audio only (no instructions) */}
                      <div className="flex items-center justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePronounce(e);
                          }}
                          title="ฟังเสียงอ่านคำศัพท์"
                          className="p-2.5 rounded-full text-indigo-100 hover:text-white bg-white/10 hover:bg-white/20 transition-all cursor-pointer shadow-xs"
                        >
                          <Volume2 className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Center: English Word */}
                      <div className="text-center my-auto px-2">
                        <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white font-serif-display drop-shadow-xs">
                          {currentCard.word}
                        </h2>
                      </div>

                      {/* Bottom Spacer (No instruction text) */}
                      <div className="h-4" />
                    </div>

                    {/* ================= BACK SIDE (คำแปล & ตัวอย่างประโยค) ================= */}
                    <div className="absolute inset-0 w-full h-full rounded-2xl bg-gradient-to-br from-white via-slate-50 to-indigo-50/40 border-2 border-indigo-200 text-slate-900 shadow-xl shadow-slate-900/10 p-7 sm:p-8 flex flex-col justify-between backface-hidden rotate-y-180 overflow-y-auto">
                      {/* Top Bar: Word + Audio */}
                      <div className="flex items-center justify-between pb-3 border-b border-indigo-100/80">
                        <span className="font-serif-display text-2xl sm:text-3xl font-bold text-indigo-950">
                          {currentCard.word}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePronounce(e);
                          }}
                          title="ฟังเสียงอ่านคำศัพท์"
                          className="p-2 rounded-full text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Center Content: Meaning + Sentence (No instructions) */}
                      <div className="my-auto py-2 space-y-4">
                        {/* คำแปลภาษาไทย */}
                        <div>
                          <p className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
                            {currentCard.meaning}
                          </p>
                        </div>

                        {/* ตัวอย่างประโยคภาษาอังกฤษ */}
                        {currentCard.sentence && (
                          <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100/90 text-slate-700 text-xs sm:text-sm italic leading-relaxed">
                            "{currentCard.sentence}"
                          </div>
                        )}
                      </div>

                      {/* Bottom Spacer (No instruction text) */}
                      <div className="h-2" />
                    </div>
                  </div>
                </div>

                {/* THE TWO BUTTONS: FIRST OPTION IS "ยังจำไม่ได้", SECOND OPTION IS "Next" */}
                <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto w-full pt-1">
                  {/* ปุ่ม 1 (ตัวเลือกแรก): ยังจำไม่ได้ */}
                  <button
                    onClick={handleNotRemembered}
                    className="py-3.5 px-4 rounded-xl border-2 border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-900 text-sm font-bold transition-all cursor-pointer flex flex-col items-center justify-center active:scale-[0.98] shadow-xs"
                  >
                    <span>ยังจำไม่ได้</span>
                  </button>

                  {/* ปุ่ม 2 (ตัวเลือกที่สอง): Next */}
                  <button
                    onClick={handleNextRemembered}
                    className="py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-all cursor-pointer flex flex-col items-center justify-center shadow-md shadow-indigo-600/25 active:scale-[0.98]"
                  >
                    <span>Next</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* TAB 2: MANAGE CARDS & CSV (ป้อนคำศัพท์เอง หรือ อัปโหลด CSV แบบสองคอลัมน์) */}
        {activeTab === 'manage' && (
          <div className="space-y-8 max-w-2xl mx-auto w-full py-4">
            {/* Section A: ป้อนคำศัพท์และคำแปลเอง */}
            <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                1. ป้อนคำศัพท์และคำแปลเอง
              </h2>

              <form onSubmit={handleAddCard} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      คำศัพท์ภาษาอังกฤษ *
                    </label>
                    <input
                      type="text"
                      required
                      value={inputWord}
                      onChange={e => setInputWord(e.target.value)}
                      placeholder="เช่น resilient"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:outline-none focus:border-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      คำแปลภาษาไทย *
                    </label>
                    <input
                      type="text"
                      required
                      value={inputMeaning}
                      onChange={e => setInputMeaning(e.target.value)}
                      placeholder="เช่น ยืดหยุ่น ฟื้นตัวได้เร็ว"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:outline-none focus:border-slate-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    ตัวอย่างประโยค (จะแสดงที่หน้าเฉลยความหมาย)
                  </label>
                  <input
                    type="text"
                    value={inputSentence}
                    onChange={e => setInputSentence(e.target.value)}
                    placeholder="เช่น She was remarkably resilient after the setback."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:outline-none focus:border-slate-600"
                  />
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>บันทึกคำศัพท์</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Section B: อัปโหลด CSV แบบสองคอลัมน์ */}
            <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  2. อัปโหลด CSV แบบสองคอลัมน์
                </h2>
                <button
                  onClick={handleDownloadSampleCsv}
                  className="text-xs text-slate-600 hover:text-slate-900 underline cursor-pointer"
                >
                  ดาวน์โหลดไฟล์ตัวอย่าง CSV
                </button>
              </div>

              <p className="text-xs text-slate-500">
                ไฟล์ CSV รูปแบบ 2 คอลัมน์ (คอลัมน์ 1: คำศัพท์, คอลัมน์ 2: คำแปล) หรือ 3 คอลัมน์รวมตัวอย่างประโยค
              </p>

              <div className="flex flex-wrap gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 text-xs font-medium text-slate-800 border border-slate-300 rounded hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>เลือกไฟล์ CSV จากเครื่อง</span>
                </button>

                <button
                  onClick={handleExportCsv}
                  className="px-4 py-2 text-xs font-medium text-slate-800 border border-slate-300 rounded hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ดาวน์โหลดคำศัพท์ปัจจุบัน (Export CSV)</span>
                </button>
              </div>

              {/* Paste CSV Direct Input */}
              <div className="pt-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  หรือวางข้อความ CSV โดยตรง (เช่น word,meaning):
                </label>
                <textarea
                  rows={3}
                  value={pasteCsvText}
                  onChange={e => setPasteCsvText(e.target.value)}
                  placeholder={`meticulous,พิถีพิถัน\nresilient,ยืดหยุ่น\npragmatic,เน้นปฏิบัติจริง`}
                  className="w-full p-2 text-xs font-mono border border-slate-300 rounded focus:outline-none focus:border-slate-600"
                />
                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleImportPastedCsv}
                    disabled={!pasteCsvText.trim()}
                    className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded disabled:opacity-40 cursor-pointer"
                  >
                    นำเข้าข้อความที่วาง
                  </button>
                </div>
              </div>
            </div>

            {/* Section C: รายการคำศัพท์ทั้งหมด */}
            <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">
                  รายการคำศัพท์ทั้งหมด ({cards.length} คำ)
                </h3>
                <button
                  onClick={handleResetDefaults}
                  className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  รีเซ็ตคำศัพท์เป็นค่าเริ่มต้น
                </button>
              </div>

              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {cards.map((c, idx) => (
                  <div
                    key={c.id}
                    className="py-2.5 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-mono w-5">{idx + 1}.</span>
                        <strong className="text-slate-900 font-serif-display text-sm">
                          {c.word}
                        </strong>
                        <span className="text-slate-600">→ {c.meaning}</span>
                      </div>
                      {c.sentence && (
                        <p className="text-slate-500 italic pl-7 text-[11px]">
                          "{c.sentence}"
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteCard(c.id)}
                      title="ลบคำนี้"
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setActiveTab('study')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded hover:bg-slate-800 cursor-pointer"
                >
                  เริ่มฝึกท่องจำทันที →
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. Footer */}
      <footer className="border-t border-slate-200 py-3 text-center text-xs text-slate-400">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between">
          <span>Flashcard English Course</span>
          <span>หน้าคำศัพท์ ↔ หน้าเฉลยความหมาย & ตัวอย่างประโยค</span>
        </div>
      </footer>
    </div>
  );
}
