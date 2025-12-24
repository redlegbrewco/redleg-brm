# Careful Code Cleanup Plan - Fix What Broke

## Issues to Fix:
1. **Recipe View** - "Recipe view not available" error
2. **Turn 1 data** not persisting in Brewer's Sheet  
3. **BT vessel** not being released after packaging

## Investigation Results:

### ✅ All Core Functions Exist:
- `getRecipeViewData()` - Line 16554 ✅
- `completeTurn()` - Line 14742 ✅
- `sendItComplete()` - Line 9761 ✅
- `updateEquipmentStatus()` - Line 1819 ✅

### ⚠️ Potential Issues Found:

#### Issue 1: Duplicate `sendIt()` Functions
- **Line 8484:** Old `sendIt()` function (109 lines)
- **Line 9897:** Wrapper `sendIt()` that calls `sendItComplete()`
- **Problem:** JavaScript uses the LAST definition, so wrapper is used
- **Solution:** Delete old one at 8484, keep wrapper at 9897

#### Issue 2: `sendItComplete()` Vessel Release
- **Line 9822-9824:** Releases `currentVessel` parameter
- **Check:** Does `currentVessel` get passed correctly from UI?
- **BRM_UI.html:10066:** Calls `.sendIt(batchNumber, packageBreakdown, currentVessel)`
- **Code.js:9897:** Wrapper passes `currentVessel` to `sendItComplete()`
- **Status:** Should work, but verify `currentVessel` is not null/undefined

#### Issue 3: `getRecipeViewData()` Dependencies
- Calls `getRecipeIngredientsByTurn()` - Line 14618 ✅
- Calls `getRecipeTasksWithDefaults()` - Line 16518 ✅
- Calls `getRawMaterialsMap()` - Line 15752 ✅
- **All dependencies exist** ✅

#### Issue 4: `completeTurn()` Dependencies
- Calls `getRecipeIngredientsByTurn()` - Line 14618 ✅
- Calls `depleteRawMaterial()` - Need to verify ✅
- Calls `updateEquipmentStatus()` - Line 1819 ✅
- **Check:** Batch Log column indices might be wrong

## Safe Cleanup Steps:

### Step 1: Verify Current State
```bash
# Check if functions are called correctly
grep -n "getRecipeViewData\|completeTurn\|sendIt" BRM_UI.html
grep -n "function getRecipeViewData\|function completeTurn\|function sendIt" Code.js
```

### Step 2: Test Each Function Before Deletion
1. **Test Recipe View:**
   - Open Recipe View for a known recipe
   - Verify it loads without errors
   - Check browser console for errors

2. **Test Turn 1 Completion:**
   - Complete Turn 1 for a test batch
   - Verify data persists in Batch Log
   - Check that vessel is marked "In Use"

3. **Test Send It:**
   - Complete packaging for a test batch
   - Run Send It
   - Verify BT vessel is released (check Equipment sheet)
   - Verify batch status = "Packaged"

### Step 3: Delete ONE Function at a Time

#### Delete 1: `confirmBrewStartEnhanced_Old()` - Line 1703
- **Verify:** No calls to this function exist
- **Test:** Start a new brew after deletion
- **Commit:** After verification

#### Delete 2: Old `refreshFullFinancialChain()` - Line 6181
- **Verify:** Only new version at 7127 is called
- **Test:** Run financial refresh after deletion
- **Commit:** After verification

#### Delete 3: Old `updateBeerCOGSMaster()` - Line 6340
- **Verify:** Only new version at 6535 is called
- **Test:** Run COGS update after deletion
- **Commit:** After verification

#### Delete 4: Old `recordTransfer()` - Line 8303
- **Verify:** Wrapper at 9307 exists and works
- **Test:** Transfer a batch after deletion
- **Commit:** After verification

#### Delete 5: Old `recordPackaging()` - Line 8395
- **Verify:** Wrapper at 9890 exists and works
- **Test:** Record packaging after deletion
- **Commit:** After verification

#### Delete 6: Old `sendIt()` - Line 8484 ⚠️ CRITICAL
- **VERIFY FIRST:**
  - Wrapper at 9897 exists
  - `sendItComplete()` at 9761 exists
  - UI calls `.sendIt()` not `.sendItComplete()`
- **TEST THOROUGHLY:**
  - Complete full batch workflow
  - Verify BT vessel is released
  - Verify batch status updates
  - Verify Finished Goods updated
- **Commit:** After extensive testing

#### Delete 7-11: Remaining duplicates
- Delete one at a time
- Test after each deletion
- Commit after verification

## Critical Checks Before Each Deletion:

1. **Search for ALL calls:**
   ```bash
   grep -n "functionName" Code.js BRM_UI.html
   ```

2. **Verify replacement exists:**
   - Check replacement function exists
   - Check replacement has same signature
   - Check replacement does same thing

3. **Test the feature:**
   - Use the feature that calls the function
   - Verify it works correctly
   - Check for console errors

4. **Check dependencies:**
   - List all functions called by the function to delete
   - Verify all dependencies exist
   - Verify no circular dependencies

## Specific Fixes Needed:

### Fix 1: BT Vessel Release
**Problem:** BT vessel not released after Send It

**Investigation:**
- `sendItComplete()` at line 9823 calls `updateEquipmentStatus(currentVessel, 'Available', '', '')`
- But `currentVessel` might be the BT vessel, not the FV vessel
- Need to check if BT vessel is tracked separately

**Check:**
- Does `currentVessel` parameter contain BT vessel name?
- Or does it contain FV vessel name?
- Should we release BOTH FV and BT vessels?

**Solution:**
- Check `completeBatch()` function at line 17772
- It releases both FV and BT vessels (lines 17784, 17807)
- Maybe `sendItComplete()` should do the same?

### Fix 2: Turn 1 Data Persistence
**Problem:** Turn 1 data not persisting

**Investigation:**
- `completeTurn()` saves to Batch Log columns
- Column indices: Turn 1 Complete Date = Column 39 (AM)
- Need to verify these columns exist

**Check:**
- Run `ensureBatchLogTurnColumns()` to verify columns exist
- Check if column indices are correct
- Verify data is being written to correct columns

### Fix 3: Recipe View Error
**Problem:** "Recipe view not available" error

**Investigation:**
- `getRecipeViewData()` exists and looks complete
- Error might be in error handling or data format

**Check:**
- Add logging to `getRecipeViewData()`
- Check what error is actually returned
- Verify recipe name matches exactly
- Check if `serializeForHtml()` is working

## Recommended Approach:

1. **DON'T delete anything yet**
2. **Add logging** to identify the actual errors
3. **Test each feature** to reproduce the issues
4. **Fix the issues** first, then do cleanup
5. **Delete one function at a time** with testing between each

## Next Steps:

1. Add error logging to identify exact issues
2. Test Recipe View, Turn 1, and Send It
3. Fix any bugs found
4. Then proceed with careful cleanup

