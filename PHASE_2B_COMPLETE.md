# PHASE 2B: BREWER'S SHEET UI - BATCH INFO + TURNS
**Date:** December 2025  
**Status:** ✅ COMPLETE - Sections 1-3 UI Implementation

---

## SUMMARY

Phase 2B has been successfully implemented. The Brewer's Sheet UI has been completely restructured with Sections 1-3 (Batch Info, Turn 1, Turn 2) including timers, ingredient tables, and turn completion functionality.

---

## WHAT WAS CREATED/MODIFIED

### 1. Backend Functions (Code.js)

#### `getBrewerSheetData(batchNumber)` - NEW
**Purpose:** Returns all data needed to render the Brewer's Sheet UI

**Returns:**
```javascript
{
  success: true,
  batchNumber: string,
  beerName: string,
  batchSize: number,
  status: string,
  brewDate: date,
  currentVessel: string,
  runningCOGS: number,
  recipeBaseBatchSize: number,
  turn1Complete: boolean,
  turn1CompleteDate: date,
  turn1CompletedBy: string,
  turn1LaborHours: number,
  turn1Vessel: string,
  turn1Ingredients: [{name, category, quantity, unit, onHand}, ...],
  turn2Complete: boolean,
  turn2CompleteDate: date,
  turn2CompletedBy: string,
  turn2LaborHours: number,
  turn2Ingredients: [{name, category, quantity, unit, onHand}, ...],
  noTurn2: boolean
}
```

**Logic:**
- Reads Batch Log (Row 9 headers, data starts Row 10)
- Gets Turn workflow columns (AM-AR)
- Calls `getRecipeIngredientsByTurn()` for Turn 1 and Turn 2
- Combines turn-specific and both-turns ingredients
- Adds on-hand quantities from Raw Materials
- Calculates scaled quantities for display

---

#### `getRawMaterialsMap()` - NEW
**Purpose:** Returns map of material names (lowercase) to quantities on hand

**Returns:**
```javascript
{
  'material name': qty,
  ...
}
```

**Usage:** Used to populate "On Hand" column in ingredient tables

---

#### `getBrewersList()` - NEW
**Purpose:** Gets list of brewers from Labor Config sheet

**Returns:**
```javascript
['Brewer 1', 'Brewer 2', ...]
```

**Fallback:** Returns hardcoded list if Labor Config not found

---

#### `markNoTurn2(batchNumber)` - NEW
**Purpose:** Marks batch as single-turn brew (no Turn 2)

**Actions:**
- Updates batch status to "Fermenting"
- Logs to Batch Details

---

### 2. Frontend Functions (BRM_UI.html)

#### `openBrewerSheet(batchNumber)` - NEW
**Purpose:** Opens new Brewer's Sheet modal for a batch

**Actions:**
1. Calls `getBrewerSheetData()` backend function
2. Renders Brewer's Sheet with all sections
3. Displays modal

---

#### `renderBrewerSheet(data)` - NEW
**Purpose:** Renders all sections of Brewer's Sheet

**Sections Rendered:**
- Section 1: Batch Info
- Section 2: Turn 1
- Section 3: Turn 2
- Sections 4-6: Locked placeholders

---

#### `renderTurn1(data)` - NEW
**Purpose:** Renders Turn 1 section with ingredients and controls

**Features:**
- Shows brewer dropdown
- Shows timer (starts at 00:00:00)
- Shows vessel dropdown (FV/LT only)
- Shows ingredients table with actual inputs
- Shows complete button (enabled when brewer + vessel + timer started)
- Shows completed info if Turn 1 already done

---

#### `renderTurn2(data)` - NEW
**Purpose:** Renders Turn 2 section

**Features:**
- Locked until Turn 1 complete
- "No Turn 2" checkbox
- Same structure as Turn 1
- Uses same vessel as Turn 1
- Shows completed info if Turn 2 done

---

#### Timer Functions - NEW
- `startTurn1Timer()` - Starts Turn 1 timer, updates every second
- `stopTurn1Timer()` - Stops Turn 1 timer
- `startTurn2Timer()` - Starts Turn 2 timer
- `stopTurn2Timer()` - Stops Turn 2 timer
- `formatTimer(totalSeconds)` - Formats seconds as HH:MM:SS

**Timer Display:**
- Updates every second while running
- Format: HH:MM:SS
- Shows in red color for visibility

---

#### Complete Turn Functions - NEW
- `completeTurn1()` - Completes Turn 1, calls backend `completeTurn()`
- `completeTurn2()` - Completes Turn 2, calls backend `completeTurn()`
- `collectActualIngredients(turn)` - Collects actual ingredient values from inputs

**Validation:**
- Brewer must be selected
- Vessel must be selected (Turn 1 only)
- Timer must be started (labor hours > 0.01)
- Confirmation dialog before completing

---

#### Helper Functions - NEW
- `loadBrewersDropdown()` - Populates brewer dropdowns
- `loadAvailableVessels()` - Populates vessel dropdown (FV/LT only)
- `updateTurn1ButtonState()` - Enables/disables Turn 1 complete button
- `updateTurn2ButtonState()` - Enables/disables Turn 2 complete button
- `toggleNoTurn2()` - Handles "No Turn 2" checkbox
- `toggleSection(contentId)` - Collapses/expands sections
- `updateSectionVisibility(data)` - Unlocks sections based on workflow
- `closeBrewerSheet()` - Closes modal, stops timers
- `formatDateTime(dateStr)` - Formats date + time

---

### 3. UI Structure

#### New Brewer's Sheet Modal
**Location:** Before `</body>` tag

**Structure:**
- Modal container with overlay
- Header with close button
- Body with 6 sections (Sections 1-3 active, 4-6 locked)
- Footer with Print and Close buttons

**Sections:**
1. **Batch Info** - Always visible, displays batch metadata
2. **Turn 1** - Collapsible, shows controls and ingredients
3. **Turn 2** - Collapsible, locked until Turn 1 complete
4. **Cellar Tasks** - Locked placeholder (Phase 2C)
5. **Packaging** - Locked placeholder (Phase 2E)
6. **Send It** - Hidden until ready (Phase 2F)

---

#### Section 1: Batch Info
**Layout:** 4-column grid

**Fields:**
- Batch #, Beer, Total BBL, Brew Date
- Current Vessel, Status, Running COGS

**Styling:**
- Red gradient background
- White text
- Gold highlight for COGS

---

#### Section 2: Turn 1
**Components:**
- Collapsible header with status badge
- Controls: Brewer dropdown, Timer, Vessel dropdown
- Ingredients table (6 columns)
- Complete button (disabled until conditions met)
- Completed info (shown after completion)

**Timer:**
- Start/Stop buttons
- Real-time display (HH:MM:SS)
- Converts to hours for labor logging

**Ingredients Table:**
- Recipe quantity (from recipe)
- Actual input (editable, defaults to scaled recipe)
- On Hand (from Raw Materials, red if low)

---

#### Section 3: Turn 2
**Components:**
- Same structure as Turn 1
- "No Turn 2" checkbox at top
- Uses same vessel as Turn 1 (display only)
- Locked until Turn 1 complete

**No Turn 2 Flow:**
- Checkbox → Hides controls
- Calls `markNoTurn2()` backend
- Shows "Single Turn Brew" message

---

### 4. CSS Styles

**Added Styles:**
- `.brewer-sheet-modal` - Modal container
- `.brewer-section` - Section container
- `.batch-info-section` - Batch info styling
- `.turn-section` - Turn section styling
- `.turn-controls` - Control group layout
- `.timer-display` - Timer styling
- `.ingredients-table` - Table styling
- `.completed-info` - Completion badge styling
- `.status-badge` - Status badge variants
- Button styles (`.btn`, `.btn-primary`, `.btn-lg`, etc.)

---

### 5. Integration

#### Updated Functions
- `openBatchSheet(batchNumber)` - Now calls `openBrewerSheet()`
- Old batch sheet modal still exists (for backward compatibility)

---

## TESTING RESULTS

### ✅ Section 1: Batch Info
- [x] Displays batch number correctly
- [x] Displays beer name correctly
- [x] Displays batch size in BBL
- [x] Displays brew date (formatted)
- [x] Displays current vessel (or "--")
- [x] Displays status with correct badge color
- [x] Displays running COGS (formatted as currency)

### ✅ Section 2: Turn 1
- [x] Brewer dropdown populated from Labor Config
- [x] Timer starts/stops correctly
- [x] Timer displays in HH:MM:SS format
- [x] Timer updates every second while running
- [x] Vessel dropdown shows only available FV/LT vessels
- [x] Ingredients table displays Turn 1 ingredients
- [x] Actual inputs default to scaled recipe quantities
- [x] On Hand column shows quantities (red if low)
- [x] Complete button disabled until: brewer + vessel + timer started
- [x] Complete button enables when all conditions met
- [x] Complete Turn 1 calls backend `completeTurn()`
- [x] After completion, shows completed info
- [x] After completion, hides controls and ingredients

### ✅ Section 3: Turn 2
- [x] Section locked until Turn 1 complete
- [x] "No Turn 2" checkbox works
- [x] Checkbox hides/shows Turn 2 controls
- [x] Same structure as Turn 1
- [x] Uses same vessel as Turn 1 (display only)
- [x] Ingredients table displays Turn 2 ingredients
- [x] Complete button works correctly
- [x] After completion, shows completed info
- [x] Single-turn brew message displays correctly

### ✅ Timer Functionality
- [x] Turn 1 timer starts on button click
- [x] Turn 1 timer stops on button click
- [x] Turn 2 timer starts on button click
- [x] Turn 2 timer stops on button click
- [x] Timer converts seconds to hours for labor logging
- [x] Timer persists while modal is open
- [x] Timer resets when modal closes

### ✅ Backend Integration
- [x] `getBrewerSheetData()` returns correct data structure
- [x] `completeTurn()` called with correct parameters
- [x] Material depletion works (via `completeTurn()`)
- [x] Labor logging works
- [x] Vessel status updates correctly
- [x] Batch status updates correctly

### ✅ UI State Management
- [x] Sections collapse/expand correctly
- [x] Locked sections show lock message
- [x] Completed turns show completion info
- [x] Modal closes correctly
- [x] Timers stop when modal closes

---

## ISSUES ENCOUNTERED

**Minor Issues:**
1. **Linter Warnings:** Some CSS-related linter warnings (appear to be false positives)
2. **Timer Persistence:** Timer state resets when modal closes (by design)

**Resolved:**
- All functionality works as expected
- No blocking issues

---

## FILES MODIFIED

1. **Code.js**
   - Added `getBrewerSheetData()` function
   - Added `getRawMaterialsMap()` function
   - Added `getBrewersList()` function
   - Added `markNoTurn2()` function

2. **BRM_UI.html**
   - Added CSS styles for Brewer's Sheet (Phase 2B section)
   - Added new Brewer's Sheet modal HTML structure
   - Added all JavaScript functions for Phase 2B
   - Updated `openBatchSheet()` to use new modal
   - Added global state object `brewerSheetState`

3. **PHASE_2B_COMPLETE.md** (this file)
   - Documentation of Phase 2B completion

---

## NEXT STEPS: PHASE 2C

Phase 2C will implement:
- Section 4: Cellar Tasks
- Task rendering with status indicators
- Timer per task
- Task completion with depletion
- Alert system for due/overdue tasks

**Ready for Phase 2C approval.**

---

## CONFIRMATION CHECKLIST

- [x] Brewer's Sheet modal opens from Production tab
- [x] Section 1 (Batch Info) displays correctly
- [x] Section 2 (Turn 1) shows with:
  - [x] Brewer dropdown populated
  - [x] Timer starts/stops correctly
  - [x] Vessel dropdown shows available FV/LTs
  - [x] Ingredients table shows Turn 1 ingredients
  - [x] Complete button enables when brewer + vessel + timer started
  - [x] Complete Turn 1 depletes materials and updates batch
- [x] Section 3 (Turn 2) shows with:
  - [x] Locked until Turn 1 complete
  - [x] "No Turn 2" checkbox works
  - [x] Same structure as Turn 1
  - [x] Complete Turn 2 sets status to "Fermenting"
- [x] Sections 4-6 show as locked placeholders
- [x] Existing functionality still works

---

## USER FLOW

1. **User clicks batch row in Production tab**
   - `openBatchSheet()` called
   - Calls `openBrewerSheet()`
   - Modal opens with batch data

2. **User sees Section 1: Batch Info**
   - All batch metadata displayed
   - Running COGS shown

3. **User works on Turn 1:**
   - Selects brewer
   - Starts timer
   - Selects FV/LT vessel
   - Reviews ingredients (can edit actuals)
   - Clicks "Complete Turn 1"
   - Materials deplete, labor logs, vessel updates

4. **User works on Turn 2 (or marks No Turn 2):**
   - If Turn 2: Selects brewer, starts timer, completes
   - If No Turn 2: Checks checkbox, batch marked as single-turn
   - Status updates to "Fermenting"

5. **Cellar Tasks unlock** (Phase 2C)
   - After both turns complete (or Turn 1 + No Turn 2)

---

**END OF PHASE 2B REPORT**
