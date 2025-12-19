# BRM Recipe-to-Task Integration Impact Analysis
**Date:** December 2025  
**Analysis Type:** Impact Assessment (No Code Changes)  
**Proposed Change:** Link Recipe Ingredients to Task Templates

---

## EXECUTIVE SUMMARY

**Proposed Change:** Task templates should auto-populate materials from recipe ingredients, creating a task-driven workflow while recipes remain the planning foundation.

**Key Finding:** This change would affect **8 major downstream systems** with varying risk levels. The highest risk areas are **COGS calculations** and **Material Depletion**, which directly depend on recipe ingredients. **Pricing, QB Journal, and CRM integrations** have lower risk as they depend on aggregated COGS data, not individual ingredient sources.

**Recommendation:** **Option B (Hybrid Approach)** - Reference recipe ingredients in task templates without breaking existing flows. This allows task-first workflow while maintaining backward compatibility.

---

## 1. CURRENT DATA FLOW MAP

### 1.1 Recipe Ingredients Data Flow

```
Recipe Ingredients Sheet
    ↓
    ├─→ getAllRecipesEnhanced()
    │   ├─→ Recipe Detail Modal (UI)
    │   ├─→ Recipe List (UI)
    │   └─→ getBrewerSheet()
    │       └─→ Brewer's Sheet Modal (UI)
    │
    ├─→ getBrewerSheet()
    │   ├─→ Scales ingredients by batch size
    │   ├─→ Calculates ingredient costs from Raw Materials
    │   └─→ Displays in Brewer's Sheet
    │
    ├─→ consumeIngredientsForBatch()
    │   ├─→ Depletes Raw Materials (on "Start Brew")
    │   ├─→ Logs to Material Log (Type: "Recipe")
    │   └─→ Sets ingredientsDepleted flag in Batch Log
    │
    ├─→ updateBeerCOGSMaster()
    │   ├─→ Calculates ingredient COGS per recipe
    │   ├─→ Uses recipe.grains, recipe.hops, recipe.other
    │   ├─→ Looks up costs from Raw Materials
    │   └─→ Updates Beer COGS Master sheet
    │
    ├─→ recalculateAllCOGS()
    │   └─→ Rebuilds Beer COGS Master from recipe ingredients
    │
    └─→ sendItWithActualLabor()
        ├─→ Uses recipeCost (from consumeIngredientsForBatch)
        ├─→ Adds task material costs
        ├─→ Adds packaging material costs
        ├─→ Calculates final COGS/BBL
        └─→ Updates Batch Log, Finished Goods, Beer COGS Master
```

### 1.2 Downstream System Dependencies

#### **Beer COGS Master**
- **Source:** `updateBeerCOGSMaster()`, `recalculateAllCOGS()`
- **Uses:** `getAllRecipesEnhanced()` → `recipe.grains`, `recipe.hops`, `recipe.other`
- **Calculates:** Ingredient COGS = sum(ingredient.amount × rawMaterial.avgCost)
- **Output:** Ingredient COGS, Total COGS, COGS/BBL per recipe
- **Used By:**
  - Floor Pricing (`updateFloorPricing()`)
  - Fully Loaded Pricing (`updateFullyLoadedPricing()`)
  - Recipe Detail Modal (COGS preview)
  - Recipe List (estimated cost display)

#### **Batch Log / Batch Details**
- **Source:** `startBrew()`, `consumeIngredientsForBatch()`, `sendItWithActualLabor()`
- **Uses:** Recipe ingredients for initial cost estimate
- **Stores:** Recipe Cost (column E), Total Cost (column I), Cost/BBL (column N)
- **Used By:**
  - TTB Reports (`getTTBDataWithState()`)
  - QB Journal (`generateMonthlyJournalEntriesV2()`)
  - WIP calculations
  - Batch archive

#### **Raw Materials Depletion**
- **Source:** `consumeIngredientsForBatch()`, `completeBatchTask()`, `deductPackagingMaterials()`
- **Uses:** Recipe ingredients → depletes on "Start Brew"
- **Logs To:** Material Log (Type: "Recipe", "Task", "Packaging")
- **Prevents Double Depletion:** `ingredientsDepleted` flag, `materialsDepletedAt` timestamp, `packagingMaterialsDepleted` flag

#### **Material Log**
- **Source:** `logMaterialAdjustment()` (called by `consumeIngredientsForBatch()`, `depleteRawMaterial()`)
- **Stores:** Item, Old Qty, New Qty, Reason (includes Batch #, Task ID, Depletion Type)
- **Used By:** Audit trail, double-depletion checks (`hasBeenDepleted()`)

#### **TTB/LED Reports**
- **Source:** `getTTBDataWithState()`
- **Uses:** Batch Log (actual yield, brew date, package date)
- **Does NOT directly use recipe ingredients** - only batch-level data
- **Risk:** LOW (uses aggregated batch data, not ingredient details)

#### **QuickBooks Journal Entries**
- **Source:** `generateMonthlyJournalEntriesV2()`
- **Uses:** Batch Log (recipeCost, laborCost, overheadCost)
- **Calculates:** WIP = materialsConsumed + laborCost + overheadCost
- **Does NOT directly use recipe ingredients** - only batch-level totals
- **Risk:** LOW (uses aggregated batch data)

#### **Pricing Calculations**
- **Source:** `updateFloorPricing()`, `updateFullyLoadedPricing()`
- **Uses:** Beer COGS Master (COGS/BBL)
- **Does NOT directly use recipe ingredients** - only COGS/BBL
- **Risk:** LOW (uses aggregated COGS, not ingredient details)

#### **Finished Goods**
- **Source:** `addToFinishedGoods()` (called by `sendItWithActualLabor()`)
- **Uses:** COGS/BBL from batch (calculated from recipe + tasks + packaging)
- **Does NOT directly use recipe ingredients** - only final COGS
- **Risk:** LOW (uses final COGS, not ingredient details)

#### **WIP Calculations**
- **Source:** `generateMonthlyJournalEntriesV2()` (Entry 2: Production)
- **Uses:** Batch Log (recipeCost = materialsConsumed)
- **Does NOT directly use recipe ingredients** - only batch totals
- **Risk:** LOW (uses aggregated batch data)

#### **CRM Integration**
- **Source:** `getInventoryForCrm()`, `getProductCatalogForCrm()`
- **Uses:** Finished Goods (inventory), Floor Pricing / Fully Loaded Pricing (prices)
- **Does NOT use recipe ingredients** - only finished goods and pricing
- **Risk:** NONE (no dependency on recipe ingredients)

#### **TRM (Keg Tracker) Integration**
- **Source:** `syncKegTrackerToBRM()`
- **Uses:** Finished Goods (keg inventory)
- **Does NOT use recipe ingredients** - only finished goods
- **Risk:** NONE (no dependency on recipe ingredients)

#### **Batch Archive**
- **Source:** `archiveBatchRecord()`
- **Uses:** Batch data, package breakdown
- **May include:** Recipe ingredients (if stored in batch data)
- **Risk:** LOW (archival only, not used in calculations)

---

## 2. TASK TEMPLATE CURRENT STRUCTURE

### 2.1 How Task Template Materials Are Stored

**Sheet:** `Recipe Task Templates`  
**Column G:** `Default Materials` (JSON string)

**Current Structure:**
```json
[
  {
    "item": "Citra",
    "quantity": 2,
    "unit": "lb",
    "uom": "lb"
  },
  {
    "item": "Mosaic",
    "quantity": 1.5,
    "unit": "lb",
    "uom": "lb"
  }
]
```

**Storage Location:**
- **Recipe Task Templates Sheet:** Column G (JSON string)
- **Batch Tasks Sheet:** Column P (JSON string, copied from template)
- **Task Materials Sheet:** Separate rows per material (if used)

### 2.2 Are Task Templates Independent or Linked?

**Current State:** **INDEPENDENT**

- Task template materials are **manually entered** when creating templates
- No link to recipe ingredients
- Materials are **copied** (not referenced) when tasks are created from templates
- Recipe ingredients and task materials are **separate data sources**

**Code Evidence:**
```javascript
// createTasksFromTemplates() - Line 10454
var taskData = {
  materials: template.defaultMaterials || []  // Direct copy, no recipe lookup
};

// addRecipeTaskTemplate() - Line 10500
JSON.stringify(templateData.defaultMaterials || [])  // Manual entry, no recipe link
```

### 2.3 When Tasks Are Created, Where Does Material Data Come From?

**Current Flow:**
1. **Template Creation:** Brewer manually enters materials in Task Template modal
2. **Template Storage:** Materials saved as JSON in `Recipe Task Templates` sheet (Column G)
3. **Task Creation:** `createTasksFromTemplates()` copies `template.defaultMaterials` to task
4. **Task Storage:** Materials saved as JSON in `Batch Tasks` sheet (Column P)
5. **Task Completion:** `completeBatchTask()` reads materials from task, depletes Raw Materials

**No Recipe Ingredient Lookup:** Tasks are created with materials from templates only, not from recipe ingredients.

---

## 3. PROPOSED INTEGRATION POINTS

### 3.1 Where Would the Link Be Created?

**Option A: Recipe Task Templates Sheet (Column Addition)**
- Add column: `Recipe Ingredient Mapping` (JSON)
- Structure: `[{recipeIngredientName: "Maris Otter", taskMaterialName: "Maris Otter", quantity: 500}]`
- **Pros:** Explicit mapping, flexible
- **Cons:** Requires new column, more complex UI

**Option B: Task Template Materials (Reference Flag)**
- Add field to material object: `source: "recipe" | "manual"`
- If `source: "recipe"`, store reference: `recipeIngredientName: "Maris Otter"`
- **Pros:** Backward compatible, simple
- **Cons:** Requires recipe ingredient name matching

**Option C: Code Logic (No Schema Change)**
- When creating task from template, check if material name matches recipe ingredient
- Auto-populate from recipe if match found
- **Pros:** No schema changes, automatic
- **Cons:** Name matching could fail, less explicit

### 3.2 Would Task Materials Reference or Copy Recipe Ingredients?

**Recommendation: REFERENCE (with copy on task creation)**

**Proposed Flow:**
1. **Template Level:** Task template materials **reference** recipe ingredients (by name/category)
2. **Task Creation:** When task is created, materials are **copied** from recipe ingredients (scaled to batch size)
3. **Task Storage:** Task materials are stored as actual quantities (not references)

**Why Reference at Template, Copy at Task:**
- Templates are recipe-level (can reference recipe ingredients)
- Tasks are batch-level (need actual quantities for that batch)
- Allows recipe changes to propagate to new batches (but not affect existing batches)

### 3.3 If Recipe Ingredients Change, Should Task Template Defaults Update?

**Recommendation: YES (with user confirmation)**

**Proposed Behavior:**
- When recipe ingredient is updated:
  - Check if any task templates reference that ingredient
  - Prompt user: "Update task template materials for [Recipe]?"
  - If yes: Update template default materials
  - Existing batches: **NOT affected** (tasks already created with copied materials)

**Implementation:**
- Add function: `syncTaskTemplatesWithRecipe(recipeName)`
- Called after: `updateRecipeIngredients()`
- Updates: `Recipe Task Templates` sheet (Column G)

---

## 4. RISK ASSESSMENT

### 4.1 Risk Assessment Table

| System | Affected? | What Changes | Risk Level | What Could Break |
|--------|-----------|--------------|------------|------------------|
| **Beer COGS Master** | ✅ YES | Ingredient COGS calculation may need to include task materials | **MEDIUM** | COGS calculations if recipe ingredients are replaced by task materials |
| **TTB/LED** | ❌ NO | No change - uses batch-level data only | **NONE** | Nothing |
| **QB Journal** | ❌ NO | No change - uses batch-level totals only | **NONE** | Nothing |
| **Pricing** | ⚠️ INDIRECT | Only if COGS changes (which it shouldn't) | **LOW** | Pricing accuracy if COGS calculation breaks |
| **Raw Materials** | ✅ YES | Depletion source may change (recipe → tasks) | **HIGH** | Double depletion if both recipe and tasks deplete same materials |
| **Finished Goods** | ❌ NO | Uses final COGS only | **LOW** | Nothing (uses aggregated data) |
| **WIP** | ❌ NO | Uses batch totals only | **LOW** | Nothing (uses aggregated data) |
| **CRM Integration** | ❌ NO | No dependency on recipe ingredients | **NONE** | Nothing |
| **TRM Integration** | ❌ NO | No dependency on recipe ingredients | **NONE** | Nothing |
| **Material Log** | ✅ YES | May log materials from tasks instead of recipe | **LOW** | Audit trail clarity (but still accurate) |
| **Batch Archive** | ⚠️ MINOR | May include task materials instead of recipe ingredients | **LOW** | Historical record format (but data still accurate) |

### 4.2 Detailed Risk Analysis

#### **HIGH RISK: Raw Materials Depletion**

**Current Flow:**
1. "Start Brew" → `consumeIngredientsForBatch()` → Depletes recipe ingredients
2. Task completion → `completeBatchTask()` → Depletes task materials

**Risk Scenario:**
- If recipe ingredients are moved to tasks:
  - Recipe ingredients deplete at "Start Brew" (grains, hops for brew day)
  - Task materials deplete at task completion (dry hops, finings, etc.)
  - **Problem:** If same material is in both recipe AND task, it depletes twice

**Mitigation:**
- **Option 1:** Recipe ingredients only for brew day (grains, initial hops)
- **Option 2:** Task materials only (all materials in tasks)
- **Option 3:** Smart de-duplication (check Material Log before depleting)

**Recommendation:** **Option 1** - Keep recipe ingredients for brew day materials, tasks for later-stage materials. Clear separation prevents double depletion.

#### **MEDIUM RISK: Beer COGS Master**

**Current Flow:**
- `updateBeerCOGSMaster()` reads `recipe.grains`, `recipe.hops`, `recipe.other`
- Calculates ingredient COGS = sum(ingredient.amount × rawMaterial.avgCost)

**Risk Scenario:**
- If recipe ingredients are replaced by task materials:
  - COGS calculation must aggregate task materials instead
  - Need new function: `getRecipeCOGSFromTasks(recipeName)`

**Mitigation:**
- Keep recipe ingredients for COGS calculation
- OR: Aggregate task template materials for COGS calculation
- OR: Hybrid - recipe ingredients for brew day, task materials for later stages

**Recommendation:** **Hybrid** - Recipe ingredients for brew day COGS, task materials for task COGS. Both included in total.

#### **LOW RISK: Material Log**

**Current Flow:**
- `logMaterialAdjustment()` logs: Item, Old Qty, New Qty, Reason (includes Batch #, Task ID, Type)

**Risk Scenario:**
- If materials come from tasks instead of recipe:
  - Material Log will show Type: "Task" instead of Type: "Recipe"
  - Audit trail still accurate, but source changes

**Mitigation:**
- Keep current logging (Type: "Recipe" for recipe ingredients, Type: "Task" for task materials)
- No change needed - system already supports both

**Recommendation:** **No change** - Current system already handles both types correctly.

---

## 5. IMPLEMENTATION OPTIONS

### Option A: Full Task-First (Replace Recipe Ingredients)

**Approach:**
- Remove recipe ingredients from COGS calculation
- All materials come from task templates
- Recipe ingredients sheet becomes optional/legacy

**Pros:**
- True task-first workflow
- Single source of truth (tasks)
- Simpler mental model

**Cons:**
- **BREAKS existing COGS calculations** (high risk)
- Requires rewriting `updateBeerCOGSMaster()`
- May break existing batches
- High migration effort

**Risk Level:** 🔴 **HIGH**  
**Effort Level:** 🔴 **HIGH** (2-3 weeks)

---

### Option B: Hybrid Approach (Reference Recipe Ingredients in Tasks)

**Approach:**
- Task templates can **reference** recipe ingredients (by name/category)
- When task is created, materials are **copied** from recipe (scaled to batch)
- Recipe ingredients remain primary source for COGS
- Tasks supplement recipe (for later-stage materials)

**Pros:**
- Backward compatible (existing recipes work)
- Task-first UI while keeping recipe foundation
- No breaking changes to COGS
- Gradual migration possible

**Cons:**
- Two sources of truth (recipe + tasks)
- Need to prevent double depletion
- More complex logic

**Risk Level:** 🟡 **MEDIUM**  
**Effort Level:** 🟡 **MEDIUM** (1 week)

**Implementation Details:**
1. Add `source: "recipe"` flag to task template materials
2. Add `recipeIngredientName` field to link to recipe ingredient
3. Modify `createTasksFromTemplates()` to:
   - If `source: "recipe"`, look up ingredient from recipe
   - Copy quantity (scaled to batch size)
   - Store as actual material in task
4. Keep `consumeIngredientsForBatch()` for brew day materials
5. Keep `completeBatchTask()` for task materials

---

### Option C: Smart Auto-Population (No Schema Changes)

**Approach:**
- When creating task template, auto-suggest materials from recipe ingredients
- Match by name/category (e.g., "Dry Hop" task → suggests recipe hops)
- User can accept or modify
- Templates still store materials independently

**Pros:**
- No schema changes
- Backward compatible
- Low risk
- Better UX (suggestions)

**Cons:**
- Not true "link" (materials still independent)
- Recipe changes don't auto-update templates
- Name matching could fail

**Risk Level:** 🟢 **LOW**  
**Effort Level:** 🟢 **LOW** (2-3 days)

**Implementation Details:**
1. Add function: `suggestMaterialsFromRecipe(recipeName, taskType)`
2. In Task Template modal, when task type selected:
   - If "Dry Hop" → suggest recipe hops
   - If "Mash In" → suggest recipe grains
   - If "Fining" → suggest recipe other (finings)
3. User can accept suggestions or enter manually
4. Templates store materials as before (no link)

---

## 6. RECOMMENDATION

### 6.1 Is This Change Safe to Implement?

**Answer: YES, with Option B (Hybrid Approach)**

**Reasoning:**
- Option A (Full Task-First) is too risky - breaks COGS calculations
- Option C (Smart Suggestions) is safe but doesn't achieve the goal
- Option B (Hybrid) provides task-first workflow while maintaining backward compatibility

### 6.2 Which Option Do You Recommend?

**Recommendation: Option B (Hybrid Approach)**

**Why:**
1. **Achieves Goal:** Task templates reference recipe ingredients, creating task-first workflow
2. **Backward Compatible:** Existing recipes continue to work
3. **Low Risk:** Doesn't break COGS calculations (recipe ingredients still primary)
4. **Flexible:** Supports both recipe-first and task-first workflows
5. **Gradual Migration:** Can migrate recipes one at a time

### 6.3 What Should Be Done First?

**Phase 1: Schema & Data Model (2 days)**
1. Add `source` field to task template materials (default: "manual")
2. Add `recipeIngredientName` field (optional, for "recipe" source)
3. Add `recipeIngredientCategory` field (optional, for category matching)
4. Update `addRecipeTaskTemplate()` to accept source fields
5. Update `getRecipeTaskTemplates()` to return source fields

**Phase 2: Task Creation Logic (2 days)**
1. Modify `createTasksFromTemplates()` to:
   - Check if material has `source: "recipe"`
   - If yes, look up ingredient from recipe (by name/category)
   - Copy quantity (scaled to batch size)
   - Store as actual material in task
2. Add function: `getRecipeIngredientForTask(recipeName, ingredientName, category)`

**Phase 3: UI Updates (2 days)**
1. Update Task Template modal to:
   - Show "Link to Recipe Ingredient" option
   - Dropdown of recipe ingredients (filtered by category)
   - Auto-populate quantity from recipe
2. Update Brewer's Sheet to show:
   - "Materials from Recipe" indicator on tasks
   - Recipe ingredient source in task material list

**Phase 4: Recipe Sync (1 day)**
1. Add function: `syncTaskTemplatesWithRecipe(recipeName)`
2. Call after `updateRecipeIngredients()`
3. Update task templates that reference changed ingredients
4. User confirmation prompt

**Phase 5: Testing (1 day)**
1. Test task creation with recipe-linked materials
2. Test COGS calculation (should be unchanged)
3. Test material depletion (no double depletion)
4. Test recipe ingredient updates (template sync)

**Total Effort: 1 week**

### 6.4 What Testing Would Be Required?

**Critical Tests:**
1. **COGS Calculation:**
   - Create recipe with ingredients
   - Create task template with recipe-linked materials
   - Start brew → verify COGS includes both recipe and task materials
   - Compare to current COGS (should match if quantities same)

2. **Material Depletion:**
   - Create recipe with "Maris Otter 500lb"
   - Create task template with recipe-linked "Maris Otter"
   - Start brew → verify recipe ingredients deplete
   - Complete task → verify task materials deplete (should be different materials or same material in different tasks)

3. **Double Depletion Prevention:**
   - Create recipe with "Citra 20lb"
   - Create task template with recipe-linked "Citra 20lb"
   - Start brew → verify only recipe depletes (not task)
   - Complete task → verify task depletes (if not already depleted)

4. **Recipe Ingredient Updates:**
   - Create recipe with "Mosaic 15lb"
   - Create task template with recipe-linked "Mosaic"
   - Update recipe ingredient to "Mosaic 18lb"
   - Sync templates → verify task template updates
   - Start new brew → verify new quantity used

5. **Backward Compatibility:**
   - Existing recipes without task templates → should work unchanged
   - Existing task templates with manual materials → should work unchanged
   - Mixed recipes (some with recipe-linked, some manual) → should work

6. **UI/UX:**
   - Task Template modal shows recipe ingredient dropdown
   - Brewer's Sheet shows recipe-linked materials clearly
   - Recipe sync prompt works correctly

---

## 7. CONCLUSION

**The proposed change is SAFE to implement with Option B (Hybrid Approach).**

**Key Points:**
- ✅ **Low Risk:** Only affects Raw Materials depletion (mitigated by clear separation)
- ✅ **Backward Compatible:** Existing recipes continue to work
- ✅ **Achieves Goal:** Task-first workflow while maintaining recipe foundation
- ✅ **Manageable Effort:** 1 week implementation
- ✅ **Clear Testing Plan:** 6 critical test scenarios identified

**Next Steps:**
1. Review this analysis with Head Brewer
2. Confirm Option B approach
3. Begin Phase 1 (Schema & Data Model)
4. Test thoroughly before production deployment

---

## APPENDIX: CODE REFERENCES

**Key Functions to Modify:**
- `createTasksFromTemplates()` - Line 10454 (add recipe ingredient lookup)
- `addRecipeTaskTemplate()` - Line 10500 (add source fields)
- `getRecipeTaskTemplates()` - Line 10394 (return source fields)
- `updateRecipeIngredients()` - Line 11460 (add template sync call)

**Key Functions to Keep Unchanged:**
- `updateBeerCOGSMaster()` - Line 6734 (uses recipe ingredients, no change)
- `consumeIngredientsForBatch()` - Line 13717 (depletes recipe ingredients, no change)
- `completeBatchTask()` - Line 10204 (depletes task materials, no change)
- `sendItWithActualLabor()` - Line 13211 (uses both recipe and task costs, no change)

**New Functions to Create:**
- `getRecipeIngredientForTask(recipeName, ingredientName, category)` - Look up recipe ingredient
- `syncTaskTemplatesWithRecipe(recipeName)` - Update templates when recipe changes
- `suggestMaterialsFromRecipe(recipeName, taskType)` - UI helper for suggestions

