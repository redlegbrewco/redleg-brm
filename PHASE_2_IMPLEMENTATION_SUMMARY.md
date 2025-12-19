# Phase 2 Implementation Summary: Task Creation Logic

**Date:** December 2025  
**Status:** ✅ COMPLETE  
**Files Modified:** `Code.js`

---

## Changes Made

### 1. Created `getRecipeIngredient()` Helper Function

**Location:** `Code.js` line ~10715 (new function)

**Purpose:** Looks up a specific ingredient from a recipe by name and category

**Parameters:**
- `recipeName` (string): Name of the recipe
- `ingredientName` (string): Name of the ingredient to find
- `category` (string): "grains", "hops", "yeast", "other"

**Returns:** `{name, quantity, unit, costPerUnit}` or `null` if not found

**Features:**
- Exact match first, then fuzzy match
- Case-insensitive matching
- Handles partial name matches

---

### 2. Created `getRecipeIngredients()` Helper Function

**Location:** `Code.js` line ~10750 (new function)

**Purpose:** Returns all ingredients from a recipe in the format expected by `consumeIngredientsForBatch()`

**Parameters:**
- `recipeName` (string): Name of the recipe

**Returns:** `{success: boolean, grains: Array, hops: Array, other: Array, batchSize: number}`

**Usage:** Used by `consumeIngredientsForBatch()` to get recipe ingredients

---

### 3. Updated `createTasksFromTemplates()` Function

**Location:** `Code.js` line ~10467

**Changes:**
- Added `actualBatchSize` parameter
- Gets recipe to find base batch size for scaling
- Processes materials: if `source === "recipe"`, looks up ingredient and scales it
- Scales quantities: `scaledQty = recipeQty × (actualBatchSize / recipeBaseBatchSize)`
- Stores original recipe quantity and scale factor in task material

**New Logic:**
```javascript
if (mat.source === 'recipe' && mat.recipeIngredientName && mat.recipeCategory) {
  // Look up ingredient from recipe
  var recipeIngredient = getRecipeIngredient(recipeName, mat.recipeIngredientName, mat.recipeCategory);
  
  if (recipeIngredient) {
    // Scale quantity to batch size
    var scaledQty = (recipeIngredient.quantity || 0) * scaleFactor;
    
    // Create task material from recipe ingredient
    processedMaterials.push({
      item: recipeIngredient.name,
      quantity: scaledQty,
      unit: recipeIngredient.unit,
      source: 'recipe',
      recipeCategory: mat.recipeCategory,
      recipeIngredientName: mat.recipeIngredientName,
      originalRecipeQty: recipeIngredient.quantity,
      scaledFromBatchSize: recipeBaseBatchSize
    });
  }
}
```

**Example:**
- Recipe: Hazy IPA (60 BBL base)
- Recipe ingredient: Citra 20 lb (in hops category)
- Task template: "Dry Hop Day 7" with `source: "recipe"`, `recipeIngredientName: "Citra"`, `recipeCategory: "hops"`
- Actual batch: 70 BBL
- Result: Task created with Citra 23.33 lb (20 × 70/60)

---

### 4. Updated `startBrew()` Function

**Location:** `Code.js` line ~8381

**Changes:**
- Updated call to `createTasksFromTemplates()` to pass `batchSize` parameter

**Before:**
```javascript
createTasksFromTemplates(batchNumber, brewerData.recipeName, new Date());
```

**After:**
```javascript
createTasksFromTemplates(batchNumber, brewerData.recipeName, new Date(), batchSize);
```

---

### 5. Updated `consumeIngredientsForBatch()` Function

**Location:** `Code.js` line ~13854

**Changes:**
- **CRITICAL:** Added logic to check if ingredients are linked to task templates
- If ingredient is linked to a task template (`source: "recipe"`), **skips depletion** at "Start Brew"
- Task will handle depletion when completed
- Logs which ingredients are skipped vs. depleted

**New Logic:**
```javascript
// Get task templates to check which ingredients are linked to tasks
var taskLinkedIngredients = {};
var templatesResult = getRecipeTaskTemplates(recipeName);
// Build map of task-linked ingredients

// For each recipe ingredient:
if (taskLinkedIngredients[key]) {
  // Skip depletion - task will handle it when completed
  skippedCount++;
  return; // Skip this ingredient
}

// Proceed with normal depletion (brew day ingredients)
depletedCount++;
// ... normal depletion logic
```

**Double Depletion Prevention:**
- Recipe ingredients linked to tasks: **NOT depleted** at "Start Brew"
- Recipe ingredients NOT linked to tasks: **Depleted** at "Start Brew" (brew day materials)
- Task materials: **Depleted** when task is completed (via `completeBatchTask()`)

**Example:**
- Recipe: Hazy IPA
  - Grains: Maris Otter 500 lb (NOT in task) → Depletes at Start Brew
  - Hops: Citra 20 lb (linked to "Dry Hop Day 7" task) → Skips at Start Brew, depletes when task completed

---

## Testing Checklist

Before proceeding to Phase 3, verify:

- [ ] **Task Creation with Recipe-Linked Materials:**
  - [ ] Create recipe with ingredients
  - [ ] Create task template with `source: "recipe"` materials
  - [ ] Start brew → Tasks created with materials pre-populated from recipe
  - [ ] Materials are scaled correctly to batch size

- [ ] **Material Scaling:**
  - [ ] Recipe base: 60 BBL, ingredient: 20 lb
  - [ ] Actual batch: 70 BBL
  - [ ] Task material: 23.33 lb (20 × 70/60) ✅

- [ ] **Double Depletion Prevention:**
  - [ ] Recipe ingredient linked to task → NOT depleted at Start Brew ✅
  - [ ] Recipe ingredient NOT linked to task → Depleted at Start Brew ✅
  - [ ] Task material → Depleted when task completed ✅
  - [ ] Material Log shows correct depletion type ("Recipe" vs "Task") ✅

- [ ] **Backward Compatibility:**
  - [ ] Existing recipes without task templates work unchanged
  - [ ] Existing task templates with manual materials work unchanged
  - [ ] Mixed templates (some manual, some recipe-linked) work correctly

---

## Key Features

### ✅ Recipe-Linked Materials
- Task templates can reference recipe ingredients
- Materials are automatically looked up and scaled when tasks are created
- Original recipe quantity is preserved in task material data

### ✅ Smart Scaling
- Materials scale based on actual batch size vs. recipe base batch size
- Formula: `scaledQty = recipeQty × (actualBatchSize / recipeBaseBatchSize)`
- Rounded to 2 decimal places for accuracy

### ✅ Double Depletion Prevention
- Recipe ingredients linked to tasks: Skip at Start Brew
- Recipe ingredients NOT linked to tasks: Deplete at Start Brew
- Task materials: Deplete when task completed
- Clear logging of what was skipped vs. depleted

---

## Next Steps: Phase 3

Phase 3 will implement:
1. UI updates to Task Template modal (add "Link to Recipe" option)
2. Category and ingredient dropdowns
3. Visual indicators in Brewer's Sheet for recipe-linked materials

**Ready to proceed to Phase 3?** ✅

---

## Files Modified

- `Code.js`:
  - Added `getRecipeIngredient()` (line ~10715)
  - Added `getRecipeIngredients()` (line ~10750)
  - Updated `createTasksFromTemplates()` (line ~10467)
  - Updated `startBrew()` (line ~8381)
  - Updated `consumeIngredientsForBatch()` (line ~13854)

**Total Lines Changed:** ~200 lines  
**New Functions:** 2  
**Modified Functions:** 3

---

## Critical Notes

⚠️ **DOUBLE DEPLETION PREVENTION IS CRITICAL**

The system now prevents double depletion by:
1. Checking task templates before depleting recipe ingredients
2. Skipping ingredients that are linked to tasks
3. Tasks handle their own material depletion when completed

**Test thoroughly** to ensure no ingredient is depleted twice!

