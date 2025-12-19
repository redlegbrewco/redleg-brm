# BRM Recipe & Task Workflow Analysis Report
**Date:** December 2025  
**Requestor:** Head Brewer  
**Analysis Type:** Workflow Review (No Code Changes)

---

## EXECUTIVE SUMMARY

The Head Brewer's feedback suggests a shift from **ingredient-first** to **task-first** recipe design. After comprehensive code analysis, **the system already supports task-based workflows**, but the current UI and data model present recipes as ingredient lists first, with tasks as secondary. The gap is primarily **UX/UI clarity**, not functionality.

**Key Finding:** The BRM can already do what the brewer wants—tasks can define materials, materials deplete on task completion, and task costs flow into COGS. However, the recipe creation/editing UI doesn't emphasize this workflow, making it appear that recipes are "just ingredient lists."

---

## 1. CURRENT FLOW ANALYSIS

### 1.1 Recipe → Brew This → Production → Send It Flow

**Current Sequence:**

1. **Recipe Creation/Edit** (`Recipes` sheet + `Recipe Ingredients` sheet)
   - Recipe metadata: Name, Style, Batch Size, ABV, IBU, etc.
   - Ingredients stored separately: Grains, Hops, Other (Adjuncts, Finings, etc.)
   - Each ingredient: Name, Amount, UOM, Category

2. **"Brew This" Button** (Recipe Detail Modal)
   - Opens Brewer's Sheet modal
   - Displays recipe ingredients (scaled to target batch size)
   - Shows Turn 1/Turn 2 labor tracker
   - Shows Task List section (if batch exists)

3. **"Start Brew" Button** (`startBrew()` / `startBrewWithCrewLabor()`)
   - Creates batch record in `Batch Log` (status = "Brewing" or "Fermenting")
   - **Calls `createTasksFromTemplates()`** - Auto-creates tasks from recipe task templates
   - **Calls `consumeIngredientsForBatch()`** - Depletes recipe ingredients from Raw Materials
   - Logs to `Batch Details`
   - Updates vessel status in `Equipment Scheduling`

4. **Task Completion** (`completeBatchTask()`)
   - When task marked "Completed":
     - Checks `materialsDepletedAt` timestamp (prevents double depletion)
     - Depletes task materials from Raw Materials via `depleteRawMaterial()`
     - Logs to `Material Log` (Batch #, Task ID, Material, Qty, Type: "Task")
     - Updates batch cost tracking

5. **"Send It" Button** (`sendItWithActualLabor()`)
   - Calculates final COGS:
     - Recipe ingredient costs (from `consumeIngredientsForBatch()`)
     - Brew labor (Turn 1 + Turn 2)
     - Cellar labor
     - Packaging labor
     - **Task material costs** (from completed tasks)
     - **Packaging material costs** (kegs, cans, labels, etc.)
     - Overhead
   - Updates `Batch Log` (status → "Packaged", final COGS/BBL)
   - Adds to `Finished Goods` (weighted average cost)
   - Updates `Beer COGS Master`
   - Archives batch record
   - Frees vessel

### 1.2 Where Tasks Fit Into the Flow

**Tasks are integrated at multiple points:**

- **Recipe Templates** (`Recipe Task Templates` sheet):
  - Each recipe can have default tasks (Dry Hop Day 5, Transfer to BT, etc.)
  - Templates include: Task Type, Name, Day Offset, Default Materials, Default Notes
  - When "Start Brew" is clicked, `createTasksFromTemplates()` auto-creates tasks

- **Task Creation** (`Batch Tasks` sheet):
  - Tasks can be created manually in Brewer's Sheet
  - Tasks can be created from templates
  - Each task can have multiple materials (stored as JSON in `Batch Tasks` sheet or in `Task Materials` sheet)

- **Task Materials**:
  - Materials are stored per task (Material Name, Planned Qty, Actual Qty, Waste Qty, Unit)
  - When task is completed, materials deplete from Raw Materials
  - Task material costs are included in batch COGS

- **Task Types Supported:**
  - Turn 1 Brew, Turn 2 Brew
  - Transfer to FV
  - Yeast Pitch
  - Dry Hop (can have multiple hop varieties)
  - Fining/Additions
  - Gravity Reading, pH Reading
  - Transfer to BT/SV
  - Filtering
  - Carbonation
  - Packaging
  - Custom

### 1.3 How Materials Get Depleted and Flow Into COGS

**Material Depletion Points:**

1. **Recipe Ingredients** (`consumeIngredientsForBatch()`):
   - Depleted at "Start Brew"
   - Checks `ingredientsDepleted` flag (prevents double depletion)
   - Converts UOM if recipe UOM ≠ Raw Material UOM (lb → oz, etc.)
   - Logs to `Material Log` (Type: "Recipe")

2. **Task Materials** (`completeBatchTask()`):
   - Depleted when task is marked "Completed"
   - Checks `materialsDepletedAt` timestamp (prevents double depletion)
   - Converts UOM if needed
   - Logs to `Material Log` (Type: "Task", includes Task ID)

3. **Packaging Materials** (`deductPackagingMaterials()`):
   - Depleted at "Send It"
   - Checks `packagingMaterialsDepleted` flag
   - Includes beer-specific items (labels, collars)
   - Logs to `Material Log` (Type: "Packaging")

**COGS Calculation** (`sendItWithActualLabor()`):
```
Total COGS = Recipe Ingredients
           + Brew Labor (Turn 1 + Turn 2)
           + Cellar Labor
           + Packaging Labor
           + Task Material Costs (from completed tasks)
           + Packaging Material Costs
           + Overhead

COGS/BBL = Total COGS / Actual Yield
```

---

## 2. DOES THE SYSTEM SUPPORT TASK-BASED WORKFLOWS?

### ✅ YES - The System Already Supports Task-Based Workflows

**Evidence:**

1. **Tasks Can Have Materials:**
   - `createBatchTask()` accepts `materials` array
   - Materials stored per task (JSON in `Batch Tasks` sheet or `Task Materials` sheet)
   - Each material: Name, Quantity, Unit, Planned/Actual/Waste

2. **Task Materials Deplete from Raw Materials:**
   - `completeBatchTask()` calls `depleteRawMaterial()` for each task material
   - Unit conversion handled automatically
   - Double-depletion prevention via `materialsDepletedAt` timestamp

3. **Task Material Costs Flow Into Batch COGS:**
   - `sendItWithActualLabor()` calls `getBatchTaskMaterialCost()`
   - Sums all completed task material costs
   - Includes in final COGS calculation

4. **Recipe Task Templates:**
   - Recipes can have default tasks with default materials
   - Templates auto-create tasks when "Start Brew" is clicked
   - Materials pre-populate from templates

**What's Missing:**
- **UI doesn't emphasize task-first workflow** - Recipe editor shows ingredients first, tasks are a separate tab
- **No visual connection** between task materials and recipe ingredients
- **Recipe ingredients are still required** - even if tasks define all materials, recipe must have an ingredient list for COGS preview

---

## 3. UI/UX REVIEW

### 3.1 Is the Brewer's Sheet Intuitive?

**Current Brewer's Sheet Structure:**
1. Header (Recipe Name, Batch Size, Fermenter dropdown)
2. **Ingredients Section** (Grains, Hops, Other) - **PRIMARY FOCUS**
3. Turn 1/Turn 2 Labor Tracker
4. **Task List Section** - Below ingredients
5. Workflow sections (Yeast Addition, Dry Hop Schedule, Cleaning Tasks, Recipe Changes)
6. Notes field
7. "START BREW" button

**Issues:**
- **Ingredients are shown first** - reinforces "recipe = ingredient list" mental model
- **Tasks appear below ingredients** - suggests tasks are secondary
- **No visual connection** between task materials and recipe ingredients
- **Task templates are hidden** - only visible in Recipe Edit modal → Task Templates tab

### 3.2 What Causes Confusion About Recipes and Tasks?

1. **Recipe Editor UI:**
   - Main view: Ingredients (Grains, Hops, Other) with "+ Add" buttons
   - Task Templates: Separate tab, not prominently displayed
   - No indication that task materials can replace/supplement recipe ingredients

2. **Brewer's Sheet Display:**
   - Ingredients shown at top (large, prominent)
   - Tasks shown below (smaller, less prominent)
   - No explanation that task materials will also deplete inventory

3. **Workflow Disconnect:**
   - Recipe ingredients deplete at "Start Brew"
   - Task materials deplete at task completion
   - No clear indication that both contribute to COGS

4. **Missing Visual Indicators:**
   - No "Task-Based Recipe" vs "Ingredient-Based Recipe" indicator
   - No summary showing "X materials from tasks, Y materials from recipe"
   - No warning if recipe has no ingredients but tasks have materials

### 3.3 UI Improvements (Without Changing Logic)

**Recommendations:**

1. **Recipe Editor - Task-First View:**
   - Add a toggle: "Task-Based Recipe" vs "Ingredient-Based Recipe"
   - If task-based: Show tasks first, ingredients generated from tasks
   - If ingredient-based: Show ingredients first (current view)

2. **Recipe Editor - Task Templates Tab:**
   - Make Task Templates tab more prominent (move to second position)
   - Add visual indicator: "Tasks with materials will auto-create on Start Brew"
   - Show material summary: "Total materials from tasks: X items"

3. **Brewer's Sheet - Task-First Layout:**
   - If recipe has task templates: Show Task List section ABOVE ingredients
   - Add collapsible section: "Ingredients (from recipe + tasks)"
   - Show breakdown: "Recipe: 15 items | Tasks: 8 items"

4. **Brewer's Sheet - Material Summary:**
   - Add a "Materials Summary" card at top:
     - Recipe Ingredients: X items, $Y
     - Task Materials (planned): X items, $Y
     - Total Materials: X items, $Y

5. **Task Modal - Material Display:**
   - When viewing a task, show materials prominently
   - Add indicator: "These materials will deplete when task is completed"
   - Show cost preview: "Estimated cost: $X"

6. **Recipe Detail Modal:**
   - Add "Task Overview" section showing:
     - Number of task templates
     - Total materials from tasks
     - Estimated task material cost

---

## 4. GAP ANALYSIS

### 4.1 What the Brewer is Asking For

**Request:** "Recipes should be based on a task and sub task format that then generates the full 'ingredients list' that then cascades into COGS."

**Interpretation:**
- Recipes should be defined by tasks (not ingredients)
- Tasks define materials needed
- Materials from tasks aggregate into an ingredient list
- Ingredient list flows into COGS

### 4.2 What the System CANNOT Currently Do

**Missing Functionality:**

1. **Task Materials → Recipe Ingredients Auto-Generation:**
   - Currently: Recipe ingredients are manually entered
   - Needed: If recipe is "task-based", aggregate task materials into recipe ingredient list
   - Impact: Recipe COGS preview would use task materials instead of manual ingredients

2. **Recipe Type Flag:**
   - Currently: All recipes are treated the same (ingredient-based)
   - Needed: Recipe flag: "Task-Based" vs "Ingredient-Based"
   - Impact: UI would show different views based on type

3. **Task Material Aggregation:**
   - Currently: Task materials are separate from recipe ingredients
   - Needed: Function to aggregate all task template materials into a recipe ingredient summary
   - Impact: Recipe detail view would show "Ingredients from Tasks: X items"

4. **Dual Material Sources:**
   - Currently: Recipe ingredients OR task materials (not both)
   - Needed: Support both (recipe ingredients for brew day, task materials for later stages)
   - Impact: COGS would include both sources

### 4.3 What's Missing vs. What's Just Not Obvious

**Not Obvious (But Already Works):**
- ✅ Tasks can have materials
- ✅ Task materials deplete on completion
- ✅ Task material costs flow into COGS
- ✅ Recipe task templates exist
- ✅ Templates auto-create tasks on "Start Brew"

**Actually Missing:**
- ❌ Recipe ingredients generated from task materials
- ❌ Recipe type flag (task-based vs ingredient-based)
- ❌ Visual aggregation of task materials into ingredient list
- ❌ UI emphasis on task-first workflow

---

## 5. RECOMMENDATIONS

### 5.1 UX/UI Improvements (No Code Changes Needed - Just UI Updates)

**Priority 1 - High Impact, Low Effort:**

1. **Recipe Editor - Reorder Tabs:**
   - Move "Task Templates" tab to second position (after "Details")
   - Add badge: "X tasks, Y materials" on tab label

2. **Brewer's Sheet - Conditional Layout:**
   - If recipe has task templates: Show Task List section FIRST
   - Add note: "Tasks define materials that will deplete on completion"
   - Collapse ingredients section by default if tasks exist

3. **Recipe Detail Modal - Task Summary:**
   - Add "Task Overview" card showing:
     - Number of task templates
     - Total materials from tasks
     - Estimated task material cost

**Priority 2 - Medium Impact, Medium Effort:**

4. **Recipe Editor - Task-First Toggle:**
   - Add toggle: "Task-Based Recipe" (checkbox)
   - If checked: Show tasks first, ingredients generated from tasks (read-only)
   - If unchecked: Show ingredients first (current view)

5. **Brewer's Sheet - Material Summary Card:**
   - Add summary at top:
     - Recipe Ingredients: X items, $Y
     - Task Materials (planned): X items, $Y
     - Total: X items, $Y

6. **Task Modal - Material Cost Preview:**
   - Show estimated cost for task materials
   - Show "Will deplete on completion" indicator

**Priority 3 - High Impact, High Effort:**

7. **Recipe Ingredients Auto-Generation:**
   - If recipe is "task-based", aggregate task template materials into recipe ingredient list
   - Show as read-only "Generated from Tasks" section
   - Update COGS preview to use task materials

8. **Dual Material Source Support:**
   - Allow recipes to have BOTH recipe ingredients (for brew day) AND task materials (for later stages)
   - COGS includes both sources
   - Clear separation in UI: "Brew Day Ingredients" vs "Task Materials"

### 5.2 Workflow Bottlenecks & Confusing Steps

**Bottlenecks:**

1. **Recipe Creation:**
   - Brewer must manually enter ingredients even if tasks define materials
   - **Fix:** Auto-generate ingredients from tasks if recipe is task-based

2. **Task Template Management:**
   - Task templates are hidden in Recipe Edit modal → Task Templates tab
   - **Fix:** Make Task Templates tab more prominent, add to recipe detail view

3. **Material Depletion Timing:**
   - Recipe ingredients deplete at "Start Brew"
   - Task materials deplete at task completion
   - **Confusion:** Why are they separate?
   - **Fix:** Add explanation in UI: "Recipe ingredients deplete at brew start. Task materials deplete when tasks are completed."

4. **COGS Preview:**
   - Recipe detail modal shows COGS based on recipe ingredients only
   - Doesn't include task materials until batch is created
   - **Fix:** Include task material costs in recipe COGS preview

**Confusing Steps:**

1. **"Where do I define materials?"**
   - Options: Recipe ingredients OR task materials OR both?
   - **Fix:** Add workflow guide: "For task-based recipes, define materials in task templates. For ingredient-based recipes, define in recipe ingredients."

2. **"Do task materials replace recipe ingredients?"**
   - Currently: No, they're separate
   - **Fix:** Add clear explanation: "Task materials supplement recipe ingredients. Both contribute to COGS."

3. **"How do I see total materials for a recipe?"**
   - Currently: Must check recipe ingredients + task templates separately
   - **Fix:** Add "Total Materials" summary in recipe detail view

---

## 6. CONCLUSION

**The BRM system already supports task-based workflows**, but the current UI and data model present recipes as ingredient-first, making it appear that tasks are secondary. The Head Brewer's request is valid—the system should emphasize task-first workflows for recipes that are defined by tasks.

**Key Findings:**
- ✅ Tasks can have materials
- ✅ Task materials deplete and flow into COGS
- ✅ Recipe task templates exist and auto-create tasks
- ❌ Recipe ingredients are not generated from task materials
- ❌ UI doesn't emphasize task-first workflow
- ❌ No visual connection between tasks and ingredients

**Recommended Approach:**
1. **Short-term (UI only):** Reorder UI elements to show tasks first, add material summaries, improve task template visibility
2. **Medium-term (UI + minor logic):** Add "Task-Based Recipe" flag, auto-generate ingredient list from task materials, update COGS preview
3. **Long-term (architectural):** Support dual material sources (recipe ingredients + task materials), full task-first recipe creation workflow

**No code changes needed for this analysis** - all recommendations are UI/UX improvements that would make existing functionality more obvious and intuitive.

---

## APPENDIX: CODE REFERENCES

**Key Functions:**
- `getAllRecipesEnhanced()` - Loads recipes with ingredients
- `getRecipeTaskTemplates()` - Gets task templates for a recipe
- `createTasksFromTemplates()` - Auto-creates tasks on "Start Brew"
- `completeBatchTask()` - Depletes task materials on completion
- `consumeIngredientsForBatch()` - Depletes recipe ingredients on "Start Brew"
- `sendItWithActualLabor()` - Calculates COGS including task materials
- `getBatchTaskMaterialCost()` - Sums task material costs for COGS

**Key Sheets:**
- `Recipes` - Recipe metadata
- `Recipe Ingredients` - Recipe ingredient list
- `Recipe Task Templates` - Default tasks per recipe
- `Batch Tasks` - Tasks for each batch
- `Task Materials` - Materials per task
- `Batch Log` - Batch records
- `Material Log` - All material depletions

**Key UI Components:**
- Recipe Detail Modal (`recipeModal`)
- Recipe Edit Modal (`editRecipeModal`) - Tabs: Details, Ingredients, Task Templates
- Brewer's Sheet Modal (`brewerSheetModal`) - Shows ingredients, tasks, labor
- Task Modal (`taskModal`) - Create/edit tasks with materials

