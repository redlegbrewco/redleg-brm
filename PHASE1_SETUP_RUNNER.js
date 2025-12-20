/**
 * PHASE 1 SETUP RUNNER
 * Copy and paste this into Apps Script console to run Phase 1 setup
 * Or create a new function in Apps Script and paste the body
 */

function runPhase1Setup() {
  try {
    var results = {
      packagingConfig: null,
      batchLogColumns: null,
      errors: []
    };
    
    // Setup Packaging Config sheet
    try {
      results.packagingConfig = setupPackagingConfigSheet();
      Logger.log('Packaging Config: ' + JSON.stringify(results.packagingConfig));
    } catch (e) {
      results.errors.push('Packaging Config: ' + e.toString());
      Logger.log('Error in Packaging Config: ' + e.toString());
    }
    
    // Ensure Batch Log columns
    try {
      results.batchLogColumns = ensureBatchLogWorkflowColumns();
      Logger.log('Batch Log Columns: ' + JSON.stringify(results.batchLogColumns));
    } catch (e) {
      results.errors.push('Batch Log Columns: ' + e.toString());
      Logger.log('Error in Batch Log Columns: ' + e.toString());
    }
    
    var success = results.errors.length === 0;
    
    Logger.log('=== PHASE 1 SETUP COMPLETE ===');
    Logger.log('Success: ' + success);
    Logger.log('Errors: ' + results.errors.length);
    
    return {
      success: success,
      results: results,
      message: success ? 'Phase 1 setup complete' : 'Phase 1 setup completed with errors',
      errors: results.errors
    };
    
  } catch (e) {
    Logger.log('Error in Phase 1 initialization: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}
