# PHASE 2A: BREWER'S SHEET CONSOLIDATION - DATA STRUCTURE UPDATES
**Date:** December 2025  
**Status:** ✅ COMPLETE - Data Layer Foundation for Complete Redesign

---

## SUMMARY

Phase 2A has been successfully implemented. All data structure updates are in place to support the complete Brewer's Sheet redesign with Turn 1/Turn 2 workflow, timer tracking, and turn-based material depletion.

---

## WHAT WAS CREATED/MODIFIED

### 1. Recipe Ingredients Sheet Updates

#### `ensureRecipeIngredientsTurnColumn()` - NEW
**Purpose:** Adds "Turn" column to Recipe Ingredients sheet if it doesn't exist

**Column Details:**
- Column Name: "Turn"
- Values: "1", "2", or blank (for ingredients that apply to both turns)
- Position: Added after existing columns (typically after UOM column)

**Logic:**
- Blank/empty = ingredient applies to both turns (will be split 50/50)
- "1" = ingredient only for Turn 1
- "2" = ingredient only for Turn 2

**Returns:**
```javascript
{
  success: true,
  message: string,
  columnIndex: number
}
```

---

### 2. Batch Log Sheet Updates

#### `ensureBatchLogTurnColumns()` - NEW
**Purpose:** Adds Turn 1 and Turn 2 tracking columns to Batch Log (Row 9 headers)

**New Columns Added (Row 9):**
- **AM (39):** Turn 1 Complete Date
- **AN (40):** Turn 1 Complete By
- **AO (41):** Turn 1 Labor Hours
- **AP (42):** Turn 2 Complete Date
- **AQ (43):** Turn 2 Complete By
- **AR (44):** Turn 2 Labor Hours

**Position:** After existing workflow columns (which end at AL = 38)

**Returns:**
```javascript
{
  success: true,
  message: string,
  columnsAdded: [string]
}
```

---

### 3. Batch Tasks Sheet Updates

#### `ensureBatchTasksTimerColumns()` - NEW
**Purpose:** Adds timer tracking columns to Batch Tasks sheet

**New Columns Added:**
- **Timer Start:** Timestamp when task timer started
- **Timer End:** Timestamp when task timer stopped
- **Actual Labor Hours:** Calculated from timer (hours)

**Note:** If Batch Tasks sheet doesn't exist, function returns success with `sheetExists: false`. Sheet will be created when first task is logged.

**Returns:**
```javascript
{
  success: true,
  message: string,
  columnsAdded: [string],
  sheetExists: boolean
}
```

---

### 4. Equipment Sheet Verification

#### `verifyEquipmentSheetStructure()` - NEW
**Purpose:** Verifies Equipment sheet has required columns

**Required Columns (flexible matching):**
- **Name:** Equipment/Vessel name (FV-1, BT-1, etc.)
- **Type:** Equipment type (FV, BT, LT, SV)
- **Size:** Capacity in BBL
- **Status:** Availability status (Available, In Use, Cleaning)
- **Current Batch:** Batch number if in use

**Matching Logic:**
- Uses flexible matching (e.g., "Equipment Name" matches "Name")
- Case-insensitive
- Partial matching for aliases

**Returns:**
```javascript
{
  success: boolean,
  foundColumns: [{name, columnIndex}, ...],
  missingColumns: [string],
  message: string
}
```

---

### 5. Helper Functions

#### `getRecipeIngredientsByTurn(recipeName, turnNumber)` - NEW
**Purpose:** Gets recipe ingredients filtered by turn

**Parameters:**
- `recipeName`: Recipe name
- `turnNumber`: 1, 2, or null (for all turns)

**Returns:**
```javascript
// If turnNumber specified (1 or 2):
{
  success: true,
  recipeName: string,
  turn: number,
  ingredients: {grains: [], hops: [], other: []},
  bothTurns: {grains: [], hops: [], other: []}  // Ingredients that apply to both
}

// If turnNumber is null:
{
  success: true,
  recipeName: string,
  turn1: {grains: [], hops: [], other: []},
  turn2: {grains: [], hops: [], other: []},
  bothTurns: {grains: [], hops: [], other: []}
}
```

**Logic:**
- Reads "Turn" column from Recipe Ingredients
- "1" → Turn 1 only
- "2" → Turn 2 only
- Blank/empty → Applies to both turns (returned in `bothTurns`)

---

#### `completeTurn(batchNumber, turnNumber, brewerId, laborHours, vesselName, actualIngredients)` - NEW
**Purpose:** Completes a turn (Turn 1 or Turn 2) with material depletion and labor logging

**Parameters:**
- `batchNumber`: Batch number
- `turnNumber`: 1 or 2
- `brewerId`: Brewer name/ID
- `laborHours`: Hours worked (from timer)
- `vesselName`: Target vessel (FV or LT)
- `actualIngredients`: Optional - actual ingredients used {grains: [], hops: [], other: []}

**Actions:**
1. Validates batch exists and turn not already completed
2. Gets recipe base batch size for scaling
3. Depletes turn-specific materials:
   - If `actualIngredients` provided: uses those
   - Otherwise: gets from recipe using `getRecipeIngredientsByTurn()`
   - For "both turns" ingredients: splits 50/50 for Turn 1, full amount for Turn 2
   - Scales to batch size: `amount × (batchSize / recipeBaseSize)`
4. Logs labor to Batch Details
5. Updates vessel status (on Turn 1 only, or if vessel changes)
6. Updates Batch Log Turn columns:
   - Turn X Complete Date = now
   - Turn X Complete By = current user
   - Turn X Labor Hours = laborHours
7. Updates batch status to "Fermenting" after Turn 2

**Returns:**
```javascript
{
  success: true,
  batchNumber: string,
  turn: number,
  brewer: string,
  laborHours: number,
  vessel: string,
  depletedItems: [{ingredient, amount, uom, cost}, ...],
  totalDepletedCost: number,
  message: string
}
```

**Depletion Logic:**
- Depletes all ingredients provided (grains, hops, other)
- Logs each depletion to Material Log via `depleteRawMaterial()`
- Calculates cost from Raw Materials before depleting

---

#### `initializePhase2ASetup()` - NEW
**Purpose:** One-time setup function to initialize all Phase 2A infrastructure

**Actions:**
1. Ensures Recipe Ingredients has "Turn" column
2. Ensures Batch Log has Turn 1/Turn 2 columns
3. Ensures Batch Tasks has timer columns
4. Verifies Equipment sheet structure

**Returns:**
```javascript
{
  success: boolean,
  results: {
    recipeIngredientsTurn: {...},
    batchLogTurnColumns: {...},
    batchTasksTimer: {...},
    equipmentStructure: {...}
  },
  message: string,
  errors: [string]
}
```

---

## DATA STRUCTURE SUMMARY

### Recipe Ingredients Sheet
**New Column:**
- **Turn** (after UOM column)
  - Values: "1", "2", or blank
  - Blank = applies to both turns

**Existing Columns (unchanged):**
- Recipe Name
- Category
- Ingredient Name
- Amount
- UOM

---

### Batch Log Sheet
**New Columns (Row 9 headers, after AL = 38):**
- **AM (39):** Turn 1 Complete Date
- **AN (40):** Turn 1 Complete By
- **AO (41):** Turn 1 Labor Hours
- **AP (42):** Turn 2 Complete Date
- **AQ (43):** Turn 2 Complete By
- **AR (44):** Turn 2 Labor Hours

**Existing Workflow Columns (from Phase 1):**
- AD (30): Transfer to FV Date
- AE (31): Transfer to FV By
- AF (32): FV/LT Vessel
- AG (33): Crash Date
- AH (34): Transfer to BT Date
- AI (35): Transfer to BT By
- AJ (36): BT Vessel
- AK (37): Packaging Complete Date
- AL (38): Packaging Complete By

---

### Batch Tasks Sheet
**New Columns:**
- **Timer Start:** Timestamp
- **Timer End:** Timestamp
- **Actual Labor Hours:** Calculated (hours)

**Note:** Sheet may not exist yet - will be created when needed.

---

### Equipment Sheet
**Verified Columns:**
- Name (or Equipment Name, Vessel Name)
- Type (or Equipment Type, Vessel Type)
- Size (or Capacity, Size (BBL), BBL)
- Status (or Availability, Available)
- Current Batch (or Current Beer, Batch Number)

**Structure:** Flexible matching allows for various header names.

---

## TESTING RESULTS

### ✅ Recipe Ingredients Turn Column
- [x] `ensureRecipeIngredientsTurnColumn()` creates column if missing
- [x] Column added after existing columns
- [x] Function returns success with column index

**Test:**
```javascript
ensureRecipeIngredientsTurnColumn()
// Result: Returns success, column index
```

---

### ✅ Batch Log Turn Columns
- [x] `ensureBatchLogTurnColumns()` adds 6 columns to Row 9
- [x] Columns added at correct positions (AM-AR)
- [x] Existing data preserved

**Test:**
```javascript
ensureBatchLogTurnColumns()
// Result: Returns success, lists columns added
```

---

### ✅ Batch Tasks Timer Columns
- [x] `ensureBatchTasksTimerColumns()` adds 3 columns
- [x] Handles case where sheet doesn't exist
- [x] Columns added at end of sheet

**Test:**
```javascript
ensureBatchTasksTimerColumns()
// Result: Returns success, lists columns added or notes sheet doesn't exist
```

---

### ✅ Equipment Sheet Verification
- [x] `verifyEquipmentSheetStructure()` checks for required columns
- [x] Flexible matching works for various header names
- [x] Returns list of found and missing columns

**Test:**
```javascript
verifyEquipmentSheetStructure()
// Result: Returns success with foundColumns and missingColumns arrays
```

---

### ✅ Recipe Ingredients by Turn
- [x] `getRecipeIngredientsByTurn()` returns correct ingredients
- [x] Handles Turn 1, Turn 2, and both turns
- [x] Returns "bothTurns" ingredients separately

**Test:**
```javascript
getRecipeIngredientsByTurn('Hazy IPA', 1)
// Result: Returns Turn 1 ingredients + bothTurns ingredients

getRecipeIngredientsByTurn('Hazy IPA', 2)
// Result: Returns Turn 2 ingredients + bothTurns ingredients

getRecipeIngredientsByTurn('Hazy IPA', null)
// Result: Returns turn1, turn2, and bothTurns separately
```

---

### ✅ Complete Turn Function
- [x] `completeTurn()` validates batch exists
- [x] Prevents duplicate turn completion
- [x] Depletes turn-specific materials
- [x] Logs labor to Batch Details
- [x] Updates vessel status (Turn 1)
- [x] Updates Batch Log Turn columns
- [x] Updates batch status after Turn 2

**Test:**
```javascript
completeTurn('HAZ-251220-68', 1, 'Richard Mar', 8, 'FV-8', null)
// Result: Depletes Turn 1 materials, logs labor, updates vessel

completeTurn('HAZ-251220-68', 2, 'Alex Velasco', 8, 'FV-8', null)
// Result: Depletes Turn 2 materials, logs labor, sets status to "Fermenting"
```

---

## ISSUES ENCOUNTERED

**None.** Phase 2A implementation was straightforward with no blocking issues.

**Notes:**
- Batch Tasks sheet may not exist - handled gracefully
- Equipment sheet column matching is flexible to handle various header formats
- Turn column in Recipe Ingredients is optional - functions handle missing column gracefully

---

## FILES MODIFIED

1. **Code.js**
   - Added `ensureRecipeIngredientsTurnColumn()` function
   - Added `ensureBatchLogTurnColumns()` function
   - Added `ensureBatchTasksTimerColumns()` function
   - Added `verifyEquipmentSheetStructure()` function
   - Added `getRecipeIngredientsByTurn()` function
   - Added `completeTurn()` function
   - Added `initializePhase2ASetup()` function

2. **PHASE_2A_COMPLETE.md** (this file)
   - Documentation of Phase 2A completion

---

## NEXT STEPS: PHASE 2B

Phase 2B will implement:
- Brewer's Sheet UI restructure
- Section 1: Batch Info
- Section 2: Turn 1 with timer, ingredients, complete button
- Section 3: Turn 2 / No Turn 2
- Integration with `completeTurn()` function

**Ready for Phase 2B approval.**

---

## CONFIRMATION CHECKLIST

- [x] Recipe Ingredients has "Turn" column (or function to add it)
- [x] Batch Log has Turn 1/Turn 2 columns (AM-AR)
- [x] Batch Tasks has timer columns (or function to add them)
- [x] Equipment sheet structure verified
- [x] `getRecipeIngredientsByTurn()` function created and tested
- [x] `completeTurn()` function created and tested
- [x] All functions handle missing data gracefully
- [x] No UI changes made (data layer only)

---

## SETUP INSTRUCTIONS

**Run once after Phase 2A deployment:**
```javascript
initializePhase2ASetup()
```

This will:
1. Add "Turn" column to Recipe Ingredients (if missing)
2. Add Turn 1/Turn 2 columns to Batch Log (if missing)
3. Add timer columns to Batch Tasks (if sheet exists)
4. Verify Equipment sheet structure

**Individual setup functions:**
```javascript
ensureRecipeIngredientsTurnColumn()
ensureBatchLogTurnColumns()
ensureBatchTasksTimerColumns()
verifyEquipmentSheetStructure()
```

---

**END OF PHASE 2A REPORT**














