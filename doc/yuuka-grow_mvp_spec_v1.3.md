# Yuuka Grow (유우카 키우기) — MVP Markdown Spec (Codex Reference)
Version: **v1.3**  
Last updated: 2026-02-12

> This document is the **single source of truth** for the MVP implementation.  
> It is written to minimize ambiguity and implementation mistakes for Codex CLI.  
> **No leaderboard.** Serverless static web game + share page.

---

## Table of Contents
1. [Goals and Non-Goals](#1-goals-and-non-goals)  
2. [Platform Support (Standard)](#2-platform-support-standard)  
3. [Tech Stack (Fixed)](#3-tech-stack-fixed)  
4. [Game Overview](#4-game-overview)  
5. [Core Data Model](#5-core-data-model)  
6. [Day / Turn System](#6-day--turn-system)  
7. [Actions: Work / Eat / Guest](#7-actions-work--eat--guest)  
8. [Guests (Characters): Effects + Gambling](#8-guests-characters-effects--gambling)  
9. [Guest Selection: Stress-Weighted Random](#9-guest-selection-stress-weighted-random)  
10. [Endings + Score Record](#10-endings--score-record)  
11. [Thigh Stage System (cm)](#11-thigh-stage-system-cm)  
12. [UI Screens and Responsive Layout](#12-ui-screens-and-responsive-layout)  
13. [Theme / 9-Slice (12px) + Asset Fallback](#13-theme--9-slice-12px--asset-fallback)  
14. [Persistence (localStorage)](#14-persistence-localstorage)  
15. [Share Page (Serverless Social)](#15-share-page-serverless-social)  
16. [Project Architecture (Maintainable Code)](#16-project-architecture-maintainable-code)  
17. [Acceptance Criteria (DoD)](#17-acceptance-criteria-dod)  
18. [Future (Out of MVP)](#18-future-out-of-mvp)  
19. [Korean Copy & Notation Policy](#19-korean-copy--notation-policy)  
20. [Korean String Table (ko-KR)](#20-korean-string-table-ko-kr)  
21. [Korean Endings & UI Copy](#21-korean-endings--ui-copy)  
22. [Korean Fonts & Typography](#22-korean-fonts--typography)  
23. [Fan Game Disclaimer & Community Posting Spec](#23-fan-game-disclaimer--community-posting-spec)  

---

## 1) Goals and Non-Goals

### 1.1 MVP Goals
- Web-based, turn-based daily loop clicker/management game.
- Grow **Yuuka’s thigh circumference in cm** (primary score).
- Survive until **Day 100** (Normal Ending is intended to be achievable).
- High score is difficult and satisfying (variance via Guests + % effects).
- **Mobile-first responsive UI** is required.
- **Static hosting only**, no server required.
- **Share page** that displays results + “Play this game” link.

### 1.2 Non-Goals (Explicitly Out of MVP)
- Global leaderboard / accounts / server DB / server validation.
- Anti-cheat for share links (share can be forged; acceptable for fan game).
- Complex character animation pipelines (fallback placeholders acceptable).
- Additional characters beyond the 7 defined here.

---

## 2) Platform Support (Standard)

Support policy:
- Desktop: Chrome / Edge / Firefox / Safari **latest 2 major versions**
- Mobile: iOS Safari / Android Chrome **latest 2 major versions**
- Primary: mobile portrait
- Secondary: desktop landscape
- Must work without network requests besides loading the static site assets.

---

## 3) Tech Stack (Fixed)

- Build: **Vite**
- Language: **TypeScript**
- Rendering: **Phaser 3**
- UI/HUD/Buttons/Log: **DOM + CSS (Responsive)**
- Persistence: **localStorage**
- Hosting: Static site (e.g., Cloudflare Pages)
- UI skinning: **9-slice 12px** via CSS (`border-image`) or equivalent
- MUST have **asset fallback** (no hard dependency on custom images).

---

## 4) Game Overview

### 4.1 Resources
- **Money** (integer, displayed as **크레딧**; can hit <= 0 → Bankruptcy Ending)
- **Stress** (integer, 0..100 clamp)
- **ThighCm** (float allowed internally; displayed as rounded integer)
- **ActionsRemaining** (3 per day)

### 4.2 Daily Loop
- 1 day = 3 actions (Morning/Noon/Evening).
- Player chooses 1 action each turn:
  - Work
  - Eat
  - Guest
- After 3 actions: Day End processing (penalties, streak checks, endings).

### 4.3 Design Intent (Balance Philosophy)
- “100 days” should be achievable with stable play.
- “Guest” introduces controlled variance:
  - Low stress → more stable/growth-oriented guests
  - High stress → more volatile / gambling guests
- **No character is “evil.”** Every character has at least one upside.
- Stress uses **point-based** deltas (NOT percent).

---

## 5) Core Data Model

### 5.1 Types (Authoritative)
```ts
export type EndingId = "normal" | "bankrupt" | "stress";

export interface GameState {
  day: number;                 // starts at 1
  actionsRemaining: number;    // starts at 3
  money: number;               // starts at 5000
  stress: number;              // 0..100 clamp
  thighCm: number;             // starts at 53
  stress100Days: number;       // consecutive days where stress==100 at Day End
  ateToday: boolean;           // whether Eat occurred today
  noaWorkCharges: number;      // 0..3 (Noa buff charges for Work only)
  logs: string[];              // latest LOG_MAX_LINES lines
}

export interface RunResult {
  endedAtIso: string;
  endingId: EndingId;
  dayReached: number;
  finalThighCm: number;
  finalMoney: number;
  finalStress: number;
}
```

### 5.2 Display Rules
- Money: integer display
- Stress: integer display
- ThighCm: display as integer `Math.round(thighCm)` in HUD/Score/Share
- Internally, thighCm may be float for smooth % operations.

---

## 6) Day / Turn System

### 6.1 Constants (v0.1 defaults)
All tunables live in **one file** (e.g., `core/constants.ts`). No magic numbers elsewhere.

```ts
export const DAYS_TO_SURVIVE = 100;

export const ACTIONS_PER_DAY = 3;

export const START_MONEY = 5000;
export const START_STRESS = 0;
export const START_THIGH_CM = 53;

export const STRESS_MIN = 0;
export const STRESS_MAX = 100;

export const LOG_MAX_LINES = 5;
```

### 6.2 Action Consumption
- Any action consumes exactly 1 action point:
  - `actionsRemaining -= 1`
- If `actionsRemaining` becomes 0:
  - Run **Day End procedure** (Section 6.3) for the current day.
  - If no ending triggered:
    - `day += 1`
    - `actionsRemaining = ACTIONS_PER_DAY`
    - `ateToday = false`
    - (Noa charges persist across days; they only decrement on Work.)

### 6.3 Day End Procedure (Order MUST)
1. Apply **no-meal penalty** if `ateToday == false`
2. Update **stress==100 consecutive day streak**
3. Check endings (Bankrupt → Stress → Normal)
4. If no ending: proceed to next day (Section 6.2)

---

## 7) Actions: Work / Eat / Guest

### 7.1 Common Rules
- After any action effect:
  - Clamp stress to [0..100]
  - If money <= 0 → trigger Bankruptcy ending immediately (do not wait for day end)
  - Clamp thighCm >= 1 (defensive)
- Every action must append at least 1 log line.
- Logs are capped to `LOG_MAX_LINES` (drop oldest).

### 7.2 Work
#### Tunables
```ts
export const WORK_BASE_MONEY = 1100;
export const WORK_DAY_SLOPE = 25;
export const WORK_STRESS_GAIN = 8;
```
#### Effect
- moneyGain = `WORK_BASE_MONEY + day * WORK_DAY_SLOPE`
- stressGain = `WORK_STRESS_GAIN`

**Noa buff interaction** (if `noaWorkCharges > 0`):
- moneyGain *= 1.5
- stressGain *= 0.5
- After applying Work: `noaWorkCharges -= 1`

**Rounding**
- `moneyGain = Math.round(moneyGain)`
- `stressGain = Math.round(stressGain)`

#### Log (example)
- If Noa buff used: `Work (Noa buff): +{moneyGain}, Stress +{stressGain}, Charges left: {noaWorkCharges}`
- Else: `Work: +{moneyGain}, Stress +{stressGain}`

### 7.3 Eat
#### Tunables
```ts
export const EAT_BASE_COST = 500;
export const EAT_COST_PER_CM = 1.5;
export const EAT_STRESS_REDUCE = 12;

export const EAT_BASE_GAIN_CM = 4;
export const EAT_GAIN_FACTOR = 0.006; // +0.6% of current thigh
```
#### Effect
- cost = `EAT_BASE_COST + thighCm * EAT_COST_PER_CM`
- money -= round(cost)
- stress -= `EAT_STRESS_REDUCE`
- thighGain = `EAT_BASE_GAIN_CM + thighCm * EAT_GAIN_FACTOR`
- thighCm += thighGain
- set `ateToday = true`

**Rounding**
- `cost = Math.round(cost)`
- thighGain may remain float; display rounded.

#### Log (example)
- `Eat: -{cost}, Thigh +{round(thighGain)}cm, Stress -{EAT_STRESS_REDUCE}`

### 7.4 Guest
- Consumes 1 action.
- Selects 1 character using stress-weighted algorithm (Section 9).
- Applies that character’s effect immediately (Section 8).
- Always logs:
  - `Guest: {CharacterName} → {EffectSummary}`

---

## 8) Guests (Characters): Effects + Gambling

**Important:** No “evil” character. Every guest has an upside.

### 8.1 Effect Units
- Stress changes are **POINTS** (B plan):
  - Example: `Stress -15` means `stress = max(0, stress - 15)`
- Money/Thigh are often **percent** based:
  - `money *= (1 + pct)`
  - `thighCm *= (1 + pct)`

**Rounding rule for Money after percent change:** `money = Math.round(money)`

### 8.2 Character List (MVP)

#### Teacher (선생님) — Very Good (Stable Care)
- Thigh: **+8%**
- Stress: **-15**
- Summary: “Best stabilizer; slightly toned down growth vs older plan.”

#### Momoi (모모이) — Good (Friendly but Stressful)
- Thigh: **+10%**
- Stress: **+10**
- Summary: “Good growth; raises stress.”

#### Aris (아리스) — Very Good (Growth + Money)
- Thigh: **+12%**
- Money: **+15%**
- Summary: “High reward, no stress change.”

#### Rio (리오) — Neutral (Efficient but Pressuring)
- Money: **+12%**
- Stress: **+12**
- Summary: “Money boost; increases stress.”

#### Noa (노아) — Good (Supporter with Work Charges)
Immediate:
- Money: **+5%**
- Stress: **-5**

Buff (Work only):
- Set `noaWorkCharges = 3` (no stacking; refresh to 3)
- For the next **3 Work actions**, apply:
  - Work moneyGain × **1.5**
  - Work stressGain × **0.5**
- Charges decrement only when Work is used.

Summary: “Long-term support without runaway stacking.”

#### Maki (마키) — Gamble (Light Gambling, Always Has Upside)
50/50 outcome (uniform):
- Outcome A (Success):
  - Thigh **+14%**
  - Money **+15%**
  - Stress **+10**
- Outcome B (Slip):
  - Thigh **-8%**
  - Money **+10%**
  - Stress **-5**

Summary: “Even ‘bad’ outcome still gives money; prevents hate.”

#### Koyuki (코유키) — Gamble (Strong Gambling, Clear Cost)
Common (always):
- Stress **+20**

50/50 outcome (uniform):
- Outcome A (Jackpot):
  - Money **+80%**
- Outcome B (Loss but comedic upside):
  - Money **-50%**
  - Thigh **+6%**

Summary: “High volatility; avoids instant-run-delete (-80%).”

### 8.3 Effect Application Order (MUST)
When applying a guest:
1. Apply Money/Thigh percent changes and round Money at the end.
2. Apply Stress point changes.
3. Clamp stress to [0..100].
4. Clamp thighCm >= 1.
5. If money <= 0 → Bankruptcy ending immediately.

---

## 9) Guest Selection: Stress-Weighted Random

### 9.1 Stress Bands
- 0–29: Stable
- 30–59: Neutral
- 60–79: Risky
- 80–100: Gambling

### 9.2 Weights per Band (Direct per Character)
> Use this as the authoritative probability model.  
> Implementation: weighted random pick using current stress band weights.

**Stress 0–29**
- Teacher 5 / Aris 5 / Noa 4 / Momoi 3 / Rio 2 / Maki 2 / Koyuki 1

**Stress 30–59**
- Teacher 3 / Aris 4 / Noa 3 / Momoi 4 / Rio 3 / Maki 3 / Koyuki 2

**Stress 60–79**
- Teacher 2 / Aris 3 / Noa 2 / Momoi 4 / Rio 4 / Maki 4 / Koyuki 3

**Stress 80–100**
- Teacher 1 / Aris 2 / Noa 1 / Momoi 4 / Rio 4 / Maki 5 / Koyuki 5

### 9.3 Weighted Pick Algorithm (MUST)
- Implement a reusable utility:
```ts
type WeightedItem<T> = { item: T; weight: number };

export function weightedPick<T>(rng01: () => number, items: WeightedItem<T>[]): T
```
- Sum weights, pick `r = rng01() * total`, iterate until cumulative >= r.
- If total <= 0 (should not happen), fallback to uniform random.

### 9.4 RNG (Maintainability)
- Use a single RNG module with a default `Math.random` implementation.
- Keep an interface to swap to seeded RNG later if needed (debug builds).

---

## 10) Endings + Score Record

### 10.1 Ending Conditions (MUST)
1. Bankruptcy Ending: `money <= 0` (immediate)
2. Stress Ending: `stress == 100` at Day End for **10 consecutive days**
3. Normal Ending: reach **Day 100** at Day End

### 10.2 Stress 100 Consecutive Days
Tunables:
```ts
export const STRESS_END_CONSECUTIVE_DAYS = 10;
```
At **Day End**:
- if `stress == 100`: `stress100Days += 1`
- else: `stress100Days = 0`
- if `stress100Days >= 10` → Stress ending

### 10.3 No-Meal Penalty (Anti-Guest-Only Abuse)
Tunables:
```ts
export const NO_MEAL_MULTIPLIER = 0.95; // -5%
```
At Day End:
- if `ateToday == false`: `thighCm *= NO_MEAL_MULTIPLIER`
- Log: `No meal today: Thigh -5%`

### 10.4 RunResult (Recorded on Ending)
On ending:
- `dayReached = state.day`
- `finalThighCm = state.thighCm`
- `finalMoney = state.money`
- `finalStress = state.stress`
- Persist to history + update best (Section 14)

---

## 11) Thigh Stage System (cm)

### 11.1 Intent
- Stage 1–10: Normal mode (full body visible)
- Stage 11+: Giant mode (upper body clipped, comparison objects appear)
- Stage is derived from **thigh circumference**.

### 11.2 Fixed Baseline
- Start thigh: **53 cm**
- Stage 11 threshold: **850 cm**
- Thresholds (rounded) are the authoritative stage boundaries.

### 11.3 Stage Threshold Table (Authoritative)
A stage is the highest stage where `thighCm >= threshold[stage]`.

| Stage | ThighCm >= |
|---:|---:|
| 1 | 53 |
| 2 | 70 |
| 3 | 92 |
| 4 | 122 |
| 5 | 161 |
| 6 | 212 |
| 7 | 280 |
| 8 | 370 |
| 9 | 488 |
| 10 | 644 |
| 11 | **850** |
| 12 | 1122 |
| 13 | 1481 |
| 14 | 1954 |
| 15 | 2579 |

### 11.4 Stage Computation (MUST)
- Prefer threshold iteration to avoid floating precision edge cases:
```ts
export const STAGE_THRESHOLDS = [53,70,92,122,161,212,280,370,488,644,850,1122,1481,1954,2579];

export function getStage(thighCm: number): number {
  let stage = 1;
  for (let i = 0; i < STAGE_THRESHOLDS.length; i++) {
    if (thighCm >= STAGE_THRESHOLDS[i]) stage = i + 1;
  }
  return stage;
}
```

### 11.5 Giant Mode Visual Rule
- If stage >= 11:
  - Yuuka is framed on legs/thigh; upper body may be clipped intentionally.
  - Show comparison object based on stage bracket:
    - 11: chair
    - 12: desk
    - 13: person
    - 14: car
    - 15+: building

Fallback: if comparison images missing, show placeholder rectangle with label text.

---

## 12) UI Screens and Responsive Layout

### 12.1 Screens
1. Lobby
2. Game
3. Ending (cinematic overlay)
4. Score (results + share)
5. Share Page (`/share.html`)

### 12.2 Lobby
- Buttons:
  - Start Game
  - Settings
- Show:
  - Game title
  - Version / Credits

**Fan game disclaimer (MUST show on Lobby or Settings/Credits):**
- `본 게임은 비공식 팬게임이며, 원작 및 공식과 무관하다.`

Settings (MVP minimal):
- BGM volume (0..1)
- SFX volume (0..1)
- Theme selector (default only; structure must allow future themes)

### 12.3 Game Screen Layout (DOM + Phaser Canvas)
- Top HUD: Day / Money / Stress / Thigh(cm) / Actions remaining
- Yuuka Panel: Phaser canvas
- Event Log: latest 5 lines
- Bottom Controls (sticky):
  - Work
  - Eat
  - Guest

#### Mobile Portrait Requirements
- Bottom controls must always be visible and tappable.
- Tap target >= 44px.
- Safe-area bottom padding applied.

#### Desktop Requirements
- Same structure with larger spacing and log height.

### 12.4 Ending Screen
- Shows ending title + short description.
- Shows ending image if available; otherwise fallback plain background.
- Button: Continue → Score

### 12.5 Score Screen
- Displays:
  - Ending name
  - Final thigh (cm)
  - Day reached
  - Final money
  - Final stress
- Buttons:
  - Retry
  - Back to Lobby
  - **Share Result** (important)

### 12.6 Event Log Rules
- Any action adds at least 1 line.
- Cap to LOG_MAX_LINES.
- Prefer concise, consistent formatting.

---

## 13) Theme / 9-Slice (12px) + Asset Fallback

### 13.1 Theme Requirements
- UI supports theme swapping via a single theme config.
- 9-slice = **12px** fixed for MVP.
- Theme assets might be absent → must fallback to CSS-only UI.

### 13.2 Theme Config Example
`/themes/default/theme.json`
```json
{
  "id": "default",
  "slicePx": 12,
  "ui": {
    "panel": "/themes/default/ui/panel.png",
    "buttonIdle": "/themes/default/ui/button_idle.png",
    "buttonHover": "/themes/default/ui/button_hover.png",
    "buttonPressed": "/themes/default/ui/button_pressed.png",
    "modal": "/themes/default/ui/modal.png"
  }
}
```

### 13.3 9-Slice Implementation (DOM)
- Use CSS `border-image` (or equivalent):
  - `border-image-slice: 12;`
  - `border-width: 12px;`
- Buttons have state classes:
  - `.idle`, `.hover`, `.pressed`
- Mobile: hover optional; pressed required.

### 13.4 Mandatory Fallback Behavior
If theme JSON or any referenced image fails:
- Panels: `background-color`, `border`, `box-shadow` fallback
- Buttons: default `<button>` style + CSS hover/active
- The game must remain playable end-to-end without custom assets.

### 13.5 Mandatory Fallback for Game Visuals (Phaser)
If Yuuka assets are missing:
- Render a placeholder:
  - A rectangle
  - Text: `"YUUKA"`, `"Stage X"`, `"Thigh: N cm"`
If ending images missing:
- Show ending title + text only.
If comparison assets missing:
- Placeholder rectangle + label text.

---

## 14) Persistence (localStorage)

### 14.1 Keys
- `yuuka_save_v1`: `{ state, best, history }`
- `yuuka_settings_v1`: `{ bgmVolume, sfxVolume, themeId }`

### 14.2 Save Timing (MUST)
- Save after every Day End (if not ended).
- Save immediately on ending.
- Save settings immediately when changed.

### 14.3 Best & History
- `best`: highest `finalThighCm` across runs
- `history`: keep latest N (recommend 20) to prevent unbounded growth

---

## 15) Share Page (Serverless Social)

### 15.1 Route
- Use a separate page: `/share.html`
- It reads URL query params and renders a score card.

### 15.2 URL Format (Fixed)
Example:
```
/share.html?thigh=1234&day=100&ending=normal&money=5000&stress=20
```

- Note: `money` query param is **credits** (크레딧). UI labels must display it as `크레딧`.


### 15.3 Required Params
- `thigh` (number)
- `day` (number)
- `ending` (string: normal|bankrupt|stress)
- `money` (number)
- `stress` (number)

If any missing/invalid:
- Show `Invalid share link` + a single CTA button `Play This Game` → `/`

### 15.4 Score Screen “Share Result” Button
- Must construct the share URL from the ending RunResult.
- Should provide:
  - Copy to clipboard (best effort)
  - Also open the share page in same tab or new tab (MVP choice)

Share is not validated. Forgery is acceptable.

---

## 16) Project Architecture (Maintainable Code)

### 16.1 Separation of Concerns (MUST)
- `core/`: pure logic (no DOM, no Phaser)
- `ui/`: DOM rendering + input → calls core actions
- `render/`: Phaser scene that visualizes state (and handles fallback visuals)
- `storage/`: save/load/settings
- `share/`: share page entry

### 16.2 Suggested Folder Structure
```
src/
  core/
    constants.ts
    state.ts
    actions.ts
    endings.ts
    stage.ts
    guests.ts
    guestWeights.ts
    clamp.ts
    rng.ts
    logger.ts
  render/
    phaserGame.ts
    yuukaRenderer.ts
  ui/
    uiController.ts
    views/
      lobbyView.ts
      gameView.ts
      endingView.ts
      scoreView.ts
    theme/
      themeManager.ts
      skinCss.ts
  storage/
    save.ts
    settings.ts
  share/
    sharePage.ts
  main.ts        // index.html entry
  shareMain.ts   // share.html entry
```

### 16.3 Tunability & Legibility Rules (MUST)
- All tunables are constants in one place (`constants.ts`).
- Each action is a named, testable function:
  - `applyWork(state): state`
  - `applyEat(state): state`
  - `applyGuest(state, rng): state`
  - `endDay(state): { state, ended?: RunResult }`
- Noa buff is represented explicitly (no “hidden flags”).
- Logging is centralized:
  - `pushLog(state, line)` caps at LOG_MAX_LINES.
- No deep coupling between UI and core logic:
  - UI calls core, core returns new state, UI re-renders.

---

## 17) Acceptance Criteria (DoD)

### Functional
- Lobby → Game works
- Work/Eat/Guest each consume 1 action
- After 3 actions, Day End executes (no-meal penalty if applicable)
- Stress is clamped 0..100
- Stress 100 streak ending works (10 consecutive day ends)
- Bankruptcy triggers immediately on money <= 0
- Normal ending triggers at Day End when `day >= 100`
- Ending → Score flow works
- Score shows correct final stats
- Share Result opens share.html with correct params
- Share page renders stats or invalid-link fallback

### Responsive
- Mobile: bottom controls always visible & tappable; safe-area handled
- Desktop: layout not broken

### Fallback
- No assets present: still playable end-to-end with placeholders
- Theme images missing: still usable UI via CSS fallback
- Comparison objects missing: placeholder still shown in giant mode

---

## 18) Future (Out of MVP)
- Optional shorter game modes (change `DAYS_TO_SURVIVE` + tuning multipliers)
- More endings / special endings
- More guests
- True global leaderboard (requires backend; intentionally excluded)

---

## Appendix A — Quick Reference: Key Numbers (v0.1)
- Start: **5000크레딧**, 0 스트레스, 53cm 허벅지
- Day: 3 actions
- Eat:
  - cost = 500 + thigh*1.5
  - thigh += 4 + thigh*0.006
  - stress -12
- Work:
  - money += 1100 + day*25
  - stress +8 (or +4 if Noa buff active)
- No meal: thigh *= 0.95
- Stage 11 giant mode: thigh >= 850cm


---

## 19) Korean Copy & Notation Policy

> MVP is **Korean-only**. All visible UI text/logs/endings/share page copy must be Korean and follow the rules below.  
> Core variable names in code may remain English (money/stress/thighCm), but **display text must follow this section**.

### 19.1 Tone & Writing Style (MUST)
- Use **하자체 / 했다체** consistently.
- Do **NOT** use 해요체.
- Buttons/labels can be short noun/verb forms (e.g., `게임 시작`, `업무하기`), but logs/endings should be **했다체**.
- Avoid wording that frames any guest character as “bad/evil.” If an outcome is negative, phrase it as “상황/우연/변동”.

#### Examples
- Work log: `업무를 했다: 크레딧 +1,250 / 스트레스 +8`
- Eat log: `밥을 먹었다: 크레딧 -1,050 / 허벅지 +12cm / 스트레스 -12`
- Guest log: `게스트가 왔다: 선생님 → 허벅지 +8% / 스트레스 -15`
- Ending line: `100일을 버텼다. 기록을 남겼다.`

### 19.2 Currency Naming & Formatting (MUST)
- Currency unit is **크레딧**.
- Replace any “원” concept with credits. UI must show:
  - Inline: `5000크레딧`
  - Label form: `크레딧: 5,000`
- Money is always integer. Format using:
  - `Intl.NumberFormat('ko-KR')` for thousands separators.

### 19.3 Numeric Notation (MUST)
- Day: `{day}일차`
- Stress: `스트레스 {stress}/100`
- Thigh: `허벅지 둘레 {thigh}cm` (no space between number and `cm`)
- Percent values in logs: use `%` with integers where possible (e.g., `+8%`).

### 19.4 Text Placement Policy (MUST)
- **All user-facing strings must come from a single Korean string table** (Section 20).
- No hard-coded Korean strings in logic modules (`core/*`). UI layer loads strings and formats templates.

---

## 20) Korean String Table (ko-KR)

> Create `src/i18n/strings.ko.json` (or equivalent).  
> MVP is Korean-only, but this string-table approach prevents hard-coding and supports future localization.

### 20.1 Key Naming Rules (MUST)
- Use dot-separated keys by screen/module:
  - `lobby.*`, `settings.*`, `hud.*`, `action.*`, `log.*`, `ending.*`, `score.*`, `share.*`, `disclaimer.*`
- All templates use `{placeholders}`.

### 20.2 Minimum Required Strings (MUST)
Below is the minimum list required for MVP. Add more as needed.

```json
{
  "lobby.title": "유우카 키우기",
  "lobby.btnStart": "게임 시작",
  "lobby.btnSettings": "설정",
  "lobby.disclaimer": "본 게임은 비공식 팬게임이며, 원작 및 공식과 무관하다.",
  "settings.title": "설정",
  "settings.bgm": "BGM",
  "settings.sfx": "SFX",
  "settings.theme": "테마",
  "settings.close": "닫기",

  "hud.day": "{day}일차",
  "hud.credits": "크레딧: {credits}",
  "hud.stress": "스트레스 {stress}/100",
  "hud.thigh": "허벅지 둘레 {thigh}cm",
  "hud.actions": "남은 행동 {actions}/3",

  "action.work": "업무하기",
  "action.eat": "밥먹기",
  "action.guest": "게스트",

  "log.work": "업무를 했다: 크레딧 +{credits} / 스트레스 +{stress}",
  "log.workNoa": "업무를 했다(노아): 크레딧 +{credits} / 스트레스 +{stress} / 남은 노아 {charges}회",
  "log.eat": "밥을 먹었다: 크레딧 -{credits} / 허벅지 +{thigh}cm / 스트레스 -{stress}",
  "log.noMeal": "오늘은 한 끼도 못 먹었다: 허벅지 -5%",
  "log.guest": "게스트가 왔다: {name} → {effect}",

  "guest.teacher.name": "선생님",
  "guest.momoi.name": "모모이",
  "guest.aris.name": "아리스",
  "guest.rio.name": "리오",
  "guest.noa.name": "노아",
  "guest.maki.name": "마키",
  "guest.koyuki.name": "코유키",

  "ending.normal.title": "일반 엔딩",
  "ending.bankrupt.title": "파산 엔딩",
  "ending.stress.title": "스트레스 엔딩",
  "ending.normal.desc": "100일을 버텼다. 기록을 남겼다.",
  "ending.bankrupt.desc": "크레딧이 바닥났다. 다시 계획을 세웠다.",
  "ending.stress.desc": "무리했다. 휴식이 필요했다.",
  "ending.continue": "계속",

  "score.title": "결과",
  "score.ending": "엔딩",
  "score.finalThigh": "최종 허벅지 둘레",
  "score.dayReached": "도달 일차",
  "score.finalCredits": "최종 크레딧",
  "score.finalStress": "최종 스트레스",
  "score.btnRetry": "다시 하기",
  "score.btnBack": "로비로",
  "score.btnShare": "결과 공유하기",

  "share.title": "공유 결과",
  "share.invalid": "유효하지 않은 공유 링크다.",
  "share.btnPlay": "플레이해보기"
}
```

### 20.3 Guest Effect Summary Formatting (Recommended)
Create a helper that builds a short summary string **without insulting any character**.
- Example summaries:
  - `허벅지 +8% / 스트레스 -15`
  - `크레딧 +15%`
  - Gambling outcomes should be neutral:
    - `대박이 났다: ...`
    - `예상과 달랐다: ...`

---

## 21) Korean Endings & UI Copy

### 21.1 Ending Copy (MVP)
Use short, neutral, “했다체” phrasing.

- **Normal Ending (Day 100)**
  - Title: `일반 엔딩`
  - Description: `100일을 버텼다. 기록을 남겼다.`
- **Bankruptcy Ending (Money <= 0)**
  - Title: `파산 엔딩`
  - Description: `크레딧이 바닥났다. 다시 계획을 세웠다.`
- **Stress Ending (Stress==100 for 10 days)**
  - Title: `스트레스 엔딩`
  - Description: `무리했다. 휴식이 필요했다.`

### 21.2 Copy Safety Rules (MUST)
- Do not frame any guest as a villain.
- Negative outcomes are described as “상황/우연/변동/컨디션”.
- Avoid insults or mocking language.

---

## 22) Korean Fonts & Typography

### 22.1 Font Recommendation (MUST)
- Primary (recommended): `Pretendard` or `Noto Sans KR`
- Fallback chain (MUST include):
  - `system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`

### 22.2 Rendering Requirements
- Use `font-display: swap` for web fonts.
- Mobile minimum sizes (recommended):
  - HUD: 12–14px
  - Buttons: 16px+

---

## 23) Fan Game Disclaimer & Community Posting Spec

### 23.1 Mandatory Disclaimer Text (MUST)
This text must be visible on Lobby or Settings/Credits (at least one place):
- `본 게임은 비공식 팬게임이며, 원작 및 공식과 무관하다.`

### 23.2 Credits / Attribution (Recommended)
- Add a simple Credits section (Lobby footer or Settings):
  - `제작: (your handle)`
  - `원작/IP: Blue Archive (Nexon Games / Yostar 등)` (neutral wording)

### 23.3 Community Posting Guidance (Recommended)
- In Korean community posts:
  - Mention: “설치 없이 웹에서 플레이 가능하다.”
  - Mention: “모바일 최적화(반응형) 지원한다.”
  - Explain share: “결과 공유 링크로 기록을 공유할 수 있다.”
- Avoid monetization language (fan game context).

