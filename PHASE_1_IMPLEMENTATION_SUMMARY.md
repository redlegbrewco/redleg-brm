# Phase 1 Implementation Summary: Schema & Data Model

**Date:** December 2025  
**Status:** ✅ COMPLETE  
**Files Modified:** `Code.js`

---

## Changes Made

### 1. Updated Task Template Material Structure

**New Material Structure (Backward Compatible):**
```json
{
  "item": "Citra",
  "quantity": 2,
  "unit": "lb",
  "uom": "lb",
  "source": "manual",              // NEW: "manual" or "recipe"
  "recipeCategory": null,          // NEW: "grains", "hops", "yeast", "other" (if source=recipe)
  "recipeIngredientName": null     // NEW: specific ingredient name (if source=recipe)
}
```

**Backward Compatibility:**
- Existing materials without new fields default to `source: "manual"`
- Old material formats (using `ingredient`, `amount`, `uom`) are automatically converted
- All existing task templates continue to work unchanged

---

### 2. Updated `getRecipeTaskTemplates()` Function

**Location:** `Code.js` line ~10410

**Changes:**
- Added material processing to ensure backward compatibility
- Maps old material formats to new structure
- Defaults `source` to `"manual"` if not provided
- Defaults `recipeCategory` and `recipeIngredientName` to `null` if not provided

**Code:**
```javascript
materials = materials.map(function(mat) {
  return {
    item: mat.item || mat.ingredient || '',
    quantity: mat.quantity || mat.amount || 0,
    unit: mat.unit || mat.uom || 'lb',
    uom: mat.uom || mat.unit || 'lb',
    source: mat.source || 'manual',  // Default to "manual" for backward compatibility
    recipeCategory: mat.recipeCategory || null,
    recipeIngredientName: mat.recipeIngredientName || null
  };
});
```

---

### 3. Updated `addRecipeTaskTemplate()` Function

**Location:** `Code.js` line ~10500

**Changes:**
- Processes materials before saving to ensure new fields are set
- Defaults `source` to `"manual"` if not provided
- Handles both new and old material formats

**Code:**
```javascript
var processedMaterials = (templateData.defaultMaterials || []).map(function(mat) {
  return {
    item: mat.item || mat.ingredient || '',
    quantity: mat.quantity || mat.amount || 0,
    unit: mat.unit || mat.uom || 'lb',
    uom: mat.uom || mat.unit || 'lb',
    source: mat.source || 'manual',  // Default to "manual" if not provided
    recipeCategory: mat.recipeCategory || null,
    recipeIngredientName: mat.recipeIngredientName || null
  };
});
```

---

### 4. Updated `updateRecipeTaskTemplate()` Function

**Location:** `Code.js` line ~10588

**Changes:**
- Processes materials when updating templates
- Ensures new fields are set with defaults
- Maintains backward compatibility

**Code:**
```javascript
if (updates.defaultMaterials !== undefined) {
  var processedMaterials = (updates.defaultMaterials || []).map(function(mat) {
    return {
      item: mat.item || mat.ingredient || '',
      quantity: mat.quantity || mat.amount || 0,
      unit: mat.unit || mat.uom || 'lb',
      uom: mat.uom || mat.unit || 'lb',
      source: mat.source || 'manual',  // Default to "manual" if not provided
      recipeCategory: mat.recipeCategory || null,
      recipeIngredientName: mat.recipeIngredientName || null
    };
  });
  sheet.getRange(templateRow, 7).setValue(JSON.stringify(processedMaterials));
}
```

---

### 5. Created `getRecipeIngredientsByCategory()` Helper Function

**Location:** `Code.js` line ~10619 (new function)

**Purpose:** Returns ingredients from a recipe filtered by category

**Parameters:**
- `recipeName` (string): Name of the recipe
- `category` (string): "grains", "hops", "yeast", "other"

**Returns:** Array of `{name, quantity, unit, costPerUnit}`

**Categories Supported:**
- `"grains"` or `"grain"` → Returns `recipe.grains`
- `"hops"` or `"hop"` → Returns `recipe.hops`
- `"yeast"` → Returns yeast from recipe metadata
- `"other"` → Returns `recipe.other`

**Usage:**
```javascript
var grains = getRecipeIngredientsByCategory("Hazy IPA", "grains");
// Returns: [{name: "Maris Otter", quantity: 500, unit: "lb", costPerUnit: 0}, ...]
```

---

### 6. Created `getRecipeIngredientsForDropdown()` UI Helper Function

**Location:** `Code.js` line ~10681 (new function)

**Purpose:** Returns ingredients for UI dropdowns (wraps `getRecipeIngredientsByCategory()`)

**Parameters:**
- `recipeName` (string): Name of the recipe
- `category` (string): "grains", "hops", "yeast", "other"

**Returns:** `{success: boolean, ingredients: Array}` (serialized for HTML)

**Usage:**
```javascript
google.script.run
  .withSuccessHandler(function(result) {
    if (result.success) {
      // Populate dropdown with result.ingredients
    }
  })
  .getRecipeIngredientsForDropdown("Hazy IPA", "hops");
```

---

## Testing Checklist

Before proceeding to Phase 2, verify:

- [ ] **Backward Compatibility:**
  - [ ] Existing task templates load correctly
  - [ ] Materials without new fields default to `source: "manual"`
  - [ ] Old material formats (using `ingredient`, `amount`) are converted correctly

- [ ] **New Functionality:**
  - [ ] `getRecipeIngredientsByCategory()` returns correct ingredients for each category
  - [ ] `getRecipeIngredientsForDropdown()` returns serialized data for UI
  - [ ] Materials with `source: "recipe"` are saved correctly

- [ ] **Data Integrity:**
  - [ ] Creating new task template with manual materials works
  - [ ] Creating new task template with recipe-linked materials works (Phase 2 will handle lookup)
  - [ ] Updating existing task template preserves all fields

---

## Next Steps: Phase 2

Phase 2 will implement:
1. Task creation logic to look up recipe ingredients when `source: "recipe"`
2. Material scaling based on batch size
3. Double depletion prevention logic

**Ready to proceed to Phase 2?** ✅

---

## Files Modified

- `Code.js`:
  - Updated `getRecipeTaskTemplates()` (line ~10410)
  - Updated `addRecipeTaskTemplate()` (line ~10500)
  - Updated `updateRecipeTaskTemplate()` (line ~10588)
  - Added `getRecipeIngredientsByCategory()` (line ~10619)
  - Added `getRecipeIngredientsForDropdown()` (line ~10681)

**Total Lines Changed:** ~100 lines  
**New Functions:** 2  
**Modified Functions:** 3

