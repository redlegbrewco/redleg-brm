# CASCADE FUNCTIONS AUDIT - BRM System
**Generated before Task Management System implementation**

## ⚠️ CRITICAL: DO NOT MODIFY THESE CASCADE FLOWS

---

## 1. "START BREW" CASCADE

### Entry Point:
- `confirmStartBrew()` in BRM_UI.html (line 3215)
- Calls: `confirmBrewStartEnhanced(brewerData)` → `startBrew(brewerData)`

### Cascade Functions (in order):
1. **`startBrew(brewerData)`** (Code.js:7926)
   - Creates Batch Log row with status "Brewing"
   - Generates batch number
   - Does NOT deplete Raw Materials yet
   - Logs to Batch Details: `addBatchEntry(batchNumber, 'Note', {...})`

2. **`logBrewLabor(batchNumber, employeeName, hours)`** (Code.js:12538)
   - Called for each Turn 1/Turn 2 entry
   - Updates Batch Log Labor Hrs (F) and Labor $ (G)
   - Updates Brewers column
   - Logs to Batch Details: `addBatchEntry(batchNumber, 'Labor', {...})`
   - Updates YTD labor tracking

3. **`updateBatchBrewers(batchNumber, brewersString)`** (Code.js:9043+)
   - Updates Batch Log "Brewers" column with "Turn 1 / Turn 2" format

### Material Deduction (happens at Finalize, NOT at Start):
- `finalizeBrew(batchNumber, vessel, actualIngredients)` (Code.js:8037)
- Calls `depleteRawMaterial()` for each ingredient
- Calls `logBatchIngredients()` to log to Batch Ingredients sheet

---

## 2. "SEND IT" CASCADE

### Entry Points:
- `sendIt(batchNumber, packageBreakdown, currentVessel)` (Code.js:8507, 9979)
- `sendItWithActualLabor(batchNumber, packageBreakdown, currentVessel, packagers, batchesPackagedToday)` (Code.js:11919)
- `sendItComplete(batchNumber, packageBreakdown, currentVessel)` (Code.js:9843)

### Cascade Functions (in order):
1. **Calculate efficiency and COGS**
   - Calculates actual yield from package breakdown
   - Calculates efficiency % and variance
   - Calculates COGS per BBL

2. **Update Batch Log** (Code.js:8556-8566)
   - Status → "Packaged"
   - Pkg Date → current date
   - Act. Yield → calculated yield
   - Cost/BBL → calculated COGS
   - Variance → calculated variance
   - Notes → efficiency %

3. **`addToFinishedGoods(beerName, packageBreakdown, cogsPerBBL, batchNumber)`** (Code.js:8622)
   - For each package type:
     - Finds existing SKU or creates new
     - Updates quantity (adds to existing)
     - Calculates weighted average cost
     - Updates total value
     - Updates status (OK/LOW/OUT)
   - Calls `logFGTransaction()` for audit trail

4. **`updateBeerCOGSMaster()`** (Code.js:6302, 6363, 6848)
   - Recalculates COGS for all recipes
   - Updates Beer COGS Master sheet

5. **`addBatchEntry(batchNumber, 'Note', {...})`** (Code.js:8517)
   - Logs completion to Batch Details for TTB tracking

6. **`updateEquipmentStatus(currentVessel, 'Available', '', '')`** (Code.js:8527)
   - Frees vessel in Equipment Scheduling

7. **`archiveBatchRecord(batchNumber, beerName, batchData, packageBreakdown)`** (Code.js:8531, 8723)
   - Creates Google Drive archive
   - Includes batch data, ingredients, package breakdown

---

## 3. MATERIAL DEDUCTION FUNCTIONS

### Core Functions:
1. **`depleteRawMaterial(itemName, qty, batchNumber)`** (Code.js:1886)
   - Finds material in Raw Materials sheet
   - Deducts quantity
   - Updates total value
   - Updates status (OK/REORDER/OUT)
   - Calls `logMaterialAdjustment()` for audit trail

2. **`consumeIngredientsForBatch(batchNumber, recipeName, batchSize)`** (Code.js:12323)
   - Alternative material consumption function
   - Gets recipe ingredients and scales by batch size
   - Directly deducts from Raw Materials sheet
   - Does NOT log to Material Log (use `depleteRawMaterial()` for audit trail)

3. **`logMaterialAdjustment(item, oldQty, newQty, reason, adjustType)`** (Code.js:844)
   - Logs to Material Log sheet
   - Columns: Timestamp, Item, Type, Previous Qty, New Qty, Change, Notes, User
   - Uses `getCurrentUser().email` for User column

4. **`logBatchIngredients(batchNumber, ingredients)`** (Code.js:1939)
   - Logs to Batch Ingredients sheet
   - Columns: Batch #, Date, Category, Ingredient, Amount, UOM, Unit Cost, Total Cost

---

## 4. BATCH DETAILS / CELLAR FUNCTIONS

1. **`addBatchEntry(batchNumber, type, data)`** (Code.js:7978)
   - Core function for logging to Batch Details sheet
   - Types: Gravity, Addition, QA, Transfer, Note, Labor
   - Columns: Batch #, Date, Time, Type, Description, Value, Units, Cost, Vessel, Entered By, Notes
   - Used by all other logging functions

2. **`addCellarEntry(batchNumber, entryType, value, units, notes)`** (Code.js:9564)
   - Wrapper for gravity/QA readings
   - Calls `addBatchEntry()` with type "Gravity" or "QA"
   - Returns updated batch sheet

3. **`addCellarAddition(batchNumber, ingredient, amount, uom, notes)`** (Code.js:9586)
   - Adds dry hops, fruit, finings, etc.
   - Gets cost from Raw Materials
   - **Calls `depleteRawMaterial()` immediately** (depletes on addition)
   - Logs to Batch Details with type "Addition"
   - Updates batch cost

4. **`transferVessel(batchNumber, fromVessel, toVessel, notes)`** (Code.js:9671)
   - Transfers batch between vessels
   - Frees old vessel: `updateEquipmentStatus(fromVessel, 'Available')`
   - Occupies new vessel: `updateEquipmentStatus(toVessel, 'In Use', beerName, batchNumber)`
   - Updates Batch Log: Status (K) and Current Vessel (AC)
   - Logs to Batch Details with type "Transfer"

5. **`getBatchDetails(batchNumber)`** (Code.js:8671)
   - Returns all Batch Details entries for a batch

---

## 5. EQUIPMENT MANAGEMENT

1. **`updateEquipmentStatus(vesselName, status, beer, batchNumber)`** (Code.js:1919)
   - Updates Equipment Scheduling sheet
   - Status: 'Available', 'In Use', etc.

---

## 6. PACKAGING FUNCTIONS

1. **`recordPackaging(batchNumber, packageBreakdown, finalGravity, abv, packager)`** (Code.js:8418)
   - Records packaging completion
   - Calculates actual yield in BBL from package breakdown
   - Updates Batch Log: Status → "Ready to Package", Act. Yield (M), FG Actual (R), ABV Actual (S)
   - Logs each package type to Batch Details with type "Note"
   - **Does NOT call `sendIt()` - separate function**

## 7. FINISHED GOODS FUNCTIONS

1. **`logFGTransaction(beerName, packageType, type, oldQty, newQty, change, notes)`** (Code.js:5869)
   - Logs to FG Log sheet
   - Types: PACKAGE, ADJUST, etc.

---

## 8. BATCH SHEET FUNCTIONS

1. **`getBatchSheet(batchNumber)`** (Code.js:9205)
   - Returns complete batch data including:
     - Batch Log row data
     - Ingredients from Batch Ingredients sheet
     - Cellar entries from Batch Details sheet

2. **`openBatchSheet(batchNumber)`** (BRM_UI.html:6213)
   - Opens batch sheet modal
   - Calls `loadBatchSheet(batchNumber)`

---

## PRESERVATION STRATEGY

### ✅ DO:
- Call existing functions from new task code
- Add new data to existing sheets (Batch Details, Material Log)
- Enhance existing functions with optional task parameters
- Use existing `depleteRawMaterial()` for task material deductions
- Use existing `addBatchEntry()` for task logging

### ❌ DON'T:
- Modify `startBrew()` core logic
- Modify `sendIt()` / `sendItWithActualLabor()` core cascade
- Change `depleteRawMaterial()` signature or behavior
- Change `addCellarAddition()` - it depletes materials immediately (by design)
- Change `transferVessel()` equipment status updates
- Remove or rename existing functions
- Change Batch Log column structure

### 🔄 INTEGRATION POINTS:
- Task completion → call `depleteRawMaterial()` for each material (NOT `consumeIngredientsForBatch()` - it doesn't log)
- Task completion → call `addBatchEntry()` to log task
- Task completion → update batch's running material cost
- Gravity/pH readings → use `addCellarEntry()` or `addBatchEntry()` with type "Gravity"
- Dry hop/additions → can use `addCellarAddition()` OR new task system (but don't double-deplete)
- Vessel transfers → can use `transferVessel()` OR new task system (but don't double-update equipment)
- "Send It" → include task material costs in final COGS
- "Send It" → archive includes all task history

---

## NEW FUNCTIONS TO CREATE (without breaking existing):

1. Task Management:
   - `createBatchTask(batchNumber, taskData)`
   - `updateBatchTask(taskId, updates)`
   - `completeBatchTask(taskId, completionData)`
   - `getBatchTasks(batchNumber)`

2. Task Material Tracking:
   - `addTaskMaterials(taskId, materials)` (calls `depleteRawMaterial()` internally)
   - `getTaskMaterials(taskId)`

3. Volume/Loss Tracking:
   - `recordVolumeTransfer(batchNumber, volumeIn, volumeOut, lossReason)`
   - `getBatchVolumeHistory(batchNumber)`

4. Gravity/pH Logging:
   - `logGravityReading(batchNumber, plato, pH, temperature, notes)` (enhances `addBatchEntry()`)

5. Packaging Materials:
   - `recordPackagingMaterials(batchNumber, packageType, qty, materials)` (calls `depleteRawMaterial()` for each)

---

## TESTING CHECKLIST (after implementation):

- [ ] Start Brew still creates batch and logs labor
- [ ] Start Brew does NOT deplete materials (only at Finalize)
- [ ] Send It still updates Finished Goods
- [ ] Send It still updates Beer COGS Master
- [ ] Send It still archives batch record
- [ ] Material deductions still log to Material Log
- [ ] Batch Details entries still work
- [ ] Equipment status updates still work
- [ ] Existing Brewer's Sheet functionality intact

