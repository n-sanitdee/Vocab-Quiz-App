# Vocab Quiz App

Flashcards for memorising English vocabulary. Each card has the English word or phrase on the front. The back has the Thai meaning and an example sentence.

The default deck is the vocabulary from **GE5072 / GE072 Business English for International Communication 1** (UTCC, semester 1/2569). You can swap in any other word list from a CSV file.

**Open the app:** <https://n-sanitdee.github.io/Vocab-Quiz-App/>

The interface is in Thai. The app runs entirely in the browser. It needs no account, no server and no API key.

## How studying works

1. **Pick a round size.** Choose 5, 10, 15 or all cards per round. The default is 10.
2. **Flip the card.** The front shows the English phrase. Tap the card or press Space to see the Thai meaning and the example sentence. The speaker button reads the phrase aloud with the browser's built-in English voice.
3. **Answer honestly.**
   - **ยังจำไม่ได้** (not yet) puts the card back in the queue behind the next three cards, or at the end if fewer are left. It comes round again in the same round.
   - **Next** marks the card as remembered and takes it out of the round.

   The round ends when every card has been marked remembered once.
4. **Weak cards come first.** Each card is on a step from 1 to 5. **Next** moves it up one step and **ยังจำไม่ได้** sends it back to step 1. A new round is filled with the lowest-step cards first. Among cards on the same step, the most-missed ones go first. In practice a student works through the deck ten cards at a time and sees their weak cards again before new ones.

The flame in the header counts the daily streak. That is the number of days in a row with at least one card answered.

Steps are not tied to dates. This is a priority queue, not scheduled spaced repetition of the Anki kind.

### Keyboard shortcuts

| Key | Action |
|---|---|
| Space | Flip the card |
| 1 | ยังจำไม่ได้ (not yet) |
| 2 or Enter | Next (remembered) |

## The GE5072 vocabulary list

The list is in [`vocab/GE5072_vocab.csv`](vocab/GE5072_vocab.csv). It has 107 items, in lesson order:

| Lesson | Items | Taken from |
|---|---:|---|
| 1.1 Transferable Skills | 16 | Video 1.1.1 word list and the Key Vocabulary slides |
| 1.2 Careers Advice | 7 | Words to Listen For, audio 1.01 |
| 2.1 Japan's Economy | 13 | Sector vs. industry, the three economic sectors, and video 2.1.1 |
| 2.2 The Energy Industry | 7 | Compound nouns |
| 4.1 One Size Fits All | 18 | Video 4.1.1, the six collocations, and the word families (verb · noun · adjective) |
| 4.5 Confirming an Order | 28 | Order-letter phrases and verbs + prepositions |
| Describing Trends (Final Project) | 18 | Trend verbs, adverbs and adjectives from the project word bank |

Phrases are kept whole with their preposition, the way they are taught in class. For example the list has *be good at problem solving* and *account for 75% of output*, not *problem solving* and *account* on their own. "Something" is written out in full, not as "sth", so that the pronunciation button reads it properly.

The example sentences were written for this app and are not copied from the coursebook (*Business Partner B1*, Pearson, 2018).

### Editing the list

The CSV has four columns:

| Column | Content |
|---|---|
| Word | The English word or phrase (front of the card) |
| Meaning | The Thai meaning (back of the card) |
| Sentence | An example sentence (back of the card) |
| Lesson | The lesson it comes from. This is for reference only and the app does not use it. |

You can edit the file in Excel, Google Sheets or a text editor. In Excel, save it as **CSV UTF-8 (Comma delimited)**. Any other CSV format will break the Thai. The app reads this file when it is built. Push the change to `main` and the live app updates in about a minute (see [Deployment](#deployment)).

> **Note:** Each browser keeps its own copy of the deck so that it can save progress. Students who have already used the app will not see an edited list until they press **รีเซ็ตคำศัพท์เป็นค่าเริ่มต้น** in the **คำศัพท์ & CSV** tab. Resetting also clears their progress.

## Using your own word list

The **คำศัพท์ & CSV** tab gives you three ways to change the deck:

- **Add one word.** Type the English, the Thai and an optional example sentence.
- **Upload a CSV file.** Use **เลือกไฟล์ CSV จากเครื่อง**.
- **Paste CSV text.** Paste it into the box and press **นำเข้าข้อความที่วาง**.

The CSV format is as follows:

- The first column is the English word and the second is the Thai meaning.
- A third column with an example sentence is optional.
- A header row is optional.
- Fields can be separated by commas or tabs.
- If a field contains a comma, wrap it in double quotes.

```csv
Word,Meaning,Sentence
stand out from the crowd,โดดเด่นกว่าคนอื่น,Real examples help you stand out from the crowd.
"rise, increase",เพิ่มขึ้น,Sales rose by 15% in 2025.
```

> **Importing replaces the whole deck**, including its progress. To keep the current deck, download it first with **ดาวน์โหลดคำศัพท์ปัจจุบัน (Export CSV)**.

## Where progress is saved

Cards and progress are saved in the browser's local storage on the device being used. Nothing is sent to a server, so no student data leaves the device. This also means:

- Progress does not follow a student from phone to laptop.
- Clearing browser data or using a private window starts over.

## Running it locally

The dependencies are locked with [Bun](https://bun.sh/):

```bash
bun install
bun run dev
```

The app opens at <http://localhost:3000>.

With npm (Node.js 20 or later), run `npm install --legacy-peer-deps` and then `npm run dev`. A plain `npm install` stops on a peer-dependency conflict. The template pins `esbuild` 0.25, but Vite 8 asks for 0.27 or later. The app does not use `esbuild`, so the conflict is harmless.

The project was started from a Google AI Studio template. That is where `.env.example`, `metadata.json` and the `@google/genai` and `express` dependencies come from. The app does not call Gemini or any other API, so you can leave `GEMINI_API_KEY` unset.

## Deployment

Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). The workflow installs from `bun.lock`, type-checks, builds, and publishes `dist/` to GitHub Pages. The Vite `base` is set to `./`, so the build works under the `/Vocab-Quiz-App/` path and on any other static host.

## Project structure

| Path | What it does |
|---|---|
| `src/App.tsx` | The whole interface and the study logic |
| `src/data/defaultCards.ts` | Loads the default deck from `vocab/GE5072_vocab.csv` |
| `src/utils/csv.ts` | CSV import and export |
| `src/utils/speech.ts` | Pronunciation (Web Speech API) |
| `src/utils/sound.ts` | Sound effects, synthesised with the Web Audio API (no audio files) |
| `vocab/GE5072_vocab.csv` | The GE5072 vocabulary list |

Built with React 19, Vite and Tailwind CSS 4.

## Author

อาจารย์ณัฎชนันท์ สนิทดี (Natchanun Sanitdee)
Department of English for Professional and International Communication (EPIC), School of Humanities, University of the Thai Chamber of Commerce
