# PHASE 2C: CELLAR TASKS SECTION
**Date:** December 2025  
**Status:** ✅ COMPLETE - Cellar Tasks UI and Backend Implementation

---

## SUMMARY

Phase 2C has been successfully implemented. The Cellar Tasks section (Section 4) of the Brewer's Sheet is now fully functional, allowing cellarmen to view, filter, and complete tasks with material depletion, labor logging, and COGS updates.

---

## WHAT WAS CREATED/MODIFIED

### 1. Frontend Functions (BRM_UI.html)

#### `renderCellarTasks(data)` - NEW
**Purpose:** Renders all cellar tasks for a batch

**Features:**
- Checks if brewing is complete (Turn 1 + Turn 2 or Turn 1 + No Turn 2)
- Locks section if brewing not complete
- Displays task count and completion status
- Renders task cards with status indicators
- Initializes timer states for incomplete tasks

**Status Indicators:**
- Pending (gray) - Not due yet
- Due Today (orange) - Due today
- Overdue (red) - Past due date
- Complete (green) - Task completed

---

#### `buildTaskCard(task, statusClass, dueClass, brewers)` - NEW
**Purpose:** Builds HTML for a single task card

**Components:**
- Task header with status indicator, name, type, due date
- Expandable details section
- Controls: Assigned dropdown, Timer
- Target values (for gravity checks, pH readings)
- Materials table with actual input fields
- Notes textarea
- Complete button (enabled when assigned + timer started)
- Completed info (shown after completion)

---

#### Task Timer Functions - NEW
- `startTaskTimer(taskId)` - Starts timer for a specific task
- `stopTaskTimer(taskId)` - Stops timer for a specific task
- Uses `taskTimers` object to track timer state per task

**Timer State:**
```javascript
taskTimers[taskId] = {
  interval: null,
  seconds: 0,
  startTime: null
}
```

---

#### `completeTask(taskId)` - NEW
**Purpose:** Completes a cellar task

**Actions:**
1. Validates assigned person and timer started
2. Collects actual material quantities
3. Collects actual readings (gravity, pH) if provided
4. Shows confirmation dialog
5. Calls backend `completeCellarTask()`
6. Refreshes Brewer's Sheet on success

**Validation:**
- Assigned person must be selected
- Timer must be started (labor hours > 0.01)
- Confirmation required before completing

---

#### Task UI Helpers - NEW
- `toggleTaskDetails(taskId)` - Expands/collapses task details
- `updateTaskButtonState(taskId)` - Enables/disables Complete button
- `filterTasks(filter)` - Filters tasks by status (All, Pending, Due Today, Overdue, Complete)
- `showAddTaskModal()` - Placeholder for future ad-hoc task creation

---

### 2. Backend Functions (Code.js)

#### `getCellarTasksForBatch(batchNumber)` - NEW
**Purpose:** Retrieves all cellar tasks for a batch from Batch Tasks sheet

**Returns:**
```javascript
[{
  id: string,
  rowIndex: number,
  name: string,
  type: string,
  dueDate: date,
  status: string,
  assignedTo: string,
  materials: [{name, quantity, unit, onHand}, ...],
  notes: string,
  completedBy: string,
  completedDate: date,
  laborHours: number,
  targets: {gravity: number, ph: number}
}, ...]
```

**Logic:**
- Reads Batch Tasks sheet
- Finds tasks matching batch number
- Parses materials JSON
- Adds on-hand quantities from Raw Materials
- Sorts by due date

---

#### `completeCellarTask(batchNumber, taskId, completedBy, laborHours, actualMaterials, actualReadings, notes)` - NEW
**Purpose:** Completes a cellar task and updates all related data

**Actions:**
1. Finds task in Batch Tasks sheet
2. Depletes materials from Raw Materials
3. Logs depletion to Material Log
4. Updates task status to "Complete"
5. Stores completed by, date, labor hours
6. Stores actual readings (gravity, pH) if provided
7. Updates batch COGS (materials + labor)
8. Returns success with costs

**Material Depletion:**
- Matches material name (case-insensitive)
- Reduces quantity on hand
- Calculates material cost (qty × unit cost)
- Logs to Material Log with negative quantity

**COGS Update:**
- Adds material cost to Addition Cost
- Adds labor cost to Labor $
- Recalculates Total Cost (Recipe + Addition + Labor + Overhead)

---

#### `updateBatchCOGS(batchNumber, materialCost, laborCost)` - NEW
**Purpose:** Updates batch COGS after task completion

**Updates:**
- Addition Cost = current + materialCost
- Labor $ = current + laborCost
- Total Cost = Recipe Cost + Addition Cost + Labor $ + Overhead

**Overhead Calculation:**
- $15 per BBL
- Overhead = Batch Size × 15

---

#### `getLaborConfig()` - NEW
**Purpose:** Gets labor rate configuration

**Returns:**
```javascript
{ rate: number }
```

**Logic:**
- Tries to read from Batch Log cell B5
- Falls back to default $25/hour

---

### 3. Updated Functions

#### `getBrewerSheetData(batchNumber)` - UPDATED
**Added:**
- Calls `getCellarTasksForBatch(batchNumber)`
- Calls `getBrewersList()`
- Includes `cellarTasks` and `brewers` in return object

---

#### `renderBrewerSheet(data)` - UPDATED
**Added:**
- Calls `renderCellarTasks(data)` after rendering Turn 2

---

### 4. UI Structure

#### Cellar Tasks Section HTML
**Location:** Section 4 in Brewer's Sheet modal

**Components:**
- Collapsible header with status badge
- Filter buttons (All, Pending, Due Today, Overdue, Complete)
- Tasks list container
- Add Task button (placeholder)

**Locking:**
- Section locked until brewing complete
- Shows lock message if brewing not complete

---

#### Task Card Structure
**Header:**
- Status indicator (colored dot)
- Task name and type
- Due date (color-coded: overdue=red, due today=orange)
- Expand/collapse icon

**Details (expandable):**
- Assigned dropdown
- Timer (start/stop buttons)
- Target values (if applicable)
- Materials table
- Notes textarea
- Complete button
- Completed info (if complete)

---

### 5. CSS Styles

**Added Styles:**
- `.task-filters` - Filter button container
- `.filter-btn` - Filter button styling
- `.cellar-tasks-list` - Tasks container
- `.task-card` - Task card container
- `.task-header` - Task header styling
- `.task-status-indicator` - Status dot (pending, due-today, overdue, complete)
- `.task-details` - Task details section
- `.task-controls` - Control group layout
- `.task-materials` - Materials section
- `.materials-table` - Materials table styling
- `.task-targets` - Target values section
- `.task-notes` - Notes section
- `.task-complete-section` - Complete button section
- `.section-status` - Status badge in section header

---

## TESTING RESULTS

### ✅ Section Unlocking
- [x] Section locked until Turn 1 + Turn 2 complete
- [x] Section locked until Turn 1 + No Turn 2
- [x] Section unlocks when brewing complete
- [x] Lock message displays correctly

### ✅ Task Display
- [x] Tasks load from Batch Tasks sheet
- [x] Tasks sorted by due date
- [x] Status indicators show correctly (pending, due today, overdue, complete)
- [x] Due dates color-coded correctly
- [x] Task count displays correctly

### ✅ Task Filters
- [x] All filter shows all tasks
- [x] Pending filter shows only pending tasks
- [x] Due Today filter shows only due today tasks
- [x] Overdue filter shows only overdue tasks
- [x] Complete filter shows only completed tasks
- [x] Filter buttons highlight correctly

### ✅ Task Details
- [x] Tasks expand/collapse correctly
- [x] Assigned dropdown populated with brewers
- [x] Timer starts/stops correctly
- [x] Timer displays in HH:MM:SS format
- [x] Materials table displays correctly
- [x] Actual input fields work
- [x] On Hand quantities show (red if low)
- [x] Target values display (if applicable)
- [x] Notes textarea works

### ✅ Task Completion
- [x] Complete button disabled until assigned + timer started
- [x] Complete button enables when conditions met
- [x] Validation works (assigned, timer)
- [x] Confirmation dialog shows
- [x] Materials deplete from Raw Materials
- [x] Material Log entry created
- [x] Task status updates to "Complete"
- [x] COGS updates correctly
- [x] Completed info displays after completion

### ✅ Backend Integration
- [x] `getCellarTasksForBatch()` returns correct data
- [x] `completeCellarTask()` depletes materials correctly
- [x] `completeCellarTask()` logs to Material Log
- [x] `completeCellarTask()` updates task status
- [x] `updateBatchCOGS()` updates Addition Cost
- [x] `updateBatchCOGS()` updates Labor $
- [x] `updateBatchCOGS()` recalculates Total Cost

---

## ISSUES ENCOUNTERED

**Minor Issues:**
1. **Task ID Matching:** Flexible matching handles various Task ID formats
2. **Column Index Mapping:** Uses flexible header matching to find columns
3. **Material Name Matching:** Case-insensitive matching for material names

**Resolved:**
- All functionality works as expected
- No blocking issues

---

## FILES MODIFIED

1. **BRM_UI.html**
   - Replaced Cellar Tasks placeholder with full HTML structure
   - Added JavaScript functions for rendering and managing tasks
   - Added CSS styles for task cards and filters
   - Updated `renderBrewerSheet()` to call `renderCellarTasks()`

2. **Code.js**
   - Added `getCellarTasksForBatch()` function
   - Added `completeCellarTask()` function
   - Added `updateBatchCOGS()` function
   - Added `getLaborConfig()` function
   - Updated `getBrewerSheetData()` to include cellar tasks and brewers

3. **PHASE_2C_COMPLETE.md** (this file)
   - Documentation of Phase 2C completion

---

## NEXT STEPS: PHASE 2D / 2E

Phase 2D/2E will implement:
- Section 5: Packaging
- Section 6: Send It
- Task creation from recipe templates
- Auto-generation of tasks from ingredients

**Ready for Phase 2D/2E approval.**

---

## CONFIRMATION CHECKLIST

- [x] Cellar Tasks section unlocks after Turn 1 + Turn 2 complete
- [x] Tasks display with correct status (pending, due today, overdue, complete)
- [x] Filter buttons work (All, Pending, Due Today, Overdue, Complete)
- [x] Each task expands to show details
- [x] Timer starts/stops per task
- [x] Assigned dropdown populated
- [x] Materials table shows with actual input fields
- [x] Complete Task button:
  - [x] Validates assigned + timer started
  - [x] Depletes materials from Raw Materials
  - [x] Logs to Material Log
  - [x] Updates COGS
  - [x] Updates task status to Complete
- [x] Completed tasks show completion info

---

## USER FLOW

1. **User completes Turn 1 and Turn 2**
   - Cellar Tasks section unlocks

2. **User views Cellar Tasks**
   - Sees list of tasks sorted by due date
   - Status indicators show task urgency
   - Can filter by status

3. **User works on a task:**
   - Expands task to see details
   - Selects assigned person
   - Starts timer
   - Reviews materials (can edit actuals)
   - Enters target readings if applicable
   - Adds notes
   - Clicks "Complete Task"

4. **Task completion:**
   - Materials deplete from Raw Materials
   - Entry logged to Material Log
   - Labor hours logged
   - COGS updated
   - Task marked complete
   - Brewer's Sheet refreshes

---

**END OF PHASE 2C REPORT**





