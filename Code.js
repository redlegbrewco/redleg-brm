// ═══════════════════════════════════════════════════════════════════════════════
// RED LEG BREWING - BRM (BREWERY RESOURCE MANAGER)
// CONSOLIDATED & CLEANED CODE.GS
// Last Updated: December 6, 2025
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: CONFIGURATION & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

var BRM_SPREADSHEET_ID = '1HMNLmLHKmeIdvqN9P6GYPQtg8kYyIqMDjlkDtnx-ZsM';

// EXTERNAL SPREADSHEET IDs - Connected Web Apps
var CRM_SPREADSHEET_ID = '1jIoGT59ipG1bF5PBa9oQ1H8_c0H65JSALAoVQKRF3Ls';
var KEG_TRACKER_ID = '1JF0R0OoMCePWBIF-AZWyAAQaMMLTupC9a7sdOw3gric';

// CANONICAL SHEET NAMES - These match your actual spreadsheet tabs
var SHEETS = {
  // Core Operations
  BATCH_LOG: 'Batch Log',
  RECIPES: 'Recipes',
  RECIPE_INGREDIENTS: 'Recipe Ingredients',
  RAW_MATERIALS: 'Raw Materials',
  FINISHED_GOODS: 'Finished Goods',
  
  // Financial
  FCCR: 'FCCR Command Center',
  OPEX: '2026 OpEx Budget',
  FLOOR_PRICING: 'Floor Pricing',
  FULLY_LOADED_PRICING: 'Fully Loaded Pricing',
  UPC_PENNY_PRICING: 'UPC Penny Pricing',
  
  // Sales
  SALES_DEPLETION: 'Sales Depletion',
  TAPROOM_SALES: 'Taproom Sales',
  
  // Production
  EQUIPMENT: 'Equipment Scheduling',
  PRODUCTION_CALENDAR: 'Production Calendar',
  BEER_COGS_MASTER: 'Beer COGS Master',
  
  // Configuration
  RECURRING_CONFIG: 'Recurring Entries Config',
  LABOR_CONFIG: 'Labor Config',
  INGREDIENT_MAP: 'Ingredient Map',
  
  // Logs
  PURCHASE_LOG: 'Purchase Log',
  FG_LOG: 'FG Log',
  MATERIAL_LOG: 'Material Log',
  BATCH_INGREDIENTS: 'Batch Ingredients',
  BATCH_DETAILS: 'Batch Details',
  
  // Task Management
  BATCH_TASKS: 'Batch Tasks',
  TASK_MATERIALS: 'Task Materials',
  RECIPE_TASK_TEMPLATES: 'Recipe Task Templates',
  
  // Exports
  QB_JOURNAL_EXPORT: 'QB Journal Export',
  TTB_REPORTS: 'TTB Reports',
  
  // Taproom
  TAPPED_KEGS: 'Tapped Kegs',
  SERVING_VESSELS: 'Serving Vessels'
};

// RAW MATERIALS CONFIG
const RAW_MATERIAL_CONFIG = {
  sheetName: SHEETS.RAW_MATERIALS,
  headerRow: 4,
  dataStartRow: 5,
  categories: ['Grain', 'Hops', 'Yeast', 'Adjuncts', 'Finings', 'Consumables', 'Packaging', 'Keg Shell', 'CO2/Gas', 'Chemicals', 'Other'],
  units: ['lb', 'oz', 'g', 'gal', 'each', 'pack', 'case', 'bag', 'box', 'L', 'kg'],
  columns: {
    item: 1,           // A: Item Name
    category: 2,       // B: Category
    unit: 3,           // C: Unit
    qtyOnHand: 4,      // D: Qty On Hand
    avgCost: 5,        // E: Avg Cost/Unit
    totalValue: 6,     // F: Total Value (may be $0 - we calculate in code)
    reorderPoint: 7,   // G: Reorder Point
    reorderQty: 8,     // H: Reorder Qty
    status: 10,        // J: Status (column I appears empty)
    supplier: 11,      // K: Supplier (if present)
    lastPurchase: 12,  // L: Last Purchase or Notes
    notes: 13          // M: Notes
  }
};

// FINISHED GOODS CONFIG
const FG_CONFIG = {
  sheetName: SHEETS.FINISHED_GOODS,
  headerRow: 4,
  dataStartRow: 5,
  columns: {
    beerName: 1, packageType: 2, qtyOnHand: 3, costPerUnit: 4,
    totalValue: 5, floorPrice: 6, minQty: 7, status: 8
  },
  packageTypes: ['1/2 BBL Keg', '1/6 BBL Keg', '1/4 BBL Keg', '12oz Case (4×6)', '16oz Case (4×6)', '12oz 6-pack', '16oz 4-pack', 'Growler', 'Crowler'],
  packageYields: {
    '1/2 BBL Keg': 2, '1/6 BBL Keg': 6, '1/4 BBL Keg': 4,
    '12oz Case (4×6)': 10.3, '16oz Case (4×6)': 7.75,
    '12oz 6-pack': 41.3, '16oz 4-pack': 31, 'Growler': 62, 'Crowler': 124
  }
};

// BATCH LOG CONFIG
const BATCH_CONFIG = {
  sheetName: SHEETS.BATCH_LOG,
  headerRow: 2,
  dataStartRow: 3,
  columns: {
    batchNumber: 1, brewDate: 2, beerType: 3, brewer: 4, vessel: 5,
    batchSize: 6, expectedYield: 7, actualYield: 8, status: 9,
    rawMaterialsCost: 10, laborCost: 11, totalCost: 12, notes: 13
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════


/**
 * Helper function to ensure clean JSON serialization for HTML callbacks
 * Prevents postMessage errors from Date objects, undefined values, etc.
 */
function serializeForHtml(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function getBrmSpreadsheet() {
  return SpreadsheetApp.openById(BRM_SPREADSHEET_ID);
}

/**
 * Wrap a synchronous function in a standardized { success, data|error } response.
 * Intended for simple server-side helpers; core public APIs already implement
 * detailed success/error objects themselves.
 *
 * @param {Function} fn - Function to execute (no args)
 * @returns {{success: boolean, data?: *, error?: string}}
 */
function safeExecute(fn) {
  try {
    var result = fn();
    return { success: true, data: result };
  } catch (e) {
    Logger.log('Error in safeExecute: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * BRM User Email-to-Name Mapping
 * Used for "Execute as Me" deployment - returns actual logged-in user
 */
var BRM_USER_MAP = {
  'todd@redlegbrewing.com': { name: 'Todd Baldwin', role: 'Owner' },
  'steve@redlegbrewing.com': { name: 'Steve DeWeese', role: 'COO' },
  'richard@redlegbrewing.com': { name: 'Richard Mar', role: 'Head Brewer' }
};

/**
 * Get current user info with email, name, and role
 * Uses Session.getActiveUser().getEmail() which returns the logged-in user
 * even when script executes as owner ("Execute as Me" deployment)
 * @returns {Object} { email: string, name: string, role: string }
 */
function getCurrentUser() {
  var email = Session.getActiveUser().getEmail() || '';
  var userInfo = BRM_USER_MAP[email.toLowerCase()];
  
  if (userInfo) {
    return {
      email: email,
      name: userInfo.name,
      role: userInfo.role
    };
  }
  
  // Fallback: use email prefix as name if not in map
  return {
    email: email,
    name: email.split('@')[0] || 'User',
    role: 'User'
  };
}

/**
 * Get current user info for UI display
 * Returns both name and role separately for display and filtering
 * @returns {Object} { success: boolean, user: { email, name, role } }
 */
function getCurrentUserInfo() {
  try {
    var user = getCurrentUser();
    return serializeForHtml({
      success: true,
      user: {
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (e) {
    Logger.log('Error getting current user info: ' + e.toString());
    return {
      success: false,
      error: e.toString(),
      user: {
        email: '',
        name: 'Unknown User',
        role: 'User'
      }
    };
  }
}

function formatCurrency(value) {
  return '$' + (parseFloat(value) || 0).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

function formatDate(date) {
  if (!date) return '';
  var d = new Date(date);
  return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
}

function findValueByLabel(data, label) {
  for (var i = 0; i < data.length; i++) {
    for (var j = 0; j < data[i].length - 1; j++) {
      if (data[i][j] && data[i][j].toString().toLowerCase().includes(label.toLowerCase())) {
        return data[i][j + 1];
      }
    }
  }
  return null;
}

function findColumnIndex(headers, ...searchTerms) {
  for (var i = 0; i < headers.length; i++) {
    var h = headers[i].toString().toLowerCase();
    for (var j = 0; j < searchTerms.length; j++) {
      if (h.includes(searchTerms[j].toLowerCase())) return i;
    }
  }
  return -1;
}

/**
 * Get URL to a specific sheet - UI calls this to open sheets
 */
function getSheetUrl(sheetName) {
  try {
    var ss = getBrmSpreadsheet();
    
    // Map common UI names to actual sheet names
    var nameMap = {
      'FG Inventory': SHEETS.FINISHED_GOODS,
      'Depletion Log': SHEETS.SALES_DEPLETION,
      'Recurring Journal Config': SHEETS.RECURRING_CONFIG,
      'OpEx': SHEETS.OPEX,
      'Operating Expenses': SHEETS.OPEX
    };
    
    var actualName = nameMap[sheetName] || sheetName;
    var sheet = ss.getSheetByName(actualName);
    
    if (!sheet) {
      Logger.log('Sheet not found: ' + sheetName + ' (tried: ' + actualName + ')');
      return null;
    }
    
    return ss.getUrl() + '#gid=' + sheet.getSheetId();
  } catch (e) {
    Logger.log('Error getting sheet URL: ' + e.toString());
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: WEB APP ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('BRM_UI')
    .setTitle('Red Leg BRM')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🍺 BRM')
    .addItem('Open BRM Dashboard', 'openBrmSidebar')
    .addSeparator()
    .addItem('Quick: New Batch', 'showNewBatchDialog')
    .addItem('Quick: Log Sale', 'showLogSaleDialog')
    .addToUi();
}

function openBrmSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('BRM_UI')
    .setTitle('Red Leg BRM')
    .setWidth(1200);
  SpreadsheetApp.getUi().showSidebar(html);
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: DASHBOARD FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Main dashboard data aggregator - called by UI on Dashboard tab load
 */
function getDashboardData() {
  var fccr = getFCCRStatus();
  var opex = getOpExStatus();
  var inventory = getFinishedGoodsData({});
  var rawMaterials = getRawMaterialsInventory({});
  var batches = getBatchesData({});
  
  // Calculate totals
  var fgValue = 0;
  (inventory.inventory || []).forEach(function(item) {
    fgValue += parseFloat(item.totalValue) || 0;
  });
  
  var rmValue = 0;
  (rawMaterials.materials || []).forEach(function(item) {
    rmValue += parseFloat(item.totalValue) || 0;
  });
  
  // Count active batches
  var activeBatches = (batches.batches || []).filter(function(b) {
    return b.status && !['Packaged', 'Dumped'].includes(b.status);
  });
  
  // Count low stock
  var lowStockItems = (inventory.inventory || []).filter(function(i) {
    return i.status && (i.status.includes('LOW') || i.status.includes('🚨'));
  }).length;
  
  var reorderNeeded = (rawMaterials.materials || []).filter(function(m) {
    return m.status && (m.status.includes('REORDER') || m.status.includes('🚨'));
  }).length;
  
  return {
    fccr: fccr,
    opex: opex,
    finishedGoodsValue: fgValue,
    rawMaterialsValue: rmValue,
    batchesInProgress: activeBatches.length,
    lowStockItems: lowStockItems,
    reorderNeeded: reorderNeeded
  };
}

/**
 * Get FCCR status from FCCR Command Center sheet
 */
function getFCCRStatus() {
  var ss = getBrmSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.FCCR);
  
  if (!sheet) {
    return { error: 'FCCR Command Center not found', projectedFCCR: 0 };
  }
  
  try {
    var data = sheet.getDataRange().getValues();
    
    var result = {
      debtService: findValueByLabel(data, 'Annual Debt Service') || findValueByLabel(data, 'Total Debt Service') || 972117,
      covenantMinimum: 1.25,
      targetWithCushion: 1.35,
      viewPropertiesNOI: findValueByLabel(data, 'View Properties NOI') || findValueByLabel(data, 'NOI') || 481868,
      netRevenueTarget: findValueByLabel(data, 'Net Revenue Target') || findValueByLabel(data, 'Revenue Target') || 5000000,
      taproomPct: 0.85,
      wholesalePct: 0.15,
      taproomRevenue: findValueByLabel(data, 'Taproom Revenue') || 0,
      wholesaleRevenue: findValueByLabel(data, 'Wholesale Revenue') || 0,
      taproomMargin: 0.7,
      wholesaleMargin: 0.3,
      projectedEBITDA: findValueByLabel(data, 'Projected EBITDA') || findValueByLabel(data, 'EBITDA') || 0,
      projectedFCCR: findValueByLabel(data, 'Projected FCCR') || findValueByLabel(data, 'FCCR') || 0
    };
    
    // Calculate projected FCCR if not found
    if (result.projectedFCCR === 0 && result.debtService > 0) {
      var cashFlow = result.projectedEBITDA + result.viewPropertiesNOI;
      result.projectedFCCR = cashFlow / result.debtService;
    }
    
    // Set status based on FCCR
    if (result.projectedFCCR >= 1.35) {
      result.status = '✅ Strong';
    } else if (result.projectedFCCR >= 1.25) {
      result.status = '⚠️ Meets Covenant';
    } else {
      result.status = '🚨 Below Covenant';
    }
    
    return result;
  } catch (e) {
    return { error: e.toString(), projectedFCCR: 0 };
  }
}

/**
 * Get OpEx status from 2026 OpEx Budget sheet
 */
function getOpExStatus() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.OPEX);
    if (!sheet) return { success: false, error: 'OpEx sheet not found', categories: [] };
    
    var data = sheet.getDataRange().getValues();
    
    // OpEx Budget structure:
    // Row 1: Title
    // Row 2: Instructions
    // Row 3: Empty
    // Row 4: Section headers
    // Row 5: Column headers (Expense Category, 2025 Actual, Growth %, 2026 Budget, Jan-Dec, YTD Actual, YTD Budget, Variance, % Used, Status)
    // Row 6+: Data
    
    var headerRow = 4; // 0-indexed
    var dataStartRow = 5;
    
    // Column positions from screenshot
    var cols = {
      category: 0,     // A: Expense Category
      actual2025: 1,   // B: 2025 Actual
      growthPct: 2,    // C: Growth %
      budget2026: 3,   // D: 2026 Budget
      // E-P: Monthly columns (Jan-Dec) = columns 4-15
      jan: 4, feb: 5, mar: 6, apr: 7, may: 8, jun: 9,
      jul: 10, aug: 11, sep: 12, oct: 13, nov: 14, dec: 15,
      ytdActual: 16,   // Q: YTD Actual
      ytdBudget: 17,   // R: YTD Budget
      variance: 18,    // S: Variance
      pctUsed: 19,     // T: % Used
      status: 20       // U: Status
    };
    
    var categories = [];
    var sections = {};
    var currentSection = 'Other';
    var ytdActual = 0, ytdBudget = 0, totalBudget = 0;
    
    // Section headers to look for
    var sectionHeaders = ['PAYROLL & BENEFITS', 'PRODUCTION', 'FACILITY', 'ADMINISTRATIVE', 'SALES & MARKETING', 'OTHER'];
    
    for (var i = dataStartRow; i < data.length; i++) {
      var row = data[i];
      var catName = (row[cols.category] || '').toString().trim();
      
      // Skip empty rows
      if (!catName || catName === '') continue;
      
      // Check if this is a section header
      if (sectionHeaders.indexOf(catName) >= 0) {
        currentSection = catName;
        if (!sections[currentSection]) {
          sections[currentSection] = { categories: [], totalBudget: 0, ytdActual: 0 };
        }
        continue;
      }
      
      // Skip TOTAL and NOTES rows
      if (catName.includes('TOTAL') || catName.includes('NOTES') || catName.includes('CURRENT MONTH')) continue;
      
      var actual2025 = parseFloat(row[cols.actual2025]) || 0;
      var growthPct = parseFloat(row[cols.growthPct]) || 0;
      var annualBudget = parseFloat(row[cols.budget2026]) || 0;
      var actual = parseFloat(row[cols.ytdActual]) || 0;
      var budget = parseFloat(row[cols.ytdBudget]) || 0;
      var variance = parseFloat(row[cols.variance]) || 0;
      var pctUsed = parseFloat(row[cols.pctUsed]) || 0;
      var status = (row[cols.status] || '').toString();
      
      // Get monthly actuals
      var monthlyActuals = [];
      for (var m = 0; m < 12; m++) {
        monthlyActuals.push(parseFloat(row[cols.jan + m]) || 0);
      }
      
      if (annualBudget > 0 || actual2025 > 0) {
        var category = {
          category: catName,
          section: currentSection,
          actual2025: actual2025,
          growthPct: growthPct,
          budget2026: annualBudget,
          monthlyActuals: monthlyActuals,
          ytdActual: actual,
          ytdBudget: budget,
          variance: variance,
          pctUsed: pctUsed,
          status: status
        };
        
        categories.push(category);
        
        // Add to section
        if (!sections[currentSection]) {
          sections[currentSection] = { categories: [], totalBudget: 0, ytdActual: 0 };
        }
        sections[currentSection].categories.push(category);
        sections[currentSection].totalBudget += annualBudget;
        sections[currentSection].ytdActual += actual;
        
        ytdActual += actual;
        ytdBudget += budget;
        totalBudget += annualBudget;
      }
    }
    
    // Get total from TOTAL OPERATING EXPENSES row
    for (var i = 0; i < data.length; i++) {
      if ((data[i][0] || '').toString().includes('TOTAL OPERATING EXPENSE')) {
        totalBudget = parseFloat(data[i][3]) || totalBudget;
        break;
      }
    }
    
    // Calculate variance and % used
    var totalVariance = ytdBudget - ytdActual;
    var totalPctUsed = ytdBudget > 0 ? Math.round((ytdActual / ytdBudget) * 1000) / 10 : 0;
    
    return serializeForHtml({ 
      success: true, 
      categories: categories,
      sections: sections,
      summary: {
        totalBudget: Math.round(totalBudget),
        ytdActual: Math.round(ytdActual),
        ytdBudget: Math.round(ytdBudget),
        variance: Math.round(totalVariance),
        pctUsed: totalPctUsed
      }
    });
  } catch (e) {
    Logger.log('Error in getOpExStatus: ' + e.toString());
    return { success: false, error: e.toString(), categories: [] };
  }
}

/**
 * Update monthly actual for an OpEx category
 */
function updateOpExActual(category, month, amount) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.OPEX);
    
    if (!sheet) return { success: false, error: 'OpEx sheet not found' };
    
    var data = sheet.getDataRange().getValues();
    var monthCol = 4 + month; // Jan=5(E), Feb=6(F), etc. (1-indexed in sheet)
    
    for (var i = 5; i < data.length; i++) {
      if ((data[i][0] || '').toString().toLowerCase() === category.toLowerCase()) {
        sheet.getRange(i + 1, monthCol + 1).setValue(parseFloat(amount) || 0);
        return { success: true, message: 'Updated ' + category + ' for month ' + month };
      }
    }
    
    return { success: false, error: 'Category not found: ' + category };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Get pending purchase requests for approval
 */
function getPendingPurchaseRequests() {
  try {
    var purchasesResult = getPurchasesData({ status: 'Pending' });
    
    if (!purchasesResult.success) {
      return { success: false, error: purchasesResult.error, requests: [] };
    }
    
    // Filter only pending
    var pending = purchasesResult.purchases.filter(function(p) {
      return p.status && p.status.toLowerCase() === 'pending';
    });
    
    // Get OpEx budget status to check available budget
    var opexResult = getOpExStatus();
    var categoryBudgets = {};
    
    if (opexResult.success) {
      opexResult.categories.forEach(function(cat) {
        categoryBudgets[cat.category.toLowerCase()] = {
          budget: cat.budget2026,
          spent: cat.ytdActual,
          remaining: cat.budget2026 - cat.ytdActual
        };
      });
    }
    
    // Enhance pending requests with budget info
    pending = pending.map(function(req) {
      var catKey = (req.category || 'other').toLowerCase();
      var budgetInfo = categoryBudgets[catKey] || { budget: 0, spent: 0, remaining: 0 };
      
      return {
        poNumber: req.poNumber,
        date: req.date,
        item: req.item,
        category: req.category,
        supplier: req.supplier,
        qty: req.qty,
        unitCost: req.unitCost,
        total: req.total,
        status: req.status,
        budgetRemaining: budgetInfo.remaining,
        withinBudget: req.total <= budgetInfo.remaining
      };
    });
    
    return serializeForHtml({
      success: true,
      requests: pending,
      totalPending: pending.length,
      totalValue: pending.reduce(function(sum, r) { return sum + (r.total || 0); }, 0)
    });
    
  } catch (e) {
    return { success: false, error: e.toString(), requests: [] };
  }
}

/**
 * Approve a purchase request
 */
function approvePurchaseRequest(poNumber, approverNotes) {
  try {
    var result = updatePurchaseStatus(poNumber, 'Approved', approverNotes);
    
    if (result.success) {
      // Log the approval
      Logger.log('Purchase ' + poNumber + ' approved by ' + (Session.getActiveUser().getEmail() || 'System'));
    }
    
    return result;
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Deny a purchase request
 */
function denyPurchaseRequest(poNumber, denialReason) {
  try {
    var result = updatePurchaseStatus(poNumber, 'Denied', denialReason);
    
    if (result.success) {
      Logger.log('Purchase ' + poNumber + ' denied: ' + denialReason);
    }
    
    return result;
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: RAW MATERIALS FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all raw materials with optional filtering
 */
function getRawMaterialsInventory(filters) {
  filters = filters || {};
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(RAW_MATERIAL_CONFIG.sheetName);
    
    if (!sheet) {
      return { success: false, error: 'Raw Materials sheet not found', materials: [] };
    }
    
    var data = sheet.getDataRange().getValues();
    var materials = [];
    var totalValue = 0, lowStockCount = 0, outOfStockCount = 0;
    var cols = RAW_MATERIAL_CONFIG.columns;
    var startRow = RAW_MATERIAL_CONFIG.dataStartRow - 1;
    
    for (var i = startRow; i < data.length; i++) {
      var row = data[i];
      
      // Skip empty or summary rows
      if (!row[cols.item - 1] || row[cols.item - 1].toString().trim() === '') continue;
      if (row[cols.item - 1].toString().includes('TOTAL') || row[cols.item - 1].toString().includes('📊')) continue;
      
      var qtyOnHand = parseFloat(row[cols.qtyOnHand - 1]) || 0;
      var avgCost = parseFloat(row[cols.avgCost - 1]) || 0;
      var reorderPoint = parseFloat(row[cols.reorderPoint - 1]) || 0;
      
      // Calculate total value (don't rely on sheet formula)
      var itemTotalValue = qtyOnHand * avgCost;
      
      // Determine status based on qty vs reorder point
      var status = row[cols.status - 1] || '';
      var isOutOfStock = qtyOnHand <= 0;
      var needsReorder = qtyOnHand > 0 && qtyOnHand <= reorderPoint && reorderPoint > 0;
      
      if (isOutOfStock) {
        status = 'OUT';
        outOfStockCount++;
      } else if (needsReorder) {
        status = 'LOW';
        lowStockCount++;
      } else {
        status = status || 'OK';
      }
      
      var material = {
        rowIndex: i + 1,
        item: row[cols.item - 1] || '',
        category: row[cols.category - 1] || '',
        unit: row[cols.unit - 1] || '',
        qtyOnHand: qtyOnHand,
        avgCost: avgCost,
        totalValue: Math.round(itemTotalValue * 100) / 100,
        reorderPoint: reorderPoint,
        reorderQty: parseFloat(row[cols.reorderQty - 1]) || 0,
        status: status,
        supplier: row[cols.supplier - 1] || '',
        lastPurchase: row[cols.lastPurchase - 1] || '',
        notes: row[cols.notes - 1] || ''
      };
      
      // Apply filters
      if (filters.category && material.category !== filters.category) continue;
      if (filters.search) {
        var searchLower = filters.search.toLowerCase();
        if (!material.item.toLowerCase().includes(searchLower) &&
            !material.supplier.toLowerCase().includes(searchLower)) continue;
      }
      
      if (!filters.lowStockOnly || material.status === 'LOW' || material.status === 'OUT') {
        materials.push(material);
      }
      
      totalValue += itemTotalValue;
    }
    
    return serializeForHtml({
      success: true,
      materials: materials,
      summary: {
        totalItems: materials.length,
        totalValue: Math.round(totalValue * 100) / 100,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
        needReorder: lowStockCount + outOfStockCount
      }
    });
    
  } catch (error) {
    Logger.log('Error in getRawMaterialsInventory: ' + error.toString());
    return { success: false, error: error.toString(), materials: [] };
  }
}

/**
 * Add a new raw material
 */
function addRawMaterial(data) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(RAW_MATERIAL_CONFIG.sheetName);
    
    if (!sheet) return { success: false, message: 'Raw Materials sheet not found' };
    if (!data.item || data.item.toString().trim() === '') {
      return { success: false, message: 'Item name is required' };
    }
    
    // Find next row
    var lastRow = sheet.getLastRow();
    var insertRow = lastRow + 1;
    
    var cols = RAW_MATERIAL_CONFIG.columns;
    var qty = parseFloat(data.qtyOnHand) || 0;
    var cost = parseFloat(data.avgCost) || 0;
    var reorder = parseFloat(data.reorderPoint) || 0;
    
    var status = '✅ OK';
    if (qty <= 0) status = '🚨 OUT';
    else if (qty <= reorder) status = '⚠️ REORDER';
    
    var rowData = [];
    rowData[cols.item - 1] = data.item.trim();
    rowData[cols.category - 1] = data.category || 'Other';
    rowData[cols.unit - 1] = data.unit || 'lb';
    rowData[cols.qtyOnHand - 1] = qty;
    rowData[cols.avgCost - 1] = cost;
    rowData[cols.totalValue - 1] = qty * cost;
    rowData[cols.reorderPoint - 1] = reorder;
    rowData[cols.reorderQty - 1] = parseFloat(data.reorderQty) || 0;
    rowData[cols.status - 1] = status;
    rowData[cols.supplier - 1] = data.supplier || '';
    rowData[cols.lastPurchase - 1] = '';
    rowData[cols.notes - 1] = data.notes || '';
    
    sheet.getRange(insertRow, 1, 1, rowData.length).setValues([rowData]);
    
    return { success: true, message: 'Material added', rowIndex: insertRow };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * Adjust raw material inventory
 */
function adjustMaterialInventory(itemName, newQty, reason) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(RAW_MATERIAL_CONFIG.sheetName);
    if (!sheet) return { success: false, error: 'Raw Materials sheet not found' };
    
    var data = sheet.getDataRange().getValues();
    var cols = RAW_MATERIAL_CONFIG.columns;
    
    for (var i = RAW_MATERIAL_CONFIG.dataStartRow - 1; i < data.length; i++) {
      if (data[i][cols.item - 1] && data[i][cols.item - 1].toString().toLowerCase() === itemName.toLowerCase()) {
        var qty = parseFloat(newQty) || 0;
        var cost = parseFloat(data[i][cols.avgCost - 1]) || 0;
        var reorder = parseFloat(data[i][cols.reorderPoint - 1]) || 0;
        
        var status = '✅ OK';
        if (qty <= 0) status = '🚨 OUT';
        else if (qty <= reorder) status = '⚠️ REORDER';
        
        sheet.getRange(i + 1, cols.qtyOnHand).setValue(qty);
        sheet.getRange(i + 1, cols.totalValue).setValue(qty * cost);
        sheet.getRange(i + 1, cols.status).setValue(status);
        
        // Log adjustment
        logMaterialAdjustment(itemName, data[i][cols.qtyOnHand - 1], qty, reason);
        
        return { success: true, message: 'Inventory adjusted' };
      }
    }
    
    return { success: false, error: 'Material not found: ' + itemName };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function logMaterialAdjustment(item, oldQty, newQty, reason, adjustType) {
  try {
    var ss = getBrmSpreadsheet();
    var logSheet = ss.getSheetByName(SHEETS.MATERIAL_LOG);
    if (!logSheet) return;
    
    var change = newQty - oldQty;
    var type = adjustType || (change < 0 ? 'DEPLETE' : 'ADJUST');
    
    // Material Log columns: Timestamp, Item, Type, Previous Qty, New Qty, Change, Notes, User
    logSheet.appendRow([
      new Date(),           // A: Timestamp
      item,                 // B: Item
      type,                 // C: Type (ADJUST, DELETE, DEPLETE, RECEIVE)
      oldQty,               // D: Previous Qty
      newQty,               // E: New Qty
      change,               // F: Change
      reason || '',         // G: Notes
      getCurrentUser().email // H: User
    ]);
  } catch (e) {
    Logger.log('Error logging material adjustment: ' + e.toString());
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: FINISHED GOODS FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all finished goods inventory with optional filtering
 */
function getFinishedGoodsData(filters) {
  filters = filters || {};
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(FG_CONFIG.sheetName);
    
    if (!sheet) {
      return { success: false, error: 'Finished Goods sheet not found', inventory: [] };
    }
    
    var data = sheet.getDataRange().getValues();
    var inventory = [];
    var cols = FG_CONFIG.columns;
    
    var totalValue = 0, totalKegs = 0, totalCases = 0, lowStockCount = 0, outOfStockCount = 0;
    
    for (var i = FG_CONFIG.dataStartRow - 1; i < data.length; i++) {
      var row = data[i];
      
      if (!row[cols.beerName - 1] || row[cols.beerName - 1].toString().trim() === '') continue;
      
      var item = {
        rowIndex: i + 1,
        beer: row[cols.beerName - 1] || '',
        beerName: row[cols.beerName - 1] || '',
        package: row[cols.packageType - 1] || '',
        packageType: row[cols.packageType - 1] || '',
        qtyOnHand: parseFloat(row[cols.qtyOnHand - 1]) || 0,
        unitCost: parseFloat(row[cols.costPerUnit - 1]) || 0,
        costPerUnit: parseFloat(row[cols.costPerUnit - 1]) || 0,
        totalValue: parseFloat(row[cols.totalValue - 1]) || 0,
        floorPrice: parseFloat(row[cols.floorPrice - 1]) || 0,
        minQty: parseFloat(row[cols.minQty - 1]) || 0,
        status: row[cols.status - 1] || ''
      };
      
      totalValue += item.totalValue;
      
      if (item.packageType.includes('BBL') || item.packageType.includes('Keg')) {
        totalKegs += item.qtyOnHand;
      } else {
        totalCases += item.qtyOnHand;
      }
      
      if (item.qtyOnHand <= 0) {
        outOfStockCount++;
      } else if (item.qtyOnHand <= item.minQty) {
        lowStockCount++;
      }
      
      // Apply filters
      if (filters.beer && !item.beerName.toLowerCase().includes(filters.beer.toLowerCase())) continue;
      if (filters.packageType && item.packageType !== filters.packageType) continue;
      if (filters.lowStockOnly && item.qtyOnHand > item.minQty) continue;
      
      inventory.push(item);
    }
    
    return serializeForHtml({
      success: true,
      inventory: inventory,
      summary: {
        totalItems: inventory.length,
        totalValue: totalValue,
        kegCount: totalKegs,
        caseCount: totalCases,
        lowCount: lowStockCount,
        outOfStockCount: outOfStockCount
      }
    });
    
  } catch (error) {
    Logger.log('Error in getFinishedGoodsData: ' + error.toString());
    return { success: false, error: error.toString(), inventory: [] };
  }
}

// Alias for legacy code
function getFinishedGoodsInventory() {
  return getFinishedGoodsData({});
}

/**
 * Adjust finished goods inventory
 */
function adjustFGInventory(beerName, packageType, newQty) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(FG_CONFIG.sheetName);
    if (!sheet) return { success: false, error: 'Finished Goods sheet not found' };
    
    var data = sheet.getDataRange().getValues();
    var cols = FG_CONFIG.columns;
    
    for (var i = FG_CONFIG.dataStartRow - 1; i < data.length; i++) {
      var rowBeer = data[i][cols.beerName - 1];
      var rowPkg = data[i][cols.packageType - 1];
      
      if (rowBeer && rowBeer.toString().toLowerCase() === beerName.toLowerCase() &&
          rowPkg && rowPkg.toString() === packageType) {
        
        var qty = parseFloat(newQty) || 0;
        var cost = parseFloat(data[i][cols.costPerUnit - 1]) || 0;
        var minQty = parseFloat(data[i][cols.minQty - 1]) || 0;
        
        var status = '✅ OK';
        if (qty <= 0) status = '🚨 OUT';
        else if (qty <= minQty) status = '⚠️ LOW';
        
        sheet.getRange(i + 1, cols.qtyOnHand).setValue(qty);
        sheet.getRange(i + 1, cols.totalValue).setValue(qty * cost);
        sheet.getRange(i + 1, cols.status).setValue(status);
        
        // Log to FG Log
        var oldQty = parseFloat(data[i][cols.qtyOnHand - 1]) || 0;
        logFGAdjustment(beerName, packageType, oldQty, qty, 'ADJUST', 'Manual inventory adjustment');
        
        return { success: true, message: 'Inventory adjusted' };
      }
    }
    
    return { success: false, error: 'Beer/Package not found' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function logFGAdjustment(beer, pkg, oldQty, newQty, adjustType, notes) {
  try {
    var ss = getBrmSpreadsheet();
    var logSheet = ss.getSheetByName(SHEETS.FG_LOG);
    if (!logSheet) return;
    
    // FG Log columns: Timestamp, Beer, Package, Type, Previous Qty, New Qty, Change, Notes, User
    logSheet.appendRow([
      new Date(),
      beer,
      pkg,
      adjustType || 'ADJUST',
      oldQty,
      newQty,
      newQty - oldQty,
      notes || 'Manual adjustment',
      getCurrentUser().email
    ]);
  } catch (e) {
    Logger.log('Error logging FG adjustment: ' + e.toString());
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: BATCH/PRODUCTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all batches with optional filtering
 */
function getBatchesData(filters) {
  filters = filters || {};
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    if (!sheet) {
      return { success: false, error: 'Batch Log sheet not found', batches: [] };
    }
    
    var data = sheet.getDataRange().getValues();
    var batches = [];
    
    // Batch Log structure:
    // Row 3: COST SETTINGS header
    // Row 4: Labor Rate ($/hr): $25.00
    // Row 5: Overhead/BBL: $15.00
    // Row 6: (WIP Summary area)
    // Row 7: Column headers (Batch #, Brew Date, Beer Name, etc.)
    // Row 8+: Data
    
    // Read cost settings from the sheet
    var laborRatePerHr = 25.00;  // Default
    var overheadPerBBL = 15.00;  // Default
    
    for (var i = 0; i < Math.min(10, data.length); i++) {
      var label = (data[i][0] || '').toString().toLowerCase();
      if (label.indexOf('labor rate') !== -1) {
        laborRatePerHr = parseFloat(data[i][1]) || 25.00;
      }
      if (label.indexOf('overhead') !== -1 && label.indexOf('bbl') !== -1) {
        overheadPerBBL = parseFloat(data[i][1]) || 15.00;
      }
    }
    
    // Find the header row (look for "Batch #" or "Batch")
    var headerRow = -1;
    for (var i = 0; i < data.length; i++) {
      var cell = (data[i][0] || '').toString().toLowerCase();
      if (cell === 'batch #' || cell === 'batch' || cell.indexOf('batch #') !== -1) {
        headerRow = i;
        break;
      }
    }
    
    if (headerRow === -1) {
      Logger.log('Could not find header row in Batch Log');
      return { success: false, error: 'Could not find header row', batches: [] };
    }
    
    var headers = data[headerRow];
    
    // Find columns dynamically
    var cols = {
      batchNumber: findColumnIndex(headers, 'batch', '#'),
      brewDate: findColumnIndex(headers, 'brew', 'date'),
      beerName: findColumnIndex(headers, 'beer', 'name'),
      batchSize: findColumnIndex(headers, 'size', 'bbl'),
      recipeCost: findColumnIndex(headers, 'recipe', 'cost'),
      laborHrs: findColumnIndex(headers, 'labor', 'hrs'),
      laborDollars: findColumnIndex(headers, 'labor', '$'),
      overhead: findColumnIndex(headers, 'overhead'),
      totalCost: findColumnIndex(headers, 'total', 'cost'),
      expYield: findColumnIndex(headers, 'exp', 'yield'),
      status: findColumnIndex(headers, 'status'),
      pkgDate: findColumnIndex(headers, 'pkg', 'date'),
      actYield: findColumnIndex(headers, 'act', 'yield'),
      costPerBBL: findColumnIndex(headers, 'cost', 'bbl'),
      variance: findColumnIndex(headers, 'variance'),
      notes: findColumnIndex(headers, 'notes'),
      brewer: findColumnIndex(headers, 'brewer'),
      vessel: findColumnIndex(headers, 'vessel', 'tank')
    };
    
    // Process data rows (start after header)
    for (var i = headerRow + 1; i < data.length; i++) {
      var row = data[i];
      var batchNum = row[cols.batchNumber];
      if (!batchNum || batchNum.toString().trim() === '') continue;
      
      var status = (row[cols.status] || 'Unknown').toString();
      
      var batch = {
        rowIndex: i + 1,
        batchNumber: batchNum,
        brewDate: row[cols.brewDate] || '',
        beerName: cols.beerName >= 0 ? row[cols.beerName] : '',
        beerType: cols.beerName >= 0 ? row[cols.beerName] : '',  // Alias
        beer: cols.beerName >= 0 ? row[cols.beerName] : '',      // Alias
        brewer: cols.brewer >= 0 ? row[cols.brewer] : '',
        vessel: cols.vessel >= 0 ? row[cols.vessel] : '',
        batchSize: parseFloat(row[cols.batchSize]) || 0,
        size: parseFloat(row[cols.batchSize]) || 0,  // Alias
        recipeCost: cols.recipeCost >= 0 ? parseFloat(row[cols.recipeCost]) || 0 : 0,
        laborHrs: cols.laborHrs >= 0 ? parseFloat(row[cols.laborHrs]) || 0 : 0,
        laborCost: cols.laborDollars >= 0 ? parseFloat(row[cols.laborDollars]) || 0 : 0,
        overhead: cols.overhead >= 0 ? parseFloat(row[cols.overhead]) || 0 : 0,
        totalCost: cols.totalCost >= 0 ? parseFloat(row[cols.totalCost]) || 0 : 0,
        expectedYield: cols.expYield >= 0 ? parseFloat(row[cols.expYield]) || 0 : 0,
        actualYield: cols.actYield >= 0 ? parseFloat(row[cols.actYield]) || 0 : 0,
        costPerBBL: cols.costPerBBL >= 0 ? parseFloat(row[cols.costPerBBL]) || 0 : 0,
        variance: cols.variance >= 0 ? parseFloat(row[cols.variance]) || 0 : 0,
        status: status,
        pkgDate: cols.pkgDate >= 0 ? row[cols.pkgDate] : '',
        notes: cols.notes >= 0 ? row[cols.notes] : ''
      };
      
      // Apply filters
      if (filters.status && filters.status !== 'All') {
        if (batch.status.toLowerCase() !== filters.status.toLowerCase()) continue;
      }
      if (filters.beer && !batch.beerName.toLowerCase().includes(filters.beer.toLowerCase())) continue;
      if (filters.search) {
        var searchLower = filters.search.toLowerCase();
        var matchesSearch = 
          batch.batchNumber.toString().toLowerCase().includes(searchLower) ||
          batch.beerName.toLowerCase().includes(searchLower) ||
          batch.brewer.toLowerCase().includes(searchLower);
        if (!matchesSearch) continue;
      }
      
      batches.push(batch);
    }
    
    // Sort by date descending (newest first)
    batches.sort(function(a, b) {
      return new Date(b.brewDate) - new Date(a.brewDate);
    });
    
    // Calculate WIP summary
    var wipBatches = batches.filter(function(b) { 
      return b.status !== 'Packaged' && b.status !== 'Complete'; 
    });
    var totalWipValue = wipBatches.reduce(function(sum, b) { return sum + b.totalCost; }, 0);
    
    return serializeForHtml({ 
      success: true, 
      batches: batches, 
      count: batches.length,
      costSettings: {
        laborRatePerHr: laborRatePerHr,
        overheadPerBBL: overheadPerBBL
      },
      wipSummary: {
        batchesInProgress: wipBatches.length,
        totalWipValue: totalWipValue
      }
    });
    
  } catch (error) {
    Logger.log('Error in getBatchesData: ' + error.toString());
    return { success: false, error: error.toString(), batches: [] };
  }
}

// Alias for legacy code
function getBatches() {
  return getBatchesData({});
}

/**
 * Update batch status by batch number
 */
function updateBatchStatusByNumber(batchNumber, newStatus, actualYield, notes) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    if (!sheet) return { success: false, error: 'Batch Log sheet not found' };
    
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    
    var batchCol = findColumnIndex(headers, 'batch', 'number');
    var statusCol = findColumnIndex(headers, 'status');
    var yieldCol = findColumnIndex(headers, 'actual yield');
    var notesCol = findColumnIndex(headers, 'notes');
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][batchCol] && data[i][batchCol].toString() === batchNumber) {
        if (statusCol >= 0) sheet.getRange(i + 1, statusCol + 1).setValue(newStatus);
        if (actualYield && yieldCol >= 0) sheet.getRange(i + 1, yieldCol + 1).setValue(parseFloat(actualYield));
        if (notes && notesCol >= 0) {
          var existingNotes = data[i][notesCol] || '';
          var newNotes = existingNotes + (existingNotes ? '\n' : '') + formatDate(new Date()) + ': ' + notes;
          sheet.getRange(i + 1, notesCol + 1).setValue(newNotes);
        }
        return { success: true, message: 'Batch updated' };
      }
    }
    
    return { success: false, error: 'Batch not found: ' + batchNumber };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Get available vessels for brewing
 */
function getAvailableVessels() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.EQUIPMENT);
    
    if (!sheet) {
      Logger.log('Equipment Scheduling sheet not found, returning defaults');
      // Return default vessels if sheet not found
      return serializeForHtml({
        success: true,
        vessels: [
          { name: 'FV-1', type: 'Fermenter', capacity: 60, status: 'Available', available: true },
          { name: 'FV-2', type: 'Fermenter', capacity: 60, status: 'Available', available: true },
          { name: 'FV-3', type: 'Fermenter', capacity: 60, status: 'Available', available: true },
          { name: 'FV-4', type: 'Fermenter', capacity: 60, status: 'Available', available: true },
          { name: 'FV-5', type: 'Fermenter', capacity: 60, status: 'Available', available: true },
          { name: 'FV-6', type: 'Fermenter', capacity: 60, status: 'Available', available: true },
          { name: 'FV-7', type: 'Fermenter', capacity: 60, status: 'Available', available: true },
          { name: 'FV-8', type: 'Fermenter', capacity: 60, status: 'Available', available: true },
          { name: 'BT-1', type: 'Brite Tank', capacity: 60, status: 'Available', available: true },
          { name: 'BT-2', type: 'Brite Tank', capacity: 60, status: 'Available', available: true },
          { name: 'BT-3', type: 'Brite Tank', capacity: 60, status: 'Available', available: true },
          { name: 'Pilot', type: 'Pilot Fermenter', capacity: 7, status: 'Available', available: true }
        ]
      });
    }
    
    var data = sheet.getDataRange().getValues();
    var vessels = [];
    
    // Headers in row 1: Equipment Name, Type, Capacity (BBL), Status, Current Beer, Start Date, Est. Ready Date, Notes
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue;
      
      var status = (row[3] || 'Available').toString();
      var isAvailable = status.toLowerCase() === 'available';
      
      vessels.push({
        name: row[0],
        type: row[1] || 'Fermenter',
        capacity: parseFloat(row[2]) || 60,
        status: status,
        currentBeer: row[4] || '',
        startDate: row[5] ? formatDate(row[5]) : '',
        estReadyDate: row[6] ? formatDate(row[6]) : '',
        notes: row[7] || '',
        available: isAvailable,
        inUse: !isAvailable
      });
    }
    
    // Summary stats
    var available = vessels.filter(function(v) { return v.available; }).length;
    var inUse = vessels.filter(function(v) { return !v.available; }).length;
    
    return serializeForHtml({ 
      success: true, 
      vessels: vessels,
      summary: {
        total: vessels.length,
        available: available,
        inUse: inUse
      }
    });
  } catch (e) {
    Logger.log('Error in getAvailableVessels: ' + e.toString());
    return { success: false, error: e.toString(), vessels: [] };
  }
}

/**
 * Get list of brewers
 */
function getBrewers() {
  // Return standard brewer list - could be expanded to read from a sheet
  return serializeForHtml({
    success: true,
    brewers: [
      { name: 'Ian', role: 'Head Brewer' },
      { name: 'Tyler', role: 'Brewer' },
      { name: 'Todd', role: 'Owner' }
    ]
  });
}

/**
 * Get brewery staff names from Labor Config sheet
 * Reads Salaried (rows 10-11) and Hourly (rows 16-18) from column A
 * Returns array of name strings for dropdowns
 */
function getBreweryStaff() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.LABOR_CONFIG);
    
    if (!sheet) {
      Logger.log('Labor Config sheet not found');
      return serializeForHtml({
        success: true,
        staff: ['Richard Mar', 'Alex Velasco'] // Fallback
      });
    }
    
    var staff = [];
    
    // Salaried Brewing Staff: rows 10-11 (0-indexed: 9-10)
    for (var row = 10; row <= 11; row++) {
      var name = sheet.getRange(row, 1).getValue(); // Column A
      if (name && name.toString().trim() !== '' && name.toString().trim() !== 'Name') {
        staff.push(name.toString().trim());
      }
    }
    
    // Hourly Brewing Staff: rows 16-18 (0-indexed: 15-17)
    for (var row = 16; row <= 18; row++) {
      var name = sheet.getRange(row, 1).getValue(); // Column A
      if (name && name.toString().trim() !== '' && name.toString().trim() !== 'Name') {
        staff.push(name.toString().trim());
      }
    }
    
    // Remove duplicates and sort
    staff = staff.filter(function(name, index) {
      return staff.indexOf(name) === index;
    });
    staff.sort();
    
    Logger.log('Found ' + staff.length + ' brewery staff members');
    
    return serializeForHtml({
      success: true,
      staff: staff
    });
    
  } catch (e) {
    Logger.log('Error getting brewery staff: ' + e.toString());
    return serializeForHtml({
      success: true,
      staff: ['Richard Mar', 'Alex Velasco'] // Fallback
    });
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: RECIPE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all recipes with ingredients - main function for Recipes tab
 */
function getAllRecipesEnhanced() {
  try {
    var ss = getBrmSpreadsheet();
    var recipesSheet = ss.getSheetByName(SHEETS.RECIPES);
    
    if (!recipesSheet) {
      return { success: false, error: 'Recipes sheet not found' };
    }
    
    // Load COGS from Beer COGS Master for accurate pricing
    var cogsLookup = {};
    var cogsSheet = ss.getSheetByName(SHEETS.BEER_COGS_MASTER);
    if (cogsSheet) {
      var cogsData = cogsSheet.getDataRange().getValues();
      // Columns: Beer Name, Batch Size, Yield %, Expected Yield, Ingredient COGS, Brewing Labor, Packaging Labor, Total COGS, COGS Per BBL
      for (var c = 1; c < cogsData.length; c++) {
        var beerName = (cogsData[c][0] || '').toString().toLowerCase().trim();
        if (beerName) {
          cogsLookup[beerName] = {
            ingredientCost: parseFloat(cogsData[c][4]) || 0,
            brewingLabor: parseFloat(cogsData[c][5]) || 0,
            packagingLabor: parseFloat(cogsData[c][6]) || 0,
            totalCOGS: parseFloat(cogsData[c][7]) || 0,
            cogsPerBBL: parseFloat(cogsData[c][8]) || 0
          };
        }
      }
    }
    
    // Load ingredients from Recipe Ingredients sheet
    var ingredientsByRecipe = {};
    var ingredientsSheet = ss.getSheetByName(SHEETS.RECIPE_INGREDIENTS);
    
    if (ingredientsSheet) {
      var ingData = ingredientsSheet.getDataRange().getValues();
      
      for (var i = 1; i < ingData.length; i++) {
        var recipeName = ingData[i][0];
        var category = ingData[i][1];
        var ingredient = ingData[i][2];
        var amount = parseFloat(ingData[i][3]) || 0;
        var uom = ingData[i][4] || 'lb';
        
        if (!recipeName || !ingredient) continue;
        
        if (!ingredientsByRecipe[recipeName]) {
          ingredientsByRecipe[recipeName] = { grains: [], hops: [], other: [] };
        }
        
        var item = { ingredient: ingredient, amount: amount, uom: uom };
        
        if (category === 'Grain') {
          ingredientsByRecipe[recipeName].grains.push(item);
        } else if (category === 'Hops') {
          ingredientsByRecipe[recipeName].hops.push(item);
        } else {
          ingredientsByRecipe[recipeName].other.push(item);
        }
      }
    }
    
    // Get recipe metadata
    var data = recipesSheet.getDataRange().getValues();
    var recipes = [];
    
    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      var recipeName = row[0];
      if (!recipeName) continue;
      
      var recipeIngredients = ingredientsByRecipe[recipeName] || { grains: [], hops: [], other: [] };
      
      var totalGrain = 0;
      recipeIngredients.grains.forEach(function(g) { totalGrain += g.amount; });
      
      // Get COGS from Beer COGS Master
      var recipeKey = recipeName.toString().toLowerCase().trim();
      var cogs = cogsLookup[recipeKey] || {};
      
      recipes.push({
        recipeName: recipeName,
        beerType: row[1] || '',
        style: row[1] || '',
        batchSize: parseFloat(row[2]) || 60,
        yieldPct: parseFloat(row[3]) || 0.95,
        productType: row[4] || 'Keg',
        expectedYield: parseFloat(row[5]) || 57,
        legacyIngredients: row[6] || '',
        estimatedCost: cogs.totalCOGS || parseFloat(row[7]) || 0,  // Use COGS Master first
        ingredientCost: cogs.ingredientCost || 0,
        laborCost: cogs.brewingLabor || 0,
        cogsPerBBL: cogs.cogsPerBBL || 0,
        brewTime: row[8] || 8,
        fermentationDays: row[9] || 14,
        notes: row[10] || '',
        og: row[11] || '',
        fg: row[12] || '',
        abv: row[13] || '',
        ibu: row[14] || '',
        srm: row[15] || '',
        yeast: row[16] || '',
        mashTemp: row[17] || '',
        grains: recipeIngredients.grains,
        hops: recipeIngredients.hops,
        other: recipeIngredients.other,
        totalGrain: totalGrain,
        hopCount: recipeIngredients.hops.length,
        rowNum: r + 1
      });
    }
    
    // Calculate summary stats
    var totalRecipes = recipes.length;
    var avgBatchSize = recipes.length > 0 ? 
      recipes.reduce(function(sum, r) { return sum + r.batchSize; }, 0) / recipes.length : 0;
    var avgCOGS = recipes.length > 0 ?
      recipes.reduce(function(sum, r) { return sum + (r.cogsPerBBL || 0); }, 0) / recipes.length : 0;
    
    return serializeForHtml({ 
      success: true, 
      recipes: recipes, 
      count: recipes.length,
      summary: {
        totalRecipes: totalRecipes,
        avgBatchSize: Math.round(avgBatchSize * 10) / 10,
        avgCOGSPerBBL: Math.round(avgCOGS * 100) / 100
      }
    });
    
  } catch (e) {
    Logger.log('Error getting enhanced recipes: ' + e.toString());
    return { success: false, error: e.toString(), recipes: [] };
  }
}

/**
 * Get recipe details for modal view
 */
function getRecipeDetails(recipeName) {
  try {
    var result = getAllRecipesEnhanced();
    if (!result.success) return result;
    
    var recipe = result.recipes.find(function(r) { return r.recipeName === recipeName; });
    if (!recipe) return { success: false, error: 'Recipe not found' };
    
    // Get COGS data if available
    var cogsData = getBeerCOGSForRecipe(recipeName);
    
    return serializeForHtml({
      success: true,
      recipeName: recipe.recipeName,
      style: recipe.style,
      batchSize: recipe.batchSize,
      abv: recipe.abv,
      ibu: recipe.ibu,
      yieldPct: recipe.yieldPct,
      grains: recipe.grains,
      hops: recipe.hops,
      other: recipe.other,
      yeast: recipe.yeast,
      notes: recipe.notes,
      ingredientCost: cogsData.ingredientCost || recipe.estimatedCost,
      laborCost: cogsData.laborCost || 0,
      cogsPerBBL: cogsData.cogsPerBBL || 0
    });
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Add a new recipe
 */
function addNewRecipe(data) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.RECIPES);
    if (!sheet) return { success: false, error: 'Recipes sheet not found' };
    
    if (!data.name || data.name.trim() === '') {
      return { success: false, error: 'Recipe name is required' };
    }
    
    var lastRow = sheet.getLastRow();
    var newRow = [
      data.name.trim(),
      data.style || '',
      parseFloat(data.batchSize) || 60,
      0.95,  // Default yield %
      'Keg',
      57,    // Expected yield
      '',    // Legacy ingredients
      0,     // Estimated cost
      8,     // Brew time
      14,    // Fermentation days
      '',    // Notes
      data.og || '',
      '',    // FG
      data.abv || '',
      data.ibu || '',
      '',    // SRM
      '',    // Yeast
      ''     // Mash temp
    ];
    
    sheet.appendRow(newRow);
    
    return { success: true, message: 'Recipe created', rowIndex: lastRow + 1 };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Generate Brewer's Sheet for a recipe - supports "Brew This" button
 */
function getBrewerSheet(recipeName, targetBatchSize, batchNumber) {
  try {
    var ss = getBrmSpreadsheet();
    var result = getAllRecipesEnhanced();
    if (!result.success) return result;
    
    var recipe = result.recipes.find(function(r) { return r.recipeName === recipeName; });
    if (!recipe) {
      return { success: false, error: 'Recipe not found: ' + recipeName };
    }
    
    var scaleFactor = (targetBatchSize || recipe.batchSize) / recipe.batchSize;
    
    // Fetch workflow data if batch exists
    var workflowData = {
      turn1Brewer: null,
      turn2Brewer: null,
      recipeChanges: [],
      fvAssignment: null,
      yeastDetails: recipe.yeast || '',
      dryHopSchedule: [],
      cleaningTasks: [],
      batchExists: false
    };
    
    // If no batchNumber provided, try to find most recent active batch for this recipe
    if (!batchNumber) {
      try {
        var batchesResult = getBatchesData({ beer: recipeName });
        if (batchesResult.success && batchesResult.batches && batchesResult.batches.length > 0) {
          // Find most recent active batch (not packaged)
          var activeBatches = batchesResult.batches.filter(function(b) {
            return b.status && b.status.toLowerCase() !== 'packaged' && b.status.toLowerCase() !== 'complete';
          });
          if (activeBatches.length > 0) {
            // Sort by brew date descending and take the most recent
            activeBatches.sort(function(a, b) {
              var dateA = a.brewDate ? new Date(a.brewDate) : new Date(0);
              var dateB = b.brewDate ? new Date(b.brewDate) : new Date(0);
              return dateB - dateA;
            });
            batchNumber = activeBatches[0].batchNumber;
          }
        }
      } catch (e) {
        Logger.log('Error finding existing batch: ' + e.toString());
      }
    }
    
    if (batchNumber) {
      // Get batch data
      var batchResult = getBatchSheet(batchNumber);
      if (batchResult.success && batchResult.batch) {
        workflowData.batchExists = true;
        workflowData.batchNumber = batchNumber;
        workflowData.fvAssignment = batchResult.batch.currentVessel || null;
        workflowData.yeastDetails = batchResult.batch.yeast || recipe.yeast || '';
        
        // Get tasks for this batch
        try {
          var tasksResult = getBatchTasks(batchNumber);
          if (tasksResult.success && tasksResult.tasks) {
            workflowData.tasks = tasksResult.tasks;
          } else {
            workflowData.tasks = [];
          }
        } catch (e) {
          Logger.log('Error getting batch tasks: ' + e.toString());
          workflowData.tasks = [];
        }
        
        // Get brewers from Batch Log (check for Brewers column)
        var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
        if (batchSheet) {
          var batchData = batchSheet.getDataRange().getValues();
          var headers = batchData[0] || [];
          var brewersCol = -1;
          for (var h = 0; h < headers.length; h++) {
            var header = (headers[h] || '').toString().toLowerCase();
            if (header.indexOf('brewer') !== -1) {
              brewersCol = h;
              break;
            }
          }
          
          // Find batch row and get brewers
          for (var i = 1; i < batchData.length; i++) {
            if (batchData[i][0] && batchData[i][0].toString() === batchNumber) {
              if (brewersCol >= 0) {
                var brewersStr = (batchData[i][brewersCol] || '').toString();
                if (brewersStr) {
                  var brewers = brewersStr.split(',').map(function(b) { return b.trim(); });
                  workflowData.turn1Brewer = brewers[0] || null;
                  workflowData.turn2Brewer = brewers[1] || null;
                }
              }
              break;
            }
          }
        }
        
        // Get Batch Details entries
        if (batchResult.cellarEntries && batchResult.cellarEntries.length > 0) {
          batchResult.cellarEntries.forEach(function(entry) {
            var desc = (entry.description || '').toLowerCase();
            var type = (entry.type || '').toLowerCase();
            
            // Dry hop additions
            if (type === 'addition' && (desc.indexOf('hop') !== -1 || desc.indexOf('dry') !== -1)) {
              workflowData.dryHopSchedule.push({
                date: entry.date,
                time: entry.time,
                ingredient: entry.description,
                amount: entry.value,
                units: entry.units,
                notes: entry.notes
              });
            }
            
            // Cleaning tasks (from notes or specific entries)
            if (type === 'note' && (desc.indexOf('clean') !== -1 || desc.indexOf('sanitize') !== -1 || entry.notes.toLowerCase().indexOf('clean') !== -1)) {
              workflowData.cleaningTasks.push({
                date: entry.date,
                time: entry.time,
                description: entry.description,
                notes: entry.notes
              });
            }
          });
        }
      }
    }
    
    // Get recipe changes from Recipe Change Log
    try {
      var changeHistory = getRecipeChangeHistory(recipeName);
      if (changeHistory.success && changeHistory.history) {
        // Get recent changes (last 10)
        workflowData.recipeChanges = changeHistory.history.slice(0, 10).map(function(change) {
          return {
            date: change['Date'] || '',
            time: change['Time'] || '',
            user: change['User'] || '',
            field: change['Field Changed'] || '',
            oldValue: change['Old Value'] || '',
            newValue: change['New Value'] || '',
            reason: change['Reason'] || ''
          };
        });
      }
    } catch (e) {
      Logger.log('Error getting recipe changes: ' + e.toString());
    }
    
    // Load Ingredient Map for name translation
    var ingredientMap = {};
    var mapSheet = ss.getSheetByName(SHEETS.INGREDIENT_MAP);
    if (mapSheet) {
      var mapData = mapSheet.getDataRange().getValues();
      for (var m = 1; m < mapData.length; m++) {
        var recipeIngName = (mapData[m][0] || '').toString().toLowerCase().trim();
        var rawMatName = (mapData[m][1] || '').toString().toLowerCase().trim();
        var convFactor = parseFloat(mapData[m][5]) || 1;
        if (recipeIngName) {
          ingredientMap[recipeIngName] = {
            rawMaterialName: rawMatName || recipeIngName,
            conversionFactor: convFactor
          };
        }
      }
    }
    
    // Get raw materials for inventory check and costs
    var rmResult = getRawMaterialsInventory({});
    var rmLookup = {};
    if (rmResult.success && rmResult.materials) {
      rmResult.materials.forEach(function(m) {
        rmLookup[m.item.toLowerCase().trim()] = {
          qtyOnHand: m.qtyOnHand || 0,
          avgCost: m.avgCost || 0,
          unit: m.unit || 'lb'
        };
      });
    }
    
    function processIngredients(items, category) {
      return (items || []).map(function(item) {
        var scaledAmount = Math.round(item.amount * scaleFactor * 100) / 100;
        var ingKey = item.ingredient.toLowerCase().trim();
        
        // Use Ingredient Map to translate to raw material name
        var mapping = ingredientMap[ingKey] || {};
        var rmName = mapping.rawMaterialName || ingKey;
        var convFactor = mapping.conversionFactor || 1;
        
        // Look up raw material
        var rm = rmLookup[rmName] || {};
        
        // Fuzzy match if not found
        if (!rm.avgCost && !rm.qtyOnHand) {
          for (var key in rmLookup) {
            if (key.indexOf(ingKey) !== -1 || ingKey.indexOf(key) !== -1) {
              rm = rmLookup[key];
              break;
            }
          }
        }
        
        var cost = scaledAmount * (rm.avgCost || 0) * convFactor;
        
        return {
          ingredient: item.ingredient,
          category: category,
          recipeAmount: item.amount,
          scaledAmount: scaledAmount,
          actualAmount: scaledAmount,
          uom: item.uom || 'lb',
          rawMaterialName: rmName,
          qtyOnHand: rm.qtyOnHand || 0,
          avgCost: rm.avgCost || 0,
          cost: Math.round(cost * 100) / 100,
          sufficient: (rm.qtyOnHand || 0) >= scaledAmount,
          verified: false
        };
      });
    }
    
    var grains = processIngredients(recipe.grains || [], 'Grain');
    var hops = processIngredients(recipe.hops || [], 'Hops');
    var other = processIngredients(recipe.other || [], 'Other');
    
    var totalGrain = 0;
    grains.forEach(function(g) { totalGrain += g.scaledAmount; });
    
    // Calculate ingredient cost
    var ingredientCost = 0;
    grains.concat(hops).concat(other).forEach(function(item) {
      ingredientCost += item.cost || 0;
    });
    
    // Get labor cost from Labor Config
    var laborResult = getLaborCostPerBatch();
    var laborCost = laborResult.totalLabor || 3897.26;
    
    // Total COGS
    var totalCOGS = ingredientCost + laborCost;
    var expectedYield = (targetBatchSize || recipe.batchSize) * (recipe.yieldPct || 0.95);
    var cogsPerBBL = expectedYield > 0 ? totalCOGS / expectedYield : 0;
    
    var allIngredients = grains.concat(hops).concat(other);
    var insufficientItems = allIngredients.filter(function(i) { return !i.sufficient; });
    
    return serializeForHtml({
      success: true,
      brewerSheet: {
        recipeName: recipe.recipeName,
        style: recipe.style || recipe.beerType,
        originalBatchSize: recipe.batchSize,
        targetBatchSize: targetBatchSize || recipe.batchSize,
        scaleFactor: scaleFactor,
        expectedYield: Math.round(expectedYield * 10) / 10,
        targetOG: recipe.og || '',
        targetFG: recipe.fg || '',
        targetABV: recipe.abv || '',
        targetIBU: recipe.ibu || '',
        targetSRM: recipe.srm || '',
        yeast: recipe.yeast || '',
        mashTemp: recipe.mashTemp || '',
        brewTime: recipe.brewTime || 8,
        fermentationDays: recipe.fermentationDays || 14,
        notes: recipe.notes || '',
        grains: grains,
        hops: hops,
        other: other,
        totalGrain: Math.round(totalGrain * 10) / 10,
        ingredientCost: Math.round(ingredientCost * 100) / 100,
        laborCost: Math.round(laborCost * 100) / 100,
        totalCOGS: Math.round(totalCOGS * 100) / 100,
        cogsPerBBL: Math.round(cogsPerBBL * 100) / 100,
        insufficientItems: insufficientItems,
        hasWarnings: insufficientItems.length > 0,
        workflow: workflowData
      }
    });
  } catch (e) {
    Logger.log('Error generating Brewer Sheet: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * Start a brew - creates batch, depletes inventory
 */
function confirmBrewStartEnhanced_Old(brewerData) {
  try {
    var ss = getBrmSpreadsheet();
    
    // Generate batch number
    var batchNumber = generateBatchNumber(brewerData.recipeName);
    
    // Create batch record
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    if (!batchSheet) return { success: false, error: 'Batch Log sheet not found' };
    
    var batchRow = [
      batchNumber,
      new Date(),
      brewerData.recipeName,
      brewerData.brewer,
      brewerData.vessel,
      brewerData.targetBatchSize,
      brewerData.targetBatchSize * 0.95,  // Expected yield
      '',  // Actual yield (TBD)
      'Brewing',
      brewerData.estimatedCost,
      0,  // Labor cost
      brewerData.estimatedCost,
      brewerData.notes || ''
    ];
    
    batchSheet.appendRow(batchRow);
    
    // Deplete raw materials
    var allIngredients = (brewerData.grains || []).concat(brewerData.hops || []).concat(brewerData.other || []);
    allIngredients.forEach(function(item) {
      var itemUOM = (item.uom || 'lb').toString().trim();
      depleteRawMaterial(item.ingredient, item.actualAmount || item.scaledAmount, batchNumber, null, 'Recipe', itemUOM);
    });
    
    // Update equipment status
    updateEquipmentStatus(brewerData.vessel, 'In Use', brewerData.recipeName, batchNumber);
    
    // Log batch ingredients
    logBatchIngredients(batchNumber, allIngredients);
    
    return serializeForHtml({
      success: true,
      batchNumber: batchNumber,
      message: 'Brew started successfully'
    });
  } catch (e) {
    Logger.log('Error starting brew: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

function generateBatchNumber(recipeName) {
  var now = new Date();
  var yy = now.getFullYear().toString().substr(-2);
  var mm = ('0' + (now.getMonth() + 1)).slice(-2);
  var dd = ('0' + now.getDate()).slice(-2);
  var prefix = recipeName.substring(0, 3).toUpperCase();
  var random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return prefix + '-' + yy + mm + dd + '-' + random;
}

/**
 * Convert quantity from one unit to another
 * @param {number} qty - Quantity to convert
 * @param {string} fromUnit - Source unit (lb, oz, kg, g, gal, ml, L, etc.)
 * @param {string} toUnit - Target unit
 * @returns {number} Converted quantity, or original qty if conversion not possible
 */
function convertUnit(qty, fromUnit, toUnit) {
  if (!fromUnit || !toUnit || fromUnit.toLowerCase() === toUnit.toLowerCase()) {
    return qty; // No conversion needed
  }
  
  var from = fromUnit.toLowerCase().trim();
  var to = toUnit.toLowerCase().trim();
  
  // Weight conversions
  if ((from === 'lb' || from === 'lbs') && (to === 'oz' || to === 'ozs')) {
    return qty * 16; // 1 lb = 16 oz
  }
  if ((from === 'oz' || from === 'ozs') && (to === 'lb' || to === 'lbs')) {
    return qty / 16; // 1 oz = 1/16 lb
  }
  if ((from === 'kg' || from === 'kilogram' || from === 'kilograms') && (to === 'g' || to === 'gram' || to === 'grams')) {
    return qty * 1000; // 1 kg = 1000 g
  }
  if ((from === 'g' || from === 'gram' || from === 'grams') && (to === 'kg' || to === 'kilogram' || to === 'kilograms')) {
    return qty / 1000; // 1 g = 1/1000 kg
  }
  
  // Volume conversions
  if ((from === 'gal' || from === 'gallon' || from === 'gallons') && (to === 'ml' || to === 'milliliter' || from === 'milliliters')) {
    return qty * 3785.41; // 1 gal = 3785.41 ml
  }
  if ((from === 'ml' || from === 'milliliter' || from === 'milliliters') && (to === 'gal' || to === 'gallon' || to === 'gallons')) {
    return qty / 3785.41; // 1 ml = 1/3785.41 gal
  }
  if ((from === 'gal' || from === 'gallon' || from === 'gallons') && (to === 'l' || to === 'liter' || to === 'liters')) {
    return qty * 3.78541; // 1 gal = 3.78541 L
  }
  if ((from === 'l' || from === 'liter' || from === 'liters') && (to === 'gal' || to === 'gallon' || to === 'gallons')) {
    return qty / 3.78541; // 1 L = 1/3.78541 gal
  }
  if ((from === 'l' || from === 'liter' || from === 'liters') && (to === 'ml' || to === 'milliliter' || to === 'milliliters')) {
    return qty * 1000; // 1 L = 1000 ml
  }
  if ((from === 'ml' || from === 'milliliter' || from === 'milliliters') && (to === 'l' || to === 'liter' || to === 'liters')) {
    return qty / 1000; // 1 ml = 1/1000 L
  }
  
  // If no conversion found, return original (assume same unit or incompatible)
  Logger.log('Warning: Unit conversion not available: ' + fromUnit + ' → ' + toUnit + '. Using original quantity.');
  return qty;
}

/**
 * Deplete raw material from inventory
 * @param {string} itemName - Material name
 * @param {number} qty - Quantity to deplete (in source UOM)
 * @param {string} batchNumber - Batch number for logging
 * @param {string} taskId - Optional task ID for logging
 * @param {string} depletionType - Type: "Recipe", "Task", "Packaging", "Cellar"
 * @param {string} sourceUOM - Optional source UOM (if different from Raw Material UOM)
 */
function depleteRawMaterial(itemName, qty, batchNumber, taskId, depletionType, sourceUOM) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(RAW_MATERIAL_CONFIG.sheetName);
    if (!sheet) return;
    
    var data = sheet.getDataRange().getValues();
    var cols = RAW_MATERIAL_CONFIG.columns;
    
    for (var i = RAW_MATERIAL_CONFIG.dataStartRow - 1; i < data.length; i++) {
      if (data[i][cols.item - 1] && data[i][cols.item - 1].toString().toLowerCase() === itemName.toLowerCase()) {
        var currentQty = parseFloat(data[i][cols.qtyOnHand - 1]) || 0;
        var rmUnit = (data[i][cols.unit - 1] || 'lb').toString().trim();
        
        // Convert quantity to match Raw Material UOM if source UOM provided
        var qtyToDeduct = qty;
        if (sourceUOM && sourceUOM !== rmUnit) {
          qtyToDeduct = convertUnit(qty, sourceUOM, rmUnit);
          Logger.log('Unit conversion: ' + qty + ' ' + sourceUOM + ' → ' + qtyToDeduct.toFixed(4) + ' ' + rmUnit + ' for ' + itemName);
        }
        
        var newQty = Math.max(0, currentQty - qtyToDeduct);
        var cost = parseFloat(data[i][cols.avgCost - 1]) || 0;
        var reorder = parseFloat(data[i][cols.reorderPoint - 1]) || 0;
        
        var status = '✅ OK';
        if (newQty <= 0) status = '🚨 OUT';
        else if (newQty <= reorder) status = '⚠️ REORDER';
        
        sheet.getRange(i + 1, cols.qtyOnHand).setValue(newQty);
        sheet.getRange(i + 1, cols.totalValue).setValue(newQty * cost);
        sheet.getRange(i + 1, cols.status).setValue(status);
        
        // Enhanced logging with depletion type and task ID
        var logNote = 'Batch: ' + batchNumber;
        if (taskId) logNote += ', Task: ' + taskId;
        if (depletionType) logNote += ', Type: ' + depletionType;
        
        logMaterialAdjustment(itemName, currentQty, newQty, logNote);
        break;
      }
    }
  } catch (e) {
    Logger.log('Error depleting material: ' + e.toString());
  }
}

/**
 * Check if materials have already been depleted for a specific batch/task/type
 * @param {string} batchNumber - Batch number
 * @param {string} taskId - Optional task ID
 * @param {string} depletionType - "Recipe", "Task", "Packaging", "Cellar"
 * @returns {boolean} True if already depleted
 */
function hasBeenDepleted(batchNumber, taskId, depletionType) {
  try {
    var ss = getBrmSpreadsheet();
    var materialLog = ss.getSheetByName(SHEETS.MATERIAL_LOG);
    if (!materialLog) return false;
    
    var data = materialLog.getDataRange().getValues();
    var batchCol = -1, notesCol = -1;
    
    // Find columns
    if (data.length > 0) {
      var headers = data[0];
      for (var c = 0; c < headers.length; c++) {
        var h = (headers[c] || '').toString().toLowerCase();
        if (h.indexOf('batch') !== -1) batchCol = c;
        if (h.indexOf('note') !== -1 || h.indexOf('description') !== -1) notesCol = c;
      }
    }
    
    // Check Material Log for existing depletion
    for (var i = 1; i < data.length; i++) {
      var rowBatch = (data[i][batchCol] || '').toString();
      var rowNotes = (data[i][notesCol] || '').toString();
      
      if (rowBatch === batchNumber) {
        // Check if this matches the depletion type
        if (depletionType === 'Recipe' && rowNotes.indexOf('Batch: ' + batchNumber) !== -1 && rowNotes.indexOf('Type: Recipe') !== -1) {
          return true;
        }
        if (depletionType === 'Task' && taskId && rowNotes.indexOf('Task: ' + taskId) !== -1) {
          return true;
        }
        if (depletionType === 'Packaging' && rowNotes.indexOf('Type: Packaging') !== -1) {
          return true;
        }
        if (depletionType === 'Cellar' && rowNotes.indexOf('Type: Cellar') !== -1) {
          return true;
        }
      }
    }
    
    return false;
  } catch (e) {
    Logger.log('Error checking depletion status: ' + e.toString());
    return false; // If error, allow depletion (fail open)
  }
}

function updateEquipmentStatus(vesselName, status, beer, batchNumber) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.EQUIPMENT);
    if (!sheet) return;
    
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === vesselName) {
        sheet.getRange(i + 1, 4).setValue(status);
        sheet.getRange(i + 1, 5).setValue(beer);
        sheet.getRange(i + 1, 6).setValue(new Date());
        break;
      }
    }
  } catch (e) {
    Logger.log('Error updating equipment: ' + e.toString());
  }
}

function logBatchIngredients(batchNumber, ingredients) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.BATCH_INGREDIENTS);
    if (!sheet) return;
    
    ingredients.forEach(function(item) {
      sheet.appendRow([
        batchNumber,
        new Date(),
        item.category,
        item.ingredient,
        item.actualAmount || item.scaledAmount,
        item.uom,
        item.avgCost,
        (item.actualAmount || item.scaledAmount) * item.avgCost
      ]);
    });
  } catch (e) {
    Logger.log('Error logging batch ingredients: ' + e.toString());
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9: PURCHASE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all purchases
 */
function getPurchasesData(filters) {
  filters = filters || {};
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.PURCHASE_LOG);
    
    if (!sheet) {
      return { success: false, error: 'Purchase Log sheet not found', purchases: [] };
    }
    
    var data = sheet.getDataRange().getValues();
    
    // Purchase Log structure:
    // Row 1: Title
    // Row 2: Instructions
    // Row 3: Empty
    // Row 4: Headers (Date, PO Number, Supplier, Item, Category, Qty, Unit, Cost/Unit, Total Cost, Invoice #, Status)
    // Row 5+: Data
    var headerRow = 3; // 0-indexed, so row 4
    var dataStartRow = 4; // 0-indexed, so row 5
    
    var headers = data[headerRow] || [];
    var purchases = [];
    
    // Column mapping based on actual spreadsheet
    var cols = {
      date: 0,        // A
      poNumber: 1,    // B
      supplier: 2,    // C
      item: 3,        // D
      category: 4,    // E
      qty: 5,         // F
      unit: 6,        // G
      unitCost: 7,    // H
      total: 8,       // I
      invoice: 9,     // J
      status: 10      // K (if present)
    };
    
    var now = new Date();
    var ytdTotal = 0, mtdTotal = 0, pendingCount = 0;
    
    for (var i = dataStartRow; i < data.length; i++) {
      var row = data[i];
      if (!row[cols.poNumber] && !row[cols.item]) continue;
      if (row[cols.date] === '' && row[cols.item] === '') continue;
      
      var status = (row[cols.status] || 'Pending').toString();
      
      var purchase = {
        rowIndex: i + 1,
        date: row[cols.date] || '',
        poNumber: row[cols.poNumber] || '',
        supplier: row[cols.supplier] || '',
        item: row[cols.item] || '',
        category: row[cols.category] || '',
        qty: parseFloat(row[cols.qty]) || 0,
        unit: row[cols.unit] || '',
        unitCost: parseFloat(row[cols.unitCost]) || 0,
        total: parseFloat(row[cols.total]) || 0,
        invoice: row[cols.invoice] || '',
        status: status
      };
      
      var purchaseDate = new Date(purchase.date);
      if (!isNaN(purchaseDate.getTime()) && purchaseDate.getFullYear() === now.getFullYear()) {
        if (status.toLowerCase() === 'received' || status.toLowerCase() === 'approved') {
          ytdTotal += purchase.total;
          if (purchaseDate.getMonth() === now.getMonth()) {
            mtdTotal += purchase.total;
          }
        }
      }
      
      if (status.toLowerCase() === 'pending' || status.toLowerCase() === 'ordered') {
        pendingCount++;
      }
      
      // Apply filters
      if (filters.status && purchase.status.toLowerCase() !== filters.status.toLowerCase()) continue;
      if (filters.supplier && !purchase.supplier.toLowerCase().includes(filters.supplier.toLowerCase())) continue;
      if (filters.search) {
        var searchLower = filters.search.toLowerCase();
        if (!purchase.item.toLowerCase().includes(searchLower) &&
            !purchase.supplier.toLowerCase().includes(searchLower) &&
            !purchase.poNumber.toLowerCase().includes(searchLower)) continue;
      }
      if (filters.pendingOnly && status.toLowerCase() !== 'pending') continue;
      
      purchases.push(purchase);
    }
    
    // Sort by date descending
    purchases.sort(function(a, b) {
      return new Date(b.date) - new Date(a.date);
    });
    
    return serializeForHtml({
      success: true,
      purchases: purchases,
      summary: {
        totalItems: purchases.length,
        ytdTotal: Math.round(ytdTotal * 100) / 100,
        mtdTotal: Math.round(mtdTotal * 100) / 100,
        pendingCount: pendingCount
      }
    });
    
  } catch (error) {
    Logger.log('Error in getPurchasesData: ' + error.toString());
    return { success: false, error: error.toString(), purchases: [] };
  }
}

/**
 * Add new purchase request
 * Called when brewer or staff submits a purchase request
 */
function addPurchaseRequest(data) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.PURCHASE_LOG);
    
    if (!sheet) return { success: false, error: 'Purchase Log sheet not found' };
    if (!data.item) return { success: false, error: 'Item is required' };
    
    // Generate PO Number: PO-YYYYMMDD-XXX
    var today = new Date();
    var dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyyMMdd');
    var lastRow = sheet.getLastRow();
    var poNumber = 'PO-' + dateStr + '-' + String(lastRow).padStart(3, '0');
    
    // Determine category from Raw Materials if not provided
    var category = data.category || 'Other';
    if (!data.category && data.item) {
      var rmResult = getRawMaterialsInventory({});
      if (rmResult.success) {
        var match = rmResult.materials.find(function(m) {
          return m.item.toLowerCase() === data.item.toLowerCase();
        });
        if (match) category = match.category;
      }
    }
    
    var qty = parseFloat(data.qty) || 1;
    var unitCost = parseFloat(data.unitCost) || 0;
    var total = qty * unitCost;
    
    // Append new row
    // Columns: Date, PO Number, Supplier, Item, Category, Qty, Unit, Cost/Unit, Total Cost, Invoice#, Status
    sheet.appendRow([
      today,
      poNumber,
      data.supplier || '',
      data.item,
      category,
      qty,
      data.unit || 'lb',
      unitCost,
      total,
      '',  // Invoice # (filled when received)
      'Pending'  // Status - awaiting approval
    ]);
    
    // TODO: Send notification to Controller/COO for approval
    // This could be an email trigger or Slack notification
    
    return serializeForHtml({ 
      success: true, 
      message: 'Purchase request submitted for approval',
      poNumber: poNumber
    });
    
  } catch (e) {
    Logger.log('Error adding purchase request: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * Approve or deny a purchase request
 * Called by Controller/COO
 */
function updatePurchaseStatus(poNumber, newStatus, notes) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.PURCHASE_LOG);
    
    if (!sheet) return { success: false, error: 'Purchase Log sheet not found' };
    
    var data = sheet.getDataRange().getValues();
    var statusCol = 11; // Column K (1-indexed)
    
    for (var i = 4; i < data.length; i++) { // Start from row 5 (0-indexed = 4)
      if (data[i][1] === poNumber) { // Column B = PO Number
        sheet.getRange(i + 1, statusCol).setValue(newStatus);
        
        // If status is "Received", update Raw Materials
        if (newStatus.toLowerCase() === 'received') {
          var item = data[i][3];      // Column D
          var qty = parseFloat(data[i][5]) || 0;   // Column F
          var cost = parseFloat(data[i][7]) || 0;  // Column H
          
          addToRawMaterialInventory(item, qty, cost);
        }
        
        return { success: true, message: 'Status updated to ' + newStatus };
      }
    }
    
    return { success: false, error: 'PO not found: ' + poNumber };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Get low stock items that need reordering
 */
function getLowStockForReorder() {
  try {
    var rmResult = getRawMaterialsInventory({});
    if (!rmResult.success) return { success: false, items: [] };
    
    var lowItems = rmResult.materials.filter(function(m) {
      return m.status === 'LOW' || m.status === 'OUT' || 
             m.status === '⚠️ REORDER' || m.status === '🚨 OUT';
    });
    
    // Add suggested order qty
    lowItems = lowItems.map(function(item) {
      return {
        item: item.item,
        category: item.category,
        unit: item.unit,
        qtyOnHand: item.qtyOnHand,
        reorderPoint: item.reorderPoint,
        reorderQty: item.reorderQty || (item.reorderPoint * 2), // Default to 2x reorder point
        status: item.status,
        supplier: item.supplier || '',
        avgCost: item.avgCost
      };
    });
    
    return { success: true, items: lowItems, count: lowItems.length };
    
  } catch (e) {
    return { success: false, error: e.toString(), items: [] };
  }
}

/**
      pendingCount: pendingCount
    };
    
  } catch (e) {
    return { success: false, error: e.toString(), purchases: [] };
  }
}

/**
 * Receive a purchase order - updates inventory
 */
function receivePurchaseOrder(poNumber) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.PURCHASE_LOG);
    if (!sheet) return { success: false, error: 'Purchase Log sheet not found' };
    
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    
    var cols = {
      poNumber: findColumnIndex(headers, 'po', 'number'),
      item: findColumnIndex(headers, 'item'),
      qty: findColumnIndex(headers, 'qty', 'quantity'),
      unitCost: findColumnIndex(headers, 'unit cost'),
      status: findColumnIndex(headers, 'status')
    };
    
    var itemsReceived = [];
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][cols.poNumber] && data[i][cols.poNumber].toString() === poNumber) {
        // Mark as received
        sheet.getRange(i + 1, cols.status + 1).setValue('Received');
        
        // Add to inventory
        var item = data[i][cols.item];
        var qty = parseFloat(data[i][cols.qty]) || 0;
        var cost = parseFloat(data[i][cols.unitCost]) || 0;
        
        addToRawMaterialInventory(item, qty, cost);
        itemsReceived.push(item);
      }
    }
    
    if (itemsReceived.length === 0) {
      return { success: false, error: 'PO not found: ' + poNumber };
    }
    
    return { success: true, message: 'Received ' + itemsReceived.length + ' items' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Create a new purchase with line items
 * Updates Raw Materials inventory and logs to Material Log
 */
function createPurchase(purchaseData) {
  try {
    var ss = getBrmSpreadsheet();
    var purchaseSheet = ss.getSheetByName(SHEETS.PURCHASE_LOG);
    if (!purchaseSheet) return { success: false, error: 'Purchase Log sheet not found' };
    
    var user = getCurrentUser();
    var purchaseDate = purchaseData.date ? new Date(purchaseData.date) : new Date();
    var poNumber = purchaseData.poNumber || generatePONumber();
    
    // Get header row (row 4, 0-indexed = 3)
    var data = purchaseSheet.getDataRange().getValues();
    var headerRow = 3; // Row 4 (0-indexed)
    var dataStartRow = 4; // Row 5 (0-indexed)
    
    // Process each line item
    var lineItems = purchaseData.lineItems || [];
    if (lineItems.length === 0) {
      return { success: false, error: 'No line items provided' };
    }
    
    var totalCost = 0;
    var itemsProcessed = [];
    
    for (var i = 0; i < lineItems.length; i++) {
      var item = lineItems[i];
      var material = item.material;
      var qty = parseFloat(item.quantity) || 0;
      var unit = item.unit || 'lb';
      var unitCost = parseFloat(item.unitCost) || 0;
      var itemTotal = qty * unitCost;
      totalCost += itemTotal;
      
      // Determine category from Raw Materials if available
      var category = 'Other';
      var rmResult = getRawMaterialsInventory({ search: material });
      if (rmResult.success && rmResult.materials.length > 0) {
        category = rmResult.materials[0].category || 'Other';
      }
      
      // Append row to Purchase Log
      // Columns: Date, PO Number, Supplier, Item, Category, Qty, Unit, Cost/Unit, Total Cost, Invoice#, Status
      purchaseSheet.appendRow([
        purchaseDate,
        poNumber,
        purchaseData.vendor || '',
        material,
        category,
        qty,
        unit,
        unitCost,
        itemTotal,
        purchaseData.poNumber || '', // Invoice # (same as PO if not separate)
        'Received' // Status - immediately received
      ]);
      
      // Update Raw Materials inventory
      addToRawMaterialInventory(material, qty, unitCost);
      
      itemsProcessed.push({
        material: material,
        quantity: qty,
        unit: unit,
        cost: itemTotal
      });
      
      Logger.log('Purchase line item: ' + qty + ' ' + unit + ' of ' + material + ' @ $' + unitCost + ' = $' + itemTotal);
    }
    
    // Add shipping and tax if provided
    var shipping = parseFloat(purchaseData.shipping) || 0;
    var tax = parseFloat(purchaseData.tax) || 0;
    
    if (shipping > 0 || tax > 0) {
      // Add a line item for shipping/tax if needed
      var grandTotal = totalCost + shipping + tax;
      Logger.log('Purchase total: $' + totalCost + ' + Shipping: $' + shipping + ' + Tax: $' + tax + ' = $' + grandTotal);
    }
    
    // Log to Material Log
    try {
      logMaterialAdjustment('PURCHASE', 0, totalCost, 'Purchase PO: ' + poNumber + ' from ' + (purchaseData.vendor || 'Unknown'), 'PURCHASE');
    } catch (logErr) {
      Logger.log('Warning: Could not log to Material Log: ' + logErr.toString());
    }
    
    return serializeForHtml({
      success: true,
      message: 'Purchase created: ' + itemsProcessed.length + ' items',
      poNumber: poNumber,
      totalCost: totalCost + shipping + tax,
      itemsProcessed: itemsProcessed
    });
    
  } catch (e) {
    Logger.log('Error creating purchase: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * Generate a unique PO number
 */
function generatePONumber() {
  var today = new Date();
  var dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyyMMdd');
  var timestamp = Date.now().toString().slice(-6);
  return 'PO-' + dateStr + '-' + timestamp;
}

/**
 * Get list of vendors from Purchase Log
 */
function getVendors() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.PURCHASE_LOG);
    if (!sheet) return serializeForHtml({ success: true, vendors: [] });
    
    var data = sheet.getDataRange().getValues();
    var vendors = new Set();
    
    // Start from row 5 (0-indexed = 4), column C (Supplier)
    for (var i = 4; i < data.length; i++) {
      var vendor = (data[i][2] || '').toString().trim();
      if (vendor && vendor.length > 0) {
        vendors.add(vendor);
      }
    }
    
    var vendorArray = Array.from(vendors).sort();
    return serializeForHtml({ success: true, vendors: vendorArray });
  } catch (e) {
    Logger.log('Error getting vendors: ' + e.toString());
    return serializeForHtml({ success: false, error: e.toString(), vendors: [] });
  }
}

function addToRawMaterialInventory(itemName, qty, cost) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(RAW_MATERIAL_CONFIG.sheetName);
    if (!sheet) return;
    
    var data = sheet.getDataRange().getValues();
    var cols = RAW_MATERIAL_CONFIG.columns;
    
    for (var i = RAW_MATERIAL_CONFIG.dataStartRow - 1; i < data.length; i++) {
      if (data[i][cols.item - 1] && data[i][cols.item - 1].toString().toLowerCase() === itemName.toLowerCase()) {
        var currentQty = parseFloat(data[i][cols.qtyOnHand - 1]) || 0;
        var currentCost = parseFloat(data[i][cols.avgCost - 1]) || 0;
        
        // Calculate weighted average cost
        var newQty = currentQty + qty;
        var newAvgCost = currentQty > 0 ? ((currentQty * currentCost) + (qty * cost)) / newQty : cost;
        var reorder = parseFloat(data[i][cols.reorderPoint - 1]) || 0;
        
        var status = '✅ OK';
        if (newQty <= 0) status = '🚨 OUT';
        else if (newQty <= reorder) status = '⚠️ REORDER';
        
        sheet.getRange(i + 1, cols.qtyOnHand).setValue(newQty);
        sheet.getRange(i + 1, cols.avgCost).setValue(Math.round(newAvgCost * 100) / 100);
        sheet.getRange(i + 1, cols.totalValue).setValue(Math.round(newQty * newAvgCost * 100) / 100);
        sheet.getRange(i + 1, cols.status).setValue(status);
        sheet.getRange(i + 1, cols.lastPurchase).setValue(new Date());
        
        logMaterialAdjustment(itemName, currentQty, newQty, 'PO Received');
        return;
      }
    }
    
    Logger.log('Item not found in inventory: ' + itemName);
  } catch (e) {
    Logger.log('Error adding to inventory: ' + e.toString());
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10: SALES FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get sales depletion data
 */
function getSalesData(filters) {
  filters = filters || {};
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.SALES_DEPLETION);
    
    if (!sheet) {
      return { success: false, error: 'Sales Depletion sheet not found', sales: [] };
    }
    
    var data = sheet.getDataRange().getValues();
    
    // Sales Depletion Log structure:
    // Row 1: Title
    // Row 2: Instructions
    // Row 3: Empty
    // Row 4: Headers (Date, Invoice #, Customer, Channel, Beer Name, Package, Qty, Sale Price, Revenue, Unit COGS, Total COGS, Gross Profit)
    // Row 5+: Data
    var headerRow = 3; // 0-indexed
    var dataStartRow = 4;
    
    // Column mapping
    var cols = {
      date: 0,        // A
      invoice: 1,     // B
      customer: 2,    // C
      channel: 3,     // D
      beer: 4,        // E
      pkg: 5,         // F
      qty: 6,         // G
      salePrice: 7,   // H
      revenue: 8,     // I
      unitCogs: 9,    // J
      totalCogs: 10,  // K
      grossProfit: 11 // L
    };
    
    var sales = [];
    var now = new Date();
    var ytdRevenue = 0, ytdCOGS = 0, ytdProfit = 0;
    
    for (var i = dataStartRow; i < data.length; i++) {
      var row = data[i];
      if (!row[cols.date] && !row[cols.customer] && !row[cols.beer]) continue;
      
      var revenue = parseFloat(row[cols.revenue]) || 0;
      var cogs = parseFloat(row[cols.totalCogs]) || 0;
      var profit = parseFloat(row[cols.grossProfit]) || (revenue - cogs);
      
      var sale = {
        rowIndex: i + 1,
        date: row[cols.date] || '',
        invoice: row[cols.invoice] || '',
        customer: row[cols.customer] || '',
        channel: row[cols.channel] || '',
        beer: row[cols.beer] || '',
        package: row[cols.pkg] || '',
        qty: parseFloat(row[cols.qty]) || 0,
        salePrice: parseFloat(row[cols.salePrice]) || 0,
        revenue: revenue,
        unitCogs: parseFloat(row[cols.unitCogs]) || 0,
        cogs: cogs,
        profit: profit
      };
      
      var saleDate = new Date(sale.date);
      if (!isNaN(saleDate.getTime()) && saleDate.getFullYear() === now.getFullYear()) {
        ytdRevenue += revenue;
        ytdCOGS += cogs;
        ytdProfit += profit;
      }
      
      // Apply filters
      if (filters.channel && sale.channel !== filters.channel) continue;
      if (filters.customer && !sale.customer.toLowerCase().includes(filters.customer.toLowerCase())) continue;
      if (filters.search) {
        var searchLower = filters.search.toLowerCase();
        if (!sale.customer.toLowerCase().includes(searchLower) &&
            !sale.beer.toLowerCase().includes(searchLower) &&
            !sale.invoice.toLowerCase().includes(searchLower)) continue;
      }
      
      sales.push(sale);
    }
    
    // Sort by date descending
    sales.sort(function(a, b) {
      return new Date(b.date) - new Date(a.date);
    });
    
    var grossMargin = ytdRevenue > 0 ? (ytdProfit / ytdRevenue * 100) : 0;
    
    return serializeForHtml({
      success: true,
      sales: sales,
      summary: {
        totalItems: sales.length,
        ytdRevenue: Math.round(ytdRevenue * 100) / 100,
        ytdCOGS: Math.round(ytdCOGS * 100) / 100,
        ytdProfit: Math.round(ytdProfit * 100) / 100,
        grossMargin: Math.round(grossMargin * 10) / 10
      }
    });
    
  } catch (error) {
    Logger.log('Error in getSalesData: ' + error.toString());
    return { success: false, error: error.toString(), sales: [] };
  }
}

/**
 * Log a B2B sale from CRM
 * Called when CRM completes a delivery/invoice
 * This depletes FG inventory and logs to Sales Depletion
 */
function logB2BSale(saleData) {
  try {
    var ss = getBrmSpreadsheet();
    var salesSheet = ss.getSheetByName(SHEETS.SALES_DEPLETION);
    
    if (!salesSheet) {
      return { success: false, error: 'Sales Depletion sheet not found' };
    }
    
    // Required fields
    if (!saleData.beerName || !saleData.packageType || !saleData.qty) {
      return { success: false, error: 'Missing required fields: beerName, packageType, qty' };
    }
    
    // Deplete from Finished Goods and get COGS
    var depletionResult = depleteB2BInventory(saleData.beerName, saleData.packageType, saleData.qty);
    
    var unitCogs = 0;
    var totalCogs = 0;
    
    if (depletionResult.success) {
      totalCogs = depletionResult.totalCost || 0;
      unitCogs = saleData.qty > 0 ? totalCogs / saleData.qty : 0;
    } else {
      // If depletion failed (insufficient inventory), still log the sale but note the issue
      Logger.log('Warning: FG depletion failed for ' + saleData.beerName + ': ' + depletionResult.message);
    }
    
    // Calculate revenue and profit
    var salePrice = parseFloat(saleData.salePrice) || 0;
    var revenue = salePrice * saleData.qty;
    var grossProfit = revenue - totalCogs;
    
    // Log to Sales Depletion sheet
    // Columns: Date, Invoice #, Customer, Channel, Beer Name, Package, Qty, Sale Price, Revenue, Unit COGS, Total COGS, Gross Profit
    salesSheet.appendRow([
      saleData.date || new Date(),
      saleData.invoice || '',
      saleData.customer || '',
      saleData.channel || 'Wholesale',
      saleData.beerName,
      saleData.packageType,
      saleData.qty,
      salePrice,
      revenue,
      Math.round(unitCogs * 100) / 100,
      Math.round(totalCogs * 100) / 100,
      Math.round(grossProfit * 100) / 100
    ]);
    
    return {
      success: true,
      message: 'Sale logged successfully',
      revenue: revenue,
      cogs: totalCogs,
      profit: grossProfit,
      inventoryDepleted: depletionResult.success
    };
    
  } catch (e) {
    Logger.log('Error logging B2B sale: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * Add manual sale (from BRM UI - rare cases like phone orders)
 */
function addManualSale(data) {
  try {
    // Validate required fields
    if (!data.beer || !data.package || !data.qty) {
      return { success: false, error: 'Beer, package, and quantity are required' };
    }
    
    // Convert to logB2BSale format
    var saleData = {
      date: data.date || new Date(),
      invoice: data.invoice || 'MANUAL-' + Date.now(),
      customer: data.customer || 'Walk-in',
      channel: data.channel || 'Wholesale',
      beerName: data.beer,
      packageType: data.package,
      qty: parseFloat(data.qty) || 0,
      salePrice: parseFloat(data.salePrice) || 0
    };
    
    return logB2BSale(saleData);
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 11: TAPROOM FUNCTIONS (Toast Import)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get taproom sales data for a specific month/year
 */
function getTaproomSalesData(year, month) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.TAPROOM_SALES);
    
    if (!sheet) {
      sheet = setupTaproomSalesSheet();
    }
    
    var data = sheet.getDataRange().getValues();
    
    // New structure: Date, Beer Type, Serving Size, Qty Sold, Revenue, Unit COGS, Total COGS, Margin, Source, Notes
    var cols = {
      date: 0,
      beerType: 1,
      servingSize: 2,
      qty: 3,
      revenue: 4,
      unitCogs: 5,
      totalCogs: 6,
      margin: 7,
      source: 8,
      notes: 9
    };
    
    var sales = [];
    var mtdRevenue = 0, mtdCogs = 0, mtdMargin = 0;
    var ytdRevenue = 0;
    var beerSales = {}; // Track by beer for velocity
    var dayOfWeekTotals = {0:[], 1:[], 2:[], 3:[], 4:[], 5:[], 6:[]};
    var daysWithSales = {};
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var dateVal = row[cols.date];
      if (!dateVal) continue;
      
      var d = new Date(dateVal);
      var rowYear = d.getFullYear();
      var rowMonth = d.getMonth() + 1;
      
      var revenue = parseFloat(row[cols.revenue]) || 0;
      var cogs = parseFloat(row[cols.totalCogs]) || 0;
      var margin = parseFloat(row[cols.margin]) || (revenue - cogs);
      
      if (rowYear === year) ytdRevenue += revenue;
      
      if (rowYear === year && rowMonth === month) {
        mtdRevenue += revenue;
        mtdCogs += cogs;
        mtdMargin += margin;
        
        var dateKey = d.toDateString();
        if (!daysWithSales[dateKey]) {
          daysWithSales[dateKey] = { total: 0, date: d };
        }
        daysWithSales[dateKey].total += revenue;
        
        dayOfWeekTotals[d.getDay()].push(revenue);
        
        // Track beer velocity
        var beerName = row[cols.beerType] || 'Unknown';
        if (!beerSales[beerName]) {
          beerSales[beerName] = { qty: 0, revenue: 0, cogs: 0 };
        }
        beerSales[beerName].qty += parseFloat(row[cols.qty]) || 0;
        beerSales[beerName].revenue += revenue;
        beerSales[beerName].cogs += cogs;
        
        sales.push({
          date: dateVal,
          beerType: beerName,
          servingSize: row[cols.servingSize] || '',
          qty: parseFloat(row[cols.qty]) || 0,
          revenue: revenue,
          unitCogs: parseFloat(row[cols.unitCogs]) || 0,
          totalCogs: cogs,
          margin: margin,
          source: row[cols.source] || ''
        });
      }
    }
    
    // Calculate day of week averages
    var dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var dayOfWeekStats = dayNames.map(function(name, idx) {
      var totals = dayOfWeekTotals[idx];
      var total = totals.length > 0 ? totals.reduce(function(a,b){return a+b;}, 0) : 0;
      return { day: name, total: total, count: totals.length };
    });
    
    var daysCount = Object.keys(daysWithSales).length;
    var avgDaily = daysCount > 0 ? mtdRevenue / daysCount : 0;
    var grossMargin = mtdRevenue > 0 ? (mtdMargin / mtdRevenue * 100) : 0;
    
    // Convert beer sales to array and sort by revenue
    var beerVelocity = Object.keys(beerSales).map(function(beer) {
      return {
        beer: beer,
        qty: beerSales[beer].qty,
        revenue: beerSales[beer].revenue,
        cogs: beerSales[beer].cogs,
        margin: beerSales[beer].revenue - beerSales[beer].cogs
      };
    }).sort(function(a, b) { return b.revenue - a.revenue; });
    
    return serializeForHtml({
      success: true,
      sales: sales,
      summary: {
        mtdRevenue: Math.round(mtdRevenue * 100) / 100,
        ytdRevenue: Math.round(ytdRevenue * 100) / 100,
        avgDaily: Math.round(avgDaily * 100) / 100,
        mtdCogs: Math.round(mtdCogs * 100) / 100,
        mtdMargin: Math.round(mtdMargin * 100) / 100,
        grossMargin: Math.round(grossMargin * 10) / 10,
        daysWithSales: daysCount
      },
      dayOfWeekStats: dayOfWeekStats,
      beerVelocity: beerVelocity.slice(0, 10) // Top 10 beers
    });
    
  } catch (e) {
    return { success: false, error: e.toString(), sales: [] };
  }
}

/**
 * Setup Taproom Sales sheet if it doesn't exist
 */
function setupTaproomSalesSheet() {
  var ss = getBrmSpreadsheet();
  var sheet = ss.insertSheet(SHEETS.TAPROOM_SALES);
  
  // Item-level structure for COGS tracking
  var headers = ['Date', 'Beer Type', 'Serving Size', 'Qty Sold', 'Revenue', 
                 'Unit COGS', 'Total COGS', 'Margin', 'Source', 'Notes'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  
  return sheet;
}

/**
 * Import Toast CSV data
 */
function importToastCSV(csvContent) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.TAPROOM_SALES);
    
    if (!sheet) {
      sheet = setupTaproomSalesSheet();
    }
    
    var lines = csvContent.split('\n');
    var rowsAdded = 0;
    
    // Skip header row
    for (var i = 1; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      
      var values = parseCSVLine(line);
      if (values.length < 2) continue;
      
      // Parse date and values
      var dateStr = values[0];
      var date = new Date(dateStr);
      if (isNaN(date.getTime())) continue;
      
      // Check for duplicate
      var existingData = sheet.getDataRange().getValues();
      var isDuplicate = false;
      for (var j = 1; j < existingData.length; j++) {
        var existingDate = new Date(existingData[j][0]);
        if (existingDate.toDateString() === date.toDateString()) {
          isDuplicate = true;
          break;
        }
      }
      
      if (isDuplicate) continue;
      
      // Add row
      var rowData = [
        date,
        parseFloat(values[1]) || 0,  // Cash
        parseFloat(values[2]) || 0,  // Card
        parseFloat(values[3]) || 0,  // Gift Card Redeemed
        parseFloat(values[4]) || 0,  // Net Sales
        parseFloat(values[5]) || 0,  // Merchandise
        parseFloat(values[6]) || 0,  // Sales Tax
        parseFloat(values[7]) || 0,  // Tips
        parseFloat(values[8]) || 0,  // Merchant Fees
        parseFloat(values[9]) || 0,  // Discounts
        parseFloat(values[10]) || 0, // Gift Cards Sold
        parseFloat(values[11]) || 0  // Gross Receipts
      ];
      
      sheet.appendRow(rowData);
      rowsAdded++;
    }
    
    return { success: true, rowsAdded: rowsAdded };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function parseCSVLine(line) {
  var result = [];
  var current = '';
  var inQuotes = false;
  
  for (var i = 0; i < line.length; i++) {
    var char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Add manual taproom entry
 */
function addTaproomSalesEntry(entry) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.TAPROOM_SALES);
    
    if (!sheet) return { success: false, error: 'Taproom Sales sheet not found' };
    if (!entry.date) return { success: false, error: 'Date is required' };
    
    var date = new Date(entry.date);
    
    // Check for existing entry on same date
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var existingDate = new Date(data[i][0]);
      if (existingDate.toDateString() === date.toDateString()) {
        // Update existing row
        var rowNum = i + 1;
        sheet.getRange(rowNum, 2).setValue(parseFloat(entry.cash) || 0);
        sheet.getRange(rowNum, 3).setValue(parseFloat(entry.card) || 0);
        sheet.getRange(rowNum, 7).setValue(parseFloat(entry.salesTax) || 0);
        sheet.getRange(rowNum, 8).setValue(parseFloat(entry.tips) || 0);
        sheet.getRange(rowNum, 9).setValue(parseFloat(entry.merchantFees) || 0);
        return { success: true, message: 'Entry updated' };
      }
    }
    
    // Add new row
    sheet.appendRow([
      date,
      parseFloat(entry.cash) || 0,
      parseFloat(entry.card) || 0,
      0,  // Gift Card Redeemed
      (parseFloat(entry.cash) || 0) + (parseFloat(entry.card) || 0),
      0,  // Merchandise
      parseFloat(entry.salesTax) || 0,
      parseFloat(entry.tips) || 0,
      parseFloat(entry.merchantFees) || 0,
      0,  // Discounts
      0,  // Gift Cards Sold
      0   // Gross Receipts
    ]);
    
    return { success: true, message: 'Entry added' };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Delete taproom entry
 */
function deleteTaproomSalesEntry(dateStr) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.TAPROOM_SALES);
    if (!sheet) return { success: false, error: 'Sheet not found' };
    
    var targetDate = new Date(dateStr);
    var data = sheet.getDataRange().getValues();
    
    for (var i = 1; i < data.length; i++) {
      var rowDate = new Date(data[i][0]);
      if (rowDate.toDateString() === targetDate.toDateString()) {
        sheet.deleteRow(i + 1);
        return { success: true, message: 'Entry deleted' };
      }
    }
    
    return { success: false, error: 'Entry not found' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 11B: TAPPED KEGS & SERVING VESSELS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all tapped kegs currently serving in taproom
 */
function getTappedKegs() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.TAPPED_KEGS);
    
    if (!sheet) {
      return { success: false, error: 'Tapped Kegs sheet not found', kegs: [] };
    }
    
    var data = sheet.getDataRange().getValues();
    // Tapped Kegs: Keg ID, Beer Type, Product Type, Source Batch, Tapped Date, Pints Remaining, Cost Per Pint, Status
    var kegs = [];
    var totalPints = 0;
    var totalValue = 0;
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue; // Skip empty rows
      
      var pintsRemaining = parseFloat(row[5]) || 0;
      var costPerPint = parseFloat(row[6]) || 0;
      
      var keg = {
        rowIndex: i + 1,
        kegId: row[0] || '',
        beerType: row[1] || '',
        productType: row[2] || '',
        sourceBatch: row[3] || '',
        tappedDate: row[4] || '',
        pintsRemaining: pintsRemaining,
        costPerPint: costPerPint,
        status: row[7] || 'Active',
        value: pintsRemaining * costPerPint
      };
      
      if (keg.status !== 'Kicked' && keg.status !== 'Empty') {
        totalPints += pintsRemaining;
        totalValue += keg.value;
      }
      
      kegs.push(keg);
    }
    
    return serializeForHtml({
      success: true,
      kegs: kegs,
      summary: {
        totalKegs: kegs.filter(function(k) { return k.status !== 'Kicked'; }).length,
        totalPints: totalPints,
        totalValue: Math.round(totalValue * 100) / 100
      }
    });
    
  } catch (e) {
    return { success: false, error: e.toString(), kegs: [] };
  }
}

/**
 * Tap a keg - move from Finished Goods to Tapped Kegs
 */
function tapKeg(beerName, packageType, sourceBatch) {
  try {
    var ss = getBrmSpreadsheet();
    
    // Calculate pints based on package type
    var pintsPerKeg = {
      '1/2 BBL Keg': 124,  // 15.5 gal × 8 pints/gal
      '1/6 BBL Keg': 41,   // 5.17 gal × 8 pints/gal
      '1/4 BBL Keg': 62    // 7.75 gal × 8 pints/gal
    };
    
    var pints = pintsPerKeg[packageType] || 124;
    
    // Get cost per pint from Floor Pricing
    var costPerPint = getCostPerPint(beerName);
    
    // Deplete from Finished Goods
    var fgResult = depleteB2BInventory(beerName, packageType, 1);
    if (!fgResult.success) {
      return { success: false, error: 'Could not deplete from Finished Goods: ' + fgResult.message };
    }
    
    // Add to Tapped Kegs
    var tappedSheet = ss.getSheetByName(SHEETS.TAPPED_KEGS);
    if (!tappedSheet) {
      return { success: false, error: 'Tapped Kegs sheet not found' };
    }
    
    // Generate Keg ID
    var kegId = 'TK-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
    
    tappedSheet.appendRow([
      kegId,
      beerName,
      packageType,
      sourceBatch || '',
      new Date(),
      pints,
      costPerPint,
      'Active'
    ]);
    
    return {
      success: true,
      message: beerName + ' tapped successfully',
      kegId: kegId,
      pints: pints,
      costPerPint: costPerPint
    };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Get cost per pint from Floor Pricing
 */
function getCostPerPint(beerName) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.FLOOR_PRICING);
    
    if (!sheet) return 0;
    
    var data = sheet.getDataRange().getValues();
    
    // Floor Pricing structure - find the beer and get pint cost
    for (var i = 1; i < data.length; i++) {
      var rowBeer = (data[i][0] || '').toString().toLowerCase();
      if (rowBeer === beerName.toLowerCase()) {
        // Assume cost per pint is in a specific column - adjust as needed
        // For now, calculate from COGS per BBL
        var cogsPerBbl = parseFloat(data[i][2]) || 0; // Adjust column index
        return cogsPerBbl / 248; // 248 pints per BBL (31 gal × 8 pints)
      }
    }
    
    // Fallback: calculate from Beer COGS Master
    var cogsSheet = ss.getSheetByName(SHEETS.BEER_COGS_MASTER);
    if (cogsSheet) {
      var cogsData = cogsSheet.getDataRange().getValues();
      for (var j = 1; j < cogsData.length; j++) {
        if ((cogsData[j][0] || '').toString().toLowerCase() === beerName.toLowerCase()) {
          var cogsPerBbl = parseFloat(cogsData[j][8]) || 0; // COGS Per BBL column
          return cogsPerBbl / 248;
        }
      }
    }
    
    return 0.50; // Default fallback
    
  } catch (e) {
    Logger.log('Error getting cost per pint: ' + e.toString());
    return 0.50;
  }
}

/**
 * Record taproom sale (deplete from tapped keg)
 */
function recordTaproomPintSale(beerName, servingSize, quantity, revenue) {
  try {
    var ss = getBrmSpreadsheet();
    
    // Convert serving size to pints
    var pintsPerServing = {
      'Pint': 1,
      '1/2 Pint': 0.5,
      'Flight': 0.25,  // Typically 4oz
      'Taster': 0.25,
      'Growler': 4,    // 64oz = 4 pints
      'Crowler': 2     // 32oz = 2 pints
    };
    
    var pintsUsed = (pintsPerServing[servingSize] || 1) * quantity;
    
    // Find the tapped keg for this beer and deplete
    var tappedSheet = ss.getSheetByName(SHEETS.TAPPED_KEGS);
    if (!tappedSheet) {
      return { success: false, error: 'Tapped Kegs sheet not found' };
    }
    
    var data = tappedSheet.getDataRange().getValues();
    var costPerPint = 0;
    var depleted = false;
    
    for (var i = 1; i < data.length; i++) {
      var rowBeer = (data[i][1] || '').toString().toLowerCase();
      var status = data[i][7] || '';
      var pintsRemaining = parseFloat(data[i][5]) || 0;
      
      if (rowBeer === beerName.toLowerCase() && status === 'Active' && pintsRemaining > 0) {
        costPerPint = parseFloat(data[i][6]) || 0;
        var newPints = Math.max(0, pintsRemaining - pintsUsed);
        
        tappedSheet.getRange(i + 1, 6).setValue(newPints); // Update pints remaining
        
        // Update status if kicked
        if (newPints <= 0) {
          tappedSheet.getRange(i + 1, 8).setValue('Kicked');
        }
        
        depleted = true;
        break;
      }
    }
    
    // Also try serving vessels if not found in tapped kegs
    if (!depleted) {
      var vesselResult = depleteFromServingVessel(beerName, pintsUsed);
      if (vesselResult.success) {
        costPerPint = vesselResult.costPerPint;
        depleted = true;
      }
    }
    
    var totalCogs = costPerPint * pintsUsed;
    var margin = revenue - totalCogs;
    
    // Log to Taproom Sales
    var salesSheet = ss.getSheetByName(SHEETS.TAPROOM_SALES);
    if (salesSheet) {
      // New structure: Date, Beer Type, Serving Size, Qty Sold, Revenue, Unit COGS, Total COGS, Margin, Source
      salesSheet.appendRow([
        new Date(),
        beerName,
        servingSize,
        quantity,
        revenue,
        costPerPint,
        totalCogs,
        margin,
        'Toast'
      ]);
    }
    
    return {
      success: true,
      pintsUsed: pintsUsed,
      cogs: totalCogs,
      margin: margin,
      depleted: depleted
    };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Get serving vessels status
 */
function getServingVessels() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.SERVING_VESSELS);
    
    if (!sheet) {
      return { success: false, error: 'Serving Vessels sheet not found', vessels: [] };
    }
    
    var data = sheet.getDataRange().getValues();
    // Serving Vessels: Vessel ID, Vessel Name, Size (BBL), Beer Type, Source Batch, Filled Date, Pints Remaining, Cost Per Pint, Status
    var vessels = [];
    var totalPints = 0;
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue;
      
      var pintsRemaining = parseFloat(row[6]) || 0;
      
      var vessel = {
        rowIndex: i + 1,
        vesselId: row[0] || '',
        vesselName: row[1] || '',
        sizeBbl: parseFloat(row[2]) || 0,
        beerType: row[3] || '',
        sourceBatch: row[4] || '',
        filledDate: row[5] || '',
        pintsRemaining: pintsRemaining,
        costPerPint: parseFloat(row[7]) || 0,
        status: row[8] || 'Empty'
      };
      
      if (vessel.status !== 'Empty') {
        totalPints += pintsRemaining;
      }
      
      vessels.push(vessel);
    }
    
    return serializeForHtml({
      success: true,
      vessels: vessels,
      summary: {
        totalVessels: vessels.length,
        activeVessels: vessels.filter(function(v) { return v.status !== 'Empty'; }).length,
        totalPints: totalPints
      }
    });
    
  } catch (e) {
    return { success: false, error: e.toString(), vessels: [] };
  }
}

/**
 * Fill a serving vessel
 */
function fillServingVessel(vesselId, beerName, sourceBatch) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.SERVING_VESSELS);
    
    if (!sheet) {
      return { success: false, error: 'Serving Vessels sheet not found' };
    }
    
    var data = sheet.getDataRange().getValues();
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === vesselId) {
        var sizeBbl = parseFloat(data[i][2]) || 7; // Default 7 BBL
        var pints = sizeBbl * 248; // 248 pints per BBL
        var costPerPint = getCostPerPint(beerName);
        
        // Update the row
        sheet.getRange(i + 1, 4).setValue(beerName);      // Beer Type
        sheet.getRange(i + 1, 5).setValue(sourceBatch);   // Source Batch
        sheet.getRange(i + 1, 6).setValue(new Date());    // Filled Date
        sheet.getRange(i + 1, 7).setValue(pints);         // Pints Remaining
        sheet.getRange(i + 1, 8).setValue(costPerPint);   // Cost Per Pint
        sheet.getRange(i + 1, 9).setValue('Active');      // Status
        
        return {
          success: true,
          message: vesselId + ' filled with ' + beerName,
          pints: pints,
          costPerPint: costPerPint
        };
      }
    }
    
    return { success: false, error: 'Vessel not found: ' + vesselId };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Deplete from serving vessel
 */
function depleteFromServingVessel(beerName, pints) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.SERVING_VESSELS);
    
    if (!sheet) return { success: false };
    
    var data = sheet.getDataRange().getValues();
    
    for (var i = 1; i < data.length; i++) {
      var rowBeer = (data[i][3] || '').toString().toLowerCase();
      var status = data[i][8] || '';
      var pintsRemaining = parseFloat(data[i][6]) || 0;
      
      if (rowBeer === beerName.toLowerCase() && status === 'Active' && pintsRemaining > 0) {
        var costPerPint = parseFloat(data[i][7]) || 0;
        var newPints = Math.max(0, pintsRemaining - pints);
        
        sheet.getRange(i + 1, 7).setValue(newPints);
        
        if (newPints <= 0) {
          sheet.getRange(i + 1, 9).setValue('Empty');
        }
        
        return { success: true, costPerPint: costPerPint };
      }
    }
    
    return { success: false };
    
  } catch (e) {
    return { success: false };
  }
}

/**
 * Generate daily QB journal entry for taproom sales
 */
function generateDailyTaproomJournal(dateStr) {
  try {
    var date = dateStr ? new Date(dateStr) : new Date();
    var ss = getBrmSpreadsheet();
    
    // Get taproom sales for the day
    var salesSheet = ss.getSheetByName(SHEETS.TAPROOM_SALES);
    if (!salesSheet) {
      return { success: false, error: 'Taproom Sales sheet not found' };
    }
    
    var data = salesSheet.getDataRange().getValues();
    var dayRevenue = 0;
    var dayCogs = 0;
    
    for (var i = 1; i < data.length; i++) {
      var rowDate = new Date(data[i][0]);
      if (rowDate.toDateString() === date.toDateString()) {
        dayRevenue += parseFloat(data[i][4]) || 0; // Revenue column
        dayCogs += parseFloat(data[i][6]) || 0;    // Total COGS column
      }
    }
    
    if (dayRevenue === 0 && dayCogs === 0) {
      return { success: false, error: 'No sales found for ' + date.toDateString() };
    }
    
    // Get QB Journal Export sheet
    var qbSheet = ss.getSheetByName(SHEETS.QB_JOURNAL_EXPORT);
    if (!qbSheet) {
      return { success: false, error: 'QB Journal Export sheet not found' };
    }
    
    var dateFormatted = Utilities.formatDate(date, Session.getScriptTimeZone(), 'MM/dd/yyyy');
    
    // Add journal entry rows
    // Entry: Taproom Sales for [date]
    var lastRow = qbSheet.getLastRow() + 2; // Leave a blank row
    
    // Revenue entry
    qbSheet.getRange(lastRow, 1).setValue(dateFormatted);
    qbSheet.getRange(lastRow, 2).setValue('1000 - Cash/Card');
    qbSheet.getRange(lastRow, 3).setValue(dayRevenue); // Debit
    qbSheet.getRange(lastRow, 4).setValue('');         // Credit
    qbSheet.getRange(lastRow, 5).setValue('Taproom sales ' + dateFormatted);
    
    lastRow++;
    qbSheet.getRange(lastRow, 1).setValue(dateFormatted);
    qbSheet.getRange(lastRow, 2).setValue('4000 - Taproom Sales');
    qbSheet.getRange(lastRow, 3).setValue('');         // Debit
    qbSheet.getRange(lastRow, 4).setValue(dayRevenue); // Credit
    qbSheet.getRange(lastRow, 5).setValue('Taproom revenue');
    
    // COGS entry
    lastRow++;
    qbSheet.getRange(lastRow, 1).setValue(dateFormatted);
    qbSheet.getRange(lastRow, 2).setValue('5000 - Cost of Goods Sold');
    qbSheet.getRange(lastRow, 3).setValue(dayCogs);    // Debit
    qbSheet.getRange(lastRow, 4).setValue('');         // Credit
    qbSheet.getRange(lastRow, 5).setValue('Taproom COGS');
    
    lastRow++;
    qbSheet.getRange(lastRow, 1).setValue(dateFormatted);
    qbSheet.getRange(lastRow, 2).setValue('1420 - Finished Goods Inventory');
    qbSheet.getRange(lastRow, 3).setValue('');         // Debit
    qbSheet.getRange(lastRow, 4).setValue(dayCogs);    // Credit
    qbSheet.getRange(lastRow, 5).setValue('FG depleted');
    
    return {
      success: true,
      message: 'Journal entry created for ' + dateFormatted,
      revenue: dayRevenue,
      cogs: dayCogs,
      profit: dayRevenue - dayCogs
    };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Parse Toast CSV with item-level detail
 * Expected columns: Date, Item Name, Category, Qty Sold, Gross Sales, Discounts, Net Sales
 */
function parseToastItemReport(csvContent) {
  try {
    var lines = csvContent.split('\n');
    if (lines.length < 2) {
      return { success: false, error: 'Empty or invalid CSV' };
    }
    
    var headers = parseCSVLine(lines[0]);
    var items = [];
    
    // Map header indices
    var cols = {
      date: findCSVColumn(headers, 'date', 'business date'),
      item: findCSVColumn(headers, 'item', 'menu item', 'product'),
      category: findCSVColumn(headers, 'category'),
      qty: findCSVColumn(headers, 'qty', 'quantity', 'count'),
      gross: findCSVColumn(headers, 'gross', 'gross sales'),
      discounts: findCSVColumn(headers, 'discount'),
      net: findCSVColumn(headers, 'net', 'net sales')
    };
    
    for (var i = 1; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      
      var values = parseCSVLine(line);
      
      var item = {
        date: values[cols.date] || '',
        itemName: values[cols.item] || '',
        category: values[cols.category] || '',
        qty: parseFloat(values[cols.qty]) || 0,
        grossSales: parseFloat(values[cols.gross]) || 0,
        discounts: parseFloat(values[cols.discounts]) || 0,
        netSales: parseFloat(values[cols.net]) || 0
      };
      
      // Only include beer items (filter by category if available)
      if (item.category.toLowerCase().includes('beer') || 
          item.category.toLowerCase().includes('draft') ||
          !item.category) {
        items.push(item);
      }
    }
    
    return { success: true, items: items };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Helper to find column in CSV headers
 */
function findCSVColumn(headers, ...searchTerms) {
  for (var i = 0; i < headers.length; i++) {
    var h = headers[i].toString().toLowerCase();
    for (var j = 0; j < searchTerms.length; j++) {
      if (h.includes(searchTerms[j])) return i;
    }
  }
  return -1;
}

/**
 * Import Toast item report and process sales
 */
function importToastItemReport(csvContent) {
  try {
    var parsed = parseToastItemReport(csvContent);
    if (!parsed.success) {
      return parsed;
    }
    
    var results = {
      processed: 0,
      skipped: 0,
      totalRevenue: 0,
      totalCogs: 0,
      errors: []
    };
    
    // Map Toast item names to beer names (you may need to customize this mapping)
    var itemToBeerMap = {
      // Example mappings - these should match your Toast menu items
      'West Coast IPA - Pint': { beer: 'West Coast IPA', size: 'Pint' },
      'Hazy IPA - Pint': { beer: 'Hazy IPA', size: 'Pint' },
      'Belgian Wit - Pint': { beer: 'Belgian Wit', size: 'Pint' }
      // Add more mappings as needed
    };
    
    for (var i = 0; i < parsed.items.length; i++) {
      var item = parsed.items[i];
      
      // Try to extract beer name and serving size from item name
      var beerInfo = extractBeerFromItemName(item.itemName);
      
      if (beerInfo.beer) {
        var saleResult = recordTaproomPintSale(
          beerInfo.beer,
          beerInfo.size,
          item.qty,
          item.netSales
        );
        
        if (saleResult.success) {
          results.processed++;
          results.totalRevenue += item.netSales;
          results.totalCogs += saleResult.cogs || 0;
        } else {
          results.skipped++;
          results.errors.push(item.itemName + ': ' + saleResult.error);
        }
      } else {
        results.skipped++;
      }
    }
    
    return {
      success: true,
      results: results,
      message: 'Processed ' + results.processed + ' items, skipped ' + results.skipped
    };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Extract beer name and serving size from Toast item name
 */
function extractBeerFromItemName(itemName) {
  // Common patterns: "Beer Name - Pint", "Beer Name (16oz)", "Pint - Beer Name"
  var servingSizes = ['Pint', '1/2 Pint', 'Half Pint', 'Flight', 'Taster', 'Growler', 'Crowler', '16oz', '12oz', '10oz', '5oz'];
  
  var name = itemName || '';
  var size = 'Pint'; // Default
  var beer = name;
  
  // Try to extract serving size
  for (var i = 0; i < servingSizes.length; i++) {
    var pattern = new RegExp(servingSizes[i], 'i');
    if (pattern.test(name)) {
      size = servingSizes[i];
      // Remove the size from the name
      beer = name.replace(pattern, '').replace(/[-–—]/g, ' ').replace(/[()]/g, '').trim();
      break;
    }
  }
  
  // Normalize size
  if (size === '16oz') size = 'Pint';
  if (size === '10oz' || size === 'Half Pint') size = '1/2 Pint';
  if (size === '5oz' || size === '12oz') size = 'Taster';
  
  return { beer: beer.trim(), size: size };
}

/**
 * Update Taproom Sales sheet to new structure
 * Run this once to migrate the sheet
 */
function updateTaproomSalesStructure() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.TAPROOM_SALES);
    
    if (!sheet) {
      // Create new sheet with correct structure
      sheet = setupTaproomSalesSheet();
      return { success: true, message: 'Created new Taproom Sales sheet with correct structure' };
    }
    
    // Check if already in new format
    var headers = sheet.getRange(1, 1, 1, 10).getValues()[0];
    if (headers[1] === 'Beer Type') {
      return { success: true, message: 'Sheet already in correct format' };
    }
    
    // Clear and set new headers
    sheet.clear();
    var newHeaders = ['Date', 'Beer Type', 'Serving Size', 'Qty Sold', 'Revenue', 
                      'Unit COGS', 'Total COGS', 'Margin', 'Source', 'Notes'];
    sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
    sheet.getRange(1, 1, 1, newHeaders.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    
    // Format columns
    sheet.setColumnWidth(1, 100);  // Date
    sheet.setColumnWidth(2, 180);  // Beer Type
    sheet.setColumnWidth(3, 100);  // Serving Size
    sheet.setColumnWidth(4, 80);   // Qty
    sheet.setColumnWidth(5, 100);  // Revenue
    sheet.setColumnWidth(6, 90);   // Unit COGS
    sheet.setColumnWidth(7, 100);  // Total COGS
    sheet.setColumnWidth(8, 100);  // Margin
    sheet.setColumnWidth(9, 80);   // Source
    sheet.setColumnWidth(10, 150); // Notes
    
    return { success: true, message: 'Taproom Sales sheet updated to new structure' };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Import Toast Sales Summary Excel file
 * Handles the multi-tab Excel format Toast provides
 */
function importToastExcel(fileBlob) {
  try {
    // This function would be called from the UI when file is uploaded
    // The actual Excel parsing happens client-side, then data is passed here
    
    return { 
      success: false, 
      error: 'Excel files must be parsed client-side. Use importToastData() with parsed data.' 
    };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Import parsed Toast data (from Order Details tab)
 * Called after client-side parsing of Toast Excel
 * 
 * Expected data format:
 * {
 *   date: '2025-12-05',
 *   items: [
 *     { menuItem: 'Cinnamon Roll stout', menuGroup: 'Draft', qty: 24, netAmount: 198 },
 *     ...
 *   ]
 * }
 */
function importToastData(toastData) {
  try {
    if (!toastData || !toastData.items || !toastData.date) {
      return { success: false, error: 'Invalid data format. Expected {date, items[]}' };
    }
    
    var ss = getBrmSpreadsheet();
    var salesSheet = ss.getSheetByName(SHEETS.TAPROOM_SALES);
    
    if (!salesSheet) {
      salesSheet = setupTaproomSalesSheet();
    }
    
    var date = new Date(toastData.date);
    var results = {
      processed: 0,
      skipped: 0,
      totalRevenue: 0,
      totalCogs: 0,
      byBeer: {}
    };
    
    // Menu groups that are beer-related
    var beerGroups = ['Draft', '6 Packs', 'KEGS', 'Crowler', 'Flight', 'TO-GO Beer'];
    
    // Process each item
    for (var i = 0; i < toastData.items.length; i++) {
      var item = toastData.items[i];
      
      // Check if this is a beer item
      var isBeer = beerGroups.some(function(g) {
        return (item.menuGroup || '').toLowerCase().includes(g.toLowerCase());
      });
      
      if (!isBeer) {
        results.skipped++;
        continue;
      }
      
      // Determine serving size based on menu group
      var servingSize = 'Pint';
      var beerName = item.menuItem;
      var pintsPerUnit = 1;
      
      if (item.menuGroup === '6 Packs') {
        servingSize = '6-Pack';
        pintsPerUnit = 4.5; // Approximately 72oz = 4.5 pints
        // Extract beer name from "6pk - Beer Name" format
        beerName = beerName.replace(/^6pk\s*-?\s*/i, '').trim();
      } else if (item.menuGroup === 'KEGS') {
        if (beerName.includes('1/6 BBL')) {
          servingSize = '1/6 BBL Keg';
          pintsPerUnit = 41;
          beerName = beerName.replace(/^1\/6 BBL\s*/i, '').trim();
        } else if (beerName.includes('1/2 BBL')) {
          servingSize = '1/2 BBL Keg';
          pintsPerUnit = 124;
          beerName = beerName.replace(/^1\/2 BBL\s*/i, '').trim();
        } else if (beerName.includes('Deposit') || beerName.includes('Pump')) {
          results.skipped++;
          continue; // Skip deposits
        }
      } else if (item.menuGroup === 'Crowler') {
        servingSize = 'Crowler';
        pintsPerUnit = 2;
        beerName = beerName.replace(/^CRW\s*-?\s*/i, '').trim();
      } else if (item.menuGroup === 'Flight') {
        servingSize = 'Flight';
        pintsPerUnit = 0.25;
      }
      
      // Clean up beer name - remove ABV/IBU info in parentheses
      beerName = beerName.replace(/\s*\([^)]*%[^)]*\)/g, '').trim();
      
      var qty = parseFloat(item.qty) || 0;
      var revenue = parseFloat(item.netAmount) || 0;
      
      // Get cost per pint from Floor Pricing
      var costPerPint = getCostPerPint(beerName);
      var totalPints = qty * pintsPerUnit;
      var totalCogs = costPerPint * totalPints;
      var margin = revenue - totalCogs;
      
      // Log to Taproom Sales
      salesSheet.appendRow([
        date,
        beerName,
        servingSize,
        qty,
        revenue,
        costPerPint,
        totalCogs,
        margin,
        'Toast',
        ''
      ]);
      
      // Track results
      results.processed++;
      results.totalRevenue += revenue;
      results.totalCogs += totalCogs;
      
      if (!results.byBeer[beerName]) {
        results.byBeer[beerName] = { qty: 0, revenue: 0, cogs: 0, pints: 0 };
      }
      results.byBeer[beerName].qty += qty;
      results.byBeer[beerName].revenue += revenue;
      results.byBeer[beerName].cogs += totalCogs;
      results.byBeer[beerName].pints += totalPints;
    }
    
    // Deplete from tapped kegs
    for (var beer in results.byBeer) {
      var pints = results.byBeer[beer].pints;
      if (pints > 0) {
        depleteFromTappedKeg(beer, pints);
      }
    }
    
    // Generate daily QB journal entry
    generateDailyTaproomJournal(toastData.date);
    
    return {
      success: true,
      message: 'Imported ' + results.processed + ' items, skipped ' + results.skipped,
      date: toastData.date,
      totalRevenue: Math.round(results.totalRevenue * 100) / 100,
      totalCogs: Math.round(results.totalCogs * 100) / 100,
      margin: Math.round((results.totalRevenue - results.totalCogs) * 100) / 100,
      byBeer: results.byBeer
    };
    
  } catch (e) {
    Logger.log('Error importing Toast data: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * Deplete pints from a tapped keg
 */
function depleteFromTappedKeg(beerName, pints) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.TAPPED_KEGS);
    
    if (!sheet) return { success: false };
    
    var data = sheet.getDataRange().getValues();
    var remaining = pints;
    
    for (var i = 1; i < data.length && remaining > 0; i++) {
      var rowBeer = (data[i][1] || '').toString().toLowerCase();
      var status = (data[i][7] || '').toString();
      var pintsRemaining = parseFloat(data[i][5]) || 0;
      
      // Fuzzy match on beer name
      if (rowBeer.includes(beerName.toLowerCase()) || 
          beerName.toLowerCase().includes(rowBeer)) {
        
        if (status !== 'Kicked' && status !== 'Empty' && pintsRemaining > 0) {
          var toDeplete = Math.min(pintsRemaining, remaining);
          var newPints = pintsRemaining - toDeplete;
          
          sheet.getRange(i + 1, 6).setValue(newPints);
          
          if (newPints <= 0) {
            sheet.getRange(i + 1, 8).setValue('Kicked');
          }
          
          remaining -= toDeplete;
        }
      }
    }
    
    // Also try serving vessels
    if (remaining > 0) {
      depleteFromServingVessel(beerName, remaining);
    }
    
    return { success: true, depleted: pints - remaining };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Get Toast import summary for a date range
 */
function getToastImportHistory(startDate, endDate) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.TAPROOM_SALES);
    
    if (!sheet) return { success: false, error: 'Sheet not found', days: [] };
    
    var data = sheet.getDataRange().getValues();
    var start = new Date(startDate);
    var end = new Date(endDate);
    var dayTotals = {};
    
    for (var i = 1; i < data.length; i++) {
      var rowDate = new Date(data[i][0]);
      if (rowDate >= start && rowDate <= end && data[i][8] === 'Toast') {
        var dateKey = rowDate.toDateString();
        
        if (!dayTotals[dateKey]) {
          dayTotals[dateKey] = { date: rowDate, revenue: 0, cogs: 0, items: 0 };
        }
        
        dayTotals[dateKey].revenue += parseFloat(data[i][4]) || 0;
        dayTotals[dateKey].cogs += parseFloat(data[i][6]) || 0;
        dayTotals[dateKey].items++;
      }
    }
    
    var days = Object.values(dayTotals).sort(function(a, b) {
      return b.date - a.date;
    });
    
    return { success: true, days: days };
    
  } catch (e) {
    return { success: false, error: e.toString(), days: [] };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 12: BEER COGS FUNCTIONS (Including MISSING getBeerCOGSData!)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET BEER COGS DATA - This function was MISSING and broke the Beer COGS tab!
 * Reads from Beer COGS Master sheet
 */
function getBeerCOGSData() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.BEER_COGS_MASTER);
    
    if (!sheet) {
      return { success: false, error: 'Beer COGS Master sheet not found', beers: [] };
    }
    
    var data = sheet.getDataRange().getValues();
    var beers = [];
    
    // Column mapping based on actual sheet structure:
    // Beer Name | Batch Size (BBL) | Yield % | Expected Yield (BBL) | Ingredient COGS | 
    // Brewing Labor | Packaging Labor | Total COGS | COGS Per BBL | Last Updated
    var cols = {
      beerName: 0,
      batchSize: 1,
      yieldPct: 2,
      expectedYield: 3,
      ingredientCost: 4,
      brewingLabor: 5,
      packagingLabor: 6,
      totalCost: 7,
      cogsPerBBL: 8,
      lastUpdated: 9
    };
    
    // Get Floor Pricing for margin calculation
    var floorPrices = {};
    var floorSheet = ss.getSheetByName(SHEETS.FLOOR_PRICING);
    if (floorSheet) {
      var floorData = floorSheet.getDataRange().getValues();
      for (var f = 1; f < floorData.length; f++) {
        var beerName = (floorData[f][0] || '').toString().toLowerCase().trim();
        // Floor price per BBL is typically in column with "Floor" or "Price" header
        var floorPrice = parseFloat(floorData[f][2]) || parseFloat(floorData[f][3]) || 0;
        if (beerName && floorPrice > 0) {
          floorPrices[beerName] = floorPrice;
        }
      }
    }
    
    // Get Labor Config info
    var laborResult = getLaborCostPerBatch();
    var laborPerBatch = laborResult.totalLabor || laborResult.brewingLabor || 3897.26;
    
    var lowestCOGS = Infinity, highestCOGS = 0, totalCOGS = 0;
    var lowestBeer = '', highestBeer = '';
    var beerCount = 0;
    
    // Skip patterns for non-beer rows
    var skipPatterns = ['labor source', 'brewing labor', 'packaging labor', 'total labor', 'overhead'];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var beerName = (row[cols.beerName] || '').toString().trim();
      
      // Skip empty rows
      if (!beerName || beerName === '') continue;
      
      // Skip non-beer rows (Labor Source section, etc.)
      var shouldSkip = skipPatterns.some(function(pattern) {
        return beerName.toLowerCase().includes(pattern);
      });
      if (shouldSkip) continue;
      
      // Skip if no numeric data in batch size column (indicates non-data row)
      var batchSize = parseFloat(row[cols.batchSize]);
      if (isNaN(batchSize) || batchSize <= 0) continue;
      
      var cogsPerBBL = parseFloat(row[cols.cogsPerBBL]) || 0;
      var ingredientCost = parseFloat(row[cols.ingredientCost]) || 0;
      var yieldPct = parseFloat(row[cols.yieldPct]) || 95;
      
      // Normalize yield % if stored as whole number
      if (yieldPct > 1) yieldPct = yieldPct / 100;
      
      // Look up floor price
      var floorPrice = floorPrices[beerName.toLowerCase()] || 0;
      var margin = floorPrice > 0 ? ((floorPrice - cogsPerBBL) / floorPrice * 100) : 0;
      
      var beer = {
        beer: beerName,
        recipeName: beerName,
        batchSize: batchSize,
        yieldPct: yieldPct,
        yieldPctDisplay: Math.round(yieldPct * 100) + '%',
        expectedYield: parseFloat(row[cols.expectedYield]) || (batchSize * yieldPct),
        ingredientCost: ingredientCost,
        laborCost: (parseFloat(row[cols.brewingLabor]) || 0) + (parseFloat(row[cols.packagingLabor]) || 0),
        brewingLabor: parseFloat(row[cols.brewingLabor]) || 0,
        packagingLabor: parseFloat(row[cols.packagingLabor]) || 0,
        totalCost: parseFloat(row[cols.totalCost]) || 0,
        cogsPerBBL: cogsPerBBL,
        floorPrice: floorPrice,
        margin: Math.round(margin * 10) / 10,
        lastUpdated: row[cols.lastUpdated] ? row[cols.lastUpdated].toString() : ''
      };
      
      if (cogsPerBBL > 0) {
        beerCount++;
        if (cogsPerBBL < lowestCOGS) {
          lowestCOGS = cogsPerBBL;
          lowestBeer = beerName;
        }
        if (cogsPerBBL > highestCOGS) {
          highestCOGS = cogsPerBBL;
          highestBeer = beerName;
        }
        totalCOGS += cogsPerBBL;
      }
      
      beers.push(beer);
    }
    
    var avgCOGS = beerCount > 0 ? totalCOGS / beerCount : 0;
    
    // Generate cost reduction recommendations
    var recommendations = generateCOGSRecommendations(beers, avgCOGS);
    
    // Ensure clean serialization for HTML callback
    var result = {
      success: true,
      beers: beers,
      summary: {
        beerCount: beerCount,
        lowestCOGS: lowestCOGS === Infinity ? 0 : Math.round(lowestCOGS * 100) / 100,
        lowestBeer: lowestBeer,
        highestCOGS: Math.round(highestCOGS * 100) / 100,
        highestBeer: highestBeer,
        averageCOGS: Math.round(avgCOGS * 100) / 100,
        laborPerBatch: laborPerBatch
      },
      recommendations: recommendations
    };
    
    // Force clean serialization to avoid postMessage errors
    return JSON.parse(JSON.stringify(result));
    
  } catch (e) {
    Logger.log('Error in getBeerCOGSData: ' + e.toString());
    return { success: false, error: e.toString(), beers: [] };
  }
}

/**
 * Generate COGS reduction recommendations
 */
function generateCOGSRecommendations(beers, avgCOGS) {
  var recommendations = [];
  
  if (!beers || beers.length === 0) return recommendations;
  
  // Find beers significantly above average
  var highCostBeers = beers.filter(function(b) {
    return b.cogsPerBBL > avgCOGS * 1.2; // 20% above average
  }).sort(function(a, b) {
    return b.cogsPerBBL - a.cogsPerBBL;
  });
  
  if (highCostBeers.length > 0) {
    recommendations.push({
      type: 'high_cost',
      title: 'High Cost Beers',
      description: highCostBeers.length + ' beer(s) are 20%+ above average COGS',
      beers: highCostBeers.slice(0, 3).map(function(b) {
        return b.beer + ' ($' + b.cogsPerBBL.toFixed(2) + '/BBL)';
      }),
      action: 'Review ingredient costs and consider recipe optimization'
    });
  }
  
  // Find beers with high ingredient costs relative to labor
  var ingredientHeavy = beers.filter(function(b) {
    return b.ingredientCost > b.laborCost * 1.5 && b.ingredientCost > 3000;
  });
  
  if (ingredientHeavy.length > 0) {
    recommendations.push({
      type: 'ingredient_heavy',
      title: 'Ingredient-Heavy Recipes',
      description: ingredientHeavy.length + ' recipe(s) have high ingredient costs',
      beers: ingredientHeavy.slice(0, 3).map(function(b) {
        return b.beer + ' ($' + b.ingredientCost.toFixed(2) + ' ingredients)';
      }),
      action: 'Consider bulk purchasing or alternative suppliers'
    });
  }
  
  // Find low margin beers
  var lowMargin = beers.filter(function(b) {
    return b.margin > 0 && b.margin < 30;
  });
  
  if (lowMargin.length > 0) {
    recommendations.push({
      type: 'low_margin',
      title: 'Low Margin Products',
      description: lowMargin.length + ' beer(s) have margins below 30%',
      beers: lowMargin.slice(0, 3).map(function(b) {
        return b.beer + ' (' + b.margin + '% margin)';
      }),
      action: 'Review floor pricing or reduce production costs'
    });
  }
  
  // Yield optimization
  var lowYield = beers.filter(function(b) {
    return b.yieldPct < 0.93;
  });
  
  if (lowYield.length > 0) {
    recommendations.push({
      type: 'yield',
      title: 'Yield Improvement Opportunity',
      description: lowYield.length + ' beer(s) have yield below 93%',
      beers: lowYield.map(function(b) {
        return b.beer + ' (' + b.yieldPctDisplay + ' yield)';
      }),
      action: 'Review brewing process for potential yield improvements'
    });
  }
  
  // If no issues found, add a positive message
  if (recommendations.length === 0) {
    recommendations.push({
      type: 'positive',
      title: 'COGS Looking Good!',
      description: 'All beers are within expected cost ranges',
      beers: [],
      action: 'Continue monitoring for seasonal ingredient price changes'
    });
  }
  
  return recommendations;
}

/**
 * Get COGS for a specific recipe (helper function)
 */
function getBeerCOGSForRecipe(recipeName) {
  try {
    var result = getBeerCOGSData();
    if (!result.success) return { ingredientCost: 0, laborCost: 0, cogsPerBBL: 0 };
    
    var beer = result.beers.find(function(b) {
      return b.beer.toLowerCase() === recipeName.toLowerCase() ||
             b.recipeName.toLowerCase() === recipeName.toLowerCase();
    });
    
    if (beer) {
      return {
        ingredientCost: beer.ingredientCost,
        laborCost: beer.laborCost,
        cogsPerBBL: beer.cogsPerBBL
      };
    }
    
    return { ingredientCost: 0, laborCost: 0, cogsPerBBL: 0 };
  } catch (e) {
    return { ingredientCost: 0, laborCost: 0, cogsPerBBL: 0 };
  }
}

/**
 * Recalculate all COGS from recipe data
 */
function recalculateAllCOGS() {
  try {
    var ss = getBrmSpreadsheet();
    var cogsSheet = ss.getSheetByName(SHEETS.BEER_COGS_MASTER);
    if (!cogsSheet) return { success: false, error: 'Beer COGS Master sheet not found' };
    
    var recipesResult = getAllRecipesEnhanced();
    if (!recipesResult.success) return recipesResult;
    
    var rmResult = getRawMaterialsInventory({});
    var rmLookup = {};
    if (rmResult.success && rmResult.materials) {
      rmResult.materials.forEach(function(m) {
        rmLookup[m.item.toLowerCase().trim()] = m.avgCost || 0;
      });
    }
    
    // Get labor config
    var laborSheet = ss.getSheetByName(SHEETS.LABOR_CONFIG);
    var brewingLabor = 150, packagingLabor = 100;  // Defaults
    if (laborSheet) {
      var laborData = laborSheet.getDataRange().getValues();
      for (var i = 0; i < laborData.length; i++) {
        if (laborData[i][0] && laborData[i][0].toString().toLowerCase().includes('brewing')) {
          brewingLabor = parseFloat(laborData[i][1]) || 150;
        }
        if (laborData[i][0] && laborData[i][0].toString().toLowerCase().includes('packaging')) {
          packagingLabor = parseFloat(laborData[i][1]) || 100;
        }
      }
    }
    
    // Clear and rebuild COGS sheet (keep headers)
    var lastRow = cogsSheet.getLastRow();
    if (lastRow > 1) {
      cogsSheet.getRange(2, 1, lastRow - 1, 10).clearContent();
    }
    
    var updatedCount = 0;
    recipesResult.recipes.forEach(function(recipe, idx) {
      // Calculate ingredient cost
      var ingredientCost = 0;
      var allIngredients = (recipe.grains || []).concat(recipe.hops || []).concat(recipe.other || []);
      allIngredients.forEach(function(ing) {
        var key = ing.ingredient.toLowerCase().trim();
        var cost = rmLookup[key] || 0;
        ingredientCost += ing.amount * cost;
      });
      
      var batchSize = recipe.batchSize || 60;
      var yieldPct = recipe.yieldPct || 0.95;
      var expectedYield = batchSize * yieldPct;
      var totalCost = ingredientCost + brewingLabor + packagingLabor;
      var cogsPerBBL = expectedYield > 0 ? totalCost / expectedYield : 0;
      
      var rowData = [
        recipe.recipeName,
        batchSize,
        yieldPct,
        expectedYield,
        Math.round(ingredientCost * 100) / 100,
        brewingLabor,
        packagingLabor,
        Math.round(totalCost * 100) / 100,
        Math.round(cogsPerBBL * 100) / 100,
        new Date()
      ];
      
      cogsSheet.getRange(idx + 2, 1, 1, rowData.length).setValues([rowData]);
      updatedCount++;
    });
    
    return { success: true, message: 'Updated COGS for ' + updatedCount + ' beers' };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 13: QB JOURNAL FUNCTIONS (Including MISSING getRecurringEntriesConfig!)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET RECURRING ENTRIES CONFIG - This function was MISSING and broke the QB Journal tab!
 * Reads from Recurring Entries Config sheet
 */
function getRecurringEntriesConfig(month) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.RECURRING_CONFIG);
    
    if (!sheet) {
      return { success: false, error: 'Recurring Entries Config sheet not found', entries: [] };
    }
    
    var data = sheet.getDataRange().getValues();
    var entries = [];
    
    // Recurring Entries Config structure:
    // Row 1: Title
    // Row 2: Instructions
    // Row 3: Empty
    // Row 4: Headers (Entry Name, Debit Account, Credit Account, Jan-Dec, Memo Template)
    // Row 5+: Data
    
    var headerRow = 3; // 0-indexed
    var dataStartRow = 4;
    
    // Column mapping
    var cols = {
      entryName: 0,      // A
      debitAccount: 1,   // B
      creditAccount: 2,  // C
      jan: 3, feb: 4, mar: 5, apr: 6, may: 7, jun: 8,
      jul: 9, aug: 10, sep: 11, oct: 12, nov: 13, dec: 14,
      memoTemplate: 15   // P
    };
    
    // Month column offset (Jan=3, Feb=4, ..., Dec=14)
    var monthCol = 2 + month; // month is 1-12, so Jan=3, etc.
    
    var totalAmount = 0;
    
    for (var i = dataStartRow; i < data.length; i++) {
      var row = data[i];
      var entryName = (row[cols.entryName] || '').toString().trim();
      
      // Skip empty rows and instruction rows
      if (!entryName || entryName === '' || entryName.toLowerCase().includes('instruction')) continue;
      
      var amount = parseFloat(row[monthCol]) || 0;
      var memoTemplate = row[cols.memoTemplate] || entryName;
      
      // Replace {month} and {year} placeholders in memo
      var monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
      var memo = memoTemplate.toString()
        .replace(/{month}/gi, monthNames[month - 1])
        .replace(/\(month\)/gi, monthNames[month - 1]);
      
      if (amount > 0) {
        entries.push({
          entryName: entryName,
          description: entryName,
          memo: memo,
          debitAccount: row[cols.debitAccount] || '',
          creditAccount: row[cols.creditAccount] || '',
          amount: amount,
          thisMonth: amount
        });
        
        totalAmount += amount;
      }
    }
    
    return serializeForHtml({
      success: true,
      entries: entries,
      totalAmount: totalAmount,
      month: month,
      entryCount: entries.length
    });
    
  } catch (e) {
    Logger.log('Error in getRecurringEntriesConfig: ' + e.toString());
    return { success: false, error: e.toString(), entries: [] };
  }
}

/**
 * Generate monthly journal entries
 */
function generateMonthlyJournalEntriesV2(year, month) {
  try {
    var ss = getBrmSpreadsheet();
    var exportSheet = ss.getSheetByName(SHEETS.QB_JOURNAL_EXPORT);
    
    if (!exportSheet) {
      return { success: false, error: 'QB Journal Export sheet not found' };
    }
    
    var monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
    var monthName = monthNames[month - 1];
    var startDate = new Date(year, month - 1, 1);
    var endDate = new Date(year, month, 0);
    var endDateStr = Utilities.formatDate(endDate, Session.getScriptTimeZone(), 'M/d/yyyy');
    var firstDateStr = Utilities.formatDate(startDate, Session.getScriptTimeZone(), 'M/d/yyyy');
    
    // Clear and rebuild the export sheet
    exportSheet.clear();
    
    // Header
    exportSheet.getRange('A1').setValue('QUICKBOOKS JOURNAL ENTRY EXPORT');
    exportSheet.getRange('A1').setFontWeight('bold').setFontSize(14);
    exportSheet.getRange('A2').setValue('Monthly journal entries to sync BRM inventory with QuickBooks');
    exportSheet.getRange('A4').setValue('Period:');
    exportSheet.getRange('B4').setValue(monthName + ' ' + year);
    
    var row = 6;
    var totalDebits = 0;
    var totalCredits = 0;
    
    // ═══════════════════════════════════════════════════════════════
    // ENTRY 1: RAW MATERIALS PURCHASES
    // ═══════════════════════════════════════════════════════════════
    exportSheet.getRange('A' + row).setValue('ENTRY 1: RAW MATERIALS PURCHASES');
    exportSheet.getRange('A' + row).setFontWeight('bold').setBackground('#1a365d').setFontColor('white');
    row++;
    
    // Headers
    exportSheet.getRange(row, 1, 1, 5).setValues([['Date', 'Account', 'Debit', 'Credit', 'Memo']]);
    exportSheet.getRange(row, 1, 1, 5).setFontWeight('bold');
    row++;
    
    // Get purchase data for the month
    var purchasesResult = getPurchasesData({ status: 'Received' });
    var rmPurchases = 0;
    
    if (purchasesResult.success && purchasesResult.purchases) {
      purchasesResult.purchases.forEach(function(p) {
        var pDate = new Date(p.date);
        if (pDate >= startDate && pDate <= endDate) {
          rmPurchases += p.total || 0;
        }
      });
    }
    
    // Debit: Raw Materials Inventory
    exportSheet.getRange(row, 1, 1, 5).setValues([[
      firstDateStr, '1400 - Raw Materials Inventory', rmPurchases, '', 'Raw materials received this month'
    ]]);
    totalDebits += rmPurchases;
    row++;
    
    // Credit: Accounts Payable
    exportSheet.getRange(row, 1, 1, 5).setValues([[
      firstDateStr, '2000 - Accounts Payable', '', rmPurchases, 'Supplier invoices'
    ]]);
    totalCredits += rmPurchases;
    row += 2;
    
    // ═══════════════════════════════════════════════════════════════
    // ENTRY 2: PRODUCTION (Raw Materials → WIP)
    // ═══════════════════════════════════════════════════════════════
    exportSheet.getRange('A' + row).setValue('ENTRY 2: PRODUCTION (Raw Materials → WIP)');
    exportSheet.getRange('A' + row).setFontWeight('bold').setBackground('#1a365d').setFontColor('white');
    row++;
    
    exportSheet.getRange(row, 1, 1, 5).setValues([['Date', 'Account', 'Debit', 'Credit', 'Memo']]);
    exportSheet.getRange(row, 1, 1, 5).setFontWeight('bold');
    row++;
    
    // Get batch data for the month
    var batchesResult = getBatchesData({});
    var materialsConsumed = 0;
    var laborCost = 0;
    var overheadCost = 0;
    var batchCount = 0;
    
    if (batchesResult.success && batchesResult.batches) {
      batchesResult.batches.forEach(function(b) {
        var bDate = new Date(b.brewDate || b.date);
        if (bDate >= startDate && bDate <= endDate) {
          materialsConsumed += b.recipeCost || b.ingredientCost || 0;
          laborCost += b.laborCost || 0;
          overheadCost += b.overheadCost || 0;
          batchCount++;
        }
      });
    }
    
    // If no batch-level data, estimate from labor config
    if (laborCost === 0 && batchCount > 0) {
      var laborResult = getLaborCostPerBatch();
      laborCost = (laborResult.totalLabor || 3897.26) * batchCount;
    }
    
    var totalWIP = materialsConsumed + laborCost + overheadCost;
    
    // Debit: Work in Process
    exportSheet.getRange(row, 1, 1, 5).setValues([[
      endDateStr, '1410 - Work in Process Inventory', totalWIP, '', 'Batches brewed this month'
    ]]);
    totalDebits += totalWIP;
    row++;
    
    // Credit: Raw Materials
    exportSheet.getRange(row, 1, 1, 5).setValues([[
      endDateStr, '1400 - Raw Materials Inventory', '', materialsConsumed, 'Materials consumed'
    ]]);
    totalCredits += materialsConsumed;
    row++;
    
    // Credit: Direct Labor
    exportSheet.getRange(row, 1, 1, 5).setValues([[
      endDateStr, '5100 - Direct Labor', '', laborCost, 'Brewer labor'
    ]]);
    totalCredits += laborCost;
    row++;
    
    // Credit: Manufacturing Overhead
    exportSheet.getRange(row, 1, 1, 5).setValues([[
      endDateStr, '5200 - Manufacturing Overhead', '', overheadCost, 'Allocated overhead'
    ]]);
    totalCredits += overheadCost;
    row += 2;
    
    // ═══════════════════════════════════════════════════════════════
    // ENTRY 3: PACKAGING (WIP → Finished Goods)
    // ═══════════════════════════════════════════════════════════════
    exportSheet.getRange('A' + row).setValue('ENTRY 3: PACKAGING (WIP → Finished Goods)');
    exportSheet.getRange('A' + row).setFontWeight('bold').setBackground('#1a365d').setFontColor('white');
    row++;
    
    exportSheet.getRange(row, 1, 1, 5).setValues([['Date', 'Account', 'Debit', 'Credit', 'Memo']]);
    exportSheet.getRange(row, 1, 1, 5).setFontWeight('bold');
    row++;
    
    // Count packaged batches
    var packagedValue = 0;
    if (batchesResult.success && batchesResult.batches) {
      batchesResult.batches.forEach(function(b) {
        var pkgDate = new Date(b.packageDate || b.pkgDate);
        if (pkgDate >= startDate && pkgDate <= endDate && 
            (b.status === 'Packaged' || b.status === 'Complete')) {
          packagedValue += b.totalCost || (b.recipeCost + b.laborCost) || 0;
        }
      });
    }
    
    // Debit: Finished Goods Inventory
    exportSheet.getRange(row, 1, 1, 5).setValues([[
      endDateStr, '1420 - Finished Goods Inventory', packagedValue, '', 'Batches packaged this month'
    ]]);
    totalDebits += packagedValue;
    row++;
    
    // Credit: WIP
    exportSheet.getRange(row, 1, 1, 5).setValues([[
      endDateStr, '1410 - Work in Process Inventory', '', packagedValue, 'WIP transferred out'
    ]]);
    totalCredits += packagedValue;
    row += 2;
    
    // ═══════════════════════════════════════════════════════════════
    // ENTRY 4: COST OF GOODS SOLD
    // ═══════════════════════════════════════════════════════════════
    exportSheet.getRange('A' + row).setValue('ENTRY 4: COST OF GOODS SOLD');
    exportSheet.getRange('A' + row).setFontWeight('bold').setBackground('#1a365d').setFontColor('white');
    row++;
    
    exportSheet.getRange(row, 1, 1, 5).setValues([['Date', 'Account', 'Debit', 'Credit', 'Memo']]);
    exportSheet.getRange(row, 1, 1, 5).setFontWeight('bold');
    row++;
    
    // Get sales COGS
    var salesResult = getSalesData({});
    var b2bCogs = 0;
    
    if (salesResult.success && salesResult.sales) {
      salesResult.sales.forEach(function(s) {
        var sDate = new Date(s.date);
        if (sDate >= startDate && sDate <= endDate) {
          b2bCogs += s.cogs || 0;
        }
      });
    }
    
    // Get taproom COGS
    var taproomResult = getTaproomSalesData(year, month);
    var taproomCogs = taproomResult.success ? (taproomResult.summary.mtdCogs || 0) : 0;
    
    var totalCogs = b2bCogs + taproomCogs;
    
    // Debit: COGS
    exportSheet.getRange(row, 1, 1, 5).setValues([[
      endDateStr, '5000 - Cost of Goods Sold', totalCogs, '', 'COGS for sales this month'
    ]]);
    totalDebits += totalCogs;
    row++;
    
    // Credit: Finished Goods
    exportSheet.getRange(row, 1, 1, 5).setValues([[
      endDateStr, '1420 - Finished Goods Inventory', '', totalCogs, 'FG depleted'
    ]]);
    totalCredits += totalCogs;
    row += 2;
    
    // ═══════════════════════════════════════════════════════════════
    // MONTHLY SUMMARY
    // ═══════════════════════════════════════════════════════════════
    exportSheet.getRange('A' + row).setValue('MONTHLY SUMMARY');
    exportSheet.getRange('A' + row).setFontWeight('bold').setBackground('#2d5016').setFontColor('white');
    row++;
    
    exportSheet.getRange(row, 1).setValue('Total Debits:');
    exportSheet.getRange(row, 2).setValue(totalDebits).setNumberFormat('$#,##0.00');
    row++;
    
    exportSheet.getRange(row, 1).setValue('Total Credits:');
    exportSheet.getRange(row, 2).setValue(totalCredits).setNumberFormat('$#,##0.00');
    row++;
    
    exportSheet.getRange(row, 1).setValue('Difference (should be $0):');
    exportSheet.getRange(row, 2).setValue(totalDebits - totalCredits).setNumberFormat('$#,##0.00');
    
    // Format columns
    exportSheet.setColumnWidth(1, 100);
    exportSheet.setColumnWidth(2, 250);
    exportSheet.setColumnWidth(3, 100);
    exportSheet.setColumnWidth(4, 100);
    exportSheet.setColumnWidth(5, 250);
    
    return {
      success: true,
      message: 'Journal entries generated for ' + monthName + ' ' + year,
      summary: {
        rawMaterialsPurchases: rmPurchases,
        wipProduction: totalWIP,
        packaged: packagedValue,
        cogs: totalCogs,
        totalDebits: totalDebits,
        totalCredits: totalCredits,
        balanced: Math.abs(totalDebits - totalCredits) < 0.01
      }
    };
    
  } catch (e) {
    Logger.log('Error generating journal entries: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * Get Taproom data status for QB Journal tab
 */
function getTaproomDataStatus(year, month) {
  try {
    var taproomResult = getTaproomSalesData(year, month);
    
    if (!taproomResult.success) {
      return { success: false, daysLoaded: 0, monthRevenue: 0, missingDays: '?' };
    }
    
    var daysInMonth = new Date(year, month, 0).getDate();
    var daysWithData = taproomResult.summary.daysWithSales || taproomResult.sales.length;
    var missingDays = daysInMonth - daysWithData;
    
    return serializeForHtml({
      success: true,
      daysLoaded: daysWithData,
      monthRevenue: taproomResult.summary.mtdRevenue || 0,
      missingDays: missingDays > 0 ? missingDays : 0,
      daysInMonth: daysInMonth
    });
    
  } catch (e) {
    return { success: false, daysLoaded: 0, monthRevenue: 0, missingDays: '?', error: e.toString() };
  }
}

/**
 * Get QB Journal data summary for UI display
 */
function getQBJournalStatus(year, month) {
  try {
    // Get recurring entries
    var recurringResult = getRecurringEntriesConfig(month);
    
    // Get taproom status
    var taproomStatus = getTaproomDataStatus(year, month);
    
    // Get calculated entries info
    var batchesResult = getBatchesData({});
    var salesResult = getSalesData({});
    
    var startDate = new Date(year, month - 1, 1);
    var endDate = new Date(year, month, 0);
    
    var batchCount = 0;
    var salesCount = 0;
    
    if (batchesResult.success && batchesResult.batches) {
      batchesResult.batches.forEach(function(b) {
        var bDate = new Date(b.brewDate || b.date);
        if (bDate >= startDate && bDate <= endDate) batchCount++;
      });
    }
    
    if (salesResult.success && salesResult.sales) {
      salesResult.sales.forEach(function(s) {
        var sDate = new Date(s.date);
        if (sDate >= startDate && sDate <= endDate) salesCount++;
      });
    }
    
    return serializeForHtml({
      success: true,
      recurring: {
        entries: recurringResult.entries || [],
        count: recurringResult.entryCount || 0,
        total: recurringResult.totalAmount || 0
      },
      taproom: taproomStatus,
      calculated: {
        batchCount: batchCount,
        salesCount: salesCount
      },
      month: month,
      year: year
    });
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Add a new recurring entry to the config sheet
 */
function addRecurringEntry(entryData) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.RECURRING_CONFIG);
    
    if (!sheet) {
      return { success: false, error: 'Recurring Entries Config sheet not found' };
    }
    
    // Validate required fields
    if (!entryData.entryName || !entryData.debitAccount || !entryData.creditAccount) {
      return { success: false, error: 'Entry name, debit account, and credit account are required' };
    }
    
    // Build row data
    var rowData = [
      entryData.entryName,
      entryData.debitAccount,
      entryData.creditAccount
    ];
    
    // Add monthly amounts (Jan-Dec)
    var monthlyAmount = parseFloat(entryData.monthlyAmount) || 0;
    for (var m = 0; m < 12; m++) {
      // Allow different amounts per month if provided
      var monthAmount = entryData.monthlyAmounts && entryData.monthlyAmounts[m] !== undefined 
        ? parseFloat(entryData.monthlyAmounts[m]) 
        : monthlyAmount;
      rowData.push(monthAmount);
    }
    
    // Add memo template
    rowData.push(entryData.memoTemplate || entryData.entryName + ' - {month}');
    
    // Append row
    sheet.appendRow(rowData);
    
    return { success: true, message: 'Recurring entry added: ' + entryData.entryName };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Update a recurring entry amount for a specific month
 */
function updateRecurringEntryAmount(entryName, month, newAmount) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.RECURRING_CONFIG);
    
    if (!sheet) {
      return { success: false, error: 'Sheet not found' };
    }
    
    var data = sheet.getDataRange().getValues();
    var monthCol = 3 + month; // month 1-12 maps to columns D-O (4-15, but 1-indexed so 4-15)
    
    for (var i = 4; i < data.length; i++) { // Start from row 5 (0-indexed = 4)
      if (data[i][0] && data[i][0].toString().toLowerCase() === entryName.toLowerCase()) {
        sheet.getRange(i + 1, monthCol + 1).setValue(parseFloat(newAmount) || 0);
        return { success: true, message: 'Amount updated' };
      }
    }
    
    return { success: false, error: 'Entry not found: ' + entryName };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function formatDateCompact(date) {
  var d = new Date(date);
  return d.getFullYear().toString().substr(-2) + 
         (d.getMonth() + 1).toString().padStart(2, '0') + 
         d.getDate().toString().padStart(2, '0');
}

/**
 * Export journal entries to CSV
 */
function exportJournalToCSV() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.QB_JOURNAL_EXPORT);
    
    if (!sheet) {
      return { success: false, error: 'QB Journal Export sheet not found' };
    }
    
    var data = sheet.getDataRange().getValues();
    var csv = data.map(function(row) {
      return row.map(function(cell) {
        var str = cell.toString();
        if (str.includes(',') || str.includes('"')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      }).join(',');
    }).join('\n');
    
    // Create file in Drive
    var folder = DriveApp.getRootFolder();
    var filename = 'QB_Journal_Export_' + Utilities.formatDate(new Date(), 'America/Denver', 'yyyyMMdd_HHmmss') + '.csv';
    var file = folder.createFile(filename, csv, MimeType.CSV);
    
    return { success: true, downloadUrl: file.getDownloadUrl(), filename: filename };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Export journal entries in QuickBooks Online IIF format
 * This format can be imported via File > Utilities > Import > Journal Entries
 */
function exportJournalForQBOnline(year, month) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.QB_JOURNAL_EXPORT);
    
    if (!sheet) {
      return { success: false, error: 'QB Journal Export sheet not found' };
    }
    
    var data = sheet.getDataRange().getValues();
    var entries = [];
    var currentEntry = null;
    
    // Parse the sheet data to extract journal entries
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      
      // Skip header/title rows
      if (!row[0] || row[0].toString().includes('ENTRY') || 
          row[0].toString().includes('Date') || 
          row[0].toString().includes('QUICKBOOKS') ||
          row[0].toString().includes('SUMMARY') ||
          row[0].toString().includes('Period')) continue;
      
      // Skip summary rows
      if (row[0].toString().includes('Total') || row[0].toString().includes('Difference')) continue;
      
      var dateVal = row[0];
      var account = row[1] || '';
      var debit = parseFloat(row[2]) || 0;
      var credit = parseFloat(row[3]) || 0;
      var memo = row[4] || '';
      
      // Skip empty rows
      if (!account || (debit === 0 && credit === 0)) continue;
      
      entries.push({
        date: dateVal,
        account: account,
        debit: debit,
        credit: credit,
        memo: memo
      });
    }
    
    // Build QB Online CSV format
    // QuickBooks Online Journal Entry Import format:
    // Date, Journal No, Memo, Account, Debits, Credits, Name, Description
    var csvLines = [];
    csvLines.push('*Date,*Journal No,Memo,*Account,Debits,Credits,Name,Description');
    
    var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var journalNum = 'BRM-' + year + '-' + monthNames[month - 1];
    
    entries.forEach(function(entry, idx) {
      var dateStr = '';
      if (entry.date instanceof Date) {
        dateStr = Utilities.formatDate(entry.date, Session.getScriptTimeZone(), 'MM/dd/yyyy');
      } else {
        dateStr = entry.date.toString();
      }
      
      var line = [
        dateStr,
        journalNum,
        entry.memo,
        entry.account,
        entry.debit > 0 ? entry.debit.toFixed(2) : '',
        entry.credit > 0 ? entry.credit.toFixed(2) : '',
        '',  // Name (customer/vendor)
        entry.memo
      ].map(function(field) {
        var str = (field || '').toString();
        if (str.includes(',') || str.includes('"')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      }).join(',');
      
      csvLines.push(line);
    });
    
    var csv = csvLines.join('\n');
    
    // Create file in Drive
    var folder = DriveApp.getRootFolder();
    var filename = 'QBO_Journal_Import_' + year + '_' + monthNames[month - 1] + '.csv';
    var file = folder.createFile(filename, csv, MimeType.CSV);
    
    return { 
      success: true, 
      downloadUrl: file.getDownloadUrl(), 
      filename: filename,
      entryCount: entries.length
    };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Add recurring entries to the current month's journal export
 */
function addRecurringEntriesToJournal(year, month) {
  try {
    var ss = getBrmSpreadsheet();
    var exportSheet = ss.getSheetByName(SHEETS.QB_JOURNAL_EXPORT);
    
    if (!exportSheet) {
      return { success: false, error: 'QB Journal Export sheet not found' };
    }
    
    var recurringResult = getRecurringEntriesConfig(month);
    if (!recurringResult.success) {
      return { success: false, error: 'Could not load recurring entries: ' + recurringResult.error };
    }
    
    var endDate = new Date(year, month, 0);
    var endDateStr = Utilities.formatDate(endDate, Session.getScriptTimeZone(), 'M/d/yyyy');
    
    // Find last row
    var lastRow = exportSheet.getLastRow() + 2;
    
    // Add header
    exportSheet.getRange('A' + lastRow).setValue('RECURRING ENTRIES');
    exportSheet.getRange('A' + lastRow).setFontWeight('bold').setBackground('#7c3aed').setFontColor('white');
    lastRow++;
    
    exportSheet.getRange(lastRow, 1, 1, 5).setValues([['Date', 'Account', 'Debit', 'Credit', 'Memo']]);
    exportSheet.getRange(lastRow, 1, 1, 5).setFontWeight('bold');
    lastRow++;
    
    var entriesAdded = 0;
    
    recurringResult.entries.forEach(function(entry) {
      if (entry.amount > 0) {
        // Debit line
        exportSheet.getRange(lastRow, 1, 1, 5).setValues([[
          endDateStr, entry.debitAccount, entry.amount, '', entry.memo
        ]]);
        lastRow++;
        
        // Credit line
        exportSheet.getRange(lastRow, 1, 1, 5).setValues([[
          endDateStr, entry.creditAccount, '', entry.amount, entry.memo
        ]]);
        lastRow++;
        
        entriesAdded++;
      }
    });
    
    return serializeForHtml({ 
      success: true, 
      message: 'Added ' + entriesAdded + ' recurring entries',
      totalAmount: recurringResult.totalAmount
    });
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 14: TTB/TAX FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get TTB data with state tax calculation
 */
function getTTBDataWithState(year, month) {
  try {
    var ss = getBrmSpreadsheet();
    
    var startDate = new Date(year, month - 1, 1);
    var endDate = new Date(year, month, 0);
    var prevMonthEnd = new Date(year, month - 1, 0); // Last day of previous month
    
    // ═══════════════════════════════════════════════════════════════
    // PART I: PRODUCTION - from Batch Log (actual yield, not batch size)
    // ═══════════════════════════════════════════════════════════════
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    var production = 0;
    
    if (batchSheet) {
      var batchData = batchSheet.getDataRange().getValues();
      
      // Batch Log structure (headers in row 7, data starts row 8):
      // Batch #, Brew Date, Beer Name, Size, Recipe Cost, Labor Hrs, Labor $, 
      // Overhead, Total Cost, Exp. Yield, Status, Pkg Date, Act. Yield, Cost/BBL
      var headerRow = 6; // 0-indexed
      var dataStartRow = 7;
      
      // Find column indices from headers
      var headers = batchData[headerRow] || [];
      var brewDateCol = -1, actYieldCol = -1, statusCol = -1, pkgDateCol = -1;
      
      for (var h = 0; h < headers.length; h++) {
        var header = (headers[h] || '').toString().toLowerCase();
        if (header.includes('brew') && header.includes('date')) brewDateCol = h;
        if (header.includes('act') && header.includes('yield')) actYieldCol = h;
        if (header === 'status') statusCol = h;
        if (header.includes('pkg') && header.includes('date')) pkgDateCol = h;
      }
      
      // Fallback column indices if headers not found
      if (brewDateCol === -1) brewDateCol = 1;
      if (actYieldCol === -1) actYieldCol = 12;
      if (statusCol === -1) statusCol = 10;
      if (pkgDateCol === -1) pkgDateCol = 11;
      
      for (var i = dataStartRow; i < batchData.length; i++) {
        var row = batchData[i];
        if (!row[0]) continue; // Skip empty rows
        
        // Use package date for when beer was actually completed
        var completionDate = row[pkgDateCol] ? new Date(row[pkgDateCol]) : new Date(row[brewDateCol]);
        var status = (row[statusCol] || '').toString().toLowerCase();
        
        // Only count packaged/completed batches within the month
        if (completionDate >= startDate && completionDate <= endDate) {
          if (status.includes('packaged') || status.includes('complete')) {
            var actualYield = parseFloat(row[actYieldCol]) || 0;
            production += actualYield;
          }
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // PART II: REMOVALS - from Sales Depletion + Taproom
    // ═══════════════════════════════════════════════════════════════
    var taxableRemovals = 0;
    var taxFreeRemovals = 0; // Tastings, samples
    
    // B2B Sales (from Sales Depletion)
    var salesSheet = ss.getSheetByName(SHEETS.SALES_DEPLETION);
    if (salesSheet) {
      var salesData = salesSheet.getDataRange().getValues();
      // Sales Depletion: headers row 4, data row 5+
      
      for (var j = 4; j < salesData.length; j++) {
        var saleRow = salesData[j];
        var saleDate = new Date(saleRow[0]); // Column A: Date
        
        if (saleDate >= startDate && saleDate <= endDate) {
          var qty = parseFloat(saleRow[6]) || 0; // Column G: Qty
          var pkg = (saleRow[5] || '').toString(); // Column F: Package
          
          // Convert packages to BBL
          var bblPerUnit = 0.5; // Default 1/2 BBL
          if (pkg.includes('1/6')) bblPerUnit = 0.167;
          else if (pkg.includes('1/4')) bblPerUnit = 0.25;
          else if (pkg.includes('1/2')) bblPerUnit = 0.5;
          else if (pkg.includes('Case') || pkg.includes('6-pack')) bblPerUnit = 0; // Skip cases for TTB
          
          taxableRemovals += qty * bblPerUnit;
        }
      }
    }
    
    // Taproom Sales (from Taproom Sales - convert pints to BBL)
    var taproomSheet = ss.getSheetByName(SHEETS.TAPROOM_SALES);
    if (taproomSheet) {
      var taproomData = taproomSheet.getDataRange().getValues();
      
      for (var t = 1; t < taproomData.length; t++) {
        var tapRow = taproomData[t];
        var tapDate = new Date(tapRow[0]);
        
        if (tapDate >= startDate && tapDate <= endDate) {
          var servingSize = (tapRow[2] || '').toString();
          var tapQty = parseFloat(tapRow[3]) || 0;
          
          // Convert servings to BBL (248 pints per BBL)
          var pintsPerServing = 1;
          if (servingSize.includes('1/2') || servingSize.includes('Half')) pintsPerServing = 0.5;
          else if (servingSize.includes('Flight') || servingSize.includes('Taster')) pintsPerServing = 0.25;
          else if (servingSize.includes('Growler')) pintsPerServing = 4;
          else if (servingSize.includes('Crowler')) pintsPerServing = 2;
          
          var totalPints = tapQty * pintsPerServing;
          taxableRemovals += totalPints / 248; // Convert pints to BBL
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // INVENTORY CALCULATION
    // ═══════════════════════════════════════════════════════════════
    
    // Get beginning inventory from FG at start of month (or end of previous month)
    var beginInventory = 0;
    var endInventory = 0;
    
    // Try to get from TTB Reports sheet (previous month's ending)
    var ttbSheet = ss.getSheetByName(SHEETS.TTB_REPORTS);
    if (ttbSheet) {
      // The sheet has a fixed structure, not a log
      // We'd need to store monthly snapshots somewhere
      // For now, calculate from FG
    }
    
    // Calculate from Finished Goods
    var fgSheet = ss.getSheetByName(SHEETS.FINISHED_GOODS);
    if (fgSheet) {
      var fgData = fgSheet.getDataRange().getValues();
      
      for (var f = 4; f < fgData.length; f++) { // Start row 5
        var fgRow = fgData[f];
        var fgPkg = (fgRow[1] || '').toString();
        var fgQty = parseFloat(fgRow[2]) || 0;
        
        // Only count kegs for TTB (not cases)
        var bblPerKeg = 0;
        if (fgPkg.includes('1/2 BBL')) bblPerKeg = 0.5;
        else if (fgPkg.includes('1/6 BBL')) bblPerKeg = 0.167;
        else if (fgPkg.includes('1/4 BBL')) bblPerKeg = 0.25;
        
        endInventory += fgQty * bblPerKeg;
      }
    }
    
    // Beginning inventory = End inventory + Removals - Production
    // (Working backwards from current state)
    beginInventory = endInventory + taxableRemovals - production;
    if (beginInventory < 0) beginInventory = 0;
    
    var totalRemovals = taxableRemovals + taxFreeRemovals;
    
    // ═══════════════════════════════════════════════════════════════
    // TAX CALCULATIONS
    // ═══════════════════════════════════════════════════════════════
    
    // Federal Tax: $3.50/BBL (CBMTRA reduced rate for first 60K BBL/year)
    var federalRate = 3.50;
    var federalTax = taxableRemovals * federalRate;
    
    // Colorado State Tax: $0.08/gallon = $2.48/BBL
    var coloradoRatePerGallon = 0.08;
    var coloradoRatePerBBL = 2.48; // 31 gallons per BBL
    var taxableGallons = taxableRemovals * 31;
    var coloradoTax = taxableRemovals * coloradoRatePerBBL;
    
    return serializeForHtml({
      success: true,
      period: {
        year: year,
        month: month,
        monthName: ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'][month-1]
      },
      partI: {
        beginInventory: Math.round(beginInventory * 100) / 100,
        beerProduced: Math.round(production * 100) / 100,
        total: Math.round((beginInventory + production) * 100) / 100,
        endInventory: Math.round(endInventory * 100) / 100,
        removalsForTax: Math.round(totalRemovals * 100) / 100
      },
      partII: {
        taxableSales: Math.round(taxableRemovals * 100) / 100,
        taxFreeRemovals: Math.round(taxFreeRemovals * 100) / 100,
        exports: 0,
        losses: 0,
        totalRemovals: Math.round(totalRemovals * 100) / 100
      },
      federal: {
        rate: federalRate,
        taxableBBL: Math.round(taxableRemovals * 100) / 100,
        taxDue: Math.round(federalTax * 100) / 100
      },
      colorado: {
        ratePerGallon: coloradoRatePerGallon,
        ratePerBBL: coloradoRatePerBBL,
        taxableBBL: Math.round(taxableRemovals * 100) / 100,
        taxableGallons: Math.round(taxableGallons * 100) / 100,
        taxDue: Math.round(coloradoTax * 100) / 100
      },
      totalTaxDue: Math.round((federalTax + coloradoTax) * 100) / 100
    });
    
  } catch (e) {
    Logger.log('Error in getTTBDataWithState: ' + e.toString());
    return { 
      success: false, 
      error: e.toString(),
      partI: { beginInventory: 0, beerProduced: 0, total: 0, endInventory: 0, removalsForTax: 0 },
      partII: { taxableSales: 0, taxFreeRemovals: 0, exports: 0, losses: 0, totalRemovals: 0 },
      federal: { rate: 3.50, taxableBBL: 0, taxDue: 0 },
      colorado: { ratePerGallon: 0.08, ratePerBBL: 2.48, taxableBBL: 0, taxableGallons: 0, taxDue: 0 },
      totalTaxDue: 0
    };
  }
}

/**
 * Generate TTB Report and update the TTB Reports sheet
 */
function generateTTBReport(year, month) {
  try {
    var data = getTTBDataWithState(year, month);
    if (!data.success) {
      return data;
    }
    
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.TTB_REPORTS);
    
    if (!sheet) {
      return { success: false, error: 'TTB Reports sheet not found' };
    }
    
    // Update the sheet with calculated values
    // Based on the sheet structure shown:
    // B5: Year, B6: Month
    sheet.getRange('B5').setValue(year);
    sheet.getRange('B6').setValue(month);
    
    // Part I - Production
    sheet.getRange('B9').setValue(data.partI.beginInventory);   // Beginning Inventory
    sheet.getRange('B10').setValue(data.partI.beerProduced);    // Beer Produced
    sheet.getRange('B11').setValue(data.partI.total);           // Total
    sheet.getRange('B12').setValue(data.partI.endInventory);    // Ending Inventory
    sheet.getRange('B13').setValue(data.partI.removalsForTax);  // Removals for Tax
    
    // Part II - Removals
    sheet.getRange('B16').setValue(data.partII.taxableSales);   // Taxable Removals
    sheet.getRange('B17').setValue(data.partII.taxFreeRemovals); // Tax-Free
    sheet.getRange('B18').setValue(data.partII.exports);        // Exports
    sheet.getRange('B19').setValue(data.partII.losses);         // Losses
    sheet.getRange('B20').setValue(data.partII.totalRemovals);  // Total Removals
    
    // Part III - Excise Tax
    sheet.getRange('B24').setValue(data.federal.taxableBBL);    // Taxable Barrels
    sheet.getRange('B25').setValue(data.federal.taxDue);        // Excise Tax Due
    
    // Part IV - Colorado State Tax
    sheet.getRange('B36').setValue(data.colorado.taxableBBL);   // In-State Taxable Barrels
    sheet.getRange('B37').setValue(data.colorado.taxableGallons); // Taxable Gallons
    sheet.getRange('B38').setValue(data.colorado.taxDue);       // Colorado Tax Due
    
    return {
      success: true,
      message: 'TTB Report generated for ' + data.period.monthName + ' ' + year,
      data: data
    };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 15: FLOOR PRICING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get floor prices from Floor Pricing sheet
 */
function getFloorPrices() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.FLOOR_PRICING);
    
    if (!sheet) {
      return { success: false, error: 'Floor Pricing sheet not found', prices: [] };
    }
    
    var data = sheet.getDataRange().getValues();
    
    // Floor Pricing sheet structure:
    // Row 1: Title
    // Row 2: Instructions
    // Row 4: INPUT PARAMETERS header
    // Row 5: Target Margin %: 75%
    // Row 6: COGS Buffer %: 10%
    // Row 10: Column headers (Beer Name, COGS/BBL, Buffered COGS, Floor $/BBL, 1/2 BBL Keg, 1/6 BBL Keg, 16oz Case, 12oz Case, Active, Notes)
    // Row 11+: Data
    
    var headerRow = 9; // 0-indexed
    var dataStartRow = 10;
    
    // Get input parameters
    var targetMargin = 0.75;
    var cogsBuffer = 0.10;
    
    for (var p = 0; p < 10; p++) {
      var label = (data[p][0] || '').toString().toLowerCase();
      if (label.includes('target margin')) {
        targetMargin = parseFloat(data[p][1]) || 0.75;
        if (targetMargin > 1) targetMargin = targetMargin / 100;
      }
      if (label.includes('cogs buffer')) {
        cogsBuffer = parseFloat(data[p][1]) || 0.10;
        if (cogsBuffer > 1) cogsBuffer = cogsBuffer / 100;
      }
    }
    
    // Column mapping
    var cols = {
      beerName: 0,      // A
      cogsPerBBL: 1,    // B
      bufferedCOGS: 2,  // C
      floorPerBBL: 3,   // D
      halfBBL: 4,       // E
      sixthBBL: 5,      // F
      case16oz: 6,      // G
      case12oz: 7,      // H
      active: 8,        // I
      notes: 9          // J
    };
    
    var prices = [];
    var lowestCOGS = Infinity, highestCOGS = 0, avgCOGS = 0;
    var beerCount = 0;
    
    for (var i = dataStartRow; i < data.length; i++) {
      var row = data[i];
      var beerName = (row[cols.beerName] || '').toString().trim();
      
      // Skip empty rows, legend, formulas sections
      if (!beerName || beerName === '' || 
          beerName.includes('LEGEND') || 
          beerName.includes('FORMULAS') ||
          beerName.includes('NEVER SELL')) continue;
      
      var cogsPerBBL = parseFloat(row[cols.cogsPerBBL]) || 0;
      var isActive = (row[cols.active] || '').toString().toLowerCase();
      
      if (cogsPerBBL > 0) {
        var price = {
          // Primary names
          beer: beerName,
          cogsPerBBL: cogsPerBBL,
          bufferedCOGS: parseFloat(row[cols.bufferedCOGS]) || 0,
          floorPerBBL: parseFloat(row[cols.floorPerBBL]) || 0,
          halfBBLKeg: parseFloat(row[cols.halfBBL]) || 0,
          sixthBBLKeg: parseFloat(row[cols.sixthBBL]) || 0,
          case16oz: parseFloat(row[cols.case16oz]) || 0,
          case12oz: parseFloat(row[cols.case12oz]) || 0,
          active: isActive === 'yes' || isActive === 'true',
          notes: row[cols.notes] || '',
          
          // Aliases for HTML compatibility
          name: beerName,
          beerName: beerName,
          cogs: cogsPerBBL,
          halfBBL: parseFloat(row[cols.halfBBL]) || 0,
          sixthBBL: parseFloat(row[cols.sixthBBL]) || 0,
          pint: parseFloat(row[cols.floorPerBBL]) ? parseFloat(row[cols.floorPerBBL]) / 248 : 0,
          '1/2 BBL': parseFloat(row[cols.halfBBL]) || 0,
          '1/6 BBL': parseFloat(row[cols.sixthBBL]) || 0,
          '16oz Case': parseFloat(row[cols.case16oz]) || 0,
          '12oz Case': parseFloat(row[cols.case12oz]) || 0
        };
        
        prices.push(price);
        
        if (cogsPerBBL < lowestCOGS) lowestCOGS = cogsPerBBL;
        if (cogsPerBBL > highestCOGS) highestCOGS = cogsPerBBL;
        avgCOGS += cogsPerBBL;
        beerCount++;
      }
    }
    
    avgCOGS = beerCount > 0 ? avgCOGS / beerCount : 0;
    
    return serializeForHtml({ 
      success: true, 
      prices: prices,
      parameters: {
        targetMargin: targetMargin,
        targetMarginPct: Math.round(targetMargin * 100) + '%',
        cogsBuffer: cogsBuffer,
        cogsBufferPct: Math.round(cogsBuffer * 100) + '%'
      },
      summary: {
        beerCount: beerCount,
        lowestCOGS: lowestCOGS === Infinity ? 0 : Math.round(lowestCOGS * 100) / 100,
        highestCOGS: Math.round(highestCOGS * 100) / 100,
        avgCOGS: Math.round(avgCOGS * 100) / 100
      }
    });
    
  } catch (e) {
    Logger.log('Error in getFloorPrices: ' + e.toString());
    return { success: false, error: e.toString(), prices: [] };
  }
}

/**
 * Get Fully Loaded Pricing for B2B sales
 */
function getFullyLoadedPricing() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.FULLY_LOADED_PRICING);
    
    if (!sheet) {
      return { success: false, error: 'Fully Loaded Pricing sheet not found', prices: [] };
    }
    
    var data = sheet.getDataRange().getValues();
    
    // Fully Loaded Pricing structure:
    // Row 1: Title
    // Row 2: Warning
    // Row 3: Description
    // Row 4: Empty
    // Row 5: Sales Cost per BBL: $143.92
    // Row 6: Required Wholesale Margin: 30%
    // Row 8: Section header
    // Row 9: Column headers
    // Row 10+: Data
    
    var headerRow = 8; // 0-indexed
    var dataStartRow = 9;
    
    // Get sales overhead and margin from config
    var salesCostPerBBL = 143.92;
    var wholesaleMargin = 0.30;
    
    for (var p = 0; p < 8; p++) {
      var label = (data[p][0] || '').toString().toLowerCase();
      if (label.includes('sales cost')) {
        salesCostPerBBL = parseFloat((data[p][1] || '').toString().replace(/[$,]/g, '')) || 143.92;
      }
      if (label.includes('wholesale margin') || label.includes('required')) {
        wholesaleMargin = parseFloat(data[p][1]) || 0.30;
        if (wholesaleMargin > 1) wholesaleMargin = wholesaleMargin / 100;
      }
    }
    
    // Column mapping from screenshot
    var cols = {
      beer: 0,           // A: Beer
      beerCOGS: 1,       // B: Beer COGS/BBL
      salesPerBBL: 2,    // C: Sales $/BBL
      fullyLoaded: 3,    // D: Fully Loaded
      floorPerBBL: 4,    // E: Floor $/BBL
      halfKegFloor: 5,   // F: 1/2 Keg FLOOR
      sixthKegFloor: 6,  // G: 1/6 Keg FLOOR
      currentHalf: 7,    // H: Current 1/2
      status: 8,         // I: Status
      case16ozFloor: 9,  // J: 16oz Case FLOOR
      case12ozFloor: 10  // K: 12oz Case FLOOR
    };
    
    var prices = [];
    
    for (var i = dataStartRow; i < data.length; i++) {
      var row = data[i];
      var beerName = (row[cols.beer] || '').toString().trim();
      
      // Skip empty rows and instruction rows
      if (!beerName || beerName === '' || 
          beerName.includes('HOW TO USE') ||
          beerName.includes('Yellow cells')) continue;
      
      var beerCOGS = parseFloat(row[cols.beerCOGS]) || 0;
      
      if (beerCOGS > 0) {
        var currentPrice = parseFloat(row[cols.currentHalf]) || 0;
        var floorPrice = parseFloat(row[cols.halfKegFloor]) || 0;
        var status = (row[cols.status] || '').toString();
        
        // Determine status if not set
        if (!status && currentPrice > 0 && floorPrice > 0) {
          if (currentPrice >= floorPrice) {
            status = '✓ OK';
          } else if (currentPrice >= beerCOGS / 2) {
            status = '⚠ BELOW FLOOR';
          } else {
            status = '⚠ BELOW COST';
          }
        }
        
        prices.push({
          beer: beerName,
          beerCOGS: beerCOGS,
          salesPerBBL: parseFloat(row[cols.salesPerBBL]) || salesCostPerBBL,
          fullyLoaded: parseFloat(row[cols.fullyLoaded]) || 0,
          floorPerBBL: parseFloat(row[cols.floorPerBBL]) || 0,
          halfKegFloor: floorPrice,
          sixthKegFloor: parseFloat(row[cols.sixthKegFloor]) || 0,
          currentHalfKeg: currentPrice,
          status: status,
          case16ozFloor: parseFloat(row[cols.case16ozFloor]) || 0,
          case12ozFloor: parseFloat(row[cols.case12ozFloor]) || 0,
          margin: currentPrice > 0 ? Math.round((currentPrice - (beerCOGS / 2 + salesCostPerBBL / 2)) / currentPrice * 1000) / 10 : 0
        });
      }
    }
    
    // Count status summary
    var okCount = 0, belowFloorCount = 0, belowCostCount = 0;
    prices.forEach(function(p) {
      if (p.status.includes('OK')) okCount++;
      else if (p.status.includes('BELOW FLOOR')) belowFloorCount++;
      else if (p.status.includes('BELOW COST')) belowCostCount++;
    });
    
    return serializeForHtml({
      success: true,
      prices: prices,
      parameters: {
        salesCostPerBBL: salesCostPerBBL,
        wholesaleMargin: wholesaleMargin,
        wholesaleMarginPct: Math.round(wholesaleMargin * 100) + '%'
      },
      summary: {
        beerCount: prices.length,
        okCount: okCount,
        belowFloorCount: belowFloorCount,
        belowCostCount: belowCostCount
      }
    });
    
  } catch (e) {
    Logger.log('Error in getFullyLoadedPricing: ' + e.toString());
    return { success: false, error: e.toString(), prices: [] };
  }
}

/**
 * Get UPC Penny Pricing data
 */
function getUPCPennyPricing() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.UPC_PENNY_PRICING);
    
    if (!sheet) {
      return { success: false, error: 'UPC Penny Pricing sheet not found', products: [] };
    }
    
    var data = sheet.getDataRange().getValues();
    
    // UPC Penny Pricing structure:
    // Row 1: Title
    // Row 2: Description
    // Row 4: RETAILER SETTINGS
    // Row 5: Target Retailer Margin: 25%
    // Row 6: 6-packs per Case: 4
    // Row 10: Column headers
    // Row 11+: Data
    
    var headerRow = 9; // 0-indexed
    var dataStartRow = 10;
    
    // Get retailer settings
    var retailerMargin = 0.25;
    var sixPacksPerCase = 4;
    
    for (var p = 0; p < 10; p++) {
      var label = (data[p][0] || '').toString().toLowerCase();
      if (label.includes('retailer margin')) {
        retailerMargin = parseFloat(data[p][1]) || 0.25;
        if (retailerMargin > 1) retailerMargin = retailerMargin / 100;
      }
      if (label.includes('6-packs') || label.includes('six-packs')) {
        sixPacksPerCase = parseInt(data[p][1]) || 4;
      }
    }
    
    // Column mapping from screenshot
    var cols = {
      beerName: 0,        // A: Beer Name
      package: 1,         // B: Package
      upc: 2,             // C: UPC
      shelfPrice: 3,      // D: Shelf Price (Penny)
      retailerCost: 4,    // E: Retailer Cost/6pk
      casePriceRetailer: 5, // F: Case Price to Retailer
      yourCostCase: 6,    // G: Your Cost/Case
      yourMarginDollar: 7, // H: Your Margin $
      yourMarginPct: 8,   // I: Your Margin %
      algorithmPct: 9,    // J: Algorithm %
      floorPrice: 10,     // K: Floor Price
      status: 11,         // L: Status
      notes: 12           // M: Notes
    };
    
    var products = [];
    
    for (var i = dataStartRow; i < data.length; i++) {
      var row = data[i];
      var beerName = (row[cols.beerName] || '').toString().trim();
      
      // Skip empty rows and status code rows
      if (!beerName || beerName === '' || 
          beerName.includes('STATUS CODES') ||
          beerName.includes('OK =') ||
          beerName.includes('BELOW')) continue;
      
      var shelfPrice = parseFloat(row[cols.shelfPrice]) || 0;
      
      if (shelfPrice > 0) {
        var yourMarginPct = parseFloat(row[cols.yourMarginPct]) || 0;
        var floorPrice = parseFloat(row[cols.floorPrice]) || 0;
        var status = (row[cols.status] || '').toString();
        
        products.push({
          beer: beerName,
          package: row[cols.package] || '',
          upc: row[cols.upc] || '',
          shelfPrice: shelfPrice,
          retailerCost: parseFloat(row[cols.retailerCost]) || 0,
          casePriceToRetailer: parseFloat(row[cols.casePriceRetailer]) || 0,
          yourCostPerCase: parseFloat(row[cols.yourCostCase]) || 0,
          yourMarginDollar: parseFloat(row[cols.yourMarginDollar]) || 0,
          yourMarginPct: yourMarginPct,
          algorithmPct: parseFloat(row[cols.algorithmPct]) || 0,
          floorPrice: floorPrice,
          status: status,
          notes: row[cols.notes] || ''
        });
      }
    }
    
    // Count by status
    var okCount = 0, belowFloorCount = 0, belowCostCount = 0;
    products.forEach(function(p) {
      var s = p.status.toLowerCase();
      if (s.includes('ok')) okCount++;
      else if (s.includes('below floor')) belowFloorCount++;
      else if (s.includes('below cost')) belowCostCount++;
    });
    
    return serializeForHtml({
      success: true,
      products: products,
      settings: {
        retailerMargin: retailerMargin,
        retailerMarginPct: Math.round(retailerMargin * 100) + '%',
        sixPacksPerCase: sixPacksPerCase
      },
      summary: {
        productCount: products.length,
        okCount: okCount,
        belowFloorCount: belowFloorCount,
        belowCostCount: belowCostCount
      }
    });
    
  } catch (e) {
    Logger.log('Error in getUPCPennyPricing: ' + e.toString());
    return { success: false, error: e.toString(), products: [] };
  }
}

/**
 * Get combined pricing data for UI
 */
function getPricingData() {
  try {
    var floorResult = getFloorPrices();
    var fullyLoadedResult = getFullyLoadedPricing();
    var upcResult = getUPCPennyPricing();
    
    // Get sales overhead from FCCR or config
    var salesOverhead = 158.92; // Default from screenshot
    var fccrResult = getFCCRStatus();
    if (fccrResult.success && fccrResult.salesOverhead) {
      salesOverhead = fccrResult.salesOverhead;
    } else if (fullyLoadedResult.success && fullyLoadedResult.parameters) {
      salesOverhead = fullyLoadedResult.parameters.salesCostPerBBL;
    }
    
    // Target margins
    var targetMarginB2B = 0.30;
    var targetMarginTaproom = 0.70;
    
    if (fullyLoadedResult.success && fullyLoadedResult.parameters) {
      targetMarginB2B = fullyLoadedResult.parameters.wholesaleMargin;
    }
    if (floorResult.success && floorResult.parameters) {
      targetMarginTaproom = floorResult.parameters.targetMargin;
    }
    
    return serializeForHtml({
      success: true,
      keyNumbers: {
        salesOverhead: salesOverhead,
        targetMarginB2B: targetMarginB2B,
        targetMarginB2BPct: Math.round(targetMarginB2B * 100) + '%',
        targetMarginTaproom: targetMarginTaproom,
        targetMarginTaproomPct: Math.round(targetMarginTaproom * 100) + '%'
      },
      floor: floorResult,
      fullyLoaded: fullyLoadedResult,
      upc: upcResult
    });
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Check if a price is above floor for FCCR compliance
 */
function checkPriceCompliance(beerName, packageType, proposedPrice) {
  try {
    var floorResult = getFloorPrices();
    
    if (!floorResult.success) {
      return { success: false, error: floorResult.error };
    }
    
    // Find the beer
    var beer = floorResult.prices.find(function(p) {
      return p.beer.toLowerCase() === beerName.toLowerCase();
    });
    
    if (!beer) {
      return { success: false, error: 'Beer not found in floor pricing: ' + beerName };
    }
    
    // Get floor price for package type
    var floorPrice = 0;
    var pkg = packageType.toLowerCase();
    
    if (pkg.includes('1/2') || pkg.includes('half')) {
      floorPrice = beer.halfBBLKeg;
    } else if (pkg.includes('1/6') || pkg.includes('sixth')) {
      floorPrice = beer.sixthBBLKeg;
    } else if (pkg.includes('16oz')) {
      floorPrice = beer.case16oz;
    } else if (pkg.includes('12oz')) {
      floorPrice = beer.case12oz;
    } else {
      floorPrice = beer.floorPerBBL;
    }
    
    var isCompliant = proposedPrice >= floorPrice;
    var margin = floorPrice > 0 ? (proposedPrice - floorPrice) / floorPrice : 0;
    
    return {
      success: true,
      beer: beerName,
      package: packageType,
      proposedPrice: proposedPrice,
      floorPrice: floorPrice,
      isCompliant: isCompliant,
      marginAboveFloor: Math.round(margin * 1000) / 10,
      status: isCompliant ? 'OK' : 'BELOW FLOOR - FCCR RISK'
    };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 16: UTILITY FUNCTIONS FOR RAW MATERIALS LOOKUP
// ═══════════════════════════════════════════════════════════════════════════════

function getRawMaterials() {
  return getRawMaterialsInventory({});
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 17: CRM INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get CRM spreadsheet
 */
function getCrmSpreadsheet() {
  return SpreadsheetApp.openById(CRM_SPREADSHEET_ID);
}

/**
 * Get inventory for CRM (called by CRM when placing orders)
 */
function getInventoryForCrm() {
  try {
    var finishedGoods = getFinishedGoodsForCrm();
    
    if (!finishedGoods.success) {
      return { success: false, products: [] };
    }
    
    // Aggregate by product type and beer type
    var products = {};
    
    finishedGoods.inventory.forEach(function(item) {
      var key = item.productType + '|' + item.beerType;
      
      if (!products[key]) {
        products[key] = {
          productType: item.productType,
          beerType: item.beerType,
          availableQty: 0,
          avgCost: 0,
          totalValue: 0
        };
      }
      
      products[key].availableQty += item.availableQty;
      products[key].totalValue += item.availableQty * item.costPerUnit;
    });
    
    // Calculate average costs
    var productList = [];
    for (var key in products) {
      var p = products[key];
      p.avgCost = p.availableQty > 0 ? p.totalValue / p.availableQty : 0;
      productList.push(p);
    }
    
    return { success: true, products: productList };
    
  } catch (error) {
    Logger.log('Error getting inventory for CRM: ' + error.toString());
    return { success: false, message: error.toString(), products: [] };
  }
}

/**
 * Get finished goods for CRM (internal helper)
 */
function getFinishedGoodsForCrm() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.FINISHED_GOODS);
    
    if (!sheet) {
      return { success: true, inventory: [] };
    }
    
    var data = sheet.getDataRange().getValues();
    var inventory = [];
    
    // Start from data row (skip header rows)
    for (var i = FG_CONFIG.dataStartRow - 1; i < data.length; i++) {
      var row = data[i];
      var beerName = row[0];
      var packageType = row[1];
      var qtyOnHand = parseFloat(row[2]) || 0;
      var costPerUnit = parseFloat(row[3]) || 0;
      
      if (beerName && qtyOnHand > 0) {
        inventory.push({
          beerType: beerName,
          productType: packageType,
          availableQty: qtyOnHand,
          costPerUnit: costPerUnit
        });
      }
    }
    
    return { success: true, inventory: inventory };
    
  } catch (error) {
    Logger.log('Error getting finished goods for CRM: ' + error.toString());
    return { success: false, message: error.toString(), inventory: [] };
  }
}

/**
 * Get product catalog for CRM (with actual prices)
 */
function getProductCatalogForCrm() {
  try {
    var products = getFloorPrices();
    
    if (!products.success) {
      return { success: false, products: [] };
    }
    
    // Get inventory levels
    var inventory = getFinishedGoodsForCrm();
    var inventoryMap = {};
    
    if (inventory.success) {
      inventory.inventory.forEach(function(item) {
        var key = item.beerType + '|' + item.productType;
        if (!inventoryMap[key]) {
          inventoryMap[key] = 0;
        }
        inventoryMap[key] += item.availableQty;
      });
    }
    
    // Combine pricing with inventory
    var catalog = products.prices.map(function(product) {
      var key = product.packageType;
      var available = inventoryMap[key] || 0;
      
      return {
        packageType: product.packageType,
        price: product.floorPrice,
        availableQty: available,
        inStock: available > 0
      };
    });
    
    return { success: true, products: catalog };
    
  } catch (error) {
    Logger.log('Error getting product catalog for CRM: ' + error.toString());
    return { success: false, message: error.toString(), products: [] };
  }
}

/**
 * Update CRM with available products
 */
function updateCrmProductAvailability(productType, beerType, addedQty) {
  try {
    // This would sync to CRM's product catalog
    Logger.log('CRM updated: ' + beerType + ' ' + productType + ' +' + addedQty);
    
    // In full implementation, this would:
    // 1. Open CRM spreadsheet
    // 2. Update product availability
    // 3. Make product visible to sales reps
    
    return true;
  } catch (error) {
    Logger.log('Error updating CRM: ' + error.toString());
    return false;
  }
}

/**
 * Deplete B2B inventory when order is placed (FIFO)
 * @param {string} beerType - Beer name
 * @param {string} productType - Product type
 * @param {number} quantity - Quantity ordered
 * @return {object} Depletion result with COGS
 */
function depleteB2BInventory(beerType, productType, quantity) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.FINISHED_GOODS);
    
    if (!sheet) {
      return { success: false, message: 'Finished Goods sheet not found' };
    }
    
    var data = sheet.getDataRange().getValues();
    var remaining = quantity;
    var totalCost = 0;
    var startRow = FG_CONFIG.dataStartRow;
    
    // Deplete FIFO (oldest first)
    for (var i = startRow - 1; i < data.length; i++) {
      if (remaining <= 0) break;
      
      var rowBeer = (data[i][0] || '').toString().toLowerCase().trim();
      var rowPackage = (data[i][1] || '').toString().trim();
      var available = parseFloat(data[i][2]) || 0;
      var costPerUnit = parseFloat(data[i][3]) || 0;
      
      if (rowBeer === beerType.toLowerCase().trim() && 
          rowPackage === productType && 
          available > 0) {
        
        var toUse = Math.min(available, remaining);
        
        // Update quantity
        sheet.getRange(i + 1, 3).setValue(available - toUse);
        
        // Update status
        var newQty = available - toUse;
        var minQty = parseFloat(data[i][6]) || 5;
        var status = '✅ OK';
        if (newQty <= 0) status = '🚨 OUT';
        else if (newQty <= minQty) status = '⚠️ LOW';
        sheet.getRange(i + 1, 8).setValue(status);
        
        // Log the transaction
        logFGTransaction(beerType, productType, 'B2B SALE', available, newQty, -toUse, 'CRM order depletion');
        
        totalCost += toUse * costPerUnit;
        remaining -= toUse;
      }
    }
    
    if (remaining > 0) {
      return {
        success: false,
        message: 'Insufficient B2B inventory! Need ' + remaining + ' more units'
      };
    }
    
    return {
      success: true,
      quantityDepleted: quantity,
      totalCost: totalCost,
      costPerUnit: totalCost / quantity
    };
    
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * Log FG transaction for audit trail
 */
function logFGTransaction(beerName, packageType, type, oldQty, newQty, change, notes) {
  try {
    var ss = getBrmSpreadsheet();
    var logSheet = ss.getSheetByName(SHEETS.FG_LOG);
    
    // Create log sheet if it doesn't exist
    if (!logSheet) {
      logSheet = ss.insertSheet(SHEETS.FG_LOG);
      logSheet.appendRow(['Timestamp', 'Beer', 'Package', 'Type', 'Previous Qty', 'New Qty', 'Change', 'Notes', 'User']);
      logSheet.getRange(1, 1, 1, 9).setFontWeight('bold');
      logSheet.setFrozenRows(1);
    }
    
    var userEmail = Session.getActiveUser().getEmail() || 'System';
    
    logSheet.appendRow([
      new Date(),
      beerName,
      packageType,
      type,
      oldQty,
      newQty,
      change,
      notes || '',
      userEmail
    ]);
    
  } catch (e) {
    Logger.log('Error logging FG transaction: ' + e.toString());
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 18: KEG TRACKER INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sync keg inventory from Keg Tracker to BRM Finished Goods
 * Counts filled kegs at brewery (sellable inventory) and updates BRM
 * Run manually or set on daily trigger
 */
function syncKegTrackerToBRM() {
  try {
    var kt = SpreadsheetApp.openById(KEG_TRACKER_ID);
    var kegSheet = kt.getSheetByName('Current Status');
    
    if (!kegSheet) {
      Logger.log('ERROR: Keg Tracker Current Status sheet not found');
      return { success: false, message: 'Keg Tracker sheet not found' };
    }
    
    var kegData = kegSheet.getDataRange().getValues();
    
    // Statuses that count as sellable inventory at brewery
    var sellableStatuses = [
      'Full - Cold Storage',
      'In Taproom',
      'Full - Ready'
    ];
    
    // Count kegs by Beer + Size
    var kegCounts = {};
    var withCustomerCounts = {};
    
    for (var i = 1; i < kegData.length; i++) {
      var row = kegData[i];
      var kegId = (row[0] || '').toString().trim();
      if (!kegId) continue;
      
      var kegSize = (row[1] || '').toString().trim();       // Column B: Keg Size
      var status = (row[3] || '').toString().trim();        // Column D: Current Status
      var contents = (row[4] || '').toString().trim();      // Column E: Contents (beer name)
      var customerName = (row[10] || '').toString().trim(); // Column K: Customer Name
      
      if (!contents) continue;
      
      var packageType = mapKegSizeToPackageType(kegSize);
      if (!packageType) continue;
      
      var key = contents + '|' + packageType;
      
      // Count sellable inventory (at brewery, filled)
      if (sellableStatuses.indexOf(status) >= 0) {
        if (!kegCounts[key]) {
          kegCounts[key] = { beerName: contents, packageType: packageType, count: 0 };
        }
        kegCounts[key].count++;
      }
      
      // Track kegs with customers (for reporting)
      if (status === 'With Customer' && customerName) {
        if (!withCustomerCounts[key]) {
          withCustomerCounts[key] = { beerName: contents, packageType: packageType, count: 0 };
        }
        withCustomerCounts[key].count++;
      }
    }
    
    // Update BRM Finished Goods
    var brm = getBrmSpreadsheet();
    var fgSheet = brm.getSheetByName(SHEETS.FINISHED_GOODS);
    
    if (!fgSheet) {
      Logger.log('ERROR: BRM Finished Goods sheet not found');
      return { success: false, message: 'Finished Goods sheet not found' };
    }
    
    var fgData = fgSheet.getDataRange().getValues();
    var results = [];
    var updated = 0;
    var created = 0;
    var startRow = FG_CONFIG.dataStartRow;
    
    // Process each beer/package combination
    for (var key in kegCounts) {
      var item = kegCounts[key];
      var beerName = item.beerName;
      var packageType = item.packageType;
      var newQty = item.count;
      
      // Find existing row
      var existingRow = -1;
      for (var f = startRow - 1; f < fgData.length; f++) {
        var fgBeer = (fgData[f][0] || '').toString().trim();
        var fgPackage = (fgData[f][1] || '').toString().trim();
        
        if (fgBeer.toLowerCase() === beerName.toLowerCase() && fgPackage === packageType) {
          existingRow = f + 1;
          break;
        }
      }
      
      if (existingRow > 0) {
        // Update existing row
        var currentQty = parseFloat(fgSheet.getRange(existingRow, 3).getValue()) || 0;
        var costPerUnit = parseFloat(fgSheet.getRange(existingRow, 4).getValue()) || 0;
        var minQty = parseFloat(fgSheet.getRange(existingRow, 7).getValue()) || 5;
        
        fgSheet.getRange(existingRow, 3).setValue(newQty);
        fgSheet.getRange(existingRow, 5).setValue(newQty * costPerUnit);
        
        // Update status
        var status = '✅ OK';
        if (newQty <= 0) status = '🚨 OUT';
        else if (newQty <= minQty) status = '⚠️ LOW';
        fgSheet.getRange(existingRow, 8).setValue(status);
        
        logFGTransaction(beerName, packageType, 'SYNC', currentQty, newQty, newQty - currentQty, 'Keg Tracker sync');
        
        results.push({ beer: beerName, package: packageType, action: 'updated', oldQty: currentQty, newQty: newQty });
        updated++;
        
      } else {
        // Create new row
        var insertRow = fgSheet.getLastRow() + 1;
        fgSheet.getRange(insertRow, 1).setValue(beerName);
        fgSheet.getRange(insertRow, 2).setValue(packageType);
        fgSheet.getRange(insertRow, 3).setValue(newQty);
        fgSheet.getRange(insertRow, 4).setValue(0);
        fgSheet.getRange(insertRow, 5).setValue(0);
        fgSheet.getRange(insertRow, 6).setValue(0);
        fgSheet.getRange(insertRow, 7).setValue(5);
        fgSheet.getRange(insertRow, 8).setValue(newQty > 0 ? '✅ OK' : '🚨 OUT');
        
        logFGTransaction(beerName, packageType, 'SYNC', 0, newQty, newQty, 'Keg Tracker sync (new SKU)');
        
        results.push({ beer: beerName, package: packageType, action: 'created', oldQty: 0, newQty: newQty });
        created++;
      }
    }
    
    Logger.log('✅ Keg Tracker sync complete: ' + updated + ' updated, ' + created + ' created');
    
    return {
      success: true,
      message: 'Synced ' + updated + ' items, created ' + created + ' new SKUs',
      updated: updated,
      created: created,
      results: results,
      withCustomerSummary: withCustomerCounts
    };
    
  } catch (error) {
    Logger.log('syncKegTrackerToBRM error: ' + error.toString());
    return { success: false, message: error.toString() };
  }
}

/**
 * Map Keg Tracker size to BRM package type
 */
function mapKegSizeToPackageType(kegSize) {
  var sizeMap = {
    '1/2 BBL': '1/2 BBL Keg',
    '1/2BBL': '1/2 BBL Keg',
    '1/2': '1/2 BBL Keg',
    '1/6 BBL': '1/6 BBL Keg',
    '1/6BBL': '1/6 BBL Keg',
    '1/6': '1/6 BBL Keg',
    '1/4 BBL': '1/4 BBL Keg',
    '1/4BBL': '1/4 BBL Keg',
    '1/4': '1/4 BBL Keg',
    'Sixtel': '1/6 BBL Keg',
    'Half Barrel': '1/2 BBL Keg',
    'Quarter Barrel': '1/4 BBL Keg'
  };
  
  return sizeMap[kegSize] || null;
}

/**
 * Preview keg tracker sync without making changes
 */
function previewKegTrackerSync() {
  try {
    var kt = SpreadsheetApp.openById(KEG_TRACKER_ID);
    var kegSheet = kt.getSheetByName('Current Status');
    
    if (!kegSheet) {
      return { success: false, message: 'Keg Tracker sheet not found' };
    }
    
    var kegData = kegSheet.getDataRange().getValues();
    
    var sellableStatuses = ['Full - Cold Storage', 'In Taproom', 'Full - Ready'];
    var kegCounts = {};
    
    for (var i = 1; i < kegData.length; i++) {
      var row = kegData[i];
      var kegId = (row[0] || '').toString().trim();
      if (!kegId) continue;
      
      var kegSize = (row[1] || '').toString().trim();
      var status = (row[3] || '').toString().trim();
      var contents = (row[4] || '').toString().trim();
      
      if (!contents) continue;
      
      var packageType = mapKegSizeToPackageType(kegSize);
      if (!packageType) continue;
      
      if (sellableStatuses.indexOf(status) >= 0) {
        var key = contents + '|' + packageType;
        if (!kegCounts[key]) {
          kegCounts[key] = { beerName: contents, packageType: packageType, count: 0 };
        }
        kegCounts[key].count++;
      }
    }
    
    var preview = [];
    for (var key in kegCounts) {
      preview.push(kegCounts[key]);
    }
    
    return {
      success: true,
      preview: preview,
      totalItems: preview.length
    };
    
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 19: FCCR FINANCIAL CHAIN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * MASTER FUNCTION - Refresh the entire financial chain
 * Runs: Beer COGS → Fully Loaded Pricing → FCCR Command Center
 */
function refreshFullFinancialChain() {
  Logger.log('');
  Logger.log('═══════════════════════════════════════════════════════════');
  Logger.log('       RED LEG BREWING - FULL FINANCIAL REFRESH');
  Logger.log('═══════════════════════════════════════════════════════════');
  Logger.log('');
  
  // Step 1: Update Beer COGS Master
  Logger.log('STEP 1: Updating Beer COGS Master...');
  var cogsResult = updateBeerCOGSMaster();
  if (!cogsResult.success) {
    Logger.log('❌ Failed to update Beer COGS Master: ' + cogsResult.error);
    return { success: false, error: 'COGS update failed' };
  }
  Logger.log('✅ Beer COGS Master updated (' + cogsResult.recipesUpdated + ' recipes)');
  Logger.log('');
  
  // Step 2: Update Fully Loaded Pricing
  Logger.log('STEP 2: Updating Fully Loaded Pricing...');
  var pricingResult = updateFullyLoadedPricing();
  if (!pricingResult.success) {
    Logger.log('❌ Failed to update Fully Loaded Pricing: ' + pricingResult.error);
    return { success: false, error: 'Pricing update failed' };
  }
  Logger.log('✅ Fully Loaded Pricing updated (' + pricingResult.beersUpdated + ' beers)');
  Logger.log('');
  
  // Step 3: Update FCCR Command Center
  Logger.log('STEP 3: Updating FCCR Command Center...');
  var fccrResult = updateFCCRCommandCenter();
  if (!fccrResult.success) {
    Logger.log('❌ Failed to update FCCR Command Center: ' + fccrResult.error);
    return { success: false, error: 'FCCR update failed' };
  }
  Logger.log('✅ FCCR Command Center updated');
  Logger.log('');
  
  Logger.log('═══════════════════════════════════════════════════════════');
  Logger.log('       FINANCIAL CHAIN REFRESH COMPLETE');
  Logger.log('═══════════════════════════════════════════════════════════');
  
  return {
    success: true,
    cogsUpdated: cogsResult.recipesUpdated,
    pricingUpdated: pricingResult.beersUpdated,
    laborPerBatch: cogsResult.brewingLabor + cogsResult.packagingLabor,
    salesOverheadPerBBL: pricingResult.salesOverheadPerBBL
  };
}

/**
 * Get labor cost per batch from Labor Config sheet
 * Labor Config calculates: Total Annual Brewer Payroll ÷ Estimated Batches = Labor Per Batch
 */
function getLaborCostPerBatch() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.LABOR_CONFIG);
    
    if (!sheet) {
      Logger.log('Labor Config sheet not found, using default');
      return serializeForHtml({ 
        success: true, 
        brewingLabor: 3897.26, 
        packagingLabor: 0, 
        totalLabor: 3897.26,
        laborPerBBL: 77.95,
        source: 'default'
      });
    }
    
    // Labor Config structure:
    // B33 = Brewing Labor Per Batch
    // B34 = Packaging Labor Per Batch
    // B35 = Total Labor Per Batch
    // B38 = Brewing Labor Per BBL
    // B39 = Packaging Labor Per BBL
    // B40 = Total Labor Per BBL
    var brewingLabor = parseFloat(sheet.getRange('B33').getValue()) || 0;
    var packagingLabor = parseFloat(sheet.getRange('B34').getValue()) || 0;
    var totalLabor = parseFloat(sheet.getRange('B35').getValue()) || 0;
    
    // Also get per-BBL values
    var brewingPerBBL = parseFloat(sheet.getRange('B38').getValue()) || 0;
    var packagingPerBBL = parseFloat(sheet.getRange('B39').getValue()) || 0;
    var totalPerBBL = parseFloat(sheet.getRange('B40').getValue()) || 0;
    
    // If per-batch not found, try calculating from per-BBL × avg batch size
    if (totalLabor === 0 && totalPerBBL > 0) {
      var avgBatchSize = parseFloat(sheet.getRange('B5').getValue()) || 50;
      totalLabor = totalPerBBL * avgBatchSize;
      brewingLabor = brewingPerBBL * avgBatchSize;
      packagingLabor = packagingPerBBL * avgBatchSize;
      Logger.log('Calculated labor per batch from per-BBL: $' + totalLabor);
    }
    
    if (totalLabor === 0) {
      Logger.log('No labor values found in Labor Config, using defaults');
      return serializeForHtml({
        success: true,
        brewingLabor: 3897.26,
        packagingLabor: 0,
        totalLabor: 3897.26,
        laborPerBBL: 77.95,
        source: 'default (no labor configured)'
      });
    }
    
    return serializeForHtml({
      success: true,
      brewingLabor: Math.round(brewingLabor * 100) / 100,
      packagingLabor: Math.round(packagingLabor * 100) / 100,
      totalLabor: Math.round(totalLabor * 100) / 100,
      laborPerBBL: Math.round(totalPerBBL * 100) / 100,
      source: 'Labor Config'
    });
    
  } catch (e) {
    Logger.log('Error getting labor cost: ' + e.toString());
    return { success: false, error: e.toString(), totalLabor: 3897.26 };
  }
}

/**
 * Helper function to get ingredient cost
 */
function getIngredientCost(ingredientName, amount, uom, rmLookup, mapLookup) {
  if (!ingredientName || !amount) return 0;
  
  var ingKey = ingredientName.toLowerCase().trim();
  
  // Check ingredient map for translation
  var mapping = mapLookup[ingKey];
  var rmName = mapping ? mapping.rmName : ingredientName;
  var conversion = mapping ? mapping.conversionFactor : 1;
  
  // Look up cost in raw materials
  var rmKey = rmName.toString().toLowerCase().trim();
  var rm = rmLookup[rmKey];
  
  // Try fuzzy match if exact match fails
  if (!rm) {
    for (var key in rmLookup) {
      if (key.indexOf(rmKey) !== -1 || rmKey.indexOf(key) !== -1) {
        rm = rmLookup[key];
        break;
      }
    }
  }
  
  if (!rm) return 0;
  
  var cost = parseFloat(amount) * rm.avgCost * conversion;
  return cost;
}

/**
 * Update Beer COGS Master - calculates COGS for all recipes
 */
function updateBeerCOGSMaster() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.BEER_COGS_MASTER);
    
    if (!sheet) {
      Logger.log('Creating Beer COGS Master sheet...');
      sheet = ss.insertSheet(SHEETS.BEER_COGS_MASTER);
    }
    
    // Clear existing data
    sheet.clear();
    
    // Headers
    var headers = [
      'Beer Name', 'Batch Size (BBL)', 'Yield %', 'Expected Yield (BBL)',
      'Ingredient COGS', 'Brewing Labor', 'Packaging Labor', 
      'Total COGS', 'COGS Per BBL', 'Last Updated'
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#1a365d')
      .setFontColor('white');
    sheet.setFrozenRows(1);
    
    // Get labor costs
    var laborResult = getLaborCostPerBatch();
    var brewingLabor = laborResult.brewingLabor || 880;
    var packagingLabor = laborResult.packagingLabor || 0;
    
    Logger.log('Labor per batch - Brewing: $' + brewingLabor + ', Packaging: $' + packagingLabor);
    
    // Get yield % from Recipes sheet
    var yieldLookup = {};
    var recipesSheet = ss.getSheetByName(SHEETS.RECIPES);
    if (recipesSheet) {
      var recipesData = recipesSheet.getDataRange().getValues();
      var recHeaders = recipesData[0];
      
      var nameCol = 0, batchCol = -1, yieldPctCol = -1;
      for (var i = 0; i < recHeaders.length; i++) {
        var h = recHeaders[i].toString().toLowerCase();
        if (h.indexOf('recipe name') !== -1 || h === 'name') nameCol = i;
        if (h.indexOf('batch size') !== -1) batchCol = i;
        if (h.indexOf('yield %') !== -1 || h.indexOf('yield%') !== -1) yieldPctCol = i;
      }
      
      for (var i = 1; i < recipesData.length; i++) {
        var name = recipesData[i][nameCol];
        if (!name) continue;
        
        var batchSize = batchCol !== -1 ? parseFloat(recipesData[i][batchCol]) || 60 : 60;
        var yieldPct = yieldPctCol !== -1 ? parseFloat(recipesData[i][yieldPctCol]) || 0.95 : 0.95;
        
        if (yieldPct > 1) yieldPct = yieldPct / 100;
        
        yieldLookup[name.toString().toLowerCase().trim()] = {
          batchSize: batchSize,
          yieldPct: yieldPct
        };
      }
    }
    
    // Get all recipes with ingredients
    var recipesResult = getAllRecipesEnhanced();
    if (!recipesResult.success || !recipesResult.recipes) {
      Logger.log('Error getting recipes: ' + (recipesResult.error || 'Unknown'));
      return { success: false, error: 'Could not load recipes' };
    }
    
    // Get raw materials for costing
    var rmResult = getRawMaterialsInventory({});
    var rmLookup = {};
    
    if (rmResult.success && rmResult.materials) {
      rmResult.materials.forEach(function(m) {
        rmLookup[m.item.toLowerCase().trim()] = {
          avgCost: parseFloat(m.avgCost) || 0,
          unit: m.unit || 'lb'
        };
      });
    }
    
    // Load Ingredient Map
    var mapLookup = {};
    var mapSheet = ss.getSheetByName(SHEETS.INGREDIENT_MAP);
    if (mapSheet) {
      var mapData = mapSheet.getDataRange().getValues();
      for (var m = 1; m < mapData.length; m++) {
        var recipeName = (mapData[m][0] || '').toString().toLowerCase().trim();
        var rmName = (mapData[m][1] || '').toString().toLowerCase().trim();
        var convFactor = parseFloat(mapData[m][5]) || 1;
        
        if (recipeName) {
          mapLookup[recipeName] = {
            rmName: rmName,
            conversionFactor: convFactor
          };
        }
      }
    }
    
    // Calculate COGS for each recipe
    var rows = [];
    var now = new Date();
    var timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    
    recipesResult.recipes.forEach(function(recipe) {
      var ingredientCOGS = 0;
      
      // Calculate grain costs
      (recipe.grains || []).forEach(function(item) {
        var cost = getIngredientCost(item.ingredient, item.amount, item.uom, rmLookup, mapLookup);
        ingredientCOGS += cost;
      });
      
      // Calculate hop costs
      (recipe.hops || []).forEach(function(item) {
        var cost = getIngredientCost(item.ingredient, item.amount, item.uom, rmLookup, mapLookup);
        ingredientCOGS += cost;
      });
      
      // Calculate other ingredient costs
      (recipe.other || []).forEach(function(item) {
        var cost = getIngredientCost(item.ingredient, item.amount, item.uom, rmLookup, mapLookup);
        ingredientCOGS += cost;
      });
      
      // Get batch size and yield
      var recipeKey = recipe.recipeName.toLowerCase().trim();
      var yieldInfo = yieldLookup[recipeKey] || {};
      
      var batchSize = yieldInfo.batchSize || recipe.batchSize || 60;
      var yieldPct = yieldInfo.yieldPct || 0.95;
      var expectedYield = batchSize * yieldPct;
      
      var totalCOGS = ingredientCOGS + brewingLabor + packagingLabor;
      var cogsPerBBL = expectedYield > 0 ? totalCOGS / expectedYield : 0;
      
      rows.push([
        recipe.recipeName,
        batchSize,
        yieldPct,
        Math.round(expectedYield * 10) / 10,
        Math.round(ingredientCOGS * 100) / 100,
        Math.round(brewingLabor * 100) / 100,
        Math.round(packagingLabor * 100) / 100,
        Math.round(totalCOGS * 100) / 100,
        Math.round(cogsPerBBL * 100) / 100,
        timestamp
      ]);
    });
    
    // Sort by COGS Per BBL
    rows.sort(function(a, b) { return a[8] - b[8]; });
    
    // Write data
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
      
      // Format numbers
      sheet.getRange(2, 2, rows.length, 1).setNumberFormat('#,##0');
      sheet.getRange(2, 3, rows.length, 1).setNumberFormat('0%');
      sheet.getRange(2, 4, rows.length, 1).setNumberFormat('#,##0.0');
      sheet.getRange(2, 5, rows.length, 4).setNumberFormat('$#,##0.00');
      sheet.getRange(2, 9, rows.length, 1).setNumberFormat('$#,##0.00');
    }
    
    return {
      success: true,
      recipesUpdated: rows.length,
      brewingLabor: brewingLabor,
      packagingLabor: packagingLabor
    };
    
  } catch (e) {
    Logger.log('Error updating Beer COGS Master: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}


/**
 * Update FCCR Command Center with current COGS data
 */
function updateFCCRCommandCenter() {
  try {
    var ss = getBrmSpreadsheet();
    var fccrSheet = ss.getSheetByName(SHEETS.FCCR);
    var cogsSheet = ss.getSheetByName(SHEETS.BEER_COGS_MASTER);
    
    if (!fccrSheet || !cogsSheet) {
      return { success: false, error: 'Required sheets not found' };
    }
    
    // Get COGS data
    var cogsData = cogsSheet.getDataRange().getValues();
    var cogsLookup = {};
    
    for (var i = 1; i < cogsData.length; i++) {
      var beerName = cogsData[i][0];
      var cogsPerBBL = parseFloat(cogsData[i][8]) || 0;  // Column I = COGS Per BBL (index 8)
      
      if (beerName && cogsPerBBL > 0) {
        cogsLookup[beerName.toString().toLowerCase().trim()] = cogsPerBBL;
      }
    }
    
    // Find beer section in FCCR
    var fccrData = fccrSheet.getDataRange().getValues();
    var beerSectionStart = -1;
    
    for (var i = 0; i < fccrData.length; i++) {
      var cell = (fccrData[i][5] || '').toString().toLowerCase();
      if (cell.indexOf('beer name') !== -1) {
        beerSectionStart = i + 1;
        break;
      }
    }
    
    if (beerSectionStart === -1) {
      return { success: true, message: 'Beer section not found, skipping FCCR update' };
    }
    
    // Update Actual COGS column
    var updated = 0;
    for (var i = beerSectionStart; i < Math.min(beerSectionStart + 20, fccrData.length); i++) {
      var beerName = fccrData[i][5];
      if (!beerName || beerName.toString().trim() === '') continue;
      
      var beerKey = beerName.toString().toLowerCase().trim();
      var newCOGS = cogsLookup[beerKey];
      
      // Fuzzy match
      if (!newCOGS) {
        for (var key in cogsLookup) {
          if (key.indexOf(beerKey) !== -1 || beerKey.indexOf(key) !== -1) {
            newCOGS = cogsLookup[key];
            break;
          }
        }
      }
      
      if (newCOGS) {
        fccrSheet.getRange(i + 1, 9).setValue(Math.round(newCOGS * 100) / 100);
        updated++;
      }
    }
    
    return { success: true, beersUpdated: updated };
    
  } catch (e) {
    Logger.log('Error updating FCCR Command Center: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * Get current FCCR projection based on all inputs
 */
function getFCCRProjection() {
  try {
    var ss = getBrmSpreadsheet();
    var fccrSheet = ss.getSheetByName(SHEETS.FCCR);
    
    if (!fccrSheet) {
      return { success: false, error: 'FCCR Command Center not found' };
    }
    
    var data = fccrSheet.getDataRange().getValues();
    
    var result = {
      debtService: 0,
      requiredFCCR: 1.25,
      targetFCCR: 1.35,
      viewPropertiesNOI: 0,
      requiredEBITDA: 0,
      revenueTarget: 0,
      taproomPct: 0.40,
      wholesalePct: 0.60,
      taproomMargin: 0.70,
      wholesaleMargin: 0.30
    };
    
    // Parse key values
    for (var i = 0; i < data.length; i++) {
      var label = (data[i][0] || '').toString().toLowerCase();
      var value = data[i][1];
      
      if (label.indexOf('total annual debt') !== -1) {
        result.debtService = parseFloat(value) || 0;
      } else if (label.indexOf('covenant minimum') !== -1) {
        result.requiredFCCR = parseFloat(value) || 1.25;
      } else if (label.indexOf('target fccr') !== -1) {
        result.targetFCCR = parseFloat(value) || 1.35;
      } else if (label.indexOf('view properties') !== -1) {
        result.viewPropertiesNOI = parseFloat(value) || 0;
      } else if (label.indexOf('net revenue target') !== -1) {
        result.revenueTarget = parseFloat(value) || 0;
      }
    }
    
    // Calculate required Red Leg EBITDA
    result.requiredEBITDA = (result.debtService * result.targetFCCR) - result.viewPropertiesNOI;
    
    // Calculate gross profit targets
    result.taproomRevenue = result.revenueTarget * result.taproomPct;
    result.wholesaleRevenue = result.revenueTarget * result.wholesalePct;
    result.taproomGrossProfit = result.taproomRevenue * result.taproomMargin;
    result.wholesaleGrossProfit = result.wholesaleRevenue * result.wholesaleMargin;
    result.totalGrossProfit = result.taproomGrossProfit + result.wholesaleGrossProfit;
    
    result.success = true;
    return result;
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Add menu for financial refresh functions
 */
function addFinancialRefreshMenu() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🍺 Red Leg BRM')
    .addItem('Refresh Full Financial Chain', 'refreshFullFinancialChain')
    .addSeparator()
    .addItem('Update Beer COGS Only', 'updateBeerCOGSMaster')
    .addItem('Update Floor Pricing Only', 'updateFullyLoadedPricing')
    .addItem('Update FCCR Only', 'updateFCCRCommandCenter')
    .addSeparator()
    .addItem('Sync Keg Tracker', 'syncKegTrackerToBRM')
    .addItem('Preview Keg Sync', 'previewKegTrackerSync')
    .addSeparator()
    .addItem('Recalc Raw Materials Values', 'recalculateRawMaterialsTotalValue')
    .addToUi();
}

// ═══════════════════════════════════════════════════════════════════════════════
// END OF CONSOLIDATED CODE.GS
// Total: ~3,500 lines with all integrations
// Includes: UI Functions, CRM Integration, Keg Tracker Integration, FCCR Chain
// ═══════════════════════════════════════════════════════════════════════════════


/**
 * One-time function to recalculate Total Value for all Raw Materials
 * Run this after importing data from Ekos or other systems
 */
function recalculateRawMaterialsTotalValue() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(RAW_MATERIAL_CONFIG.sheetName);
    if (!sheet) return { success: false, error: 'Raw Materials sheet not found' };
    
    var data = sheet.getDataRange().getValues();
    var cols = RAW_MATERIAL_CONFIG.columns;
    var updated = 0;
    
    for (var i = RAW_MATERIAL_CONFIG.dataStartRow - 1; i < data.length; i++) {
      var itemName = data[i][cols.item - 1];
      if (!itemName || itemName.toString().trim() === '') continue;
      
      var qtyOnHand = parseFloat(data[i][cols.qtyOnHand - 1]) || 0;
      var avgCost = parseFloat(data[i][cols.avgCost - 1]) || 0;
      var totalValue = Math.round(qtyOnHand * avgCost * 100) / 100;
      
      // Update Total Value column
      sheet.getRange(i + 1, cols.totalValue).setValue(totalValue);
      updated++;
    }
    
    return { success: true, message: 'Updated Total Value for ' + updated + ' items' };
  } catch (e) {
    Logger.log('Error recalculating total values: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}
// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED PRICING CHAIN WITH SALES CHANNEL SUPPORT
// 
// New Recipe Field: "Sales Channel" (Column L in Recipes sheet)
//   - "Taproom" = Only Floor Pricing (7 BBL pilot batches, taproom exclusives)
//   - "B2B" = Only Fully Loaded Pricing (contract brewing, wholesale only)
//   - "Both" = Both pricing sheets (standard production beers)
//
// This prevents taproom-only beers from showing in CRM
// ═══════════════════════════════════════════════════════════════════════════════

// Add this to your SHEETS config if not present
// SHEETS.RECIPES = 'Recipes';

// Column index for Sales Channel in Recipes sheet (0-indexed)
// Adjust based on your actual Recipes sheet structure
var RECIPES_SALES_CHANNEL_COL = 11;  // Column L (after Notes in column K)

// Valid sales channel values
var SALES_CHANNELS = {
  TAPROOM: 'Taproom',
  B2B: 'B2B', 
  BOTH: 'Both'
};

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATED: Get recipes with Sales Channel info
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all recipes with sales channel information
 * Returns which channel each beer should be sold through
 */
function getRecipesWithSalesChannel() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.RECIPES);
    
    if (!sheet) {
      return { success: false, error: 'Recipes sheet not found' };
    }
    
    var data = sheet.getDataRange().getValues();
    var recipes = {};
    
    // Find Sales Channel column dynamically
    var headers = data[0];
    var salesChannelCol = -1;
    
    for (var h = 0; h < headers.length; h++) {
      var header = (headers[h] || '').toString().toLowerCase();
      if (header.indexOf('sales channel') !== -1 || header.indexOf('channel') !== -1) {
        salesChannelCol = h;
        break;
      }
    }
    
    // If not found, use default column
    if (salesChannelCol === -1) {
      salesChannelCol = RECIPES_SALES_CHANNEL_COL;
      Logger.log('Sales Channel column not found in headers, using column ' + (salesChannelCol + 1));
    }
    
    for (var i = 1; i < data.length; i++) {
      var recipeName = (data[i][0] || '').toString().trim();
      if (!recipeName) continue;
      
      var salesChannel = (data[i][salesChannelCol] || '').toString().trim();
      
      // Default to "Both" if not specified (backward compatibility)
      if (!salesChannel || 
          (salesChannel !== SALES_CHANNELS.TAPROOM && 
           salesChannel !== SALES_CHANNELS.B2B && 
           salesChannel !== SALES_CHANNELS.BOTH)) {
        salesChannel = SALES_CHANNELS.BOTH;
      }
      
      var batchSize = parseFloat(data[i][2]) || 60;
      
      recipes[recipeName.toLowerCase().trim()] = {
        name: recipeName,
        salesChannel: salesChannel,
        batchSize: batchSize,
        // Auto-suggest based on batch size
        suggestedChannel: batchSize <= 10 ? SALES_CHANNELS.TAPROOM : SALES_CHANNELS.BOTH
      };
    }
    
    return { success: true, recipes: recipes };
    
  } catch (e) {
    Logger.log('Error getting recipes with sales channel: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// UPDATED: Update Beer COGS Master (includes sales channel)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Update Beer COGS Master - now includes Sales Channel column
 */
function updateBeerCOGSMaster() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.BEER_COGS_MASTER);
    
    if (!sheet) {
      Logger.log('Creating Beer COGS Master sheet...');
      sheet = ss.insertSheet(SHEETS.BEER_COGS_MASTER);
    }
    
    // Clear existing data
    sheet.clear();
    
    // Headers - now includes Sales Channel
    var headers = [
      'Beer Name', 'Batch Size (BBL)', 'Yield %', 'Expected Yield (BBL)',
      'Ingredient COGS', 'Brewing Labor', 'Packaging Labor', 
      'Total COGS', 'COGS Per BBL', 'Sales Channel', 'Last Updated'
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#1a365d')
      .setFontColor('white');
    sheet.setFrozenRows(1);
    
    // Get labor costs
    var laborResult = getLaborCostPerBatch();
    var brewingLabor = laborResult.brewingLabor || 880;
    var packagingLabor = laborResult.packagingLabor || 0;
    
    // Get recipes with sales channel
    var recipesChannelResult = getRecipesWithSalesChannel();
    var recipeChannels = recipesChannelResult.success ? recipesChannelResult.recipes : {};
    
    // Get yield % from Recipes sheet
    var yieldLookup = {};
    var recipesSheet = ss.getSheetByName(SHEETS.RECIPES);
    if (recipesSheet) {
      var recipesData = recipesSheet.getDataRange().getValues();
      var recHeaders = recipesData[0];
      
      var nameCol = 0, batchCol = -1, yieldPctCol = -1;
      for (var i = 0; i < recHeaders.length; i++) {
        var h = recHeaders[i].toString().toLowerCase();
        if (h.indexOf('recipe name') !== -1 || h === 'name') nameCol = i;
        if (h.indexOf('batch size') !== -1) batchCol = i;
        if (h.indexOf('yield %') !== -1 || h.indexOf('yield%') !== -1) yieldPctCol = i;
      }
      
      for (var i = 1; i < recipesData.length; i++) {
        var name = recipesData[i][nameCol];
        if (!name) continue;
        
        var batchSize = batchCol !== -1 ? parseFloat(recipesData[i][batchCol]) || 60 : 60;
        var yieldPct = yieldPctCol !== -1 ? parseFloat(recipesData[i][yieldPctCol]) || 0.95 : 0.95;
        
        if (yieldPct > 1) yieldPct = yieldPct / 100;
        
        yieldLookup[name.toString().toLowerCase().trim()] = {
          batchSize: batchSize,
          yieldPct: yieldPct
        };
      }
    }
    
    // Get all recipes with ingredients
    var recipesResult = getAllRecipesEnhanced();
    if (!recipesResult.success || !recipesResult.recipes) {
      Logger.log('Error getting recipes: ' + (recipesResult.error || 'Unknown'));
      return { success: false, error: 'Could not load recipes' };
    }
    
    // Get raw materials for costing
    var rmResult = getRawMaterialsInventory({});
    var rmLookup = {};
    
    if (rmResult.success && rmResult.materials) {
      rmResult.materials.forEach(function(m) {
        rmLookup[m.item.toLowerCase().trim()] = {
          avgCost: parseFloat(m.avgCost) || 0,
          unit: m.unit || 'lb'
        };
      });
    }
    
    // Load Ingredient Map
    var mapLookup = {};
    var mapSheet = ss.getSheetByName(SHEETS.INGREDIENT_MAP);
    if (mapSheet) {
      var mapData = mapSheet.getDataRange().getValues();
      for (var m = 1; m < mapData.length; m++) {
        var recipeName = (mapData[m][0] || '').toString().toLowerCase().trim();
        var rmName = (mapData[m][1] || '').toString().toLowerCase().trim();
        var convFactor = parseFloat(mapData[m][5]) || 1;
        
        if (recipeName) {
          mapLookup[recipeName] = {
            rmName: rmName,
            conversionFactor: convFactor
          };
        }
      }
    }
    
    // Calculate COGS for each recipe
    var rows = [];
    var now = new Date();
    var timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    
    recipesResult.recipes.forEach(function(recipe) {
      var ingredientCOGS = 0;
      
      // Calculate ingredient costs (grains, hops, other)
      var allIngredients = (recipe.grains || []).concat(recipe.hops || []).concat(recipe.other || []);
      allIngredients.forEach(function(item) {
        var cost = getIngredientCost(item.ingredient, item.amount, item.uom, rmLookup, mapLookup);
        ingredientCOGS += cost;
      });
      
      // Get batch size and yield
      var recipeKey = recipe.recipeName.toLowerCase().trim();
      var yieldInfo = yieldLookup[recipeKey] || {};
      var channelInfo = recipeChannels[recipeKey] || {};
      
      var batchSize = yieldInfo.batchSize || recipe.batchSize || 60;
      var yieldPct = yieldInfo.yieldPct || 0.95;
      var expectedYield = batchSize * yieldPct;
      var salesChannel = channelInfo.salesChannel || SALES_CHANNELS.BOTH;
      
      var totalCOGS = ingredientCOGS + brewingLabor + packagingLabor;
      var cogsPerBBL = expectedYield > 0 ? totalCOGS / expectedYield : 0;
      
      rows.push([
        recipe.recipeName,
        batchSize,
        yieldPct,
        Math.round(expectedYield * 10) / 10,
        Math.round(ingredientCOGS * 100) / 100,
        Math.round(brewingLabor * 100) / 100,
        Math.round(packagingLabor * 100) / 100,
        Math.round(totalCOGS * 100) / 100,
        Math.round(cogsPerBBL * 100) / 100,
        salesChannel,
        timestamp
      ]);
    });
    
    // Sort by COGS Per BBL
    rows.sort(function(a, b) { return a[8] - b[8]; });
    
    // Write data
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
      
      // Format numbers
      sheet.getRange(2, 2, rows.length, 1).setNumberFormat('#,##0');
      sheet.getRange(2, 3, rows.length, 1).setNumberFormat('0%');
      sheet.getRange(2, 4, rows.length, 1).setNumberFormat('#,##0.0');
      sheet.getRange(2, 5, rows.length, 4).setNumberFormat('$#,##0.00');
      sheet.getRange(2, 9, rows.length, 1).setNumberFormat('$#,##0.00');
      
      // Color code Sales Channel
      for (var r = 0; r < rows.length; r++) {
        var channelCell = sheet.getRange(r + 2, 10);
        var channel = rows[r][9];
        
        if (channel === SALES_CHANNELS.TAPROOM) {
          channelCell.setBackground('#fef3c7').setFontColor('#92400e');  // Amber
        } else if (channel === SALES_CHANNELS.B2B) {
          channelCell.setBackground('#dbeafe').setFontColor('#1e40af');  // Blue
        } else {
          channelCell.setBackground('#d1fae5').setFontColor('#065f46');  // Green (Both)
        }
      }
    }
    
    return {
      success: true,
      recipesUpdated: rows.length,
      brewingLabor: brewingLabor,
      packagingLabor: packagingLabor
    };
    
  } catch (e) {
    Logger.log('Error updating Beer COGS Master: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// UPDATED: Update Fully Loaded Pricing - FLAT PRICING (No .01)
// ═══════════════════════════════════════════════════════════════════════════════
// 
// WHAT CHANGED:
// - Keg prices now round UP to nearest whole dollar (Math.ceil)
// - Case prices round to nearest $0.50
// - Protects margins while giving sales team clean numbers
//
// TO USE:
// 1. In your BRM Code.gs, find BOTH copies of updateFullyLoadedPricing()
//    - First one around line 6360
//    - Second one around line 6982
// 2. DELETE BOTH copies
// 3. Paste this function in place of the second one (around line 6982)
// 4. Save and run refreshFullFinancialChain() to update all prices
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Update Fully Loaded Pricing from Beer COGS Master
 * ONLY includes beers with Sales Channel = "B2B" or "Both"
 * Taproom-only beers are EXCLUDED (won't show in CRM)
 * 
 * PRICING ROUNDING:
 * - Kegs: Round UP to nearest $1 (protects margins)
 * - Cases: Round to nearest $0.50
 */
function updateFullyLoadedPricing() {
  try {
    var ss = getBrmSpreadsheet();
    var flpSheet = ss.getSheetByName(SHEETS.FULLY_LOADED_PRICING);
    var cogsSheet = ss.getSheetByName(SHEETS.BEER_COGS_MASTER);
    var soSheet = ss.getSheetByName('Sales Overhead');
    
    if (!flpSheet) {
      return { success: false, error: 'Fully Loaded Pricing sheet not found' };
    }
    if (!cogsSheet) {
      return { success: false, error: 'Beer COGS Master sheet not found' };
    }
    
    // Get Sales Overhead per BBL
    var salesOverheadPerBBL = 143.92;
    if (soSheet) {
      var soData = soSheet.getDataRange().getValues();
      for (var i = 0; i < soData.length; i++) {
        var label = (soData[i][0] || '').toString().toUpperCase();
        if (label.indexOf('SALES COST PER BBL') !== -1 || label.indexOf('COST PER BBL') !== -1) {
          salesOverheadPerBBL = parseFloat(soData[i][1]) || 143.92;
          break;
        }
      }
    }
    
    // Get required margin from FLP sheet
    var requiredMargin = 0.30;
    var flpData = flpSheet.getDataRange().getValues();
    for (var i = 0; i < Math.min(10, flpData.length); i++) {
      var label = (flpData[i][0] || '').toString().toLowerCase();
      if (label.indexOf('required') !== -1 && label.indexOf('margin') !== -1) {
        requiredMargin = parseFloat(flpData[i][1]) || 0.30;
        if (requiredMargin > 1) requiredMargin = requiredMargin / 100;
        break;
      }
    }
    
    // Get COGS data - FILTER by Sales Channel (B2B or Both only)
    var cogsData = cogsSheet.getDataRange().getValues();
    var cogsHeaders = cogsData[0];
    
    // Find Sales Channel column in COGS sheet
    var salesChannelCol = -1;
    for (var h = 0; h < cogsHeaders.length; h++) {
      if ((cogsHeaders[h] || '').toString().toLowerCase().indexOf('sales channel') !== -1) {
        salesChannelCol = h;
        break;
      }
    }
    
    var cogsLookup = {};
    var taproomOnlySkipped = 0;
    
    for (var i = 1; i < cogsData.length; i++) {
      var beerName = (cogsData[i][0] || '').toString().trim();
      var cogsPerBBL = parseFloat(cogsData[i][8]) || 0;
      var salesChannel = salesChannelCol >= 0 ? (cogsData[i][salesChannelCol] || '').toString().trim() : 'Both';
      
      if (!beerName || cogsPerBBL <= 0) continue;
      
      // SKIP Taproom-only beers for Fully Loaded Pricing
      if (salesChannel === 'Taproom') {
        Logger.log('Skipping Taproom-only beer for FLP: ' + beerName);
        taproomOnlySkipped++;
        continue;
      }
      
      cogsLookup[beerName.toLowerCase().trim()] = {
        name: beerName,
        cogsPerBBL: cogsPerBBL,
        salesChannel: salesChannel
      };
    }
    
    // Find header row in FLP
    var headerRow = -1;
    for (var i = 0; i < flpData.length; i++) {
      var cell = (flpData[i][0] || '').toString().toLowerCase();
      if (cell === 'beer' || cell.indexOf('beer name') !== -1) {
        headerRow = i;
        break;
      }
    }
    
    if (headerRow === -1) {
      return { success: false, error: 'Could not find header row in Fully Loaded Pricing' };
    }
    
    // Build list of existing beers in FLP
    var existingBeers = {};
    var dataStartRow = headerRow + 2;
    
    for (var i = dataStartRow - 1; i < flpData.length; i++) {
      var beerName = (flpData[i][0] || '').toString().trim();
      if (beerName && !beerName.includes('Yellow') && !beerName.includes('Enter') && 
          !beerName.includes('Column') && !beerName.includes('HOW TO USE')) {
        existingBeers[beerName.toLowerCase().trim()] = i + 1;
      }
    }
    
    var updated = 0;
    var created = 0;
    
    // Update existing rows AND create new ones (B2B and Both only)
    for (var beerKey in cogsLookup) {
      var beer = cogsLookup[beerKey];
      var cogsPerBBL = beer.cogsPerBBL;
      var beerName = beer.name;
      
      // Calculate pricing
      var fullyLoaded = cogsPerBBL + salesOverheadPerBBL;
      var floorPerBBL = fullyLoaded / (1 - requiredMargin);
      
      // ═══════════════════════════════════════════════════════════════════════
      // FLAT PRICING - Round UP kegs to whole dollars, cases to $0.50
      // ═══════════════════════════════════════════════════════════════════════
      var halfKegFloor = Math.ceil(floorPerBBL / 2);           // Round UP to $1
      var sixthKegFloor = Math.ceil(floorPerBBL / 6);          // Round UP to $1
      var case16ozFloor = Math.ceil(floorPerBBL / 10.33 * 2) / 2;  // Round to $0.50
      var case12ozFloor = Math.ceil(floorPerBBL / 13.78 * 2) / 2;  // Round to $0.50
      
      if (existingBeers[beerKey]) {
        // UPDATE existing row
        var rowNum = existingBeers[beerKey];
        
        flpSheet.getRange(rowNum, 2).setValue(Math.round(cogsPerBBL * 100) / 100);  // COGS stays precise
        flpSheet.getRange(rowNum, 3).setValue(salesOverheadPerBBL);
        flpSheet.getRange(rowNum, 4).setValue(Math.round(fullyLoaded * 100) / 100);  // Fully Loaded stays precise
        flpSheet.getRange(rowNum, 5).setValue(Math.round(floorPerBBL * 100) / 100);  // Floor/BBL stays precise
        flpSheet.getRange(rowNum, 6).setValue(halfKegFloor);    // FLAT - $XX.00
        flpSheet.getRange(rowNum, 7).setValue(sixthKegFloor);   // FLAT - $XX.00
        flpSheet.getRange(rowNum, 10).setValue(case16ozFloor);  // $XX.00 or $XX.50
        flpSheet.getRange(rowNum, 11).setValue(case12ozFloor);  // $XX.00 or $XX.50
        
        updated++;
        
      } else {
        // CREATE new row
        var lastRow = flpSheet.getLastRow() + 1;
        
        var newRow = [
          beerName,
          Math.round(cogsPerBBL * 100) / 100,
          salesOverheadPerBBL,
          Math.round(fullyLoaded * 100) / 100,
          Math.round(floorPerBBL * 100) / 100,
          halfKegFloor,      // FLAT
          sixthKegFloor,     // FLAT
          '',  // Current 1/2 (manual)
          '',  // Status
          case16ozFloor,     // FLAT
          case12ozFloor      // FLAT
        ];
        
        flpSheet.getRange(lastRow, 1, 1, newRow.length).setValues([newRow]);
        
        Logger.log('Created new FLP row for B2B beer: ' + beerName);
        created++;
      }
    }
    
    Logger.log('═══════════════════════════════════════════════════════════════');
    Logger.log('  FULLY LOADED PRICING UPDATE COMPLETE');
    Logger.log('═══════════════════════════════════════════════════════════════');
    Logger.log('  Updated: ' + updated + ' beers');
    Logger.log('  Created: ' + created + ' new beers');
    Logger.log('  Skipped: ' + taproomOnlySkipped + ' taproom-only beers');
    Logger.log('  Sales Overhead: $' + salesOverheadPerBBL + '/BBL');
    Logger.log('  Required Margin: ' + (requiredMargin * 100) + '%');
    Logger.log('  Pricing: FLAT (kegs round UP to $1, cases to $0.50)');
    Logger.log('═══════════════════════════════════════════════════════════════');
    
    return { 
      success: true, 
      beersUpdated: updated,
      beersCreated: created,
      taproomOnlySkipped: taproomOnlySkipped,
      salesOverheadPerBBL: salesOverheadPerBBL,
      requiredMargin: requiredMargin
    };
    
  } catch (e) {
    Logger.log('Error updating Fully Loaded Pricing: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// UPDATED: Update Floor Pricing - ONLY Taproom and Both
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Update Floor Pricing (Taproom) from Beer COGS Master
 * ONLY includes beers with Sales Channel = "Taproom" or "Both"
 * B2B-only beers are EXCLUDED (not sold in taproom)
 */
function updateFloorPricing() {
  try {
    var ss = getBrmSpreadsheet();
    var fpSheet = ss.getSheetByName(SHEETS.FLOOR_PRICING);
    var cogsSheet = ss.getSheetByName(SHEETS.BEER_COGS_MASTER);
    
    if (!fpSheet) {
      return { success: false, error: 'Floor Pricing sheet not found' };
    }
    if (!cogsSheet) {
      return { success: false, error: 'Beer COGS Master sheet not found' };
    }
    
    // Get Floor Pricing parameters
    var targetMargin = 0.75;
    var cogsBuffer = 0.10;
    
    var fpData = fpSheet.getDataRange().getValues();
    
    for (var i = 0; i < Math.min(10, fpData.length); i++) {
      var label = (fpData[i][0] || '').toString().toLowerCase();
      if (label.indexOf('target margin') !== -1) {
        targetMargin = parseFloat(fpData[i][1]) || 0.75;
        if (targetMargin > 1) targetMargin = targetMargin / 100;
      }
      if (label.indexOf('cogs buffer') !== -1) {
        cogsBuffer = parseFloat(fpData[i][1]) || 0.10;
        if (cogsBuffer > 1) cogsBuffer = cogsBuffer / 100;
      }
    }
    
    // Get COGS data - FILTER by Sales Channel (Taproom or Both only)
    var cogsData = cogsSheet.getDataRange().getValues();
    var cogsHeaders = cogsData[0];
    
    // Find Sales Channel column
    var salesChannelCol = -1;
    for (var h = 0; h < cogsHeaders.length; h++) {
      if ((cogsHeaders[h] || '').toString().toLowerCase().indexOf('sales channel') !== -1) {
        salesChannelCol = h;
        break;
      }
    }
    
    var cogsLookup = {};
    var b2bOnlySkipped = 0;
    
    for (var i = 1; i < cogsData.length; i++) {
      var beerName = (cogsData[i][0] || '').toString().trim();
      var cogsPerBBL = parseFloat(cogsData[i][8]) || 0;
      var salesChannel = salesChannelCol >= 0 ? (cogsData[i][salesChannelCol] || '').toString().trim() : SALES_CHANNELS.BOTH;
      
      if (!beerName || cogsPerBBL <= 0) continue;
      
      // SKIP B2B-only beers for Floor Pricing
      if (salesChannel === SALES_CHANNELS.B2B) {
        Logger.log('Skipping B2B-only beer for Floor Pricing: ' + beerName);
        b2bOnlySkipped++;
        continue;
      }
      
      cogsLookup[beerName.toLowerCase().trim()] = {
        name: beerName,
        cogsPerBBL: cogsPerBBL,
        salesChannel: salesChannel
      };
    }
    
    // Find header row in Floor Pricing
    var headerRow = -1;
    for (var i = 0; i < fpData.length; i++) {
      var cell = (fpData[i][0] || '').toString().toLowerCase();
      if (cell === 'beer name' || cell === 'beer') {
        headerRow = i;
        break;
      }
    }
    
    if (headerRow === -1) {
      headerRow = 9;  // Default
    }
    
    // Build list of existing beers
    var existingBeers = {};
    var dataStartRow = headerRow + 2;
    
    for (var i = dataStartRow - 1; i < fpData.length; i++) {
      var beerName = (fpData[i][0] || '').toString().trim();
      if (beerName && !beerName.includes('LEGEND') && !beerName.includes('FORMULA') && 
          !beerName.includes('NEVER SELL')) {
        existingBeers[beerName.toLowerCase().trim()] = i + 1;
      }
    }
    
    var updated = 0;
    var created = 0;
    
    // Update existing rows AND create new ones (Taproom and Both only)
    for (var beerKey in cogsLookup) {
      var beer = cogsLookup[beerKey];
      var cogsPerBBL = beer.cogsPerBBL;
      var beerName = beer.name;
      
      // Calculate Floor Pricing values
      var bufferedCOGS = cogsPerBBL * (1 + cogsBuffer);
      var floorPerBBL = bufferedCOGS / (1 - targetMargin);
      var halfBBLKeg = floorPerBBL / 2;
      var sixthBBLKeg = floorPerBBL / 6;
      var case16oz = floorPerBBL / 10.33;
      var case12oz = floorPerBBL / 13.78;
      
      if (existingBeers[beerKey]) {
        // UPDATE existing row
        var rowNum = existingBeers[beerKey];
        
        fpSheet.getRange(rowNum, 2).setValue(Math.round(cogsPerBBL * 100) / 100);
        fpSheet.getRange(rowNum, 3).setValue(Math.round(bufferedCOGS * 100) / 100);
        fpSheet.getRange(rowNum, 4).setValue(Math.round(floorPerBBL * 100) / 100);
        fpSheet.getRange(rowNum, 5).setValue(Math.round(halfBBLKeg * 100) / 100);
        fpSheet.getRange(rowNum, 6).setValue(Math.round(sixthBBLKeg * 100) / 100);
        fpSheet.getRange(rowNum, 7).setValue(Math.round(case16oz * 100) / 100);
        fpSheet.getRange(rowNum, 8).setValue(Math.round(case12oz * 100) / 100);
        
        updated++;
        
      } else {
        // CREATE new row
        var lastRow = fpSheet.getLastRow() + 1;
        
        var newRow = [
          beerName,
          Math.round(cogsPerBBL * 100) / 100,
          Math.round(bufferedCOGS * 100) / 100,
          Math.round(floorPerBBL * 100) / 100,
          Math.round(halfBBLKeg * 100) / 100,
          Math.round(sixthBBLKeg * 100) / 100,
          Math.round(case16oz * 100) / 100,
          Math.round(case12oz * 100) / 100,
          'Yes',  // Active
          ''      // Notes
        ];
        
        fpSheet.getRange(lastRow, 1, 1, newRow.length).setValues([newRow]);
        
        Logger.log('Created new Floor Pricing row for taproom beer: ' + beerName);
        created++;
      }
    }
    
    Logger.log('Floor Pricing: Updated ' + updated + ', Created ' + created + ', Skipped ' + b2bOnlySkipped + ' B2B-only');
    
    return { 
      success: true, 
      beersUpdated: updated,
      beersCreated: created,
      b2bOnlySkipped: b2bOnlySkipped,
      targetMargin: targetMargin,
      cogsBuffer: cogsBuffer
    };
    
  } catch (e) {
    Logger.log('Error updating Floor Pricing: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// UPDATED: Master refresh function with Sales Channel awareness
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * MASTER FUNCTION - Refresh the entire financial chain with Sales Channel logic
 */
function refreshFullFinancialChain() {
  Logger.log('');
  Logger.log('═══════════════════════════════════════════════════════════════════');
  Logger.log('       RED LEG BREWING - FULL FINANCIAL REFRESH');
  Logger.log('       (With Sales Channel Routing)');
  Logger.log('═══════════════════════════════════════════════════════════════════');
  Logger.log('');
  
  // Step 1: Update Beer COGS Master (includes Sales Channel)
  Logger.log('STEP 1: Updating Beer COGS Master...');
  var cogsResult = updateBeerCOGSMaster();
  if (!cogsResult.success) {
    Logger.log('❌ Failed: ' + cogsResult.error);
    return { success: false, error: 'COGS update failed: ' + cogsResult.error };
  }
  Logger.log('✅ ' + cogsResult.recipesUpdated + ' recipes processed');
  Logger.log('');
  
  // Step 2: Update Fully Loaded Pricing (B2B + Both only)
  Logger.log('STEP 2: Updating Fully Loaded Pricing (B2B channel)...');
  var flpResult = updateFullyLoadedPricing();
  if (!flpResult.success) {
    Logger.log('❌ Failed: ' + flpResult.error);
    return { success: false, error: 'FLP update failed: ' + flpResult.error };
  }
  Logger.log('✅ Updated: ' + flpResult.beersUpdated + ', Created: ' + flpResult.beersCreated);
  if (flpResult.taproomOnlySkipped > 0) {
    Logger.log('   ⏭️  Skipped ' + flpResult.taproomOnlySkipped + ' taproom-only beers (won\'t show in CRM)');
  }
  Logger.log('');
  
  // Step 3: Update Floor Pricing (Taproom + Both only)
  Logger.log('STEP 3: Updating Floor Pricing (Taproom channel)...');
  var fpResult = updateFloorPricing();
  if (!fpResult.success) {
    Logger.log('❌ Failed: ' + fpResult.error);
    return { success: false, error: 'Floor Pricing update failed: ' + fpResult.error };
  }
  Logger.log('✅ Updated: ' + fpResult.beersUpdated + ', Created: ' + fpResult.beersCreated);
  if (fpResult.b2bOnlySkipped > 0) {
    Logger.log('   ⏭️  Skipped ' + fpResult.b2bOnlySkipped + ' B2B-only beers (not in taproom)');
  }
  Logger.log('');
  
  // Step 4: Update FCCR Command Center
  Logger.log('STEP 4: Updating FCCR Command Center...');
  var fccrResult = updateFCCRCommandCenter();
  if (!fccrResult.success) {
    Logger.log('⚠️ Skipped: ' + (fccrResult.error || fccrResult.message));
  } else {
    Logger.log('✅ FCCR updated');
  }
  Logger.log('');
  
  Logger.log('═══════════════════════════════════════════════════════════════════');
  Logger.log('       COMPLETE');
  Logger.log('═══════════════════════════════════════════════════════════════════');
  Logger.log('');
  Logger.log('SALES CHANNEL ROUTING:');
  Logger.log('  • Taproom-only beers → Floor Pricing only (not in CRM)');
  Logger.log('  • B2B-only beers → Fully Loaded Pricing only (not in taproom)');
  Logger.log('  • Both → Everywhere');
  Logger.log('');
  
  return {
    success: true,
    cogsUpdated: cogsResult.recipesUpdated,
    fullyLoadedUpdated: flpResult.beersUpdated,
    fullyLoadedCreated: flpResult.beersCreated,
    taproomOnlySkipped: flpResult.taproomOnlySkipped || 0,
    floorPricingUpdated: fpResult.beersUpdated,
    floorPricingCreated: fpResult.beersCreated,
    b2bOnlySkipped: fpResult.b2bOnlySkipped || 0,
    laborPerBatch: cogsResult.brewingLabor + cogsResult.packagingLabor,
    salesOverheadPerBBL: flpResult.salesOverheadPerBBL
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Add Sales Channel column to Recipes sheet if missing
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * One-time setup: Add Sales Channel column to Recipes sheet
 * Run this once to add the column, then brewers can set values
 */
function addSalesChannelToRecipes() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.RECIPES);
    
    if (!sheet) {
      return { success: false, error: 'Recipes sheet not found' };
    }
    
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Check if Sales Channel already exists
    for (var i = 0; i < headers.length; i++) {
      if ((headers[i] || '').toString().toLowerCase().indexOf('sales channel') !== -1) {
        return { success: true, message: 'Sales Channel column already exists at column ' + (i + 1) };
      }
    }
    
    // Add column after last column
    var newCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, newCol).setValue('Sales Channel');
    sheet.getRange(1, newCol).setFontWeight('bold');
    
    // Add data validation dropdown for all data rows
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var validationRange = sheet.getRange(2, newCol, lastRow - 1, 1);
      var rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['Taproom', 'B2B', 'Both'], true)
        .setAllowInvalid(false)
        .build();
      validationRange.setDataValidation(rule);
      
      // Default all existing recipes to "Both"
      validationRange.setValue('Both');
    }
    
    // Add note explaining the column
    sheet.getRange(1, newCol).setNote(
      'Sales Channel determines where this beer is sold:\n\n' +
      '• Taproom = Only sold in taproom (pilot batches, exclusives)\n' +
      '• B2B = Only sold wholesale (contract brewing)\n' +
      '• Both = Sold everywhere (standard beers)\n\n' +
      'This controls which pricing sheets are populated.'
    );
    
    Logger.log('Added Sales Channel column at position ' + newCol);
    
    return { 
      success: true, 
      message: 'Sales Channel column added at column ' + newCol,
      column: newCol
    };
    
  } catch (e) {
    Logger.log('Error adding Sales Channel column: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// UI HELPER: Get sales channel options for recipe form
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get sales channel options for UI dropdowns
 */
function getSalesChannelOptions() {
  return {
    success: true,
    options: [
      { value: 'Taproom', label: '🍺 Taproom Only', description: 'Pilot batches, taproom exclusives' },
      { value: 'B2B', label: '🚚 B2B Only', description: 'Wholesale, contract brewing' },
      { value: 'Both', label: '✅ Both', description: 'Standard production beers' }
    ],
    default: 'Both'
  };
}
// ═══════════════════════════════════════════════════════════════════════════════
// FIX: Get brewers from Labor Config instead of hardcoded list
// Replace the existing getBrewers() function with this
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get list of brewers from Labor Config sheet
 * Reads both Salaried and Hourly brewing staff
 */
function getBrewers() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.LABOR_CONFIG);
    
    if (!sheet) {
      Logger.log('Labor Config sheet not found, returning empty list');
      return serializeForHtml({ success: true, brewers: [] });
    }
    
    var data = sheet.getDataRange().getValues();
    var brewers = [];
    var inSalariedSection = false;
    var inHourlySection = false;
    
    for (var i = 0; i < data.length; i++) {
      var cellA = (data[i][0] || '').toString().trim();
      var cellB = data[i][1];  // Salary or Hourly Rate
      
      // Detect section headers
      if (cellA.toUpperCase().indexOf('SALARIED BREWING STAFF') !== -1) {
        inSalariedSection = true;
        inHourlySection = false;
        continue;
      }
      if (cellA.toUpperCase().indexOf('HOURLY BREWING STAFF') !== -1) {
        inSalariedSection = false;
        inHourlySection = true;
        continue;
      }
      if (cellA.toUpperCase().indexOf('PACKAGING STAFF') !== -1 || 
          cellA.toUpperCase().indexOf('LABOR COST SUMMARY') !== -1) {
        // End of brewing staff sections
        inSalariedSection = false;
        inHourlySection = false;
        continue;
      }
      
      // Skip header rows, subtotals, empty rows, placeholders
      if (cellA === '' || 
          cellA === 'Name' || 
          cellA.indexOf('Subtotal') !== -1 ||
          cellA.indexOf('Enter Name') !== -1 ||
          cellA.indexOf('[') !== -1) {
        continue;
      }
      
      // Add brewers from active sections
      if (inSalariedSection && cellB > 0) {
        brewers.push({
          name: cellA,
          role: 'Brewer (Salaried)',
          type: 'salaried'
        });
      }
      
      if (inHourlySection && cellB > 0) {
        brewers.push({
          name: cellA,
          role: 'Brewer (Hourly)',
          type: 'hourly'
        });
      }
    }
    
    // Sort alphabetically by name
    brewers.sort(function(a, b) {
      return a.name.localeCompare(b.name);
    });
    
    Logger.log('Found ' + brewers.length + ' brewers in Labor Config');
    
    return serializeForHtml({
      success: true,
      brewers: brewers,
      count: brewers.length
    });
    
  } catch (e) {
    Logger.log('Error getting brewers: ' + e.toString());
    return serializeForHtml({ 
      success: false, 
      error: e.toString(),
      brewers: [] 
    });
  }
}
// ═══════════════════════════════════════════════════════════════════════════════
// FIX: addNewRecipe() - Now includes Sales Channel (Column S)
// Add this to Code.gs (will override any existing addNewRecipe function)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Add a new recipe to the Recipes sheet
 * Called from UI's saveNewRecipe() function
 * 
 * @param {Object} recipe - Recipe data from UI
 * @returns {Object} Result with success/error
 */
function addNewRecipe(recipe) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.RECIPES);
    
    if (!sheet) {
      return { success: false, error: 'Recipes sheet not found' };
    }
    
    // Validate required fields
    if (!recipe.name || recipe.name.trim() === '') {
      return { success: false, error: 'Recipe name is required' };
    }
    
    // Check for duplicate recipe name
    var data = sheet.getDataRange().getValues();
    var nameCol = 0; // Column A = Recipe Name
    for (var i = 1; i < data.length; i++) {
      if (data[i][nameCol] && data[i][nameCol].toString().toLowerCase() === recipe.name.toLowerCase()) {
        return { success: false, error: 'Recipe "' + recipe.name + '" already exists' };
      }
    }
    
    // Build the new row
    // Recipes sheet columns (based on earlier work):
    // A=Recipe Name, B=Style, C=Batch Size, D=ABV, E=OG, F=FG, G=IBU, H=SRM, 
    // I=Yeast, J=Mash Temp, K=Fermentation Days, L=Yield %, M-R=various, S=Sales Channel
    
    var newRow = [];
    newRow[0] = recipe.name;                              // A: Recipe Name
    newRow[1] = recipe.style || '';                       // B: Style
    newRow[2] = recipe.batchSize || 60;                   // C: Batch Size (BBL)
    newRow[3] = recipe.abv || '';                         // D: ABV
    newRow[4] = recipe.og || '';                          // E: Target OG
    newRow[5] = recipe.fg || '';                          // F: Target FG
    newRow[6] = recipe.ibu || '';                         // G: IBU
    newRow[7] = recipe.srm || '';                         // H: SRM
    newRow[8] = recipe.yeast || '';                       // I: Yeast
    newRow[9] = recipe.mashTemp || '';                    // J: Mash Temp
    newRow[10] = recipe.fermentationDays || 14;           // K: Fermentation Days
    newRow[11] = recipe.yieldPct || 0.95;                 // L: Yield %
    newRow[12] = '';                                      // M: (reserved)
    newRow[13] = '';                                      // N: (reserved)
    newRow[14] = '';                                      // O: (reserved)
    newRow[15] = '';                                      // P: (reserved)
    newRow[16] = '';                                      // Q: (reserved)
    newRow[17] = '';                                      // R: (reserved)
    newRow[18] = recipe.salesChannel || 'Both';           // S: Sales Channel
    
    // Append the new row
    sheet.appendRow(newRow);
    
    Logger.log('Added new recipe: ' + recipe.name + ' (Sales Channel: ' + newRow[18] + ')');
    
    // Trigger the financial chain update to populate pricing sheets
    try {
      refreshFullFinancialChain();
      Logger.log('Financial chain refreshed after adding recipe');
    } catch (chainError) {
      Logger.log('Warning: Could not refresh financial chain: ' + chainError.toString());
      // Don't fail the whole operation if chain refresh fails
    }
    
    return { 
      success: true, 
      message: 'Recipe "' + recipe.name + '" created successfully',
      recipeName: recipe.name,
      salesChannel: newRow[18]
    };
    
  } catch (e) {
    Logger.log('Error in addNewRecipe: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// UI UPDATE REQUIRED - Update saveNewRecipe() in HTML to pass salesChannel
// ═══════════════════════════════════════════════════════════════════════════════
// 
// Find saveNewRecipe() in your HTML and update the recipe object:
//
// function saveNewRecipe() {
//   var name = document.getElementById('newRecipeName').value.trim();
//   if (!name) { showToast('Recipe name required', 'error'); return; }
//   
//   var recipe = {
//     name: name,
//     style: document.getElementById('newRecipeStyle').value,
//     batchSize: parseFloat(document.getElementById('newRecipeBatchSize').value) || 60,
//     abv: document.getElementById('newRecipeABV').value,
//     og: document.getElementById('newRecipeOG').value,
//     ibu: document.getElementById('newRecipeIBU').value,
//     salesChannel: document.getElementById('newRecipeSalesChannel').value  // <-- ADD THIS
//   };
//   
//   google.script.run
//     .withSuccessHandler(function(result) {
//       document.getElementById('newRecipeModal').remove();
//       if (result.success) { showToast('Recipe created!', 'success'); loadRecipes(); }
//       else showToast('Error: ' + result.error, 'error');
//     })
//     .withFailureHandler(function(err) { showToast('Error: ' + err, 'error'); })
//     .addNewRecipe(recipe);
// }
// ═══════════════════════════════════════════════════════════════════════════════
// RED LEG BREWING - BREWER'S SHEET COMPLETE FLOW
// ADD THIS TO YOUR EXISTING Code.gs
// 
// These functions complete the brew-to-packaging flow:
// 1. "Brew This" → Creates Batch Log row (no RM depletion)
// 2. "Finalize Brew & Assign Vessel" → Depletes RM based on ACTUALS
// 3. Cellar work → Gravity, additions, transfers (Batch Details sheet)
// 4. Packaging → Enter counts
// 5. "Send It!" → FG, TTB, COGS, archive to Google Drive
// ═══════════════════════════════════════════════════════════════════════════════

// Google Drive folder for archived batch records
var BATCH_RECORDS_FOLDER_ID = '1wjwR9hqF6wGtBIsgSrjYL65CdV0nVJ5f';

// Batch Details sheet name (supporting sheet for multiple entries per batch)
var BATCH_DETAILS_SHEET = 'Batch Details';

// Package type BBL conversions
var PACKAGE_BBL_CONVERSIONS = {
  '1/2 BBL Keg': 0.5,
  '1/6 BBL Keg': 0.167,
  '1/4 BBL Keg': 0.25,
  '12oz Case (24pk)': 0.0581,
  '16oz Case (24pk)': 0.0774,
  'Crowler (32oz)': 0.00258,
  'Growler (64oz)': 0.00516
};


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: SETUP - Create Batch Details sheet (run once)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create Batch Details sheet if it doesn't exist
 * Stores: gravity readings, additions, QA checks, transfers, notes
 * Links to Batch Log via Batch #
 */
function setupBatchDetailsSheet() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(BATCH_DETAILS_SHEET);
    
    if (sheet) {
      return { success: true, message: 'Batch Details sheet already exists' };
    }
    
    sheet = ss.insertSheet(BATCH_DETAILS_SHEET);
    
    var headers = [
      'Batch #',        // A - Links to Batch Log
      'Date',           // B - Entry date
      'Time',           // C - Entry time
      'Type',           // D - Gravity, Addition, QA, Transfer, Note
      'Description',    // E - What was done
      'Value',          // F - Numeric value
      'Units',          // G - SG, lbs, oz, psi, etc.
      'Cost',           // H - Cost if applicable
      'Vessel',         // I - Current vessel
      'Entered By',     // J - User
      'Notes'           // K - Additional notes
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#1a365d')
      .setFontColor('white');
    sheet.setFrozenRows(1);
    
    // Column widths
    sheet.setColumnWidth(1, 140);  // Batch #
    sheet.setColumnWidth(2, 100);  // Date
    sheet.setColumnWidth(3, 70);   // Time
    sheet.setColumnWidth(4, 90);   // Type
    sheet.setColumnWidth(5, 200);  // Description
    sheet.setColumnWidth(6, 80);   // Value
    sheet.setColumnWidth(7, 60);   // Units
    sheet.setColumnWidth(8, 80);   // Cost
    sheet.setColumnWidth(9, 80);   // Vessel
    sheet.setColumnWidth(10, 100); // Entered By
    sheet.setColumnWidth(11, 200); // Notes
    
    Logger.log('Created Batch Details sheet');
    return { success: true, message: 'Batch Details sheet created' };
    
  } catch (e) {
    Logger.log('Error creating Batch Details sheet: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: BREW START - Creates Batch Log row (NO RM depletion yet)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Start a brew - REPLACES confirmBrewStartEnhanced()
 * Creates Batch Log row with status "Brewing"
 * Does NOT deplete Raw Materials (that happens at Finalize)
 * 
 * @param {Object} brewerData - Recipe data, batch size, brewer name
 * @returns {Object} Result with batch number
 */
function startBrew(brewerData) {
  try {
    var ss = getBrmSpreadsheet();
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    if (!batchSheet) {
      return { success: false, error: 'Batch Log sheet not found' };
    }
    
    // Generate batch number
    var batchNumber = generateBatchNumber(brewerData.recipeName);
    
    // Get labor cost from Labor Config
    var laborResult = getLaborCostPerBatch();
    var laborCost = laborResult.totalLabor || 0;
    
    // Calculate expected yield
    var batchSize = parseFloat(brewerData.targetBatchSize) || 60;
    var yieldPct = parseFloat(brewerData.yieldPct) || 0.95;
    var expectedYield = batchSize * yieldPct;
    
    // Find the data start row (after headers)
    var data = batchSheet.getDataRange().getValues();
    var headerRow = -1;
    for (var i = 0; i < data.length; i++) {
      if ((data[i][0] || '').toString().toLowerCase().indexOf('batch') !== -1) {
        headerRow = i;
        break;
      }
    }
    var insertRow = headerRow >= 0 ? batchSheet.getLastRow() + 1 : 10;
    
    // Build row data matching Batch Log columns A-X
    // A=Batch#, B=BrewDate, C=BeerName, D=Size, E=RecipeCost, F=LaborHrs, G=Labor$, 
    // H=Overhead, I=TotalCost, J=ExpYield, K=Status, L=PkgDate, M=ActYield, 
    // N=Cost/BBL, O=Variance, P=Notes, Q-X=QA Finals
    var rowData = [
      batchNumber,                              // A: Batch #
      new Date(),                               // B: Brew Date
      brewerData.recipeName,                    // C: Beer Name
      batchSize,                                // D: Size (BBL)
      brewerData.estimatedIngredientCost || 0,  // E: Recipe Cost (estimated, not final)
      brewerData.laborHrs || 8,                 // F: Labor Hrs
      laborCost,                                // G: Labor $
      batchSize * 15,                           // H: Overhead ($15/BBL default)
      0,                                        // I: Total Cost (calculated at finalize)
      expectedYield,                            // J: Expected Yield
      'Brewing',                                // K: Status
      '',                                       // L: Pkg Date
      '',                                       // M: Act. Yield
      '',                                       // N: Cost/BBL
      '',                                       // O: Variance
      'Started by ' + (brewerData.brewer || 'Unknown'), // P: Notes
      brewerData.targetOG || '',                // Q: OG Actual
      '',                                       // R: FG Actual
      '',                                       // S: ABV Actual
      '',                                       // T: IBU Actual
      '',                                       // U: SRM Actual
      brewerData.yeast || '',                   // V: Yeast Used
      brewerData.mashTemp || '',                // W: Mash Temp Actual
      ''                                        // X: Ferment Temp
    ];
    
    batchSheet.getRange(insertRow, 1, 1, rowData.length).setValues([rowData]);
    
    // Store the ingredients list for later (when we finalize and deplete)
    // Save to a temporary property or just pass through UI
    var ingredientsJson = JSON.stringify({
      grains: brewerData.grains || [],
      hops: brewerData.hops || [],
      other: brewerData.other || []
    });
    
    // Log the brew start to Batch Details
    addBatchEntry(batchNumber, 'Note', {
      description: 'Brew started',
      value: batchSize,
      units: 'BBL',
      vessel: '',
      notes: 'Recipe: ' + brewerData.recipeName + ', Brewer: ' + (brewerData.brewer || 'Unknown')
    });
    
    // Create tasks from recipe templates
    try {
      var tasksResult = createTasksFromTemplates(batchNumber, brewerData.recipeName, new Date());
      if (tasksResult.success && tasksResult.tasksCreated > 0) {
        Logger.log('Created ' + tasksResult.tasksCreated + ' tasks from templates');
      }
    } catch (taskError) {
      Logger.log('Warning: Could not create tasks from templates: ' + taskError.toString());
    }
    
    Logger.log('Brew started: ' + batchNumber + ' (RM not depleted yet)');
    
    return serializeForHtml({
      success: true,
      batchNumber: batchNumber,
      message: 'Brew started. Assign to vessel when ready to finalize.',
      ingredientsJson: ingredientsJson
    });
    
  } catch (e) {
    Logger.log('Error starting brew: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: FINALIZE BREW - Assigns vessel, DEPLETES RM based on ACTUALS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Finalize brew and assign to vessel
 * THIS is when Raw Materials get depleted based on ACTUALS
 * 
 * @param {string} batchNumber - Batch number
 * @param {string} vessel - Vessel to assign (FV-1, FV-2, etc.)
 * @param {Array} actualIngredients - What was ACTUALLY used (may differ from recipe)
 * @returns {Object} Result
 */
function finalizeBrew(batchNumber, vessel, actualIngredients) {
  try {
    var ss = getBrmSpreadsheet();
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    if (!batchSheet) {
      return { success: false, error: 'Batch Log sheet not found' };
    }
    
    // Find the batch row
    var data = batchSheet.getDataRange().getValues();
    var batchRow = -1;
    var batchCol = 0;  // Column A
    
    for (var i = 0; i < data.length; i++) {
      if (data[i][batchCol] && data[i][batchCol].toString() === batchNumber) {
        batchRow = i + 1;  // 1-indexed for sheet
        break;
      }
    }
    
    if (batchRow === -1) {
      return { success: false, error: 'Batch not found: ' + batchNumber };
    }
    
    // Deplete Raw Materials based on ACTUALS
    var totalIngredientCost = 0;
    var allIngredients = [];
    
    // Process grains
    if (actualIngredients.grains) {
      actualIngredients.grains.forEach(function(item) {
        var itemUOM = (item.uom || 'lb').toString().trim();
        var result = depleteRawMaterial(item.ingredient, item.actualAmount, batchNumber, null, 'Recipe', itemUOM);
        var cost = item.actualAmount * (item.avgCost || 0);
        totalIngredientCost += cost;
        allIngredients.push({
          category: 'Grain',
          ingredient: item.ingredient,
          amount: item.actualAmount,
          uom: item.uom,
          cost: cost
        });
      });
    }
    
    // Process hops
    if (actualIngredients.hops) {
      actualIngredients.hops.forEach(function(item) {
        var itemUOM = (item.uom || 'lb').toString().trim();
        var result = depleteRawMaterial(item.ingredient, item.actualAmount, batchNumber, null, 'Recipe', itemUOM);
        var cost = item.actualAmount * (item.avgCost || 0);
        totalIngredientCost += cost;
        allIngredients.push({
          category: 'Hops',
          ingredient: item.ingredient,
          amount: item.actualAmount,
          uom: item.uom,
          cost: cost
        });
      });
    }
    
    // Process other
    if (actualIngredients.other) {
      actualIngredients.other.forEach(function(item) {
        var itemUOM = (item.uom || 'lb').toString().trim();
        var result = depleteRawMaterial(item.ingredient, item.actualAmount, batchNumber, null, 'Recipe', itemUOM);
        var cost = item.actualAmount * (item.avgCost || 0);
        totalIngredientCost += cost;
        allIngredients.push({
          category: 'Other',
          ingredient: item.ingredient,
          amount: item.actualAmount,
          uom: item.uom,
          cost: cost
        });
      });
    }
    
    // Update Batch Log row
    var laborCost = parseFloat(data[batchRow - 1][6]) || 0;  // Column G
    var overhead = parseFloat(data[batchRow - 1][7]) || 0;   // Column H
    var totalCost = totalIngredientCost + laborCost + overhead;
    
    batchSheet.getRange(batchRow, 5).setValue(totalIngredientCost);  // E: Recipe Cost (actual)
    batchSheet.getRange(batchRow, 9).setValue(totalCost);            // I: Total Cost
    batchSheet.getRange(batchRow, 11).setValue('Fermenting');        // K: Status
    
    // Update Equipment Scheduling
    updateEquipmentStatus(vessel, 'In Use', data[batchRow - 1][2], batchNumber);
    
    // Log to Batch Ingredients
    logBatchIngredients(batchNumber, allIngredients);
    
    // Log to Batch Details
    addBatchEntry(batchNumber, 'Transfer', {
      description: 'Assigned to ' + vessel,
      vessel: vessel,
      notes: 'Finalized. RM depleted. Total ingredient cost: $' + totalIngredientCost.toFixed(2)
    });
    
    Logger.log('Brew finalized: ' + batchNumber + ' → ' + vessel + ', RM depleted, cost: $' + totalIngredientCost.toFixed(2));
    
    return serializeForHtml({
      success: true,
      batchNumber: batchNumber,
      vessel: vessel,
      ingredientCost: totalIngredientCost,
      totalCost: totalCost,
      message: 'Brew finalized and assigned to ' + vessel
    });
    
  } catch (e) {
    Logger.log('Error finalizing brew: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: BATCH DETAILS - Add entries (gravity, additions, QA, transfers)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Add an entry to Batch Details sheet
 * Types: Gravity, Addition, QA, Transfer, Note
 * 
 * @param {string} batchNumber - Batch number
 * @param {string} type - Entry type
 * @param {Object} data - Entry data
 * @returns {Object} Result
 */
function addBatchEntry(batchNumber, type, data) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(BATCH_DETAILS_SHEET);
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      var setupResult = setupBatchDetailsSheet();
      if (!setupResult.success) {
        return setupResult;
      }
      sheet = ss.getSheetByName(BATCH_DETAILS_SHEET);
    }
    
    var now = new Date();
    var timeStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm');
    var user = getCurrentUser().email || 'System';
    
    var rowData = [
      batchNumber,
      now,
      timeStr,
      type,
      data.description || '',
      data.value || '',
      data.units || '',
      data.cost || '',
      data.vessel || '',
      user,
      data.notes || ''
    ];
    
    sheet.appendRow(rowData);
    
    return { success: true, message: type + ' entry added' };
    
  } catch (e) {
    Logger.log('Error adding batch entry: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}


/**
 * Add gravity reading (legacy - uses SG)
 */
function addGravityReading(batchNumber, gravity, temperature, notes) {
  return addBatchEntry(batchNumber, 'Gravity', {
    description: 'Gravity reading',
    value: gravity,
    units: 'SG',
    notes: (temperature ? 'Temp: ' + temperature + '°F. ' : '') + (notes || '')
  });
}

/**
 * Get package type components configuration
 * Returns what materials/components are needed for each package type
 * Includes beer-specific flag for labels and collars
 */
function getPackageTypeComponents(packageType, beerName) {
  beerName = beerName || '';
  
  // Component definitions for each package type
  var packageComponents = {
    '1/2 BBL Keg': [
      { item: '1/2 BBL Keg Shell', qtyPerUnit: 1, unit: 'each', beerSpecific: false },
      { item: 'Keg Cap (Red)', qtyPerUnit: 1, unit: 'each', beerSpecific: false },
      { item: (beerName ? beerName + ' Collar' : 'Keg Collar'), qtyPerUnit: 1, unit: 'each', beerSpecific: true },
      { item: 'Product', qtyPerUnit: 15.5, unit: 'gal', beerSpecific: false }
    ],
    '1/6 BBL Keg': [
      { item: '1/6 BBL Keg Shell', qtyPerUnit: 1, unit: 'each', beerSpecific: false },
      { item: 'Keg Cap (Red)', qtyPerUnit: 1, unit: 'each', beerSpecific: false },
      { item: (beerName ? beerName + ' Collar' : 'Keg Collar'), qtyPerUnit: 1, unit: 'each', beerSpecific: true },
      { item: 'Product', qtyPerUnit: 5.17, unit: 'gal', beerSpecific: false }
    ],
    '1/4 BBL Keg': [
      { item: '1/4 BBL Keg Shell', qtyPerUnit: 1, unit: 'each', beerSpecific: false },
      { item: 'Keg Cap (Red)', qtyPerUnit: 1, unit: 'each', beerSpecific: false },
      { item: (beerName ? beerName + ' Collar' : 'Keg Collar'), qtyPerUnit: 1, unit: 'each', beerSpecific: true },
      { item: 'Product', qtyPerUnit: 7.75, unit: 'gal', beerSpecific: false }
    ],
    '12oz Case (4×6)': [
      { item: '12oz Can', qtyPerUnit: 24, unit: 'each', beerSpecific: false },
      { item: 'Can Lid', qtyPerUnit: 24, unit: 'each', beerSpecific: false },
      { item: (beerName ? beerName + ' 12oz Label' : 'Can Label'), qtyPerUnit: 24, unit: 'each', beerSpecific: true },
      { item: 'Six Pack Applicator (Red)', qtyPerUnit: 4, unit: 'each', beerSpecific: false },
      { item: 'Case Pack (Tray)', qtyPerUnit: 1, unit: 'each', beerSpecific: false },
      { item: 'Product', qtyPerUnit: 2.25, unit: 'gal', beerSpecific: false }
    ],
    '16oz Case (4×6)': [
      { item: '16oz Can', qtyPerUnit: 24, unit: 'each', beerSpecific: false },
      { item: 'Can Lid', qtyPerUnit: 24, unit: 'each', beerSpecific: false },
      { item: (beerName ? beerName + ' 16oz Label' : 'Can Label'), qtyPerUnit: 24, unit: 'each', beerSpecific: true },
      { item: 'Six Pack Applicator (Red)', qtyPerUnit: 4, unit: 'each', beerSpecific: false },
      { item: 'Case Pack (Tray)', qtyPerUnit: 1, unit: 'each', beerSpecific: false },
      { item: 'Product', qtyPerUnit: 3, unit: 'gal', beerSpecific: false }
    ],
    '12oz 6-pack': [
      { item: '12oz Can', qtyPerUnit: 6, unit: 'each', beerSpecific: false },
      { item: 'Can Lid', qtyPerUnit: 6, unit: 'each', beerSpecific: false },
      { item: (beerName ? beerName + ' 12oz Label' : 'Can Label'), qtyPerUnit: 6, unit: 'each', beerSpecific: true },
      { item: '6-pack Carrier', qtyPerUnit: 1, unit: 'each', beerSpecific: false },
      { item: 'Product', qtyPerUnit: 0.5625, unit: 'gal', beerSpecific: false }
    ],
    '16oz 4-pack': [
      { item: '16oz Can', qtyPerUnit: 4, unit: 'each', beerSpecific: false },
      { item: 'Can Lid', qtyPerUnit: 4, unit: 'each', beerSpecific: false },
      { item: (beerName ? beerName + ' 16oz Label' : 'Can Label'), qtyPerUnit: 4, unit: 'each', beerSpecific: true },
      { item: '4-pack Carrier', qtyPerUnit: 1, unit: 'each', beerSpecific: false },
      { item: 'Product', qtyPerUnit: 0.5, unit: 'gal', beerSpecific: false }
    ],
    'Growler': [
      { item: 'Growler', qtyPerUnit: 1, unit: 'each', beerSpecific: false },
      { item: 'Growler Cap', qtyPerUnit: 1, unit: 'each', beerSpecific: false },
      { item: 'Product', qtyPerUnit: 0.5, unit: 'gal', beerSpecific: false }
    ],
    'Crowler': [
      { item: 'Crowler Can', qtyPerUnit: 1, unit: 'each', beerSpecific: false },
      { item: 'Can End', qtyPerUnit: 1, unit: 'each', beerSpecific: false },
      { item: 'Product', qtyPerUnit: 0.25, unit: 'gal', beerSpecific: false }
    ]
  };
  
  return serializeForHtml({
    success: true,
    components: packageComponents[packageType] || []
  });
}

/**
 * Calculate packaging materials needed and deduct from Raw Materials
 * Called from sendItWithActualLabor when packaging is complete
 */
function deductPackagingMaterials(batchNumber, packageBreakdown, beerName) {
  try {
    var totalPackagingCost = 0;
    var materialsUsed = [];
    var rmResult = getRawMaterialsInventory({});
    var materialsLookup = {};
    
    if (rmResult.success && rmResult.materials) {
      rmResult.materials.forEach(function(m) {
        materialsLookup[m.item.toLowerCase()] = m.avgCost || 0;
      });
    }
    
    // Process each package type
    for (var pkgType in packageBreakdown) {
      var qty = parseFloat(packageBreakdown[pkgType]) || 0;
      if (qty <= 0) continue;
      
      // Get components for this package type
      var componentsResult = getPackageTypeComponents(pkgType, beerName);
      if (!componentsResult.success || !componentsResult.components) continue;
      
      componentsResult.components.forEach(function(comp) {
        // Skip "Product" - that's the beer itself, not a material
        if (comp.item.toLowerCase() === 'product') return;
        
        var totalQty = comp.qtyPerUnit * qty;
        var materialName = comp.item;
        
        // Try to find the material in Raw Materials (case-insensitive)
        var foundMaterial = null;
        for (var matName in materialsLookup) {
          if (matName === materialName.toLowerCase() || 
              materialName.toLowerCase().indexOf(matName) !== -1 ||
              matName.indexOf(materialName.toLowerCase()) !== -1) {
            // Find the actual material object
            rmResult.materials.forEach(function(m) {
              if (m.item.toLowerCase() === matName) {
                foundMaterial = m;
              }
            });
            break;
          }
        }
        
        // If not found by exact match, try partial match
        if (!foundMaterial) {
          rmResult.materials.forEach(function(m) {
            var mName = m.item.toLowerCase();
            var cName = materialName.toLowerCase();
            if (mName.indexOf(cName) !== -1 || cName.indexOf(mName) !== -1) {
              foundMaterial = m;
              materialName = m.item; // Use the actual material name from inventory
            }
          });
        }
        
        if (foundMaterial) {
          var unitCost = foundMaterial.avgCost || 0;
          var totalCost = totalQty * unitCost;
          totalPackagingCost += totalCost;
          
          // Deduct from Raw Materials (with Packaging type)
          depleteRawMaterial(materialName, totalQty, batchNumber, null, 'Packaging');
          
          materialsUsed.push({
            item: materialName,
            quantity: totalQty,
            unit: comp.unit,
            cost: totalCost
          });
          
          Logger.log('Packaging: Deducted ' + totalQty + ' ' + comp.unit + ' of ' + materialName + ' (Cost: $' + totalCost.toFixed(2) + ')');
        } else {
          Logger.log('Warning: Packaging material not found in inventory: ' + materialName);
        }
      });
    }
    
    return {
      success: true,
      totalCost: totalPackagingCost,
      materialsUsed: materialsUsed,
      message: 'Deducted ' + materialsUsed.length + ' packaging materials'
    };
  } catch (e) {
    Logger.log('Error deducting packaging materials: ' + e.toString());
    return { success: false, error: e.toString(), totalCost: 0 };
  }
}

/**
 * Log gravity and pH reading (Plato scale)
 * @param {string} batchNumber - Batch number
 * @param {Object} data - { plato, pH, temperature, vessel, notes }
 */
function logGravityReading(batchNumber, data) {
  try {
    var plato = parseFloat(data.plato) || null;
    var pH = parseFloat(data.pH) || null;
    var temperature = parseFloat(data.temperature) || null;
    var vessel = data.vessel || '';
    var notes = data.notes || '';
    
    if (plato === null && pH === null) {
      return { success: false, error: 'At least one reading (Plato or pH) is required' };
    }
    
    var description = 'Gravity/pH reading';
    if (plato !== null && pH !== null) {
      description = plato.toFixed(1) + '°P, pH ' + pH.toFixed(2);
    } else if (plato !== null) {
      description = plato.toFixed(1) + '°P';
    } else if (pH !== null) {
      description = 'pH ' + pH.toFixed(2);
    }
    
    var notesText = '';
    if (temperature !== null) {
      notesText += 'Temp: ' + temperature + '°F. ';
    }
    if (vessel) {
      notesText += 'Vessel: ' + vessel + '. ';
    }
    notesText += notes;
    
    // Store both values in notes for retrieval
    var fullNotes = 'Plato: ' + (plato !== null ? plato.toFixed(2) : 'N/A') + 
                    ', pH: ' + (pH !== null ? pH.toFixed(2) : 'N/A') + 
                    '. ' + notesText;
    
    return addBatchEntry(batchNumber, 'Gravity', {
      description: description,
      value: plato !== null ? plato : pH,
      units: plato !== null ? '°P' : 'pH',
      vessel: vessel,
      notes: fullNotes
    });
    
  } catch (e) {
    Logger.log('Error logging gravity reading: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}


/**
 * Add secondary addition (dry hops, fruit, finings, etc.)
 * DEPLETES Raw Materials and adds cost to batch
 * 
 * @param {string} batchNumber - Batch number
 * @param {string} item - Item name (must match Raw Materials)
 * @param {number} amount - Amount used
 * @param {string} uom - Unit of measure
 * @param {string} notes - Optional notes
 * @returns {Object} Result
 */
function addSecondaryAddition(batchNumber, item, amount, uom, notes) {
  try {
    var ss = getBrmSpreadsheet();
    
    // Get cost from Raw Materials before depleting
    var rmResult = getRawMaterialsInventory({});
    var itemCost = 0;
    
    if (rmResult.success && rmResult.materials) {
      var material = rmResult.materials.find(function(m) {
        return m.item.toLowerCase() === item.toLowerCase();
      });
      if (material) {
        itemCost = (material.avgCost || 0) * amount;
      }
    }
    
    // Deplete from Raw Materials
    var depleteResult = depleteRawMaterial(item, amount, batchNumber, null, 'Cellar');
    
    // Add entry to Batch Details
    addBatchEntry(batchNumber, 'Addition', {
      description: item,
      value: amount,
      units: uom || 'lb',
      cost: itemCost,
      notes: notes || ''
    });
    
    // Update Batch Log - add to addition cost (we'll add column Y for this)
    updateBatchAdditionCost(batchNumber, itemCost);
    
    // Log to Material Log
    logMaterialAdjustment(item, 0, -amount, 'Secondary addition - Batch: ' + batchNumber, 'DEPLETE');
    
    Logger.log('Secondary addition: ' + amount + ' ' + uom + ' ' + item + ' → ' + batchNumber + ', cost: $' + itemCost.toFixed(2));
    
    return serializeForHtml({
      success: true,
      item: item,
      amount: amount,
      cost: itemCost,
      message: item + ' added to batch'
    });
    
  } catch (e) {
    Logger.log('Error adding secondary addition: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}


/**
 * Update batch addition cost (running total of secondary additions)
 */
function updateBatchAdditionCost(batchNumber, additionalCost) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    if (!sheet) return;
    
    var data = sheet.getDataRange().getValues();
    
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === batchNumber) {
        // Column Y (25) = Addition Cost
        // Check if we have that column
        var currentCost = parseFloat(data[i][24]) || 0;  // Column Y = index 24
        var newCost = currentCost + additionalCost;
        sheet.getRange(i + 1, 25).setValue(newCost);
        
        // Also update Total Cost (Column I = index 8)
        var totalCost = parseFloat(data[i][8]) || 0;
        sheet.getRange(i + 1, 9).setValue(totalCost + additionalCost);
        break;
      }
    }
  } catch (e) {
    Logger.log('Error updating batch addition cost: ' + e.toString());
  }
}


/**
 * Record transfer between vessels
 * 
 * @param {string} batchNumber - Batch number
 * @param {string} fromVessel - Source vessel
 * @param {string} toVessel - Destination vessel
 * @param {string} notes - Optional notes
 * @returns {Object} Result
 */
function recordTransfer(batchNumber, fromVessel, toVessel, notes) {
  try {
    // Free the old vessel
    if (fromVessel) {
      updateEquipmentStatus(fromVessel, 'Available', '', '');
    }
    
    // Occupy the new vessel
    var ss = getBrmSpreadsheet();
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    var beerName = '';
    
    if (batchSheet) {
      var data = batchSheet.getDataRange().getValues();
      for (var i = 0; i < data.length; i++) {
        if (data[i][0] && data[i][0].toString() === batchNumber) {
          beerName = data[i][2] || '';  // Column C = Beer Name
          
          // Update status based on vessel type
          var newStatus = 'Fermenting';
          if (toVessel.indexOf('BT') !== -1 || toVessel.toLowerCase().indexOf('brite') !== -1) {
            newStatus = 'Conditioning';
          }
          batchSheet.getRange(i + 1, 11).setValue(newStatus);  // Column K = Status
          break;
        }
      }
    }
    
    updateEquipmentStatus(toVessel, 'In Use', beerName, batchNumber);
    
    // Log to Batch Details
    addBatchEntry(batchNumber, 'Transfer', {
      description: (fromVessel || 'Start') + ' → ' + toVessel,
      vessel: toVessel,
      notes: notes || ''
    });
    
    Logger.log('Transfer: ' + batchNumber + ' from ' + (fromVessel || 'Start') + ' to ' + toVessel);
    
    return serializeForHtml({
      success: true,
      batchNumber: batchNumber,
      fromVessel: fromVessel,
      toVessel: toVessel,
      message: 'Transferred to ' + toVessel
    });
    
  } catch (e) {
    Logger.log('Error recording transfer: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}


/**
 * Add QA checkpoint
 * 
 * @param {string} batchNumber - Batch number
 * @param {string} checkpoint - Checkpoint name (e.g., "DO at Transfer", "Final pH")
 * @param {number} value - Measured value
 * @param {string} units - Units (ppb, pH, etc.)
 * @param {string} passFail - PASS, FAIL, or PENDING
 * @param {string} notes - Optional notes
 * @returns {Object} Result
 */
function addQACheckpoint(batchNumber, checkpoint, value, units, passFail, notes) {
  return addBatchEntry(batchNumber, 'QA', {
    description: checkpoint + ' - ' + (passFail || 'PENDING'),
    value: value,
    units: units,
    notes: notes || ''
  });
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: PACKAGING - Enter package counts
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Record packaging breakdown
 * Called before "Send It!" to capture what packages were produced
 * 
 * @param {string} batchNumber - Batch number
 * @param {Object} packageBreakdown - Object with package counts
 *   e.g., { '1/2 BBL Keg': 20, '1/6 BBL Keg': 15, '12oz Case (24pk)': 50 }
 * @param {number} finalGravity - Final gravity reading
 * @param {number} abv - Calculated ABV
 * @param {string} packager - Who packaged it
 * @returns {Object} Result with actual yield
 */
function recordPackaging(batchNumber, packageBreakdown, finalGravity, abv, packager) {
  try {
    var ss = getBrmSpreadsheet();
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    if (!batchSheet) {
      return { success: false, error: 'Batch Log sheet not found' };
    }
    
    // Calculate actual yield in BBL
    var actualYieldBBL = 0;
    for (var pkgType in packageBreakdown) {
      var qty = parseFloat(packageBreakdown[pkgType]) || 0;
      var bblPer = PACKAGE_BBL_CONVERSIONS[pkgType] || 0;
      actualYieldBBL += qty * bblPer;
    }
    
    // Find batch row and update
    var data = batchSheet.getDataRange().getValues();
    var batchRow = -1;
    
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === batchNumber) {
        batchRow = i + 1;
        break;
      }
    }
    
    if (batchRow === -1) {
      return { success: false, error: 'Batch not found: ' + batchNumber };
    }
    
    // Update Batch Log columns
    batchSheet.getRange(batchRow, 11).setValue('Ready to Package');  // K: Status
    batchSheet.getRange(batchRow, 13).setValue(actualYieldBBL);      // M: Act. Yield
    batchSheet.getRange(batchRow, 18).setValue(finalGravity);        // R: FG Actual
    batchSheet.getRange(batchRow, 19).setValue(abv);                 // S: ABV Actual
    
    // Log each package type to Batch Details
    for (var pkgType in packageBreakdown) {
      var qty = packageBreakdown[pkgType];
      if (qty > 0) {
        addBatchEntry(batchNumber, 'Note', {
          description: 'Packaged: ' + qty + ' × ' + pkgType,
          value: qty,
          units: pkgType,
          notes: 'Packager: ' + (packager || 'Unknown')
        });
      }
    }
    
    Logger.log('Packaging recorded: ' + batchNumber + ', yield: ' + actualYieldBBL.toFixed(2) + ' BBL');
    
    return serializeForHtml({
      success: true,
      batchNumber: batchNumber,
      actualYieldBBL: actualYieldBBL,
      packageBreakdown: packageBreakdown,
      message: 'Packaging recorded. Ready to Send It!'
    });
    
  } catch (e) {
    Logger.log('Error recording packaging: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: SEND IT! - The big cascade
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SEND IT! - Complete the batch and cascade to all systems
 * 
 * 1. Calculate efficiency
 * 2. Calculate final COGS/BBL
 * 3. Update Batch Log (status = Packaged)
 * 4. Add to Finished Goods (each package type with COGS)
 * 5. Update Beer COGS Master
 * 6. Update TTB/CO LED data
 * 7. Free vessel in Equipment Scheduling
 * 8. Archive batch record to Google Drive folder
 * 
 * @param {string} batchNumber - Batch number
 * @param {Object} packageBreakdown - Package counts
 * @param {string} currentVessel - Vessel to free
 * @returns {Object} Result
 */
function sendIt(batchNumber, packageBreakdown, currentVessel) {
  try {
    var ss = getBrmSpreadsheet();
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    if (!batchSheet) {
      return { success: false, error: 'Batch Log sheet not found' };
    }
    
    // Find batch row
    var data = batchSheet.getDataRange().getValues();
    var batchRow = -1;
    var batchData = null;
    
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === batchNumber) {
        batchRow = i + 1;
        batchData = data[i];
        break;
      }
    }
    
    if (batchRow === -1 || !batchData) {
      return { success: false, error: 'Batch not found: ' + batchNumber };
    }
    
    // Extract batch info
    var beerName = batchData[2] || '';           // C: Beer Name
    var batchSize = parseFloat(batchData[3]) || 0;  // D: Size
    var totalCost = parseFloat(batchData[8]) || 0;  // I: Total Cost
    var expectedYield = parseFloat(batchData[9]) || 0;  // J: Expected Yield
    var actualYield = parseFloat(batchData[12]) || 0;   // M: Act. Yield
    
    // Calculate if not already set
    if (actualYield === 0 && packageBreakdown) {
      for (var pkgType in packageBreakdown) {
        var qty = parseFloat(packageBreakdown[pkgType]) || 0;
        var bblPer = PACKAGE_BBL_CONVERSIONS[pkgType] || 0;
        actualYield += qty * bblPer;
      }
    }
    
    // 1. Calculate efficiency
    var efficiency = expectedYield > 0 ? (actualYield / expectedYield * 100) : 0;
    var variance = actualYield - expectedYield;
    
    // 2. Calculate COGS/BBL
    var cogsPerBBL = actualYield > 0 ? totalCost / actualYield : 0;
    
    // 3. Update Batch Log
    batchSheet.getRange(batchRow, 11).setValue('Packaged');          // K: Status
    batchSheet.getRange(batchRow, 12).setValue(new Date());          // L: Pkg Date
    batchSheet.getRange(batchRow, 13).setValue(actualYield);         // M: Act. Yield
    batchSheet.getRange(batchRow, 14).setValue(cogsPerBBL);          // N: Cost/BBL
    batchSheet.getRange(batchRow, 15).setValue(variance);            // O: Variance
    
    // Append efficiency to notes
    var existingNotes = batchData[15] || '';
    var newNotes = existingNotes + ' | Efficiency: ' + efficiency.toFixed(1) + '%';
    batchSheet.getRange(batchRow, 16).setValue(newNotes);
    
    // 4. Add to Finished Goods
    var fgResult = addToFinishedGoods(beerName, packageBreakdown, cogsPerBBL, batchNumber);
    
    // 5. Update Beer COGS Master
    try {
      updateBeerCOGSMaster();
    } catch (cogsError) {
      Logger.log('Warning: Could not update Beer COGS Master: ' + cogsError.toString());
    }
    
    // 6. Log to Batch Details for TTB tracking
    addBatchEntry(batchNumber, 'Note', {
      description: '🚀 SEND IT! Batch complete.',
      value: actualYield,
      units: 'BBL',
      notes: 'Efficiency: ' + efficiency.toFixed(1) + '%, COGS/BBL: $' + cogsPerBBL.toFixed(2)
    });
    
    // 7. Free vessel
    if (currentVessel) {
      updateEquipmentStatus(currentVessel, 'Available', '', '');
    }
    
    // 8. Archive to Google Drive folder
    var archiveResult = archiveBatchRecord(batchNumber, beerName, batchData, packageBreakdown);
    
    Logger.log('🚀 SEND IT! ' + batchNumber + ' complete. Yield: ' + actualYield.toFixed(2) + 
               ' BBL, Efficiency: ' + efficiency.toFixed(1) + '%, COGS/BBL: $' + cogsPerBBL.toFixed(2));
    
    return serializeForHtml({
      success: true,
      batchNumber: batchNumber,
      beerName: beerName,
      actualYield: actualYield,
      efficiency: efficiency,
      cogsPerBBL: cogsPerBBL,
      totalCost: totalCost,
      fgUpdated: fgResult.success,
      archived: archiveResult.success,
      archiveUrl: archiveResult.url || '',
      message: '🚀 SEND IT! Batch ' + batchNumber + ' complete!'
    });
    
  } catch (e) {
    Logger.log('Error in Send It: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}


/**
 * Add packaged beer to Finished Goods inventory
 * Each package type gets its own row with COGS from this batch
 */
function addToFinishedGoods(beerName, packageBreakdown, cogsPerBBL, batchNumber) {
  try {
    var ss = getBrmSpreadsheet();
    var fgSheet = ss.getSheetByName(SHEETS.FINISHED_GOODS);
    
    if (!fgSheet) {
      return { success: false, error: 'Finished Goods sheet not found' };
    }
    
    var data = fgSheet.getDataRange().getValues();
    var updated = 0;
    var created = 0;
    
    for (var pkgType in packageBreakdown) {
      var qty = parseFloat(packageBreakdown[pkgType]) || 0;
      if (qty <= 0) continue;
      
      // Calculate cost per unit
      var bblPerUnit = PACKAGE_BBL_CONVERSIONS[pkgType] || 0.5;
      var costPerUnit = cogsPerBBL * bblPerUnit;
      
      // Find existing row or create new
      var found = false;
      for (var i = FG_CONFIG.dataStartRow - 1; i < data.length; i++) {
        var rowBeer = (data[i][0] || '').toString().toLowerCase();
        var rowPkg = (data[i][1] || '').toString();
        
        if (rowBeer === beerName.toLowerCase() && rowPkg === pkgType) {
          // Update existing row
          var currentQty = parseFloat(data[i][2]) || 0;
          var currentCost = parseFloat(data[i][3]) || 0;
          
          // Weighted average cost
          var newQty = currentQty + qty;
          var newAvgCost = currentQty > 0 
            ? ((currentQty * currentCost) + (qty * costPerUnit)) / newQty 
            : costPerUnit;
          
          fgSheet.getRange(i + 1, 3).setValue(newQty);
          fgSheet.getRange(i + 1, 4).setValue(newAvgCost);
          fgSheet.getRange(i + 1, 5).setValue(newQty * newAvgCost);  // Total Value
          
          // Update status
          var minQty = parseFloat(data[i][6]) || 5;
          var status = '✅ OK';
          if (newQty <= 0) status = '🚨 OUT';
          else if (newQty <= minQty) status = '⚠️ LOW';
          fgSheet.getRange(i + 1, 8).setValue(status);
          
          logFGTransaction(beerName, pkgType, 'PACKAGE', currentQty, newQty, qty, 'Batch: ' + batchNumber);
          
          found = true;
          updated++;
          break;
        }
      }
      
      if (!found) {
        // Create new row
        var newRow = fgSheet.getLastRow() + 1;
        fgSheet.appendRow([
          beerName,
          pkgType,
          qty,
          costPerUnit,
          qty * costPerUnit,
          0,  // Floor Price (set from pricing sheet)
          5,  // Min Qty
          '✅ OK'
        ]);
        
        logFGTransaction(beerName, pkgType, 'PACKAGE', 0, qty, qty, 'Batch: ' + batchNumber + ' (new SKU)');
        created++;
      }
    }
    
    Logger.log('Finished Goods updated: ' + updated + ' updated, ' + created + ' created');
    
    return { success: true, updated: updated, created: created };
    
  } catch (e) {
    Logger.log('Error adding to Finished Goods: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: ARCHIVE - Export batch record to Google Drive
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Archive batch record to Google Drive folder
 * Creates a Google Sheet with all batch data for permanent record
 * 
 * @param {string} batchNumber - Batch number
 * @param {string} beerName - Beer name
 * @param {Array} batchData - Row data from Batch Log
 * @param {Object} packageBreakdown - Package counts
 * @returns {Object} Result with file URL
 */
function archiveBatchRecord(batchNumber, beerName, batchData, packageBreakdown) {
  try {
    // Get the archive folder
    var folder;
    try {
      folder = DriveApp.getFolderById(BATCH_RECORDS_FOLDER_ID);
    } catch (e) {
      Logger.log('Warning: Archive folder not found. Creating in root.');
      folder = DriveApp.getRootFolder();
    }
    
    // Create new spreadsheet for the batch record
    var archiveName = batchNumber + ' - ' + beerName + ' - Batch Record';
    var archiveSS = SpreadsheetApp.create(archiveName);
    var archiveFile = DriveApp.getFileById(archiveSS.getId());
    
    // Move to archive folder
    archiveFile.moveTo(folder);
    
    // === SUMMARY TAB ===
    var summarySheet = archiveSS.getActiveSheet();
    summarySheet.setName('Summary');
    
    summarySheet.getRange('A1').setValue('BATCH RECORD').setFontSize(16).setFontWeight('bold');
    summarySheet.getRange('A2').setValue('Red Leg Brewing Company');
    summarySheet.getRange('A4').setValue('Batch Number:').setFontWeight('bold');
    summarySheet.getRange('B4').setValue(batchNumber);
    summarySheet.getRange('A5').setValue('Beer:').setFontWeight('bold');
    summarySheet.getRange('B5').setValue(beerName);
    summarySheet.getRange('A6').setValue('Brew Date:').setFontWeight('bold');
    summarySheet.getRange('B6').setValue(batchData[1] || '');
    summarySheet.getRange('A7').setValue('Package Date:').setFontWeight('bold');
    summarySheet.getRange('B7').setValue(batchData[11] || new Date());
    summarySheet.getRange('A8').setValue('Batch Size:').setFontWeight('bold');
    summarySheet.getRange('B8').setValue((batchData[3] || 0) + ' BBL');
    summarySheet.getRange('A9').setValue('Actual Yield:').setFontWeight('bold');
    summarySheet.getRange('B9').setValue((batchData[12] || 0) + ' BBL');
    summarySheet.getRange('A10').setValue('Efficiency:').setFontWeight('bold');
    var eff = batchData[9] > 0 ? (batchData[12] / batchData[9] * 100) : 0;
    summarySheet.getRange('B10').setValue(eff.toFixed(1) + '%');
    summarySheet.getRange('A11').setValue('Total Cost:').setFontWeight('bold');
    summarySheet.getRange('B11').setValue('$' + (batchData[8] || 0).toFixed(2));
    summarySheet.getRange('A12').setValue('COGS/BBL:').setFontWeight('bold');
    summarySheet.getRange('B12').setValue('$' + (batchData[13] || 0).toFixed(2));
    
    // QA Data
    summarySheet.getRange('A14').setValue('QA DATA').setFontWeight('bold');
    summarySheet.getRange('A15').setValue('OG:');
    summarySheet.getRange('B15').setValue(batchData[16] || '');
    summarySheet.getRange('A16').setValue('FG:');
    summarySheet.getRange('B16').setValue(batchData[17] || '');
    summarySheet.getRange('A17').setValue('ABV:');
    summarySheet.getRange('B17').setValue(batchData[18] || '');
    summarySheet.getRange('A18').setValue('Yeast:');
    summarySheet.getRange('B18').setValue(batchData[21] || '');
    
    // Package Breakdown
    summarySheet.getRange('A20').setValue('PACKAGE BREAKDOWN').setFontWeight('bold');
    var row = 21;
    if (packageBreakdown) {
      for (var pkgType in packageBreakdown) {
        summarySheet.getRange('A' + row).setValue(pkgType + ':');
        summarySheet.getRange('B' + row).setValue(packageBreakdown[pkgType]);
        row++;
      }
    }
    
    // === BATCH DETAILS TAB ===
    var ss = getBrmSpreadsheet();
    var detailsSheet = ss.getSheetByName(BATCH_DETAILS_SHEET);
    
    if (detailsSheet) {
      var detailsData = detailsSheet.getDataRange().getValues();
      var batchDetails = detailsData.filter(function(row) {
        return row[0] && row[0].toString() === batchNumber;
      });
      
      if (batchDetails.length > 0) {
        var detailTab = archiveSS.insertSheet('Batch Details');
        
        // Headers
        var headers = detailsData[0];
        detailTab.getRange(1, 1, 1, headers.length).setValues([headers]);
        detailTab.getRange(1, 1, 1, headers.length).setFontWeight('bold');
        
        // Data
        if (batchDetails.length > 0) {
          detailTab.getRange(2, 1, batchDetails.length, batchDetails[0].length).setValues(batchDetails);
        }
      }
    }
    
    // === INGREDIENTS TAB ===
    var ingSheet = ss.getSheetByName(SHEETS.BATCH_INGREDIENTS);
    if (ingSheet) {
      var ingData = ingSheet.getDataRange().getValues();
      var batchIngredients = ingData.filter(function(row) {
        return row[0] && row[0].toString() === batchNumber;
      });
      
      if (batchIngredients.length > 0) {
        var ingTab = archiveSS.insertSheet('Ingredients');
        
        var ingHeaders = ingData[0] || ['Batch #', 'Date', 'Category', 'Ingredient', 'Amount', 'UOM', 'Unit Cost', 'Total Cost'];
        ingTab.getRange(1, 1, 1, ingHeaders.length).setValues([ingHeaders]);
        ingTab.getRange(1, 1, 1, ingHeaders.length).setFontWeight('bold');
        
        if (batchIngredients.length > 0) {
          ingTab.getRange(2, 1, batchIngredients.length, batchIngredients[0].length).setValues(batchIngredients);
        }
      }
    }
    
    Logger.log('Batch record archived: ' + archiveSS.getUrl());
    
    return {
      success: true,
      fileId: archiveSS.getId(),
      url: archiveSS.getUrl(),
      message: 'Batch record archived'
    };
    
  } catch (e) {
    Logger.log('Error archiving batch record: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: UI HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get batch details for UI display
 * Returns all entries from Batch Details sheet for a specific batch
 */
function getBatchDetails(batchNumber) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(BATCH_DETAILS_SHEET);
    
    if (!sheet) {
      return { success: true, entries: [] };
    }
    
    var data = sheet.getDataRange().getValues();
    var entries = [];
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === batchNumber) {
        entries.push({
          batchNumber: data[i][0],
          date: data[i][1],
          time: data[i][2],
          type: data[i][3],
          description: data[i][4],
          value: data[i][5],
          units: data[i][6],
          cost: data[i][7],
          vessel: data[i][8],
          enteredBy: data[i][9],
          notes: data[i][10]
        });
      }
    }
    
    return serializeForHtml({ success: true, entries: entries });
    
  } catch (e) {
    return { success: false, error: e.toString(), entries: [] };
  }
}


/**
 * Get active batches (not yet packaged) for Production Tab
 */
function getActiveBatches() {
  try {
    var result = getBatchesData({});
    
    if (!result.success) return result;
    
    var activeBatches = result.batches.filter(function(b) {
      return b.status !== 'Packaged' && b.status !== 'Dumped' && b.status !== 'Complete';
    });
    
    return serializeForHtml({
      success: true,
      batches: activeBatches,
      count: activeBatches.length
    });
    
  } catch (e) {
    return { success: false, error: e.toString(), batches: [] };
  }
}


/**
 * Get batch summary for Production Tab card display
 */
function getBatchSummary(batchNumber) {
  try {
    var ss = getBrmSpreadsheet();
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    if (!batchSheet) {
      return { success: false, error: 'Batch Log not found' };
    }
    
    var data = batchSheet.getDataRange().getValues();
    
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === batchNumber) {
        var batchData = data[i];
        
        // Get latest entries from Batch Details
        var detailsResult = getBatchDetails(batchNumber);
        var latestGravity = null;
        var additions = [];
        
        if (detailsResult.success && detailsResult.entries) {
          detailsResult.entries.forEach(function(e) {
            if (e.type === 'Gravity') {
              latestGravity = { value: e.value, date: e.date };
            }
            if (e.type === 'Addition') {
              additions.push(e.description);
            }
          });
        }
        
        return serializeForHtml({
          success: true,
          batch: {
            batchNumber: batchData[0],
            brewDate: batchData[1],
            beerName: batchData[2],
            batchSize: batchData[3],
            recipeCost: batchData[4],
            totalCost: batchData[8],
            expectedYield: batchData[9],
            status: batchData[10],
            pkgDate: batchData[11],
            actualYield: batchData[12],
            cogsPerBBL: batchData[13],
            og: batchData[16],
            fg: batchData[17],
            abv: batchData[18],
            latestGravity: latestGravity,
            additions: additions
          }
        });
      }
    }
    
    return { success: false, error: 'Batch not found' };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9: SETUP BATCH LOG COLUMNS (run once)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Add new columns to Batch Log if they don't exist
 * Run once to extend the sheet
 */
function setupBatchLogColumns() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    if (!sheet) {
      return { success: false, error: 'Batch Log not found' };
    }
    
    // Find the header row
    var data = sheet.getDataRange().getValues();
    var headerRow = -1;
    
    for (var i = 0; i < data.length; i++) {
      if ((data[i][0] || '').toString().toLowerCase().indexOf('batch') !== -1) {
        headerRow = i + 1;
        break;
      }
    }
    
    if (headerRow === -1) {
      headerRow = 9;  // Default from screenshot
    }
    
    // Check if columns already exist
    var headers = data[headerRow - 1];
    var lastCol = headers.length;
    
    // Look for our new columns
    var hasTerminalGravity = false;
    var hasDaysInTank = false;
    var hasAdditionCost = false;
    var hasQAStatus = false;
    var hasCurrentVessel = false;
    
    for (var h = 0; h < headers.length; h++) {
      var header = (headers[h] || '').toString().toLowerCase();
      if (header.indexOf('terminal') !== -1) hasTerminalGravity = true;
      if (header.indexOf('days in tank') !== -1) hasDaysInTank = true;
      if (header.indexOf('addition cost') !== -1) hasAdditionCost = true;
      if (header.indexOf('qa status') !== -1) hasQAStatus = true;
      if (header.indexOf('current vessel') !== -1) hasCurrentVessel = true;
    }
    
    // Add missing columns
    var colsAdded = [];
    var nextCol = lastCol + 1;
    
    if (!hasTerminalGravity) {
      sheet.getRange(headerRow, nextCol).setValue('Terminal Gravity');
      colsAdded.push('Terminal Gravity');
      nextCol++;
    }
    
    if (!hasDaysInTank) {
      sheet.getRange(headerRow, nextCol).setValue('Days in Tank');
      colsAdded.push('Days in Tank');
      nextCol++;
    }
    
    if (!hasAdditionCost) {
      sheet.getRange(headerRow, nextCol).setValue('Addition Cost');
      colsAdded.push('Addition Cost');
      nextCol++;
    }
    
    if (!hasQAStatus) {
      sheet.getRange(headerRow, nextCol).setValue('QA Status');
      colsAdded.push('QA Status');
      nextCol++;
    }
    
    if (!hasCurrentVessel) {
      sheet.getRange(headerRow, nextCol).setValue('Current Vessel');
      colsAdded.push('Current Vessel');
      nextCol++;
    }
    
    if (colsAdded.length > 0) {
      Logger.log('Added columns to Batch Log: ' + colsAdded.join(', '));
      return { success: true, message: 'Added columns: ' + colsAdded.join(', ') };
    } else {
      return { success: true, message: 'All columns already exist' };
    }
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// END OF BREWER'S SHEET ADDITIONS
// 
// TO USE:
// 1. Add this code to your existing Code.gs
// 2. Run setupBatchDetailsSheet() once to create the supporting sheet
// 3. Run setupBatchLogColumns() once to add new columns to Batch Log
// 4. Replace calls to confirmBrewStartEnhanced() with startBrew()
// 5. Add finalizeBrew() call when brewer assigns to vessel
// 6. Add UI elements for cellar work (gravity, additions, transfers)
// 7. Add sendIt() button to complete batches
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Wrapper for backward compatibility
 * HTML calls confirmBrewStartEnhanced, but new function is startBrew
 */
function confirmBrewStartEnhanced(brewerData) {
  var result = startBrew(brewerData);
  
  // If Turn 1 and Turn 2 brewers are provided, update Brewers column with "Turn 1 / Turn 2" format
  if (result.success && brewerData.turn1Brewer && brewerData.turn2Brewer) {
    try {
      var ss = getBrmSpreadsheet();
      var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
      if (batchSheet) {
        var data = batchSheet.getDataRange().getValues();
        var headers = data[0] || [];
        var brewersCol = -1;
        
        for (var i = 0; i < headers.length; i++) {
          if (headers[i] && headers[i].toString().toLowerCase().includes('brewer')) {
            brewersCol = i + 1;
            break;
          }
        }
        
        if (brewersCol > 0) {
          for (var i = 1; i < data.length; i++) {
            if (data[i][0] && data[i][0].toString() === result.batchNumber) {
              var brewersStr = brewerData.turn1Brewer + ' / ' + brewerData.turn2Brewer;
              batchSheet.getRange(i + 1, brewersCol).setValue(brewersStr);
              break;
            }
          }
        }
      }
    } catch (e) {
      Logger.log('Warning: Could not update Brewers column: ' + e.toString());
    }
  }
  
  return result;
}

/**
 * Update Batch Brewers column with Turn 1 / Turn 2 format
 */
function updateBatchBrewers(batchNumber, brewersString) {
  try {
    var ss = getBrmSpreadsheet();
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    if (!batchSheet) {
      return { success: false, error: 'Batch Log not found' };
    }
    
    var data = batchSheet.getDataRange().getValues();
    var headers = data[0] || [];
    var brewersCol = -1;
    
    for (var i = 0; i < headers.length; i++) {
      if (headers[i] && headers[i].toString().toLowerCase().includes('brewer')) {
        brewersCol = i + 1;
        break;
      }
    }
    
    if (brewersCol <= 0) {
      return { success: false, error: 'Brewers column not found' };
    }
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === batchNumber) {
        batchSheet.getRange(i + 1, brewersCol).setValue(brewersString);
        return { success: true, message: 'Brewers column updated' };
      }
    }
    
    return { success: false, error: 'Batch not found: ' + batchNumber };
    
  } catch (e) {
    Logger.log('Error updating batch brewers: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}
// ═══════════════════════════════════════════════════════════════════════════════
// RED LEG BREWING - PERSISTENT BATCH SHEET SYSTEM
// Backend functions for Code.gs
// One sheet per batch from brew to Send It!
// ═══════════════════════════════════════════════════════════════════════════════

// PACKAGE BBL CONVERSIONS
var PACKAGE_BBL_CONVERSIONS = {
  '1/2 BBL Keg': 0.5,
  '1/6 BBL Keg': 0.167,
  '1/4 BBL Keg': 0.25,
  '12oz Case (24pk)': 0.0581,
  '16oz Case (24pk)': 0.0774,
  'Crowler (32oz)': 0.00258,
  'Growler (64oz)': 0.00516
};


/**
 * GET FULL BATCH SHEET - Returns everything for a batch
 * Called when clicking on a batch row - loads THE SAME SHEET
 */
function getBatchSheet(batchNumber) {
  try {
    var ss = getBrmSpreadsheet();
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    var detailsSheet = ss.getSheetByName('Batch Details');
    var ingredientsSheet = ss.getSheetByName('Batch Ingredients');
    
    if (!batchSheet) {
      return { success: false, error: 'Batch Log not found' };
    }
    
    // Find batch in Batch Log
    var data = batchSheet.getDataRange().getValues();
    var batch = null;
    var batchRow = -1;
    
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === batchNumber) {
        batchRow = i + 1;
        batch = {
          batchNumber: data[i][0],
          brewDate: data[i][1],
          beerName: data[i][2],
          batchSize: data[i][3],
          recipeCost: data[i][4],
          laborHrs: data[i][5],
          laborCost: data[i][6],
          overhead: data[i][7],
          totalCost: data[i][8],
          expectedYield: data[i][9],
          status: data[i][10],
          pkgDate: data[i][11],
          actualYield: data[i][12],
          cogsPerBBL: data[i][13],
          variance: data[i][14],
          notes: data[i][15],
          ogActual: data[i][16],
          fgActual: data[i][17],
          abvActual: data[i][18],
          ibuActual: data[i][19],
          srmActual: data[i][20],
          yeast: data[i][21],
          mashTemp: data[i][22],
          fermentTemp: data[i][23],
          terminalGravity: data[i][24],
          daysInTank: data[i][25],
          additionCost: data[i][26],
          qaStatus: data[i][27],
          currentVessel: data[i][28]
        };
        break;
      }
    }
    
    if (!batch) {
      return { success: false, error: 'Batch not found: ' + batchNumber };
    }
    
    // Get ingredients from Batch Ingredients sheet
    var ingredients = { grains: [], hops: [], other: [] };
    if (ingredientsSheet) {
      var ingData = ingredientsSheet.getDataRange().getValues();
      for (var i = 1; i < ingData.length; i++) {
        if (ingData[i][0] && ingData[i][0].toString() === batchNumber) {
          var ing = {
            category: ingData[i][2],
            ingredient: ingData[i][3],
            amount: ingData[i][4],
            uom: ingData[i][5],
            unitCost: ingData[i][6],
            totalCost: ingData[i][7]
          };
          
          var cat = (ing.category || '').toLowerCase();
          if (cat === 'grain' || cat === 'grains') ingredients.grains.push(ing);
          else if (cat === 'hops' || cat === 'hop') ingredients.hops.push(ing);
          else ingredients.other.push(ing);
        }
      }
    }
    
    // Get all cellar entries from Batch Details
    var cellarEntries = [];
    if (detailsSheet) {
      var detailsData = detailsSheet.getDataRange().getValues();
      for (var i = 1; i < detailsData.length; i++) {
        if (detailsData[i][0] && detailsData[i][0].toString() === batchNumber) {
          cellarEntries.push({
            date: detailsData[i][1],
            time: detailsData[i][2],
            type: detailsData[i][3],
            description: detailsData[i][4],
            value: detailsData[i][5],
            units: detailsData[i][6],
            cost: detailsData[i][7],
            vessel: detailsData[i][8],
            enteredBy: detailsData[i][9],
            notes: detailsData[i][10]
          });
        }
      }
    }
    
    return serializeForHtml({
      success: true,
      batch: batch,
      ingredients: ingredients,
      cellarEntries: cellarEntries,
      batchRow: batchRow
    });
    
  } catch (e) {
    Logger.log('Error getting batch sheet: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASK MANAGEMENT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Ensure Batch Tasks sheet exists with proper structure
 */
function ensureBatchTasksSheet() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.BATCH_TASKS);
    
    if (!sheet) {
      sheet = ss.insertSheet(SHEETS.BATCH_TASKS);
      
      var headers = [
        'Task ID',           // A - Auto-generated unique ID
        'Batch Number',      // B - Links to Batch Log
        'Task Type',         // C - Dropdown
        'Task Name',         // D - Display name
        'Assigned To',       // E - Brewer name
        'Due Date',          // F - Expected completion
        'Status',            // G - Planned/In Progress/Completed
        'Completed By',      // H - Who marked complete
        'Completed Date',    // I - When completed
        'Volume In',         // J - BBL in (for transfers)
        'Volume Out',        // K - BBL out (for transfers)
        'Loss Reason',       // L - Dropdown
        'Notes',             // M - Task notes/instructions
        'Materials JSON',    // N - JSON array of materials
        'Created Date',      // O - When created
        'Created By',        // P - Who created
        'Materials Depleted At'  // Q - Timestamp when materials were depleted
      ];
      
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#1a365d')
        .setFontColor('white');
      sheet.setFrozenRows(1);
      
      // Column widths
      sheet.setColumnWidth(1, 100);  // Task ID
      sheet.setColumnWidth(2, 120);  // Batch Number
      sheet.setColumnWidth(3, 120);  // Task Type
      sheet.setColumnWidth(4, 200);  // Task Name
      sheet.setColumnWidth(5, 120);  // Assigned To
      sheet.setColumnWidth(6, 100);  // Due Date
      sheet.setColumnWidth(7, 100);  // Status
      sheet.setColumnWidth(8, 120);  // Completed By
      sheet.setColumnWidth(9, 120);  // Completed Date
      sheet.setColumnWidth(10, 80);  // Volume In
      sheet.setColumnWidth(11, 80);  // Volume Out
      sheet.setColumnWidth(12, 120); // Loss Reason
      sheet.setColumnWidth(13, 300); // Notes
      sheet.setColumnWidth(14, 400); // Materials JSON
      sheet.setColumnWidth(15, 100); // Created Date
      sheet.setColumnWidth(16, 120); // Created By
      sheet.setColumnWidth(17, 150); // Materials Depleted At
      
      Logger.log('Created Batch Tasks sheet');
    }
    
    return sheet;
  } catch (e) {
    Logger.log('Error ensuring Batch Tasks sheet: ' + e.toString());
    return null;
  }
}

/**
 * Generate unique Task ID
 */
function generateTaskId(batchNumber) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.BATCH_TASKS);
    if (!sheet) {
      ensureBatchTasksSheet();
      sheet = ss.getSheetByName(SHEETS.BATCH_TASKS);
    }
    
    var data = sheet.getDataRange().getValues();
    var taskCount = data.length - 1; // Exclude header
    var taskId = 'TASK-' + batchNumber + '-' + String(taskCount + 1).padStart(3, '0');
    
    return taskId;
  } catch (e) {
    // Fallback if sheet doesn't exist
    return 'TASK-' + batchNumber + '-' + Date.now();
  }
}

/**
 * CREATE BATCH TASK
 */
function createBatchTask(batchNumber, taskData) {
  try {
    var sheet = ensureBatchTasksSheet();
    if (!sheet) {
      return { success: false, error: 'Could not create Batch Tasks sheet' };
    }
    
    var taskId = generateTaskId(batchNumber);
    var user = getCurrentUser();
    var now = new Date();
    
    var row = [
      taskId,                                    // A: Task ID
      batchNumber,                               // B: Batch Number
      taskData.taskType || '',                   // C: Task Type
      taskData.taskName || taskData.taskType || '', // D: Task Name
      taskData.assignedTo || '',                 // E: Assigned To
      taskData.dueDate || '',                    // F: Due Date
      taskData.status || 'Planned',              // G: Status
      '',                                        // H: Completed By
      '',                                        // I: Completed Date
      taskData.volumeIn || '',                  // J: Volume In
      taskData.volumeOut || '',                 // K: Volume Out
      taskData.lossReason || '',                // L: Loss Reason
      taskData.notes || '',                     // M: Notes
      JSON.stringify(taskData.materials || []), // N: Materials JSON
      now,                                       // O: Created Date
      user.name                                  // P: Created By
    ];
    
    sheet.appendRow(row);
    
    return serializeForHtml({
      success: true,
      taskId: taskId,
      message: 'Task created successfully'
    });
  } catch (e) {
    Logger.log('Error creating batch task: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * GET BATCH TASKS
 */
function getBatchTasks(batchNumber) {
  try {
    var sheet = ensureBatchTasksSheet();
    if (!sheet) {
      return serializeForHtml({ success: true, tasks: [] });
    }
    
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return serializeForHtml({ success: true, tasks: [] });
    }
    
    var headers = data[0];
    var tasks = [];
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][1] && data[i][1].toString() === batchNumber) {
        var materialsJson = data[i][13] || '[]';
        var materials = [];
        try {
          materials = JSON.parse(materialsJson);
        } catch (e) {
          materials = [];
        }
        
        tasks.push({
          taskId: data[i][0],
          batchNumber: data[i][1],
          taskType: data[i][2],
          taskName: data[i][3],
          assignedTo: data[i][4],
          dueDate: data[i][5],
          status: data[i][6],
          completedBy: data[i][7],
          completedDate: data[i][8],
          volumeIn: data[i][9],
          volumeOut: data[i][10],
          lossReason: data[i][11],
          notes: data[i][12],
          materials: materials,
          createdDate: data[i][14],
          createdBy: data[i][15]
        });
      }
    }
    
    return serializeForHtml({
      success: true,
      tasks: tasks
    });
  } catch (e) {
    Logger.log('Error getting batch tasks: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * UPDATE BATCH TASK
 */
function updateBatchTask(taskId, updates) {
  try {
    var sheet = ensureBatchTasksSheet();
    if (!sheet) {
      return { success: false, error: 'Batch Tasks sheet not found' };
    }
    
    var data = sheet.getDataRange().getValues();
    var taskRow = -1;
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === taskId) {
        taskRow = i + 1;
        break;
      }
    }
    
    if (taskRow === -1) {
      return { success: false, error: 'Task not found: ' + taskId };
    }
    
    // Update fields (preserve existing if not provided)
    if (updates.taskType !== undefined) sheet.getRange(taskRow, 3).setValue(updates.taskType);
    if (updates.taskName !== undefined) sheet.getRange(taskRow, 4).setValue(updates.taskName);
    if (updates.assignedTo !== undefined) sheet.getRange(taskRow, 5).setValue(updates.assignedTo);
    if (updates.dueDate !== undefined) sheet.getRange(taskRow, 6).setValue(updates.dueDate);
    if (updates.status !== undefined) sheet.getRange(taskRow, 7).setValue(updates.status);
    if (updates.volumeIn !== undefined) {
      if (updates.volumeIn === null || updates.volumeIn === '') {
        sheet.getRange(taskRow, 10).setValue('');
      } else {
        sheet.getRange(taskRow, 10).setValue(updates.volumeIn);
      }
    }
    if (updates.volumeOut !== undefined) {
      if (updates.volumeOut === null || updates.volumeOut === '') {
        sheet.getRange(taskRow, 11).setValue('');
      } else {
        sheet.getRange(taskRow, 11).setValue(updates.volumeOut);
      }
    }
    if (updates.lossReason !== undefined) sheet.getRange(taskRow, 12).setValue(updates.lossReason);
    if (updates.notes !== undefined) sheet.getRange(taskRow, 13).setValue(updates.notes);
    if (updates.materials !== undefined) {
      sheet.getRange(taskRow, 14).setValue(JSON.stringify(updates.materials));
    }
    if (updates.packageType !== undefined) {
      // Store in notes or create new column - for now, store in notes
      var currentNotes = sheet.getRange(taskRow, 13).getValue();
      if (currentNotes && currentNotes.indexOf('Package Type:') === -1) {
        sheet.getRange(taskRow, 13).setValue(currentNotes + (currentNotes ? ' | ' : '') + 'Package Type: ' + updates.packageType);
      }
    }
    if (updates.packageQty !== undefined) {
      var currentNotes = sheet.getRange(taskRow, 13).getValue();
      if (currentNotes && currentNotes.indexOf('Package Qty:') === -1) {
        sheet.getRange(taskRow, 13).setValue(currentNotes + (currentNotes ? ' | ' : '') + 'Package Qty: ' + updates.packageQty);
      }
    }
    
    return { success: true, message: 'Task updated successfully' };
  } catch (e) {
    Logger.log('Error updating batch task: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * COMPLETE BATCH TASK
 * Marks task as complete and handles material depletion
 */
function completeBatchTask(taskId, completionData) {
  try {
    var sheet = ensureBatchTasksSheet();
    if (!sheet) {
      return { success: false, error: 'Batch Tasks sheet not found' };
    }
    
    var data = sheet.getDataRange().getValues();
    var taskRow = -1;
    var task = null;
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === taskId) {
        taskRow = i + 1;
        var materialsJson = data[i][13] || '[]';
        var materials = [];
        try {
          materials = JSON.parse(materialsJson);
        } catch (e) {
          materials = [];
        }
        
        task = {
          taskId: data[i][0],
          batchNumber: data[i][1],
          taskType: data[i][2],
          taskName: data[i][3],
          materials: materials,
          materialsDepletedBy: completionData.materialsDepletedBy || null
        };
        break;
      }
    }
    
    if (!task) {
      return { success: false, error: 'Task not found: ' + taskId };
    }
    
    var user = getCurrentUser();
    var now = new Date();
    
    // Update task status
    sheet.getRange(taskRow, 7).setValue('Completed');  // Status
    sheet.getRange(taskRow, 8).setValue(user.name);    // Completed By
    sheet.getRange(taskRow, 9).setValue(now);          // Completed Date
    
    // Update volume if provided
    if (completionData.volumeOut !== undefined) {
      sheet.getRange(taskRow, 11).setValue(completionData.volumeOut);
    }
    if (completionData.lossReason !== undefined) {
      sheet.getRange(taskRow, 12).setValue(completionData.lossReason);
    }
    
    // Check if materials already depleted (check timestamp column)
    var materialsDepletedAt = data[taskRow - 1][16]; // Column Q (0-indexed = 16)
    var alreadyDepleted = materialsDepletedAt && materialsDepletedAt !== '';
    
    // Deplete materials if not already depleted
    if (!alreadyDepleted && task.materials && task.materials.length > 0 && 
        (!task.materialsDepletedBy || task.materialsDepletedBy === 'task')) {
      
      // Check Material Log to be extra safe
      if (!hasBeenDepleted(task.batchNumber, taskId, 'Task')) {
        for (var m = 0; m < task.materials.length; m++) {
          var mat = task.materials[m];
          if (mat.actualQty && mat.actualQty > 0) {
            var matUOM = (mat.unit || mat.uom || 'lb').toString().trim();
            depleteRawMaterial(mat.item, mat.actualQty, task.batchNumber, taskId, 'Task', matUOM);
          }
        }
        
        // Set depletion timestamp
        sheet.getRange(taskRow, 17).setValue(now); // Column Q
        Logger.log('Task materials depleted: ' + taskId + ' for batch ' + task.batchNumber);
      } else {
        Logger.log('Task materials already depleted (found in Material Log): ' + taskId);
      }
    } else if (alreadyDepleted) {
      Logger.log('Task materials already depleted (timestamp exists): ' + taskId);
    }
    
    // Log to Batch Details
    addBatchEntry(task.batchNumber, 'Task', {
      description: task.taskName || task.taskType,
      notes: 'Task completed: ' + (completionData.notes || '')
    });
    
    return { success: true, message: 'Task completed successfully' };
  } catch (e) {
    Logger.log('Error completing batch task: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * DELETE BATCH TASK
 */
function deleteBatchTask(taskId) {
  try {
    var sheet = ensureBatchTasksSheet();
    if (!sheet) {
      return { success: false, error: 'Batch Tasks sheet not found' };
    }
    
    var data = sheet.getDataRange().getValues();
    var taskRow = -1;
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === taskId) {
        taskRow = i + 1;
        break;
      }
    }
    
    if (taskRow === -1) {
      return { success: false, error: 'Task not found: ' + taskId };
    }
    
    sheet.deleteRow(taskRow);
    
    return { success: true, message: 'Task deleted successfully' };
  } catch (e) {
    Logger.log('Error deleting batch task: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * ASSIGN BATCH TASK
 */
function assignBatchTask(taskId, assignee) {
  try {
    return updateBatchTask(taskId, { assignedTo: assignee });
  } catch (e) {
    Logger.log('Error assigning batch task: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECIPE TASK TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Ensure Recipe Task Templates sheet exists
 */
function ensureRecipeTaskTemplatesSheet() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.RECIPE_TASK_TEMPLATES);
    
    if (!sheet) {
      sheet = ss.insertSheet(SHEETS.RECIPE_TASK_TEMPLATES);
      
      var headers = [
        'Template ID',      // A - Auto-generated
        'Recipe Name',      // B - Links to Recipes
        'Task Type',        // C - Dropdown
        'Task Name',        // D - Default name
        'Day Offset',       // E - Days after brew (0=brew day)
        'Default Assigned To', // F - Optional brewer
        'Default Materials',   // G - JSON array
        'Default Notes',       // H - Instructions
        'Sort Order',          // I - Display order
        'Active',              // J - TRUE/FALSE
        'Created Date',        // K
        'Created By'           // L
      ];
      
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#1a365d')
        .setFontColor('white');
      sheet.setFrozenRows(1);
      
      Logger.log('Created Recipe Task Templates sheet');
    }
    
    return sheet;
  } catch (e) {
    Logger.log('Error ensuring Recipe Task Templates sheet: ' + e.toString());
    return null;
  }
}

/**
 * GET RECIPE TASK TEMPLATES
 */
function getRecipeTaskTemplates(recipeName) {
  try {
    var sheet = ensureRecipeTaskTemplatesSheet();
    if (!sheet) {
      return serializeForHtml({ success: true, templates: [] });
    }
    
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return serializeForHtml({ success: true, templates: [] });
    }
    
    var templates = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][1] && data[i][1].toString() === recipeName && 
          (data[i][9] === true || data[i][9] === 'TRUE')) { // Active
        var materialsJson = data[i][6] || '[]';
        var materials = [];
        try {
          materials = JSON.parse(materialsJson);
          // Ensure backward compatibility: add default fields if missing
          materials = materials.map(function(mat) {
            return {
              item: mat.item || mat.ingredient || '',
              quantity: mat.quantity || mat.amount || 0,
              unit: mat.unit || mat.uom || 'lb',
              uom: mat.uom || mat.unit || 'lb',
              source: mat.source || 'manual',  // NEW: default to "manual" for backward compatibility
              recipeCategory: mat.recipeCategory || null,  // NEW: category if source=recipe
              recipeIngredientName: mat.recipeIngredientName || null  // NEW: ingredient name if source=recipe
            };
          });
        } catch (e) {
          materials = [];
        }
        
        templates.push({
          templateId: data[i][0],
          recipeName: data[i][1],
          taskType: data[i][2],
          taskName: data[i][3],
          dayOffset: data[i][4],
          defaultAssignedTo: data[i][5],
          defaultMaterials: materials,
          defaultNotes: data[i][7],
          sortOrder: data[i][8] || 0,
          active: data[i][9],
          createdDate: data[i][10],
          createdBy: data[i][11]
        });
      }
    }
    
    // Sort by sort order
    templates.sort(function(a, b) {
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
    
    return serializeForHtml({
      success: true,
      templates: templates
    });
  } catch (e) {
    Logger.log('Error getting recipe task templates: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * CREATE TASKS FROM TEMPLATES
 * Called when Start Brew is clicked
 */
function createTasksFromTemplates(batchNumber, recipeName, brewDate) {
  try {
    var templatesResult = getRecipeTaskTemplates(recipeName);
    if (!templatesResult.success || !templatesResult.templates || templatesResult.templates.length === 0) {
      return { success: true, message: 'No task templates for this recipe', tasksCreated: 0 };
    }
    
    var brewDateObj = brewDate instanceof Date ? brewDate : new Date(brewDate);
    var tasksCreated = 0;
    
    templatesResult.templates.forEach(function(template) {
      var dueDate = new Date(brewDateObj);
      dueDate.setDate(dueDate.getDate() + (template.dayOffset || 0));
      
      var taskData = {
        taskType: template.taskType,
        taskName: template.taskName || template.taskType,
        assignedTo: template.defaultAssignedTo || '',
        dueDate: dueDate.toISOString().split('T')[0],
        status: 'Planned',
        notes: template.defaultNotes || '',
        materials: template.defaultMaterials || []
      };
      
      var result = createBatchTask(batchNumber, taskData);
      if (result.success) {
        tasksCreated++;
      }
    });
    
    Logger.log('Created ' + tasksCreated + ' tasks from templates for ' + recipeName);
    
    return {
      success: true,
      tasksCreated: tasksCreated,
      message: 'Created ' + tasksCreated + ' tasks from templates'
    };
  } catch (e) {
    Logger.log('Error creating tasks from templates: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * ADD RECIPE TASK TEMPLATE
 */
function addRecipeTaskTemplate(recipeName, templateData) {
  try {
    var sheet = ensureRecipeTaskTemplatesSheet();
    if (!sheet) {
      return { success: false, error: 'Could not create Recipe Task Templates sheet' };
    }
    
    var templateId = 'TEMPLATE-' + recipeName + '-' + Date.now();
    var user = getCurrentUser();
    var now = new Date();
    
    // Process materials to ensure new fields are set with defaults
    var processedMaterials = (templateData.defaultMaterials || []).map(function(mat) {
      return {
        item: mat.item || mat.ingredient || '',
        quantity: mat.quantity || mat.amount || 0,
        unit: mat.unit || mat.uom || 'lb',
        uom: mat.uom || mat.unit || 'lb',
        source: mat.source || 'manual',  // NEW: default to "manual" if not provided
        recipeCategory: mat.recipeCategory || null,  // NEW: category if source=recipe
        recipeIngredientName: mat.recipeIngredientName || null  // NEW: ingredient name if source=recipe
      };
    });
    
    var row = [
      templateId,                                    // A: Template ID
      recipeName,                                    // B: Recipe Name
      templateData.taskType || '',                   // C: Task Type
      templateData.taskName || templateData.taskType || '', // D: Task Name
      templateData.dayOffset || 0,                   // E: Day Offset
      templateData.defaultAssignedTo || '',           // F: Default Assigned To
      JSON.stringify(processedMaterials),            // G: Default Materials (with new fields)
      templateData.defaultNotes || '',               // H: Default Notes
      templateData.sortOrder || 0,                   // I: Sort Order
      true,                                          // J: Active
      now,                                           // K: Created Date
      user.name                                      // L: Created By
    ];
    
    sheet.appendRow(row);
    
    return serializeForHtml({
      success: true,
      templateId: templateId,
      message: 'Template created successfully'
    });
  } catch (e) {
    Logger.log('Error creating recipe task template: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * UPDATE RECIPE TASK TEMPLATE
 */
function updateRecipeTaskTemplate(templateId, updates) {
  try {
    var sheet = ensureRecipeTaskTemplatesSheet();
    if (!sheet) {
      return { success: false, error: 'Recipe Task Templates sheet not found' };
    }
    
    var data = sheet.getDataRange().getValues();
    var templateRow = -1;
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === templateId) {
        templateRow = i + 1;
        break;
      }
    }
    
    if (templateRow === -1) {
      return { success: false, error: 'Template not found: ' + templateId };
    }
    
    // Update fields
    if (updates.taskType !== undefined) sheet.getRange(templateRow, 3).setValue(updates.taskType);
    if (updates.taskName !== undefined) sheet.getRange(templateRow, 4).setValue(updates.taskName);
    if (updates.dayOffset !== undefined) sheet.getRange(templateRow, 5).setValue(updates.dayOffset);
    if (updates.defaultAssignedTo !== undefined) sheet.getRange(templateRow, 6).setValue(updates.defaultAssignedTo);
    if (updates.defaultMaterials !== undefined) {
      // Process materials to ensure new fields are set with defaults
      var processedMaterials = (updates.defaultMaterials || []).map(function(mat) {
        return {
          item: mat.item || mat.ingredient || '',
          quantity: mat.quantity || mat.amount || 0,
          unit: mat.unit || mat.uom || 'lb',
          uom: mat.uom || mat.unit || 'lb',
          source: mat.source || 'manual',  // NEW: default to "manual" if not provided
          recipeCategory: mat.recipeCategory || null,  // NEW: category if source=recipe
          recipeIngredientName: mat.recipeIngredientName || null  // NEW: ingredient name if source=recipe
        };
      });
      sheet.getRange(templateRow, 7).setValue(JSON.stringify(processedMaterials));
    }
    if (updates.defaultNotes !== undefined) sheet.getRange(templateRow, 8).setValue(updates.defaultNotes);
    if (updates.sortOrder !== undefined) sheet.getRange(templateRow, 9).setValue(updates.sortOrder);
    if (updates.active !== undefined) sheet.getRange(templateRow, 10).setValue(updates.active);
    
    return { success: true, message: 'Template updated successfully' };
  } catch (e) {
    Logger.log('Error updating recipe task template: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * GET RECIPE INGREDIENTS BY CATEGORY
 * Returns ingredients from a recipe filtered by category
 * Used for linking task template materials to recipe ingredients
 * 
 * @param {string} recipeName - Name of the recipe
 * @param {string} category - Category: "grains", "hops", "yeast", "other"
 * @returns {Array} Array of {name, quantity, unit, costPerUnit}
 */
function getRecipeIngredientsByCategory(recipeName, category) {
  try {
    var recipesResult = getAllRecipesEnhanced();
    if (!recipesResult.success || !recipesResult.recipes) {
      return [];
    }
    
    var recipe = recipesResult.recipes.find(function(r) {
      return r.recipeName === recipeName;
    });
    
    if (!recipe) {
      Logger.log('Recipe not found: ' + recipeName);
      return [];
    }
    
    var ingredients = [];
    var categoryLower = (category || '').toLowerCase();
    
    // Map category to recipe property
    if (categoryLower === 'grains' || categoryLower === 'grain') {
      ingredients = (recipe.grains || []).map(function(ing) {
        return {
          name: ing.ingredient || '',
          quantity: ing.amount || 0,
          unit: ing.uom || 'lb',
          costPerUnit: 0  // Will be calculated from Raw Materials if needed
        };
      });
    } else if (categoryLower === 'hops' || categoryLower === 'hop') {
      ingredients = (recipe.hops || []).map(function(ing) {
        return {
          name: ing.ingredient || '',
          quantity: ing.amount || 0,
          unit: ing.uom || 'lb',
          costPerUnit: 0  // Will be calculated from Raw Materials if needed
        };
      });
    } else if (categoryLower === 'yeast') {
      // Yeast is typically stored in recipe metadata, not in ingredients
      if (recipe.yeast) {
        ingredients = [{
          name: recipe.yeast,
          quantity: 1,  // Yeast is typically per batch
          unit: 'pitch',
          costPerUnit: 0
        }];
      }
    } else if (categoryLower === 'other') {
      ingredients = (recipe.other || []).map(function(ing) {
        return {
          name: ing.ingredient || '',
          quantity: ing.amount || 0,
          unit: ing.uom || 'lb',
          costPerUnit: 0  // Will be calculated from Raw Materials if needed
        };
      });
    }
    
    return ingredients;
  } catch (e) {
    Logger.log('Error getting recipe ingredients by category: ' + e.toString());
    return [];
  }
}

/**
 * GET RECIPE INGREDIENTS FOR DROPDOWN (UI Helper)
 * Returns ingredients from a recipe filtered by category for UI dropdowns
 * Used in Task Template modal when linking materials to recipe ingredients
 * 
 * @param {string} recipeName - Name of the recipe
 * @param {string} category - Category: "grains", "hops", "yeast", "other"
 * @returns {Object} {success: boolean, ingredients: Array}
 */
function getRecipeIngredientsForDropdown(recipeName, category) {
  try {
    var ingredients = getRecipeIngredientsByCategory(recipeName, category);
    
    return serializeForHtml({
      success: true,
      ingredients: ingredients
    });
  } catch (e) {
    Logger.log('Error getting recipe ingredients for dropdown: ' + e.toString());
    return { success: false, error: e.toString(), ingredients: [] };
  }
}

/**
 * DELETE RECIPE TASK TEMPLATE
 */
function deleteRecipeTaskTemplate(templateId) {
  try {
    var sheet = ensureRecipeTaskTemplatesSheet();
    if (!sheet) {
      return { success: false, error: 'Recipe Task Templates sheet not found' };
    }
    
    var data = sheet.getDataRange().getValues();
    var templateRow = -1;
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === templateId) {
        templateRow = i + 1;
        break;
      }
    }
    
    if (templateRow === -1) {
      return { success: false, error: 'Template not found: ' + templateId };
    }
    
    sheet.deleteRow(templateRow);
    
    return { success: true, message: 'Template deleted successfully' };
  } catch (e) {
    Logger.log('Error deleting recipe task template: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}


/**
 * CREATE BATCH - Step 1: Brewer clicks "Brew This"
 * Creates batch record with status = "Brewing"
 * NO RM depletion yet - that happens at Finalize
 */
function createBatch(recipeData) {
  try {
    var ss = getBrmSpreadsheet();
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    if (!batchSheet) {
      return { success: false, error: 'Batch Log not found' };
    }
    
    // Generate batch number
    var batchNumber = generateBatchNumber(recipeData.recipeName);
    
    // Get labor cost
    var laborResult = getLaborCostPerBatch();
    var laborCost = laborResult.totalLabor || 0;
    
    // Calculate expected values
    var batchSize = parseFloat(recipeData.batchSize) || 60;
    var yieldPct = parseFloat(recipeData.yieldPct) || 0.95;
    var expectedYield = batchSize * yieldPct;
    var overhead = batchSize * 15;
    var estimatedCost = (recipeData.estimatedIngredientCost || 0) + laborCost + overhead;
    
    // Find insert row (after row 9 headers)
    var insertRow = batchSheet.getLastRow() + 1;
    if (insertRow < 10) insertRow = 10;
    
    // Build row - status = "Brewing" (not yet finalized)
    var rowData = [
      batchNumber,                              // A: Batch #
      new Date(),                               // B: Brew Date
      recipeData.recipeName,                    // C: Beer Name
      batchSize,                                // D: Size (BBL)
      recipeData.estimatedIngredientCost || 0,  // E: Recipe Cost (estimated)
      8,                                        // F: Labor Hrs
      laborCost,                                // G: Labor $
      overhead,                                 // H: Overhead
      estimatedCost,                            // I: Total Cost (estimated)
      expectedYield,                            // J: Expected Yield
      'Brewing',                                // K: Status
      '',                                       // L: Pkg Date
      '',                                       // M: Act. Yield
      '',                                       // N: Cost/BBL
      '',                                       // O: Variance
      '',                                       // P: Notes
      recipeData.targetOG || '',                // Q: OG Target
      '',                                       // R: FG Actual
      '',                                       // S: ABV Actual
      '',                                       // T: IBU Actual
      '',                                       // U: SRM Actual
      recipeData.yeast || '',                   // V: Yeast
      '',                                       // W: Mash Temp
      '',                                       // X: Ferment Temp
      '',                                       // Y: Terminal Gravity
      0,                                        // Z: Days in Tank
      0,                                        // AA: Addition Cost
      'PENDING',                                // AB: QA Status
      ''                                        // AC: Current Vessel
    ];
    
    batchSheet.getRange(insertRow, 1, 1, rowData.length).setValues([rowData]);
    
    // Log creation
    addBatchEntry(batchNumber, 'Note', {
      description: 'Batch created - Brewing in progress',
      value: batchSize,
      units: 'BBL',
      notes: 'Recipe: ' + recipeData.recipeName
    });
    
    Logger.log('Batch created: ' + batchNumber + ' (status: Brewing)');
    
    // Return full batch sheet data
    return getBatchSheet(batchNumber);
    
  } catch (e) {
    Logger.log('Error creating batch: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}


/**
 * FINALIZE BREW - Brewer confirms actuals and assigns vessel
 * THIS depletes Raw Materials based on ACTUALS
 */
function finalizeBrewWithActuals(batchNumber, vessel, brewer, actualIngredients, ogActual, mashTemp, notes) {
  try {
    var ss = getBrmSpreadsheet();
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    if (!batchSheet) {
      return { success: false, error: 'Batch Log not found' };
    }
    
    // Find batch row
    var data = batchSheet.getDataRange().getValues();
    var batchRow = -1;
    var beerName = '';
    var batchSize = 60;
    
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === batchNumber) {
        batchRow = i + 1;
        beerName = data[i][2];
        batchSize = parseFloat(data[i][3]) || 60;
        break;
      }
    }
    
    if (batchRow === -1) {
      return { success: false, error: 'Batch not found: ' + batchNumber };
    }
    
    // Deplete Raw Materials and calculate actual cost
    var totalIngredientCost = 0;
    var allIngredients = [];
    
    // Process all ingredients
    ['grains', 'hops', 'other'].forEach(function(category) {
      if (actualIngredients[category] && actualIngredients[category].length > 0) {
        actualIngredients[category].forEach(function(item) {
          var amt = parseFloat(item.actualAmount) || parseFloat(item.amount) || 0;
          var itemUOM = (item.uom || 'lb').toString().trim();
          if (amt > 0 && item.ingredient) {
            // Deplete from Raw Materials (with unit conversion)
            depleteRawMaterial(item.ingredient, amt, batchNumber, null, 'Recipe', itemUOM);
            
            // Calculate cost
            var unitCost = parseFloat(item.avgCost) || parseFloat(item.unitCost) || 0;
            var cost = amt * unitCost;
            totalIngredientCost += cost;
            
            allIngredients.push({
              category: category === 'grains' ? 'Grain' : category === 'hops' ? 'Hops' : 'Other',
              ingredient: item.ingredient,
              amount: amt,
              uom: item.uom || 'lb',
              unitCost: unitCost,
              cost: cost
            });
          }
        });
      }
    });
    
    // Get labor cost
    var laborResult = getLaborCostPerBatch();
    var laborCost = laborResult.totalLabor || 0;
    var overhead = batchSize * 15;
    var totalCost = totalIngredientCost + laborCost + overhead;
    
    // Update Batch Log
    batchSheet.getRange(batchRow, 5).setValue(totalIngredientCost);  // E: Recipe Cost (actual)
    batchSheet.getRange(batchRow, 9).setValue(totalCost);            // I: Total Cost
    batchSheet.getRange(batchRow, 11).setValue('Fermenting');        // K: Status
    batchSheet.getRange(batchRow, 16).setValue(notes || '');         // P: Notes
    batchSheet.getRange(batchRow, 17).setValue(ogActual || '');      // Q: OG Actual
    batchSheet.getRange(batchRow, 23).setValue(mashTemp || '');      // W: Mash Temp
    batchSheet.getRange(batchRow, 29).setValue(vessel || '');        // AC: Current Vessel
    
    // Log ingredients to Batch Ingredients sheet
    if (allIngredients.length > 0) {
      logBatchIngredients(batchNumber, allIngredients);
    }
    
    // Update Equipment Scheduling
    if (vessel) {
      updateEquipmentStatus(vessel, 'In Use', beerName, batchNumber);
    }
    
    // Log to Batch Details
    addBatchEntry(batchNumber, 'Transfer', {
      description: 'Brew finalized - Assigned to ' + vessel,
      vessel: vessel,
      notes: 'Brewer: ' + (brewer || 'Unknown') + ' | OG: ' + (ogActual || '-') + ' | RM Cost: $' + totalIngredientCost.toFixed(2)
    });
    
    Logger.log('Brew finalized: ' + batchNumber + ' → ' + vessel + ', RM depleted: $' + totalIngredientCost.toFixed(2));
    
    // Return updated batch sheet
    return getBatchSheet(batchNumber);
    
  } catch (e) {
    Logger.log('Error finalizing brew: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}


/**
 * LOG BATCH INGREDIENTS - Write actuals to Batch Ingredients sheet
 */
function logBatchIngredients(batchNumber, ingredients) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName('Batch Ingredients');
    
    if (!sheet) {
      Logger.log('Batch Ingredients sheet not found');
      return { success: false, error: 'Sheet not found' };
    }
    
    var today = new Date();
    var rows = [];
    
    ingredients.forEach(function(ing) {
      rows.push([
        batchNumber,                          // A: Batch #
        today,                                // B: Date
        ing.category || 'Other',              // C: Category
        ing.ingredient || '',                 // D: Ingredient
        ing.amount || 0,                      // E: Amount
        ing.uom || 'lb',                      // F: UOM
        ing.unitCost || 0,                    // G: Unit Cost
        ing.cost || (ing.amount * ing.unitCost) || 0  // H: Total Cost
      ]);
    });
    
    if (rows.length > 0) {
      var lastRow = sheet.getLastRow();
      var insertRow = lastRow < 1 ? 2 : lastRow + 1;
      sheet.getRange(insertRow, 1, rows.length, 8).setValues(rows);
    }
    
    return { success: true, count: rows.length };
    
  } catch (e) {
    Logger.log('Error logging ingredients: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}


/**
 * ADD CELLAR ENTRY - Generic function for gravity, DO, carb, etc.
 */
function addCellarEntry(batchNumber, entryType, value, units, notes) {
  try {
    var result = addBatchEntry(batchNumber, entryType, {
      description: entryType + ' reading',
      value: value,
      units: units,
      notes: notes || ''
    });
    
    // Return updated batch sheet
    return getBatchSheet(batchNumber);
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}


/**
 * ADD CELLAR ADDITION - Dry hops, fruit, finings etc.
 * Depletes RM immediately and adds cost to batch
 */
function addCellarAddition(batchNumber, ingredient, amount, uom, notes) {
  try {
    var ss = getBrmSpreadsheet();
    
    // Get cost from Raw Materials
    var rmResult = getRawMaterialsInventory({});
    var unitCost = 0;
    
    if (rmResult.success && rmResult.materials) {
      var material = rmResult.materials.find(function(m) {
        return m.item && m.item.toLowerCase() === ingredient.toLowerCase();
      });
      if (material) {
        unitCost = material.avgCost || 0;
      }
    }
    
    var totalCost = amount * unitCost;
    
    // Deplete from Raw Materials
    depleteRawMaterial(ingredient, amount, batchNumber, null, 'Cellar');
    
    // Log to Batch Details
    addBatchEntry(batchNumber, 'Addition', {
      description: ingredient,
      value: amount,
      units: uom || 'lb',
      cost: totalCost,
      notes: notes || ''
    });
    
    // Update batch addition cost
    updateBatchAdditionCost(batchNumber, totalCost);
    
    // Log to Batch Ingredients
    logBatchIngredients(batchNumber, [{
      category: 'Addition',
      ingredient: ingredient,
      amount: amount,
      uom: uom || 'lb',
      unitCost: unitCost,
      cost: totalCost
    }]);
    
    Logger.log('Cellar addition: ' + amount + ' ' + uom + ' ' + ingredient + ' → ' + batchNumber);
    
    // Return updated batch sheet
    return getBatchSheet(batchNumber);
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}


/**
 * UPDATE BATCH ADDITION COST - Add to running total
 */
function updateBatchAdditionCost(batchNumber, additionalCost) {
  try {
    var ss = getBrmSpreadsheet();
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    var data = batchSheet.getDataRange().getValues();
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === batchNumber) {
        var currentAdditionCost = parseFloat(data[i][26]) || 0;
        var newAdditionCost = currentAdditionCost + additionalCost;
        batchSheet.getRange(i + 1, 27).setValue(newAdditionCost);  // AA: Addition Cost
        
        // Also update total cost
        var currentTotal = parseFloat(data[i][8]) || 0;
        batchSheet.getRange(i + 1, 9).setValue(currentTotal + additionalCost);  // I: Total Cost
        break;
      }
    }
  } catch (e) {
    Logger.log('Error updating addition cost: ' + e.toString());
  }
}


/**
 * TRANSFER VESSEL - Move batch to new vessel
 */
function transferVessel(batchNumber, fromVessel, toVessel, notes) {
  try {
    var ss = getBrmSpreadsheet();
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    // Find batch and get beer name
    var data = batchSheet.getDataRange().getValues();
    var batchRow = -1;
    var beerName = '';
    
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === batchNumber) {
        batchRow = i + 1;
        beerName = data[i][2];
        break;
      }
    }
    
    if (batchRow === -1) {
      return { success: false, error: 'Batch not found' };
    }
    
    // Free old vessel
    if (fromVessel) {
      updateEquipmentStatus(fromVessel, 'Available', '', '');
    }
    
    // Occupy new vessel
    updateEquipmentStatus(toVessel, 'In Use', beerName, batchNumber);
    
    // Update batch log - current vessel and status
    var newStatus = 'Fermenting';
    if (toVessel.toLowerCase().indexOf('bt') !== -1 || toVessel.toLowerCase().indexOf('brite') !== -1) {
      newStatus = 'Conditioning';
    }
    
    batchSheet.getRange(batchRow, 11).setValue(newStatus);  // K: Status
    batchSheet.getRange(batchRow, 29).setValue(toVessel);   // AC: Current Vessel
    
    // Log transfer
    addBatchEntry(batchNumber, 'Transfer', {
      description: (fromVessel || 'Start') + ' → ' + toVessel,
      vessel: toVessel,
      notes: notes || ''
    });
    
    Logger.log('Transfer: ' + batchNumber + ' from ' + fromVessel + ' to ' + toVessel);
    
    return getBatchSheet(batchNumber);
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}


/**
 * UPDATE BATCH QA - Update gravity, ABV, etc on batch
 */
function updateBatchQA(batchNumber, field, value) {
  try {
    var ss = getBrmSpreadsheet();
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    var data = batchSheet.getDataRange().getValues();
    var batchRow = -1;
    
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === batchNumber) {
        batchRow = i + 1;
        break;
      }
    }
    
    if (batchRow === -1) {
      return { success: false, error: 'Batch not found' };
    }
    
    // Map field to column
    var colMap = {
      'ogActual': 17,      // Q
      'fgActual': 18,      // R
      'abvActual': 19,     // S
      'ibuActual': 20,     // T
      'srmActual': 21,     // U
      'mashTemp': 23,      // W
      'fermentTemp': 24,   // X
      'terminalGravity': 25, // Y
      'qaStatus': 28       // AB
    };
    
    var col = colMap[field];
    if (col) {
      batchSheet.getRange(batchRow, col).setValue(value);
    }
    
    return getBatchSheet(batchNumber);
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}


/**
 * RECORD PACKAGING - Enter package counts before Send It
 */
function recordBatchPackaging(batchNumber, packageBreakdown, finalGravity, abv, packager) {
  try {
    var ss = getBrmSpreadsheet();
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    // Calculate actual yield in BBL
    var actualYieldBBL = 0;
    for (var pkgType in packageBreakdown) {
      var qty = parseFloat(packageBreakdown[pkgType]) || 0;
      var bblPer = PACKAGE_BBL_CONVERSIONS[pkgType] || 0;
      actualYieldBBL += qty * bblPer;
    }
    
    // Find batch row
    var data = batchSheet.getDataRange().getValues();
    var batchRow = -1;
    
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === batchNumber) {
        batchRow = i + 1;
        break;
      }
    }
    
    if (batchRow === -1) {
      return { success: false, error: 'Batch not found' };
    }
    
    // Update Batch Log
    batchSheet.getRange(batchRow, 11).setValue('Ready to Package');  // K: Status
    batchSheet.getRange(batchRow, 13).setValue(actualYieldBBL);      // M: Act. Yield
    batchSheet.getRange(batchRow, 18).setValue(finalGravity || '');  // R: FG Actual
    batchSheet.getRange(batchRow, 19).setValue(abv || '');           // S: ABV Actual
    
    // Log each package type
    for (var pkgType in packageBreakdown) {
      var qty = packageBreakdown[pkgType];
      if (qty > 0) {
        addBatchEntry(batchNumber, 'Package', {
          description: qty + ' × ' + pkgType,
          value: qty,
          units: pkgType,
          notes: 'Packager: ' + (packager || 'Unknown')
        });
      }
    }
    
    Logger.log('Packaging recorded: ' + batchNumber + ', yield: ' + actualYieldBBL.toFixed(2) + ' BBL');
    
    // Return with package data for Send It
    var result = getBatchSheet(batchNumber);
    result.packageBreakdown = packageBreakdown;
    result.actualYieldBBL = actualYieldBBL;
    
    return result;
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}


/**
 * SEND IT! - Complete the batch, cascade to all systems
 */
function sendItComplete(batchNumber, packageBreakdown, currentVessel) {
  try {
    var ss = getBrmSpreadsheet();
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    // Find batch
    var data = batchSheet.getDataRange().getValues();
    var batchRow = -1;
    var batch = null;
    
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === batchNumber) {
        batchRow = i + 1;
        batch = {
          beerName: data[i][2],
          batchSize: parseFloat(data[i][3]) || 60,
          totalCost: parseFloat(data[i][8]) || 0,
          expectedYield: parseFloat(data[i][9]) || 0,
          actualYield: parseFloat(data[i][12]) || 0
        };
        break;
      }
    }
    
    if (batchRow === -1 || !batch) {
      return { success: false, error: 'Batch not found' };
    }
    
    // Calculate yield if needed
    var actualYield = batch.actualYield;
    if (actualYield === 0 && packageBreakdown) {
      for (var pkgType in packageBreakdown) {
        var qty = parseFloat(packageBreakdown[pkgType]) || 0;
        var bblPer = PACKAGE_BBL_CONVERSIONS[pkgType] || 0;
        actualYield += qty * bblPer;
      }
    }
    
    // Calculate efficiency and COGS
    var efficiency = batch.expectedYield > 0 ? (actualYield / batch.expectedYield * 100) : 0;
    var variance = actualYield - batch.expectedYield;
    var cogsPerBBL = actualYield > 0 ? batch.totalCost / actualYield : 0;
    
    // Update Batch Log
    batchSheet.getRange(batchRow, 11).setValue('Packaged');          // K: Status
    batchSheet.getRange(batchRow, 12).setValue(new Date());          // L: Pkg Date
    batchSheet.getRange(batchRow, 13).setValue(actualYield);         // M: Act. Yield
    batchSheet.getRange(batchRow, 14).setValue(cogsPerBBL);          // N: Cost/BBL
    batchSheet.getRange(batchRow, 15).setValue(variance);            // O: Variance
    
    // Add to Finished Goods
    var fgResult = addToFinishedGoods(batch.beerName, packageBreakdown, cogsPerBBL, batchNumber);
    
    // Update Beer COGS Master
    try {
      updateBeerCOGSMaster();
    } catch (e) {
      Logger.log('Warning: Could not update COGS Master: ' + e.toString());
    }
    
    // Free vessel
    if (currentVessel) {
      updateEquipmentStatus(currentVessel, 'Available', '', '');
    }
    
    // Log completion
    addBatchEntry(batchNumber, 'Note', {
      description: '🚀 SEND IT! Batch complete',
      value: actualYield,
      units: 'BBL',
      notes: 'Efficiency: ' + efficiency.toFixed(1) + '% | COGS/BBL: $' + cogsPerBBL.toFixed(2)
    });
    
    // Archive to Drive
    var archiveResult = { success: false, url: '' };
    try {
      archiveResult = archiveBatchRecord(batchNumber, batch.beerName, data[batchRow - 1], packageBreakdown);
    } catch (e) {
      Logger.log('Warning: Could not archive: ' + e.toString());
    }
    
    Logger.log('🚀 SEND IT! ' + batchNumber + ' complete. Yield: ' + actualYield.toFixed(2) + ' BBL');
    
    return serializeForHtml({
      success: true,
      batchNumber: batchNumber,
      beerName: batch.beerName,
      actualYield: actualYield,
      efficiency: efficiency,
      cogsPerBBL: cogsPerBBL,
      totalCost: batch.totalCost,
      archiveUrl: archiveResult.url || '',
      message: '🚀 SEND IT! Batch ' + batchNumber + ' complete!'
    });
    
  } catch (e) {
    Logger.log('Error in Send It: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}
// ═══════════════════════════════════════════════════════════════════════════════
// WRAPPER FUNCTIONS - Connect cellar modals to batch sheet backend
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Wrapper for gravity reading - called by showGravityModal
 */
function addGravityReading(batchNumber, gravity, temperature, notes) {
  return addCellarEntry(batchNumber, 'Gravity', gravity, 'SG', 
    (temperature ? 'Temp: ' + temperature + '°F. ' : '') + (notes || ''));
}

/**
 * Wrapper for secondary addition - called by showAdditionModal
 */
function addSecondaryAddition(batchNumber, item, amount, uom, notes) {
  return addCellarAddition(batchNumber, item, amount, uom, notes);
}

/**
 * Wrapper for transfer - called by showTransferModal
 */
function recordTransfer(batchNumber, fromVessel, toVessel, notes) {
  return transferVessel(batchNumber, fromVessel, toVessel, notes);
}

/**
 * Wrapper for packaging - called by showPackageModal
 */
function recordPackaging(batchNumber, packageBreakdown, finalGravity, abv, packager) {
  return recordBatchPackaging(batchNumber, packageBreakdown, finalGravity, abv, packager);
}

/**
 * Wrapper for Send It - called by showSendItModal
 */
function sendIt(batchNumber, packageBreakdown, currentVessel) {
  return sendItComplete(batchNumber, packageBreakdown, currentVessel);
}
// ============================================
// EDIT RECIPE & RECIPE CHANGE LOG FUNCTIONS
// Paste this at the bottom of your Code.gs file
// ============================================

/**
 * Get recipe data for editing - FIXED VERSION
 * @param {string} recipeName - Name of the recipe to edit
 * @returns {Object} Recipe data including ingredients
 */
function getRecipeForEdit(recipeName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const recipesSheet = ss.getSheetByName('Recipes');
  const ingredientsSheet = ss.getSheetByName('Recipe Ingredients');
  
  if (!recipesSheet) {
    return { success: false, error: 'Recipes sheet not found' };
  }
  
  // Find the recipe
  const recipeData = recipesSheet.getDataRange().getValues();
  const headers = recipeData[0];
  let recipeRow = null;
  let recipeRowIndex = -1;
  
  for (let i = 1; i < recipeData.length; i++) {
    if (recipeData[i][0] === recipeName) {
      recipeRow = recipeData[i];
      recipeRowIndex = i + 1;
      break;
    }
  }
  
  if (!recipeRow) {
    return { success: false, error: 'Recipe not found: ' + recipeName };
  }
  
  // Build recipe object from headers
  const recipe = {};
  headers.forEach((header, index) => {
    recipe[header] = recipeRow[index];
  });
  recipe._rowIndex = recipeRowIndex;
  
  // Get ingredients for this recipe
  const ingredients = { grains: [], hops: [], yeast: [], other: [] };
  
  if (ingredientsSheet) {
    const ingData = ingredientsSheet.getDataRange().getValues();
    const ingHeaders = ingData[0];
    
    // Find column indices - handle various possible header names
    let recipeCol = 0; // Usually column A
    let categoryCol = 1;
    let nameCol = 2;
    let amountCol = 3;
    let uomCol = 4;
    
    // Try to find columns by header name
    ingHeaders.forEach((h, idx) => {
      const header = (h || '').toString().toLowerCase().trim();
      if (header.includes('recipe')) recipeCol = idx;
      if (header.includes('category') || header.includes('type')) categoryCol = idx;
      if (header === 'ingredient' || header === 'ingredient name' || header === 'name' || header === 'item') nameCol = idx;
      if (header === 'amount' || header === 'qty' || header === 'quantity') amountCol = idx;
      if (header === 'uom' || header === 'unit' || header === 'units') uomCol = idx;
    });
    
    for (let i = 1; i < ingData.length; i++) {
      const row = ingData[i];
      const ingRecipe = (row[recipeCol] || '').toString().trim();
      
      if (ingRecipe === recipeName) {
        const ingredient = {
          'Ingredient Name': row[nameCol] || '',
          'Amount': row[amountCol] || 0,
          'UOM': row[uomCol] || 'lb',
          '_rowIndex': i + 1
        };
        
        // Categorize by type
        const category = (row[categoryCol] || '').toString().toLowerCase();
        if (category.includes('grain') || category.includes('malt') || category.includes('adjunct')) {
          ingredients.grains.push(ingredient);
        } else if (category.includes('hop')) {
          ingredients.hops.push(ingredient);
        } else if (category.includes('yeast')) {
          ingredients.yeast.push(ingredient);
        } else {
          ingredients.other.push(ingredient);
        }
      }
    }
  }
  
  return {
    success: true,
    recipe: recipe,
    ingredients: ingredients,
    headers: headers
  };
}


/**
 * Update a recipe and log the changes
 * @param {string} recipeName - Original recipe name
 * @param {Object} updates - Object with field:newValue pairs
 * @param {string} reason - Reason for the change
 * @returns {Object} Success/error result
 */
function updateRecipe(recipeName, updates, reason) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const recipesSheet = ss.getSheetByName('Recipes');
  const user = Session.getActiveUser().getEmail() || 'Unknown';
  const timestamp = new Date();
  
  if (!recipesSheet) {
    return { success: false, error: 'Recipes sheet not found' };
  }
  
  // Get current recipe data
  const recipeData = recipesSheet.getDataRange().getValues();
  const headers = recipeData[0];
  let recipeRowIndex = -1;
  let oldValues = {};
  
  for (let i = 1; i < recipeData.length; i++) {
    if (recipeData[i][0] === recipeName) {
      recipeRowIndex = i + 1;
      headers.forEach((header, colIndex) => {
        oldValues[header] = recipeData[i][colIndex];
      });
      break;
    }
  }
  
  if (recipeRowIndex === -1) {
    return { success: false, error: 'Recipe not found: ' + recipeName };
  }
  
  // Track changes and update
  const changes = [];
  
  for (const field in updates) {
    if (updates.hasOwnProperty(field)) {
      const colIndex = headers.indexOf(field);
      if (colIndex !== -1) {
        const oldVal = oldValues[field];
        const newVal = updates[field];
        
        // Only log if actually changed
        if (oldVal != newVal) {
          changes.push({
            field: field,
            oldValue: oldVal,
            newValue: newVal
          });
          
          // Update the cell
          recipesSheet.getRange(recipeRowIndex, colIndex + 1).setValue(newVal);
        }
      }
    }
  }
  
  // Log all changes
  if (changes.length > 0) {
    logRecipeChanges(recipeName, changes, reason, user, timestamp);
  }
  
  return {
    success: true,
    message: 'Recipe updated successfully',
    changesLogged: changes.length
  };
}


/**
 * Update recipe ingredients
 * @param {string} recipeName - Recipe name
 * @param {Array} ingredientUpdates - Array of {rowIndex, field, newValue} or {action:'add'/'delete', data}
 * @param {string} reason - Reason for changes
 * @returns {Object} Success/error result
 */
function updateRecipeIngredients(recipeName, ingredientUpdates, reason) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ingredientsSheet = ss.getSheetByName('Recipe Ingredients');
  const user = Session.getActiveUser().getEmail() || 'Unknown';
  const timestamp = new Date();
  
  if (!ingredientsSheet) {
    return { success: false, error: 'Recipe Ingredients sheet not found' };
  }
  
  const ingData = ingredientsSheet.getDataRange().getValues();
  const headers = ingData[0];
  const changes = [];
  
  for (const update of ingredientUpdates) {
    if (update.action === 'update' && update.rowIndex) {
      // Update existing ingredient
      const colIndex = headers.indexOf(update.field);
      if (colIndex !== -1) {
        const oldVal = ingData[update.rowIndex - 1][colIndex];
        const newVal = update.newValue;
        
        if (oldVal != newVal) {
          changes.push({
            field: update.ingredientName + ' - ' + update.field,
            oldValue: oldVal,
            newValue: newVal
          });
          ingredientsSheet.getRange(update.rowIndex, colIndex + 1).setValue(newVal);
        }
      }
    } else if (update.action === 'add') {
      // Add new ingredient row
      const newRow = headers.map(h => update.data[h] || '');
      newRow[0] = recipeName; // Ensure recipe name is set
      ingredientsSheet.appendRow(newRow);
      
      changes.push({
        field: 'Added Ingredient',
        oldValue: '',
        newValue: update.data['Ingredient Name'] + ' (' + update.data['Amount'] + ' ' + update.data['UOM'] + ')'
      });
    } else if (update.action === 'delete' && update.rowIndex) {
      // Delete ingredient row
      const deletedName = ingData[update.rowIndex - 1][headers.indexOf('Ingredient Name')] || 'Unknown';
      ingredientsSheet.deleteRow(update.rowIndex);
      
      changes.push({
        field: 'Deleted Ingredient',
        oldValue: deletedName,
        newValue: ''
      });
    }
  }
  
  // Log changes
  if (changes.length > 0) {
    logRecipeChanges(recipeName, changes, reason, user, timestamp);
  }
  
  return {
    success: true,
    message: 'Ingredients updated successfully',
    changesLogged: changes.length
  };
}


/**
 * Log recipe changes to Recipe Change Log sheet
 * @param {string} recipeName - Recipe that was changed
 * @param {Array} changes - Array of {field, oldValue, newValue}
 * @param {string} reason - Reason for the change
 * @param {string} user - User who made the change
 * @param {Date} timestamp - When the change was made
 */
function logRecipeChanges(recipeName, changes, reason, user, timestamp) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let logSheet = ss.getSheetByName('Recipe Change Log');
  
  // Create sheet if it doesn't exist
  if (!logSheet) {
    logSheet = ss.insertSheet('Recipe Change Log');
    logSheet.appendRow([
      'Date',
      'Time', 
      'User',
      'Recipe Name',
      'Field Changed',
      'Old Value',
      'New Value',
      'Reason'
    ]);
    
    // Format header row
    const headerRange = logSheet.getRange(1, 1, 1, 8);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#1D3557');
    headerRange.setFontColor('#FFFFFF');
    
    // Set column widths
    logSheet.setColumnWidth(1, 100); // Date
    logSheet.setColumnWidth(2, 80);  // Time
    logSheet.setColumnWidth(3, 180); // User
    logSheet.setColumnWidth(4, 150); // Recipe Name
    logSheet.setColumnWidth(5, 150); // Field Changed
    logSheet.setColumnWidth(6, 150); // Old Value
    logSheet.setColumnWidth(7, 150); // New Value
    logSheet.setColumnWidth(8, 250); // Reason
    
    // Freeze header
    logSheet.setFrozenRows(1);
  }
  
  // Add a row for each change
  const dateStr = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'MM/dd/yyyy');
  const timeStr = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'HH:mm:ss');
  
  for (const change of changes) {
    logSheet.appendRow([
      dateStr,
      timeStr,
      user,
      recipeName,
      change.field,
      change.oldValue !== undefined ? change.oldValue.toString() : '',
      change.newValue !== undefined ? change.newValue.toString() : '',
      reason || ''
    ]);
  }
}


/**
 * Get recipe change history
 * @param {string} recipeName - Recipe name (optional, if blank returns all)
 * @returns {Object} Change history records
 */
function getRecipeChangeHistory(recipeName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName('Recipe Change Log');
  
  if (!logSheet) {
    return { success: true, history: [], message: 'No change history yet' };
  }
  
  const data = logSheet.getDataRange().getValues();
  const headers = data[0];
  const history = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index];
    });
    
    // Filter by recipe if specified
    if (!recipeName || record['Recipe Name'] === recipeName) {
      history.push(record);
    }
  }
  
  // Sort by date descending (newest first)
  history.sort((a, b) => {
    const dateA = new Date(a['Date'] + ' ' + a['Time']);
    const dateB = new Date(b['Date'] + ' ' + b['Time']);
    return dateB - dateA;
  });
  
  return {
    success: true,
    history: history
  };
}
// ═══════════════════════════════════════════════════════════════════════════════
// RED LEG BREWING - YEAST PROPAGATION MANAGEMENT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
// 
// This system tracks yeast costs across generations (P0 through P8/P9) with full
// traceability to batches and accurate COGS calculation.
//
// SHEETS CREATED:
//   - Yeast Strain Config: Master list of strains with default settings
//   - Yeast Propagation Log: Every pitch with full cost breakdown
//
// INTEGRATION:
//   - Pulls DME/Nutrient costs from Raw Materials
//   - Feeds yeast costs into Recipe Ingredients → Beer COGS Master
//   - Full batch traceability for contamination tracking
//
// TO INSTALL: Paste this entire file into your BRM Code.gs
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

var YEAST_STRAIN_CONFIG_SHEET = 'Yeast Strain Config';
var YEAST_PROPAGATION_LOG_SHEET = 'Yeast Propagation Log';

// Labor rates - pull from your Labor Config or set here
var YEAST_LABOR_RATE_PER_HOUR = 25.00; // Adjust to your actual rate

// Default costs if not found in Raw Materials
var DEFAULT_DME_COST_PER_LB = 2.50;
var DEFAULT_NUTRIENT_COST = 4.00;

// ═══════════════════════════════════════════════════════════════════════════════
// SHEET INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Initialize the complete Yeast Propagation System
 * Run this once to create both sheets with proper structure
 */
function initializeYeastPropagationSystem() {
  var ss = getBrmSpreadsheet();
  
  Logger.log('═══ INITIALIZING YEAST PROPAGATION SYSTEM ═══');
  
  // Create Yeast Strain Config
  initializeYeastStrainConfig(ss);
  
  // Create Yeast Propagation Log
  initializeYeastPropagationLog(ss);
  
  Logger.log('═══ YEAST PROPAGATION SYSTEM READY ═══');
  
  return { success: true, message: 'Yeast Propagation System initialized successfully' };
}

/**
 * Create and populate Yeast Strain Config sheet
 */
function initializeYeastStrainConfig(ss) {
  var sheet = ss.getSheetByName(YEAST_STRAIN_CONFIG_SHEET);
  
  if (!sheet) {
    sheet = ss.insertSheet(YEAST_STRAIN_CONFIG_SHEET);
    Logger.log('Created ' + YEAST_STRAIN_CONFIG_SHEET + ' sheet');
  } else {
    sheet.clear();
    Logger.log('Cleared existing ' + YEAST_STRAIN_CONFIG_SHEET + ' sheet');
  }
  
  // Headers
  var headers = [
    'Strain Name',           // A
    'Base Yeast Source',     // B - Original yeast (e.g., "London Ale III", "34/70")
    'Initial Purchase Cost', // C - Cost of original culture
    'Max Generations',       // D - How many times can be repitched
    'Single Use Only',       // E - TRUE for Hazy
    'Default DME (lbs)',     // F - DME needed for P0 step-up
    'Default P0 Labor (hrs)',// G - Labor for initial propagation
    'Harvest Labor (min)',   // H - Time to harvest (typically 10 min)
    'Target Cell Count',     // I - Billion cells target
    'Target Volume (gal)',   // J - Gallons per pitch
    'Notes',                 // K
    'Active'                 // L
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1a365d')
    .setFontColor('white');
  sheet.setFrozenRows(1);
  
  // Red Leg's 6 strains with defaults
  var strains = [
    ['Red Leg Lager', '34/70 or similar', 8.00, 8, false, 4.0, 1.0, 10, 400, 2.5, 'Used for Lloronas, Springs Lite, Marzen', true],
    ['Red Leg Hazy', 'London Ale III', 8.00, 1, true, 3.0, 1.0, 10, 300, 2.0, 'SINGLE USE ONLY - No repitching', true],
    ['Red Leg Chico', 'US-05 / Chico', 8.00, 8, false, 3.0, 1.0, 10, 300, 2.0, 'Used for West Coast IPA, Howitzer, etc.', true],
    ['Red Leg Hefeweizen', 'Weihenstephan', 8.00, 6, false, 3.5, 1.0, 10, 350, 2.0, 'Used for Helo Hefe', true],
    ['Red Leg Mexican Lager', 'Mexican Lager strain', 8.00, 8, false, 4.0, 1.0, 10, 400, 2.5, 'Clean lager for Mexican Lager', true],
    ['Red Leg ESB', 'English Ale', 8.00, 7, false, 3.0, 1.0, 10, 300, 2.0, 'Used for Golden Lion ESB', true]
  ];
  
  sheet.getRange(2, 1, strains.length, strains[0].length).setValues(strains);
  
  // Format columns
  sheet.setColumnWidth(1, 160);  // Strain Name
  sheet.setColumnWidth(2, 140);  // Base Yeast Source
  sheet.setColumnWidth(3, 120);  // Initial Purchase Cost
  sheet.setColumnWidth(4, 100);  // Max Generations
  sheet.setColumnWidth(5, 100);  // Single Use Only
  sheet.setColumnWidth(6, 110);  // Default DME
  sheet.setColumnWidth(7, 130);  // Default P0 Labor
  sheet.setColumnWidth(8, 120);  // Harvest Labor
  sheet.setColumnWidth(9, 110);  // Target Cell Count
  sheet.setColumnWidth(10, 120); // Target Volume
  sheet.setColumnWidth(11, 250); // Notes
  sheet.setColumnWidth(12, 60);  // Active
  
  // Number formatting
  sheet.getRange(2, 3, strains.length, 1).setNumberFormat('$#,##0.00'); // Initial Cost
  sheet.getRange(2, 6, strains.length, 1).setNumberFormat('0.0');       // DME lbs
  sheet.getRange(2, 7, strains.length, 1).setNumberFormat('0.0');       // Labor hrs
  
  // Data validation for Single Use Only and Active
  var boolRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['TRUE', 'FALSE'], true)
    .build();
  sheet.getRange(2, 5, 100, 1).setDataValidation(boolRule); // Single Use
  sheet.getRange(2, 12, 100, 1).setDataValidation(boolRule); // Active
  
  Logger.log('✓ Yeast Strain Config populated with 6 Red Leg strains');
}

/**
 * Create Yeast Propagation Log sheet
 */
function initializeYeastPropagationLog(ss) {
  var sheet = ss.getSheetByName(YEAST_PROPAGATION_LOG_SHEET);
  
  if (!sheet) {
    sheet = ss.insertSheet(YEAST_PROPAGATION_LOG_SHEET);
    Logger.log('Created ' + YEAST_PROPAGATION_LOG_SHEET + ' sheet');
  } else {
    sheet.clear();
    Logger.log('Cleared existing ' + YEAST_PROPAGATION_LOG_SHEET + ' sheet');
  }
  
  // Headers
  var headers = [
    'Pitch ID',              // A - Auto-generated (Y001, Y002, etc.)
    'Strain',                // B - Dropdown from Yeast Strain Config
    'Generation',            // C - P0, P1, P2, etc.
    'Date Created',          // D
    'Parent Pitch ID',       // E - Which pitch this was harvested from (blank for P0)
    'Source Batch #',        // F - Batch number harvested from (blank for P0)
    'DME Used (lbs)',        // G
    'DME Cost',              // H - Pulled from Raw Materials or calculated
    'Nutrients Used',        // I - Description
    'Nutrient Cost',         // J
    'Other Materials',       // K - Any other inputs
    'Other Cost',            // L
    'Labor Hours',           // M
    'Labor Cost',            // N - Calculated from hours × rate
    'Total Prop Cost',       // O - Sum of all costs
    'Volume (gal)',          // P - Total gallons in this pitch
    'Cell Count (B)',        // Q - Billion cells
    'Cost Per Gallon',       // R - Total Cost / Volume
    'Pitches Available',     // S - How many batches can use this (usually 1)
    'Cost Per Pitch',        // T - Total Cost / Pitches Available
    'Status',                // U - Active, Depleted, Contaminated, Expired
    'Used In Batch #',       // V - Which batch(es) used this pitch
    'Date Used',             // W
    'Harvested To',          // X - Pitch ID of harvest from this batch
    'Notes',                 // Y
    'Created By',            // Z
    'Last Updated'           // AA
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1a365d')
    .setFontColor('white');
  sheet.setFrozenRows(1);
  
  // Column widths
  var widths = [80, 140, 80, 100, 100, 100, 100, 90, 120, 90, 120, 90, 90, 90, 100, 90, 100, 100, 100, 100, 90, 110, 90, 100, 200, 100, 120];
  for (var i = 0; i < widths.length; i++) {
    sheet.setColumnWidth(i + 1, widths[i]);
  }
  
  // Data validation for Strain dropdown (pull from Yeast Strain Config)
  var strainRange = ss.getSheetByName(YEAST_STRAIN_CONFIG_SHEET).getRange('A2:A100');
  var strainRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(strainRange, true)
    .build();
  sheet.getRange(2, 2, 500, 1).setDataValidation(strainRule);
  
  // Data validation for Generation
  var genRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9'], true)
    .build();
  sheet.getRange(2, 3, 500, 1).setDataValidation(genRule);
  
  // Data validation for Status
  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Active', 'Depleted', 'Contaminated', 'Expired', 'Reserved'], true)
    .build();
  sheet.getRange(2, 21, 500, 1).setDataValidation(statusRule);
  
  // Number formatting
  sheet.getRange(2, 8, 500, 1).setNumberFormat('$#,##0.00');  // DME Cost
  sheet.getRange(2, 10, 500, 1).setNumberFormat('$#,##0.00'); // Nutrient Cost
  sheet.getRange(2, 12, 500, 1).setNumberFormat('$#,##0.00'); // Other Cost
  sheet.getRange(2, 14, 500, 1).setNumberFormat('$#,##0.00'); // Labor Cost
  sheet.getRange(2, 15, 500, 1).setNumberFormat('$#,##0.00'); // Total Prop Cost
  sheet.getRange(2, 18, 500, 1).setNumberFormat('$#,##0.00'); // Cost Per Gallon
  sheet.getRange(2, 20, 500, 1).setNumberFormat('$#,##0.00'); // Cost Per Pitch
  
  // Date formatting
  sheet.getRange(2, 4, 500, 1).setNumberFormat('mm/dd/yyyy'); // Date Created
  sheet.getRange(2, 23, 500, 1).setNumberFormat('mm/dd/yyyy'); // Date Used
  sheet.getRange(2, 27, 500, 1).setNumberFormat('mm/dd/yyyy hh:mm'); // Last Updated
  
  Logger.log('✓ Yeast Propagation Log created with full tracking structure');
}


// ═══════════════════════════════════════════════════════════════════════════════
// CORE YEAST FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get next available Pitch ID
 */
function getNextPitchId() {
  var ss = getBrmSpreadsheet();
  var sheet = ss.getSheetByName(YEAST_PROPAGATION_LOG_SHEET);
  
  if (!sheet) return 'Y001';
  
  var data = sheet.getDataRange().getValues();
  var maxNum = 0;
  
  for (var i = 1; i < data.length; i++) {
    var id = data[i][0];
    if (id && typeof id === 'string' && id.startsWith('Y')) {
      var num = parseInt(id.substring(1));
      if (num > maxNum) maxNum = num;
    }
  }
  
  var nextNum = maxNum + 1;
  return 'Y' + ('000' + nextNum).slice(-3);
}

/**
 * Get DME cost from Raw Materials sheet
 */
function getDMECostPerLb() {
  var ss = getBrmSpreadsheet();
  var rmSheet = ss.getSheetByName('Raw Materials');
  
  if (!rmSheet) {
    Logger.log('Raw Materials sheet not found, using default DME cost');
    return DEFAULT_DME_COST_PER_LB;
  }
  
  var data = rmSheet.getDataRange().getValues();
  var headers = data[0];
  var nameCol = -1, costCol = -1, unitCol = -1;
  
  // Find columns
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).toLowerCase();
    if (h.includes('name') || h.includes('item') || h.includes('ingredient')) nameCol = i;
    if (h.includes('cost') && !h.includes('total')) costCol = i;
    if (h.includes('unit') || h.includes('uom')) unitCol = i;
  }
  
  if (nameCol === -1 || costCol === -1) {
    return DEFAULT_DME_COST_PER_LB;
  }
  
  // Search for DME
  var dmeTerms = ['dme', 'dry malt extract', 'dried malt extract', 'malt extract'];
  
  for (var i = 1; i < data.length; i++) {
    var name = String(data[i][nameCol]).toLowerCase();
    for (var j = 0; j < dmeTerms.length; j++) {
      if (name.includes(dmeTerms[j])) {
        var cost = parseFloat(data[i][costCol]) || 0;
        if (cost > 0) {
          Logger.log('Found DME in Raw Materials: $' + cost + '/lb');
          return cost;
        }
      }
    }
  }
  
  Logger.log('DME not found in Raw Materials, using default: $' + DEFAULT_DME_COST_PER_LB);
  return DEFAULT_DME_COST_PER_LB;
}

/**
 * Get nutrient cost from Raw Materials sheet
 */
function getNutrientCost(nutrientName) {
  var ss = getBrmSpreadsheet();
  var rmSheet = ss.getSheetByName('Raw Materials');
  
  if (!rmSheet || !nutrientName) {
    return DEFAULT_NUTRIENT_COST;
  }
  
  var data = rmSheet.getDataRange().getValues();
  var headers = data[0];
  var nameCol = -1, costCol = -1;
  
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).toLowerCase();
    if (h.includes('name') || h.includes('item') || h.includes('ingredient')) nameCol = i;
    if (h.includes('cost') && !h.includes('total')) costCol = i;
  }
  
  if (nameCol === -1 || costCol === -1) {
    return DEFAULT_NUTRIENT_COST;
  }
  
  var searchTerm = nutrientName.toLowerCase();
  
  for (var i = 1; i < data.length; i++) {
    var name = String(data[i][nameCol]).toLowerCase();
    if (name.includes(searchTerm) || searchTerm.includes(name)) {
      var cost = parseFloat(data[i][costCol]) || 0;
      if (cost > 0) return cost;
    }
  }
  
  return DEFAULT_NUTRIENT_COST;
}

/**
 * Get strain configuration
 */
function getStrainConfig(strainName) {
  var ss = getBrmSpreadsheet();
  var sheet = ss.getSheetByName(YEAST_STRAIN_CONFIG_SHEET);
  
  if (!sheet) return null;
  
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === strainName) {
      return {
        name: data[i][0],
        baseYeast: data[i][1],
        initialCost: parseFloat(data[i][2]) || 0,
        maxGenerations: parseInt(data[i][3]) || 8,
        singleUseOnly: data[i][4] === true || data[i][4] === 'TRUE',
        defaultDME: parseFloat(data[i][5]) || 3.0,
        defaultP0Labor: parseFloat(data[i][6]) || 1.0,
        harvestLabor: parseFloat(data[i][7]) || 10, // minutes
        targetCellCount: parseFloat(data[i][8]) || 300,
        targetVolume: parseFloat(data[i][9]) || 2.0,
        notes: data[i][10],
        active: data[i][11] === true || data[i][11] === 'TRUE'
      };
    }
  }
  
  return null;
}

/**
 * Get all active strains for dropdown
 */
function getActiveYeastStrains() {
  var ss = getBrmSpreadsheet();
  var sheet = ss.getSheetByName(YEAST_STRAIN_CONFIG_SHEET);
  
  if (!sheet) return [];
  
  var data = sheet.getDataRange().getValues();
  var strains = [];
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][11] === true || data[i][11] === 'TRUE') {
      strains.push({
        name: data[i][0],
        singleUseOnly: data[i][4] === true || data[i][4] === 'TRUE',
        maxGenerations: parseInt(data[i][3]) || 8
      });
    }
  }
  
  return strains;
}

/**
 * Get available pitches for a strain (Active status only)
 */
function getAvailablePitches(strainName) {
  var ss = getBrmSpreadsheet();
  var sheet = ss.getSheetByName(YEAST_PROPAGATION_LOG_SHEET);
  
  if (!sheet) return [];
  
  var data = sheet.getDataRange().getValues();
  var pitches = [];
  
  for (var i = 1; i < data.length; i++) {
    var strain = data[i][1];
    var status = data[i][20];
    
    if (strain === strainName && status === 'Active') {
      pitches.push({
        pitchId: data[i][0],
        strain: strain,
        generation: data[i][2],
        dateCreated: data[i][3],
        parentPitchId: data[i][4],
        sourceBatch: data[i][5],
        totalCost: parseFloat(data[i][14]) || 0,
        volume: parseFloat(data[i][15]) || 0,
        cellCount: parseFloat(data[i][16]) || 0,
        costPerPitch: parseFloat(data[i][19]) || 0,
        pitchesAvailable: parseInt(data[i][18]) || 1,
        row: i + 1
      });
    }
  }
  
  return pitches;
}

/**
 * Get all available pitches across all strains
 */
function getAllAvailablePitches() {
  var ss = getBrmSpreadsheet();
  var sheet = ss.getSheetByName(YEAST_PROPAGATION_LOG_SHEET);
  
  if (!sheet) return [];
  
  var data = sheet.getDataRange().getValues();
  var pitches = [];
  
  for (var i = 1; i < data.length; i++) {
    var status = data[i][20];
    
    if (status === 'Active') {
      pitches.push({
        pitchId: data[i][0],
        strain: data[i][1],
        generation: data[i][2],
        dateCreated: data[i][3],
        parentPitchId: data[i][4],
        sourceBatch: data[i][5],
        totalCost: parseFloat(data[i][14]) || 0,
        volume: parseFloat(data[i][15]) || 0,
        cellCount: parseFloat(data[i][16]) || 0,
        costPerPitch: parseFloat(data[i][19]) || 0,
        pitchesAvailable: parseInt(data[i][18]) || 1,
        row: i + 1
      });
    }
  }
  
  return pitches;
}


// ═══════════════════════════════════════════════════════════════════════════════
// PROPAGATION ENTRY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new P0 propagation (starting from purchased yeast)
 */
function createP0Propagation(data) {
  var ss = getBrmSpreadsheet();
  var sheet = ss.getSheetByName(YEAST_PROPAGATION_LOG_SHEET);
  
  if (!sheet) {
    return { success: false, error: 'Yeast Propagation Log sheet not found. Run initializeYeastPropagationSystem() first.' };
  }
  
  var strainConfig = getStrainConfig(data.strain);
  if (!strainConfig) {
    return { success: false, error: 'Strain not found: ' + data.strain };
  }
  
  // Calculate costs
  var dmeCostPerLb = getDMECostPerLb();
  var dmeLbs = parseFloat(data.dmeLbs) || strainConfig.defaultDME;
  var dmeCost = dmeLbs * dmeCostPerLb;
  
  var nutrientCost = parseFloat(data.nutrientCost) || getNutrientCost(data.nutrients || 'Yeastex');
  var otherCost = parseFloat(data.otherCost) || strainConfig.initialCost; // Include purchase cost of original yeast
  
  var laborHours = parseFloat(data.laborHours) || strainConfig.defaultP0Labor;
  var laborCost = laborHours * YEAST_LABOR_RATE_PER_HOUR;
  
  var totalCost = dmeCost + nutrientCost + otherCost + laborCost;
  
  var volume = parseFloat(data.volume) || strainConfig.targetVolume;
  var cellCount = parseFloat(data.cellCount) || strainConfig.targetCellCount;
  
  var costPerGallon = volume > 0 ? totalCost / volume : totalCost;
  var pitchesAvailable = parseInt(data.pitchesAvailable) || 1;
  var costPerPitch = pitchesAvailable > 0 ? totalCost / pitchesAvailable : totalCost;
  
  var pitchId = getNextPitchId();
  var now = new Date();
  
  var row = [
    pitchId,                           // A - Pitch ID
    data.strain,                       // B - Strain
    'P0',                              // C - Generation
    data.dateCreated || now,           // D - Date Created
    '',                                // E - Parent Pitch ID (none for P0)
    '',                                // F - Source Batch (none for P0)
    dmeLbs,                            // G - DME Used
    dmeCost,                           // H - DME Cost
    data.nutrients || 'Yeastex',       // I - Nutrients Used
    nutrientCost,                      // J - Nutrient Cost
    data.otherMaterials || 'Initial yeast purchase', // K - Other Materials
    otherCost,                         // L - Other Cost
    laborHours,                        // M - Labor Hours
    laborCost,                         // N - Labor Cost
    totalCost,                         // O - Total Prop Cost
    volume,                            // P - Volume (gal)
    cellCount,                         // Q - Cell Count
    costPerGallon,                     // R - Cost Per Gallon
    pitchesAvailable,                  // S - Pitches Available
    costPerPitch,                      // T - Cost Per Pitch
    'Active',                          // U - Status
    '',                                // V - Used In Batch
    '',                                // W - Date Used
    '',                                // X - Harvested To
    data.notes || '',                  // Y - Notes
    data.createdBy || '',              // Z - Created By
    now                                // AA - Last Updated
  ];
  
  sheet.appendRow(row);
  
  Logger.log('Created P0 propagation: ' + pitchId + ' for ' + data.strain + ' at $' + totalCost.toFixed(2));
  
  return {
    success: true,
    pitchId: pitchId,
    strain: data.strain,
    generation: 'P0',
    totalCost: totalCost,
    costPerPitch: costPerPitch
  };
}

/**
 * Create a harvest (P1+ propagation from existing batch)
 */
function createHarvestPropagation(data) {
  var ss = getBrmSpreadsheet();
  var sheet = ss.getSheetByName(YEAST_PROPAGATION_LOG_SHEET);
  
  if (!sheet) {
    return { success: false, error: 'Yeast Propagation Log sheet not found.' };
  }
  
  // Get parent pitch info
  var parentData = sheet.getDataRange().getValues();
  var parentRow = -1;
  var parentPitch = null;
  
  for (var i = 1; i < parentData.length; i++) {
    if (parentData[i][0] === data.parentPitchId) {
      parentRow = i + 1;
      parentPitch = {
        pitchId: parentData[i][0],
        strain: parentData[i][1],
        generation: parentData[i][2]
      };
      break;
    }
  }
  
  if (!parentPitch) {
    return { success: false, error: 'Parent pitch not found: ' + data.parentPitchId };
  }
  
  var strainConfig = getStrainConfig(parentPitch.strain);
  if (!strainConfig) {
    return { success: false, error: 'Strain config not found: ' + parentPitch.strain };
  }
  
  // Check if strain allows repitching
  if (strainConfig.singleUseOnly) {
    return { success: false, error: parentPitch.strain + ' is single-use only and cannot be harvested.' };
  }
  
  // Calculate next generation
  var parentGen = parseInt(parentPitch.generation.replace('P', '')) || 0;
  var newGen = parentGen + 1;
  
  // Check max generations
  if (newGen > strainConfig.maxGenerations) {
    return { success: false, error: 'Maximum generations (' + strainConfig.maxGenerations + ') exceeded for ' + parentPitch.strain };
  }
  
  // Calculate costs - harvesting is minimal
  var dmeCostPerLb = getDMECostPerLb();
  var dmeLbs = parseFloat(data.dmeLbs) || 0; // Usually 0 or small for step-up
  var dmeCost = dmeLbs * dmeCostPerLb;
  
  var nutrientCost = parseFloat(data.nutrientCost) || 0;
  var otherCost = parseFloat(data.otherCost) || 0;
  
  // Harvest labor is typically 10 minutes
  var laborMinutes = parseFloat(data.laborMinutes) || strainConfig.harvestLabor;
  var laborHours = laborMinutes / 60;
  var laborCost = laborHours * YEAST_LABOR_RATE_PER_HOUR;
  
  var totalCost = dmeCost + nutrientCost + otherCost + laborCost;
  
  var volume = parseFloat(data.volume) || strainConfig.targetVolume;
  var cellCount = parseFloat(data.cellCount) || strainConfig.targetCellCount;
  
  var costPerGallon = volume > 0 ? totalCost / volume : totalCost;
  var pitchesAvailable = parseInt(data.pitchesAvailable) || 1;
  var costPerPitch = pitchesAvailable > 0 ? totalCost / pitchesAvailable : totalCost;
  
  var pitchId = getNextPitchId();
  var now = new Date();
  
  var row = [
    pitchId,                           // A - Pitch ID
    parentPitch.strain,                // B - Strain
    'P' + newGen,                      // C - Generation
    data.dateCreated || now,           // D - Date Created
    data.parentPitchId,                // E - Parent Pitch ID
    data.sourceBatch || '',            // F - Source Batch
    dmeLbs,                            // G - DME Used
    dmeCost,                           // H - DME Cost
    data.nutrients || '',              // I - Nutrients Used
    nutrientCost,                      // J - Nutrient Cost
    data.otherMaterials || '',         // K - Other Materials
    otherCost,                         // L - Other Cost
    laborHours,                        // M - Labor Hours
    laborCost,                         // N - Labor Cost
    totalCost,                         // O - Total Prop Cost
    volume,                            // P - Volume (gal)
    cellCount,                         // Q - Cell Count
    costPerGallon,                     // R - Cost Per Gallon
    pitchesAvailable,                  // S - Pitches Available
    costPerPitch,                      // T - Cost Per Pitch
    'Active',                          // U - Status
    '',                                // V - Used In Batch
    '',                                // W - Date Used
    '',                                // X - Harvested To
    data.notes || 'Harvested from batch ' + data.sourceBatch, // Y - Notes
    data.createdBy || '',              // Z - Created By
    now                                // AA - Last Updated
  ];
  
  sheet.appendRow(row);
  
  // Update parent pitch with harvest reference
  if (parentRow > 0) {
    var currentHarvestTo = sheet.getRange(parentRow, 24).getValue();
    var newHarvestTo = currentHarvestTo ? currentHarvestTo + ', ' + pitchId : pitchId;
    sheet.getRange(parentRow, 24).setValue(newHarvestTo);
    sheet.getRange(parentRow, 27).setValue(now);
  }
  
  Logger.log('Created P' + newGen + ' harvest: ' + pitchId + ' from ' + data.parentPitchId + ' at $' + totalCost.toFixed(2));
  
  return {
    success: true,
    pitchId: pitchId,
    strain: parentPitch.strain,
    generation: 'P' + newGen,
    parentPitchId: data.parentPitchId,
    totalCost: totalCost,
    costPerPitch: costPerPitch
  };
}

/**
 * Use a pitch for a batch (marks as depleted, records batch)
 */
function usePitchForBatch(pitchId, batchNumber) {
  var ss = getBrmSpreadsheet();
  var sheet = ss.getSheetByName(YEAST_PROPAGATION_LOG_SHEET);
  
  if (!sheet) {
    return { success: false, error: 'Yeast Propagation Log sheet not found.' };
  }
  
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === pitchId) {
      var row = i + 1;
      var status = data[i][20];
      var pitchesAvailable = parseInt(data[i][18]) || 1;
      var costPerPitch = parseFloat(data[i][19]) || 0;
      var strain = data[i][1];
      var generation = data[i][2];
      
      if (status !== 'Active') {
        return { success: false, error: 'Pitch ' + pitchId + ' is not active (status: ' + status + ')' };
      }
      
      var now = new Date();
      
      // Update the row
      var currentUsedIn = data[i][21];
      var newUsedIn = currentUsedIn ? currentUsedIn + ', ' + batchNumber : batchNumber;
      
      // Decrement pitches available
      var newPitchesAvailable = pitchesAvailable - 1;
      var newStatus = newPitchesAvailable <= 0 ? 'Depleted' : 'Active';
      
      sheet.getRange(row, 19).setValue(newPitchesAvailable); // Pitches Available
      sheet.getRange(row, 21).setValue(newStatus);           // Status
      sheet.getRange(row, 22).setValue(newUsedIn);           // Used In Batch
      sheet.getRange(row, 23).setValue(now);                 // Date Used
      sheet.getRange(row, 27).setValue(now);                 // Last Updated
      
      Logger.log('Used pitch ' + pitchId + ' for batch ' + batchNumber + ' (cost: $' + costPerPitch.toFixed(2) + ')');
      
      return {
        success: true,
        pitchId: pitchId,
        strain: strain,
        generation: generation,
        batchNumber: batchNumber,
        yeastCost: costPerPitch,
        remainingPitches: newPitchesAvailable,
        newStatus: newStatus
      };
    }
  }
  
  return { success: false, error: 'Pitch not found: ' + pitchId };
}


// ═══════════════════════════════════════════════════════════════════════════════
// COST CALCULATION & REPORTING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get weighted average yeast cost per strain
 * This is what gets used in Recipe Ingredients when you don't want to track specific pitches
 */
function getWeightedAverageYeastCost(strainName) {
  var ss = getBrmSpreadsheet();
  var sheet = ss.getSheetByName(YEAST_PROPAGATION_LOG_SHEET);
  
  if (!sheet) return 0;
  
  var data = sheet.getDataRange().getValues();
  var totalCost = 0;
  var totalPitches = 0;
  
  for (var i = 1; i < data.length; i++) {
    var strain = data[i][1];
    var status = data[i][20];
    
    // Include all pitches (active and depleted) for historical average
    if (strain === strainName) {
      var costPerPitch = parseFloat(data[i][19]) || 0;
      var pitchesUsed = (data[i][20] === 'Depleted') ? 1 : 0;
      var pitchesAvailable = parseInt(data[i][18]) || 0;
      
      // Weight by actual usage
      if (status === 'Depleted') {
        totalCost += costPerPitch;
        totalPitches += 1;
      }
    }
  }
  
  if (totalPitches === 0) {
    // No history, use config defaults
    var config = getStrainConfig(strainName);
    if (config) {
      // Estimate P0 cost
      var dmeCost = config.defaultDME * getDMECostPerLb();
      var laborCost = config.defaultP0Labor * YEAST_LABOR_RATE_PER_HOUR;
      return dmeCost + config.initialCost + DEFAULT_NUTRIENT_COST + laborCost;
    }
    return 50; // Default fallback
  }
  
  return totalCost / totalPitches;
}

/**
 * Get all weighted average costs for updating Raw Materials
 */
function getAllYeastAverageCosts() {
  var strains = getActiveYeastStrains();
  var costs = [];
  
  for (var i = 0; i < strains.length; i++) {
    var avgCost = getWeightedAverageYeastCost(strains[i].name);
    costs.push({
      strain: strains[i].name,
      averageCost: avgCost
    });
  }
  
  return costs;
}

/**
 * Update Raw Materials with current weighted average yeast costs
 * Run this periodically to keep Recipe COGS accurate
 */
function updateRawMaterialsWithYeastCosts() {
  var ss = getBrmSpreadsheet();
  var rmSheet = ss.getSheetByName('Raw Materials');
  
  if (!rmSheet) {
    Logger.log('Raw Materials sheet not found');
    return { success: false, error: 'Raw Materials sheet not found' };
  }
  
  var costs = getAllYeastAverageCosts();
  var data = rmSheet.getDataRange().getValues();
  var headers = data[0];
  
  // Find columns
  var nameCol = -1, costCol = -1;
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).toLowerCase();
    if (h.includes('name') || h.includes('item') || h.includes('ingredient')) nameCol = i;
    if ((h.includes('cost') || h.includes('price')) && !h.includes('total')) costCol = i;
  }
  
  if (nameCol === -1 || costCol === -1) {
    return { success: false, error: 'Could not find Name and Cost columns in Raw Materials' };
  }
  
  var updated = 0;
  var added = 0;
  
  for (var c = 0; c < costs.length; c++) {
    var strain = costs[c].strain;
    var avgCost = costs[c].averageCost;
    var found = false;
    
    // Look for existing entry
    for (var i = 1; i < data.length; i++) {
      var name = String(data[i][nameCol]).toLowerCase();
      if (name.includes(strain.toLowerCase()) || strain.toLowerCase().includes(name)) {
        // Update existing
        rmSheet.getRange(i + 1, costCol + 1).setValue(avgCost);
        updated++;
        found = true;
        Logger.log('Updated ' + strain + ' to $' + avgCost.toFixed(2));
        break;
      }
    }
    
    // Add if not found
    if (!found) {
      var newRow = [strain + ' (Avg)', 'Yeast', 'pitch', 1, avgCost];
      // Pad to match existing columns
      while (newRow.length < headers.length) {
        newRow.push('');
      }
      rmSheet.appendRow(newRow);
      added++;
      Logger.log('Added ' + strain + ' at $' + avgCost.toFixed(2));
    }
  }
  
  return {
    success: true,
    updated: updated,
    added: added,
    costs: costs
  };
}

/**
 * Get yeast cost breakdown by generation
 */
function getYeastCostByGeneration(strainName) {
  var ss = getBrmSpreadsheet();
  var sheet = ss.getSheetByName(YEAST_PROPAGATION_LOG_SHEET);
  
  if (!sheet) return [];
  
  var data = sheet.getDataRange().getValues();
  var generations = {};
  
  for (var i = 1; i < data.length; i++) {
    var strain = data[i][1];
    if (strain !== strainName) continue;
    
    var gen = data[i][2];
    var costPerPitch = parseFloat(data[i][19]) || 0;
    
    if (!generations[gen]) {
      generations[gen] = { count: 0, totalCost: 0, avgCost: 0 };
    }
    
    generations[gen].count++;
    generations[gen].totalCost += costPerPitch;
    generations[gen].avgCost = generations[gen].totalCost / generations[gen].count;
  }
  
  // Convert to array sorted by generation
  var result = [];
  var genOrder = ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9'];
  
  for (var g = 0; g < genOrder.length; g++) {
    if (generations[genOrder[g]]) {
      result.push({
        generation: genOrder[g],
        count: generations[genOrder[g]].count,
        avgCost: generations[genOrder[g]].avgCost
      });
    }
  }
  
  return result;
}

/**
 * Get full yeast inventory summary for dashboard
 */
function getYeastInventorySummary() {
  var ss = getBrmSpreadsheet();
  var sheet = ss.getSheetByName(YEAST_PROPAGATION_LOG_SHEET);
  
  if (!sheet) {
    return { strains: [], totalActive: 0, totalDepleted: 0 };
  }
  
  var data = sheet.getDataRange().getValues();
  var strains = {};
  var totalActive = 0;
  var totalDepleted = 0;
  
  for (var i = 1; i < data.length; i++) {
    var strain = data[i][1];
    var status = data[i][20];
    var generation = data[i][2];
    var costPerPitch = parseFloat(data[i][19]) || 0;
    
    if (!strain) continue;
    
    if (!strains[strain]) {
      strains[strain] = {
        name: strain,
        active: 0,
        depleted: 0,
        totalCost: 0,
        generations: {},
        avgCost: 0
      };
    }
    
    if (status === 'Active') {
      strains[strain].active++;
      totalActive++;
    } else if (status === 'Depleted') {
      strains[strain].depleted++;
      totalDepleted++;
    }
    
    strains[strain].totalCost += costPerPitch;
    
    if (!strains[strain].generations[generation]) {
      strains[strain].generations[generation] = 0;
    }
    strains[strain].generations[generation]++;
  }
  
  // Calculate averages
  var strainArray = [];
  for (var s in strains) {
    var total = strains[s].active + strains[s].depleted;
    strains[s].avgCost = total > 0 ? strains[s].totalCost / total : 0;
    strainArray.push(strains[s]);
  }
  
  return {
    strains: strainArray,
    totalActive: totalActive,
    totalDepleted: totalDepleted
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// RECIPE INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get yeast cost for a specific recipe
 * Looks up which strain the recipe uses and returns either:
 * - Specific pitch cost (if pitchId provided)
 * - Weighted average cost (if no specific pitch)
 */
function getYeastCostForRecipe(recipeName, pitchId) {
  var ss = getBrmSpreadsheet();
  
  // If specific pitch provided, use that cost
  if (pitchId) {
    var sheet = ss.getSheetByName(YEAST_PROPAGATION_LOG_SHEET);
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === pitchId) {
          return {
            cost: parseFloat(data[i][19]) || 0,
            strain: data[i][1],
            generation: data[i][2],
            pitchId: pitchId,
            method: 'specific'
          };
        }
      }
    }
  }
  
  // Otherwise, look up recipe to find strain, then get average
  var recipeSheet = ss.getSheetByName('Recipe Ingredients') || ss.getSheetByName('Recipes');
  if (!recipeSheet) {
    return { cost: 50, strain: 'Unknown', method: 'default' };
  }
  
  var recipeData = recipeSheet.getDataRange().getValues();
  var strainName = null;
  
  // Find yeast entry for this recipe
  for (var i = 1; i < recipeData.length; i++) {
    var recipe = recipeData[i][0];
    var category = String(recipeData[i][1]).toLowerCase();
    var ingredient = recipeData[i][2];
    
    if (recipe === recipeName && (category.includes('yeast') || category === 'other')) {
      // Check if ingredient matches a strain
      var strains = getActiveYeastStrains();
      for (var s = 0; s < strains.length; s++) {
        if (String(ingredient).toLowerCase().includes(strains[s].name.toLowerCase()) ||
            strains[s].name.toLowerCase().includes(String(ingredient).toLowerCase())) {
          strainName = strains[s].name;
          break;
        }
      }
      if (strainName) break;
    }
  }
  
  if (strainName) {
    var avgCost = getWeightedAverageYeastCost(strainName);
    return {
      cost: avgCost,
      strain: strainName,
      method: 'weighted_average'
    };
  }
  
  // Default fallback
  return { cost: 50, strain: 'Unknown', method: 'default' };
}


// ═══════════════════════════════════════════════════════════════════════════════
// UI/API FUNCTIONS FOR HTML INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get data for Yeast Dashboard
 */
function getYeastDashboardData() {
  return {
    summary: getYeastInventorySummary(),
    strains: getActiveYeastStrains(),
    availablePitches: getAllAvailablePitches(),
    averageCosts: getAllYeastAverageCosts(),
    laborRate: YEAST_LABOR_RATE_PER_HOUR,
    dmeCostPerLb: getDMECostPerLb()
  };
}

/**
 * Get cost trend for a strain
 */
function getStrainCostTrend(strainName) {
  return {
    strain: strainName,
    byGeneration: getYeastCostByGeneration(strainName),
    currentAverage: getWeightedAverageYeastCost(strainName)
  };
}

/**
 * API endpoint for creating P0 from UI
 */
function apiCreateP0(formData) {
  return createP0Propagation(formData);
}

/**
 * API endpoint for creating harvest from UI
 */
function apiCreateHarvest(formData) {
  return createHarvestPropagation(formData);
}

/**
 * API endpoint for using pitch from UI
 */
function apiUsePitch(pitchId, batchNumber) {
  return usePitchForBatch(pitchId, batchNumber);
}

/**
 * API endpoint for updating Raw Materials with yeast costs
 */
function apiUpdateYeastCostsInRawMaterials() {
  return updateRawMaterialsWithYeastCosts();
}


// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Ensure getBrmSpreadsheet exists
// ═══════════════════════════════════════════════════════════════════════════════

// If getBrmSpreadsheet isn't already defined in your Code.gs, uncomment this:
/*
function getBrmSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}
*/


// ═══════════════════════════════════════════════════════════════════════════════
// MENU ADDITION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Add Yeast menu items to your existing menu
 * Call this from your existing onOpen or menu setup function
 */
function addYeastMenuItems(menu) {
  menu.addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('🧫 Yeast Management')
      .addItem('Initialize Yeast System', 'initializeYeastPropagationSystem')
      .addItem('View Dashboard', 'showYeastDashboard')
      .addItem('Add P0 Propagation', 'showP0PropagationForm')
      .addItem('Add Harvest', 'showHarvestForm')
      .addItem('Update Raw Materials Costs', 'apiUpdateYeastCostsInRawMaterials'));
  return menu;
}

/**
 * Standalone menu creation (if not integrating with existing menu)
 */
function createYeastMenu() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🧫 Yeast Management')
    .addItem('Initialize Yeast System', 'initializeYeastPropagationSystem')
    .addItem('View Dashboard', 'showYeastDashboard')
    .addSeparator()
    .addItem('Add P0 Propagation', 'showP0PropagationForm')
    .addItem('Add Harvest', 'showHarvestForm')
    .addSeparator()
    .addItem('Update Raw Materials Costs', 'apiUpdateYeastCostsInRawMaterials')
    .addToUi();
}
    function showYeastDashboard() {
       var html = HtmlService.createHtmlOutputFromFile('YeastDashboard')
         .setWidth(1000)
         .setHeight(700)
         .setTitle('Yeast Propagation Dashboard');
       SpreadsheetApp.getUi().showModalDialog(html, 'Yeast Propagation Dashboard');
     }
     function showP0PropagationForm() {
       var html = HtmlService.createHtmlOutputFromFile('YeastP0Form')
         .setWidth(500)
         .setHeight(600)
         .setTitle('New P0 Propagation');
       SpreadsheetApp.getUi().showModalDialog(html, 'New P0 Propagation');
     }
     function showHarvestForm() {
       var html = HtmlService.createHtmlOutputFromFile('YeastHarvestForm')
         .setWidth(500)
         .setHeight(550)
         .setTitle('Harvest Yeast');
       SpreadsheetApp.getUi().showModalDialog(html, 'Harvest Yeast');
     }
     // ═══════════════════════════════════════════════════════════════════════════════
// TASK-BASED LABOR COSTING SYSTEM
// Add these functions to your BRM Code.gs
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * EMPLOYEE RATE CARD
 * Returns hourly rates for all employees
 * These are used for task-based labor costing
 */
var EMPLOYEE_RATES = {
  'Richard Mar': 37.50,      // $78,000 / 2080 hrs
  'Alex Velasco': 31.25,     // $65,000 / 2080 hrs
  'Jeremy Ueberroth': 26.50,
  'Zach Schneider': 27.15,
  'Dwayne Klaus': 20.00
};

var STANDARD_SHIFT_HOURS = 8;

/**
 * Get employee rates for UI dropdowns
 */
function getEmployeeRates() {
  try {
    var employees = [];
    for (var name in EMPLOYEE_RATES) {
      employees.push({
        name: name,
        hourlyRate: EMPLOYEE_RATES[name],
        shiftCost: EMPLOYEE_RATES[name] * STANDARD_SHIFT_HOURS
      });
    }
    return serializeForHtml({
      success: true,
      employees: employees,
      shiftHours: STANDARD_SHIFT_HOURS
    });
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Calculate labor cost for a task
 * @param {Array} employeeNames - Array of employee names working the task
 * @param {number} batchesWorked - How many batches they're splitting time across
 * @returns {Object} Labor breakdown
 */
function calculateTaskLabor(employeeNames, batchesWorked) {
  if (!employeeNames || employeeNames.length === 0) {
    return { totalCost: 0, perBatchCost: 0, breakdown: [] };
  }
  
  var batchCount = Math.max(1, batchesWorked || 1);
  var hoursPerBatch = STANDARD_SHIFT_HOURS / batchCount;
  var totalCost = 0;
  var breakdown = [];
  
  employeeNames.forEach(function(name) {
    var rate = EMPLOYEE_RATES[name] || 0;
    var employeeCost = rate * STANDARD_SHIFT_HOURS;
    var costPerBatch = employeeCost / batchCount;
    
    totalCost += employeeCost;
    breakdown.push({
      employee: name,
      hourlyRate: rate,
      hoursWorked: STANDARD_SHIFT_HOURS,
      hoursPerBatch: hoursPerBatch,
      totalCost: employeeCost,
      costPerBatch: costPerBatch
    });
  });
  
  return {
    totalCost: totalCost,
    perBatchCost: totalCost / batchCount,
    hoursPerBatch: hoursPerBatch,
    batchCount: batchCount,
    breakdown: breakdown
  };
}

/**
 * Assign brew labor to a batch
 * Called when brew is finalized/started
 * @param {string} batchNumber
 * @param {Array} brewers - Array of brewer names
 * @param {number} batchesBrewedToday - How many batches being brewed today
 */
function assignBrewLabor(batchNumber, brewers, batchesBrewedToday) {
  try {
    var ss = getBrmSpreadsheet();
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    if (!batchSheet) {
      return { success: false, error: 'Batch Log not found' };
    }
    
    // Find batch row
    var data = batchSheet.getDataRange().getValues();
    var headers = data[0];
    var batchRow = -1;
    
    // Find column indices (we'll add new columns if needed)
    var brewLaborCol = headers.indexOf('Brew Labor $') + 1;
    var brewersCol = headers.indexOf('Brewers') + 1;
    
    // If columns don't exist, we'll use columns after existing data
    // Standard Batch Log ends around column AC (29)
    if (brewLaborCol === 0) brewLaborCol = 30;  // AD
    if (brewersCol === 0) brewersCol = 31;       // AE
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === batchNumber) {
        batchRow = i + 1;
        break;
      }
    }
    
    if (batchRow === -1) {
      return { success: false, error: 'Batch not found: ' + batchNumber };
    }
    
    // Calculate labor
    var laborCalc = calculateTaskLabor(brewers, batchesBrewedToday);
    
    // Update batch with brew labor
    batchSheet.getRange(batchRow, brewLaborCol).setValue(laborCalc.perBatchCost);
    // Format brewers as "Turn 1 / Turn 2" if provided, otherwise join with comma
    var brewersStr = brewers.length === 2 ? brewers.join(' / ') : brewers.join(', ');
    batchSheet.getRange(batchRow, brewersCol).setValue(brewersStr);
    
    // Also update the Labor $ column (G) and Labor Hrs (F)
    var hoursPerBatch = STANDARD_SHIFT_HOURS / Math.max(1, batchesBrewedToday);
    batchSheet.getRange(batchRow, 6).setValue(hoursPerBatch * brewers.length);  // F: Labor Hrs
    batchSheet.getRange(batchRow, 7).setValue(laborCalc.perBatchCost);          // G: Labor $
    
    // Recalculate Total Cost (column I)
    var recipeCost = parseFloat(batchSheet.getRange(batchRow, 5).getValue()) || 0;  // E
    var overhead = parseFloat(batchSheet.getRange(batchRow, 8).getValue()) || 0;     // H
    var newTotalCost = recipeCost + laborCalc.perBatchCost + overhead;
    batchSheet.getRange(batchRow, 9).setValue(newTotalCost);  // I: Total Cost
    
    // Log the assignment
    addBatchEntry(batchNumber, 'Labor', {
      description: 'Brew labor assigned: ' + brewers.join(', '),
      value: laborCalc.perBatchCost,
      units: '$',
      notes: laborCalc.hoursPerBatch.toFixed(1) + ' hrs each (' + batchesBrewedToday + ' batches today)'
    });
    
    Logger.log('Brew labor assigned to ' + batchNumber + ': $' + laborCalc.perBatchCost.toFixed(2));
    
    return serializeForHtml({
      success: true,
      batchNumber: batchNumber,
      brewLabor: laborCalc.perBatchCost,
      brewers: brewers,
      breakdown: laborCalc.breakdown,
      message: 'Brew labor: $' + laborCalc.perBatchCost.toFixed(2)
    });
    
  } catch (e) {
    Logger.log('Error assigning brew labor: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * Assign cellar labor to a batch
 * Called when cellar tasks are logged (dry hop, transfer, etc.)
 * @param {string} batchNumber
 * @param {Array} workers - Array of worker names
 * @param {number} batchesWorkedToday - How many batches they worked on today
 * @param {string} taskType - Description of task (e.g., "Dry Hop", "Transfer")
 */
function assignCellarLabor(batchNumber, workers, batchesWorkedToday, taskType) {
  try {
    var ss = getBrmSpreadsheet();
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    if (!batchSheet) {
      return { success: false, error: 'Batch Log not found' };
    }
    
    // Find batch row
    var data = batchSheet.getDataRange().getValues();
    var headers = data[0];
    var batchRow = -1;
    
    // Cellar labor column (we'll accumulate here)
    var cellarLaborCol = headers.indexOf('Cellar Labor $') + 1;
    if (cellarLaborCol === 0) cellarLaborCol = 32;  // AF
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === batchNumber) {
        batchRow = i + 1;
        break;
      }
    }
    
    if (batchRow === -1) {
      return { success: false, error: 'Batch not found: ' + batchNumber };
    }
    
    // Calculate labor for this task
    var laborCalc = calculateTaskLabor(workers, batchesWorkedToday);
    
    // Get existing cellar labor and add to it
    var existingCellarLabor = parseFloat(batchSheet.getRange(batchRow, cellarLaborCol).getValue()) || 0;
    var newCellarLabor = existingCellarLabor + laborCalc.perBatchCost;
    
    batchSheet.getRange(batchRow, cellarLaborCol).setValue(newCellarLabor);
    
    // Update Total Cost
    var recipeCost = parseFloat(batchSheet.getRange(batchRow, 5).getValue()) || 0;
    var brewLabor = parseFloat(batchSheet.getRange(batchRow, 7).getValue()) || 0;
    var overhead = parseFloat(batchSheet.getRange(batchRow, 8).getValue()) || 0;
    var newTotalCost = recipeCost + brewLabor + newCellarLabor + overhead;
    batchSheet.getRange(batchRow, 9).setValue(newTotalCost);
    
    // Log the assignment
    addBatchEntry(batchNumber, 'Labor', {
      description: 'Cellar labor (' + (taskType || 'task') + '): ' + workers.join(', '),
      value: laborCalc.perBatchCost,
      units: '$',
      notes: laborCalc.hoursPerBatch.toFixed(1) + ' hrs each (' + batchesWorkedToday + ' batches)'
    });
    
    Logger.log('Cellar labor added to ' + batchNumber + ': +$' + laborCalc.perBatchCost.toFixed(2) + ' (total: $' + newCellarLabor.toFixed(2) + ')');
    
    return serializeForHtml({
      success: true,
      batchNumber: batchNumber,
      addedLabor: laborCalc.perBatchCost,
      totalCellarLabor: newCellarLabor,
      workers: workers,
      taskType: taskType,
      message: 'Cellar labor added: +$' + laborCalc.perBatchCost.toFixed(2)
    });
    
  } catch (e) {
    Logger.log('Error assigning cellar labor: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * Assign packaging labor to a batch
 * Called when SEND IT is clicked
 * @param {string} batchNumber
 * @param {Array} packagers - Array of packager names
 * @param {number} batchesPackagedToday - How many batches being packaged today
 */
function assignPackagingLabor(batchNumber, packagers, batchesPackagedToday) {
  try {
    var ss = getBrmSpreadsheet();
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    if (!batchSheet) {
      return { success: false, error: 'Batch Log not found' };
    }
    
    // Find batch row
    var data = batchSheet.getDataRange().getValues();
    var headers = data[0];
    var batchRow = -1;
    
    var pkgLaborCol = headers.indexOf('Pkg Labor $') + 1;
    var packagersCol = headers.indexOf('Packagers') + 1;
    if (pkgLaborCol === 0) pkgLaborCol = 33;    // AG
    if (packagersCol === 0) packagersCol = 34;   // AH
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === batchNumber) {
        batchRow = i + 1;
        break;
      }
    }
    
    if (batchRow === -1) {
      return { success: false, error: 'Batch not found: ' + batchNumber };
    }
    
    // Calculate labor
    var laborCalc = calculateTaskLabor(packagers, batchesPackagedToday);
    
    // Update batch with packaging labor
    batchSheet.getRange(batchRow, pkgLaborCol).setValue(laborCalc.perBatchCost);
    batchSheet.getRange(batchRow, packagersCol).setValue(packagers.join(', '));
    
    // Log the assignment
    addBatchEntry(batchNumber, 'Labor', {
      description: 'Packaging labor: ' + packagers.join(', '),
      value: laborCalc.perBatchCost,
      units: '$',
      notes: laborCalc.hoursPerBatch.toFixed(1) + ' hrs each (' + batchesPackagedToday + ' batches)'
    });
    
    Logger.log('Packaging labor assigned to ' + batchNumber + ': $' + laborCalc.perBatchCost.toFixed(2));
    
    return serializeForHtml({
      success: true,
      batchNumber: batchNumber,
      pkgLabor: laborCalc.perBatchCost,
      packagers: packagers,
      breakdown: laborCalc.breakdown
    });
    
  } catch (e) {
    Logger.log('Error assigning packaging labor: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * Get total labor cost for a batch (all three tiers combined)
 * @param {string} batchNumber
 */
function getBatchLaborTotal(batchNumber) {
  try {
    var ss = getBrmSpreadsheet();
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    if (!batchSheet) {
      return { success: false, error: 'Batch Log not found' };
    }
    
    var data = batchSheet.getDataRange().getValues();
    var headers = data[0];
    
    // Find column indices
    var brewLaborCol = headers.indexOf('Brew Labor $');
    var cellarLaborCol = headers.indexOf('Cellar Labor $');
    var pkgLaborCol = headers.indexOf('Pkg Labor $');
    
    // Fallback to standard positions if headers not found
    if (brewLaborCol === -1) brewLaborCol = 29;   // AD (0-indexed)
    if (cellarLaborCol === -1) cellarLaborCol = 31;
    if (pkgLaborCol === -1) pkgLaborCol = 32;
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === batchNumber) {
        var brewLabor = parseFloat(data[i][brewLaborCol]) || parseFloat(data[i][6]) || 0;  // Also check col G
        var cellarLabor = parseFloat(data[i][cellarLaborCol]) || 0;
        var pkgLabor = parseFloat(data[i][pkgLaborCol]) || 0;
        
        return serializeForHtml({
          success: true,
          batchNumber: batchNumber,
          brewLabor: brewLabor,
          cellarLabor: cellarLabor,
          pkgLabor: pkgLabor,
          totalLabor: brewLabor + cellarLabor + pkgLabor
        });
      }
    }
    
    return { success: false, error: 'Batch not found' };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * MODIFIED SEND IT - Uses actual assigned labor instead of Labor Config estimate
 * This replaces the existing sendIt function
 */
function sendItWithActualLabor(batchNumber, packageBreakdown, currentVessel, packagers, batchesPackagedToday) {
  try {
    var ss = getBrmSpreadsheet();
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    if (!batchSheet) {
      return { success: false, error: 'Batch Log sheet not found' };
    }
    
    // Find batch row
    var data = batchSheet.getDataRange().getValues();
    var headers = data[0];
    var batchRow = -1;
    var batchData = null;
    
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === batchNumber) {
        batchRow = i + 1;
        batchData = data[i];
        break;
      }
    }
    
    if (batchRow === -1 || !batchData) {
      return { success: false, error: 'Batch not found: ' + batchNumber };
    }
    
    // First, assign packaging labor
    if (packagers && packagers.length > 0) {
      assignPackagingLabor(batchNumber, packagers, batchesPackagedToday || 1);
    }
    
    // Re-read batch data after labor assignment
    batchData = batchSheet.getRange(batchRow, 1, 1, batchSheet.getLastColumn()).getValues()[0];
    
    // Extract batch info
    var beerName = batchData[2] || '';                  // C: Beer Name
    var batchSize = parseFloat(batchData[3]) || 0;      // D: Size
    var recipeCost = parseFloat(batchData[4]) || 0;     // E: Recipe Cost
    var brewLabor = parseFloat(batchData[6]) || 0;      // G: Labor $ (brew)
    var overhead = parseFloat(batchData[7]) || 0;       // H: Overhead
    var expectedYield = parseFloat(batchData[9]) || 0;  // J: Expected Yield
    var actualYield = parseFloat(batchData[12]) || 0;   // M: Act. Yield
    
    // Get cellar and pkg labor from extended columns
    var cellarLaborCol = headers.indexOf('Cellar Labor $');
    var pkgLaborCol = headers.indexOf('Pkg Labor $');
    var cellarLabor = cellarLaborCol !== -1 ? parseFloat(batchData[cellarLaborCol]) || 0 : 0;
    var pkgLabor = pkgLaborCol !== -1 ? parseFloat(batchData[pkgLaborCol]) || 0 : 0;
    
    // Calculate actual yield from packages if not set
    if (actualYield === 0 && packageBreakdown) {
      for (var pkgType in packageBreakdown) {
        var qty = parseFloat(packageBreakdown[pkgType]) || 0;
        var bblPer = PACKAGE_BBL_CONVERSIONS[pkgType] || 0;
        actualYield += qty * bblPer;
      }
    }
    
    // Get task material costs
    var taskMaterialCost = 0;
    try {
      var tasksResult = getBatchTasks(batchNumber);
      if (tasksResult.success && tasksResult.tasks) {
        var rmResult = getRawMaterialsInventory({});
        var materialsLookup = {};
        if (rmResult.success && rmResult.materials) {
          rmResult.materials.forEach(function(m) {
            materialsLookup[m.item] = m.avgCost || 0;
          });
        }
        
        tasksResult.tasks.forEach(function(task) {
          if (task.status === 'Completed' && task.materials && task.materials.length > 0) {
            task.materials.forEach(function(mat) {
              var unitCost = materialsLookup[mat.item] || 0;
              var qty = 0;
              
              if (mat.isPackaging) {
                // For packaging, deduct actual + waste
                qty = (mat.actualQty || 0) + (mat.wasteQty || 0);
              } else {
                // Regular materials - use actual quantity
                qty = mat.actualQty || mat.quantity || 0;
              }
              
              taskMaterialCost += qty * unitCost;
            });
          }
        });
      }
    } catch (taskError) {
      Logger.log('Warning: Could not calculate task material costs: ' + taskError.toString());
    }
    
    // Check if packaging materials already depleted
    var packagingMaterialsDepletedCol = -1;
    for (var h = 0; h < headers.length; h++) {
      if ((headers[h] || '').toString().toLowerCase().indexOf('packagingmaterialsdepleted') !== -1) {
        packagingMaterialsDepletedCol = h;
        break;
      }
    }
    
    var packagingAlreadyDepleted = false;
    if (packagingMaterialsDepletedCol !== -1) {
      var flagValue = batchData[packagingMaterialsDepletedCol];
      packagingAlreadyDepleted = (flagValue === true || flagValue === 'TRUE' || flagValue === 'Yes' || flagValue === 'Y');
    }
    
    // Also check Material Log
    if (!packagingAlreadyDepleted && hasBeenDepleted(batchNumber, null, 'Packaging')) {
      packagingAlreadyDepleted = true;
      Logger.log('Packaging materials already depleted (found in Material Log) for batch: ' + batchNumber);
    }
    
    // Deduct packaging materials and calculate cost
    var packagingMaterialCost = 0;
    if (!packagingAlreadyDepleted && packageBreakdown) {
      try {
        var packagingResult = deductPackagingMaterials(batchNumber, packageBreakdown, beerName);
        if (packagingResult.success) {
          packagingMaterialCost = packagingResult.totalCost || 0;
          Logger.log('Packaging materials cost: $' + packagingMaterialCost.toFixed(2));
          
          // Set packagingMaterialsDepleted flag
          if (packagingMaterialsDepletedCol === -1) {
            // Add column if missing
            var lastCol = batchSheet.getLastColumn();
            batchSheet.getRange(1, lastCol + 1).setValue('Packaging Materials Depleted');
            packagingMaterialsDepletedCol = lastCol;
          }
          batchSheet.getRange(batchRow, packagingMaterialsDepletedCol + 1).setValue('Yes');
          Logger.log('Set packagingMaterialsDepleted flag for batch: ' + batchNumber);
        }
      } catch (pkgError) {
        Logger.log('Warning: Could not deduct packaging materials: ' + pkgError.toString());
      }
    } else if (packagingAlreadyDepleted) {
      Logger.log('Packaging materials already depleted for batch: ' + batchNumber + ' - skipping');
    }
    
    // Calculate FINAL total cost with ACTUAL labor + task materials + packaging materials
    var totalLabor = brewLabor + cellarLabor + pkgLabor;
    var totalCost = recipeCost + totalLabor + overhead + taskMaterialCost + packagingMaterialCost;
    
    // Calculate efficiency and COGS/BBL
    var efficiency = expectedYield > 0 ? (actualYield / expectedYield * 100) : 0;
    var variance = actualYield - expectedYield;
    var cogsPerBBL = actualYield > 0 ? totalCost / actualYield : 0;
    
    // Update Batch Log with final values
    batchSheet.getRange(batchRow, 9).setValue(totalCost);            // I: Total Cost (FINAL)
    batchSheet.getRange(batchRow, 11).setValue('Packaged');          // K: Status
    batchSheet.getRange(batchRow, 12).setValue(new Date());          // L: Pkg Date
    batchSheet.getRange(batchRow, 13).setValue(actualYield);         // M: Act. Yield
    batchSheet.getRange(batchRow, 14).setValue(cogsPerBBL);          // N: Cost/BBL
    batchSheet.getRange(batchRow, 15).setValue(variance);            // O: Variance
    
    // Append labor, task materials, and packaging materials breakdown to notes
    var existingNotes = batchData[15] || '';
    var laborNote = ' | Labor: Brew $' + brewLabor.toFixed(0) + 
                    ' + Cellar $' + cellarLabor.toFixed(0) + 
                    ' + Pkg $' + pkgLabor.toFixed(0) + 
                    ' = $' + totalLabor.toFixed(0);
    if (taskMaterialCost > 0) {
      laborNote += ' | Task Materials: $' + taskMaterialCost.toFixed(2);
    }
    if (packagingMaterialCost > 0) {
      laborNote += ' | Packaging Materials: $' + packagingMaterialCost.toFixed(2);
    }
    batchSheet.getRange(batchRow, 16).setValue(existingNotes + laborNote);
    
    // Add to Finished Goods
    var fgResult = addToFinishedGoods(beerName, packageBreakdown, cogsPerBBL, batchNumber);
    
    // Update Beer COGS Master
    try {
      updateBeerCOGSMaster();
    } catch (cogsError) {
      Logger.log('Warning: Could not update Beer COGS Master: ' + cogsError.toString());
    }
    
    // Log completion with labor breakdown
    addBatchEntry(batchNumber, 'Note', {
      description: '🚀 SEND IT! Batch complete.',
      value: totalCost,
      units: '$',
      notes: 'COGS/BBL: $' + cogsPerBBL.toFixed(2) + ' | Labor: $' + totalLabor.toFixed(2) + 
             ' (Brew: $' + brewLabor.toFixed(2) + ', Cellar: $' + cellarLabor.toFixed(2) + ', Pkg: $' + pkgLabor.toFixed(2) + ')'
    });
    
    // Free vessel
    if (currentVessel) {
      updateEquipmentStatus(currentVessel, 'Available', '', '');
    }
    
    // Archive to Google Drive
    var archiveResult = { success: false, url: '' };
    try {
      archiveResult = archiveBatchRecord(batchNumber, beerName, batchData, packageBreakdown);
    } catch (archiveError) {
      Logger.log('Warning: Could not archive: ' + archiveError.toString());
    }
    
    Logger.log('🚀 SEND IT! ' + batchNumber + ' complete. COGS/BBL: $' + cogsPerBBL.toFixed(2) + 
               ' (Ingredients: $' + recipeCost.toFixed(2) + ', Labor: $' + totalLabor.toFixed(2) + 
               ', Task Materials: $' + taskMaterialCost.toFixed(2) + 
               ', Packaging: $' + packagingMaterialCost.toFixed(2) + ', OH: $' + overhead.toFixed(2) + ')');
    
    return serializeForHtml({
      success: true,
      batchNumber: batchNumber,
      beerName: beerName,
      actualYield: actualYield,
      efficiency: efficiency,
      cogsPerBBL: cogsPerBBL,
      totalCost: totalCost,
      laborBreakdown: {
        brew: brewLabor,
        cellar: cellarLabor,
        packaging: pkgLabor,
        total: totalLabor
      },
      taskMaterialCost: taskMaterialCost,
      costBreakdown: {
        ingredients: recipeCost,
        labor: totalLabor,
        taskMaterials: taskMaterialCost,
        packagingMaterials: packagingMaterialCost,
        overhead: overhead,
        total: totalCost
      },
      packagingMaterialsCost: packagingMaterialCost,
      fgUpdated: fgResult.success,
      archived: archiveResult.success,
      archiveUrl: archiveResult.url || '',
      message: '🚀 SEND IT! Batch ' + batchNumber + ' complete! COGS/BBL: $' + cogsPerBBL.toFixed(2)
    });
    
  } catch (e) {
    Logger.log('Error in Send It: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * MODIFIED finalizeBrewWithActuals - Now includes crew assignment
 */
function finalizeBrewWithCrewLabor(batchNumber, vessel, brewers, batchesBrewedToday, og, mashTemp, notes) {
  try {
    // First assign the brew labor
    var laborResult = assignBrewLabor(batchNumber, brewers || ['Unknown'], batchesBrewedToday || 1);
    
    if (!laborResult.success) {
      Logger.log('Warning: Could not assign brew labor: ' + laborResult.error);
    }
    
    // Then do the normal finalize
    var ss = getBrmSpreadsheet();
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    // Find batch row
    var data = batchSheet.getDataRange().getValues();
    var batchRow = -1;
    
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === batchNumber) {
        batchRow = i + 1;
        break;
      }
    }
    
    if (batchRow === -1) {
      return { success: false, error: 'Batch not found' };
    }
    
    // Update batch with vessel and QA data
    batchSheet.getRange(batchRow, 11).setValue('Fermenting');           // K: Status
    batchSheet.getRange(batchRow, 29).setValue(vessel);                 // AC: Current Vessel (or wherever it is)
    
    if (og) batchSheet.getRange(batchRow, 17).setValue(og);             // Q: OG Target/Actual
    if (mashTemp) batchSheet.getRange(batchRow, 23).setValue(mashTemp); // W: Mash Temp
    if (notes) {
      var existingNotes = batchSheet.getRange(batchRow, 16).getValue() || '';
      batchSheet.getRange(batchRow, 16).setValue(existingNotes + (existingNotes ? ' | ' : '') + notes);
    }
    
    // Update vessel status
    if (vessel) {
      var beerName = batchSheet.getRange(batchRow, 3).getValue();
      updateEquipmentStatus(vessel, 'In Use', batchNumber, beerName);
    }
    
    // Log the brew start
    addBatchEntry(batchNumber, 'Brew', {
      description: 'Brew started by ' + (brewers ? brewers.join(', ') : 'Unknown'),
      value: laborResult.brewLabor || 0,
      units: '$ labor',
      notes: 'Vessel: ' + vessel + (og ? ', OG: ' + og : '')
    });
    
    Logger.log('Brew finalized: ' + batchNumber + ' → ' + vessel + ' by ' + (brewers ? brewers.join(', ') : 'Unknown'));
    
    return serializeForHtml({
      success: true,
      batchNumber: batchNumber,
      vessel: vessel,
      brewers: brewers,
      brewLabor: laborResult.brewLabor || 0,
      status: 'Fermenting',
      message: 'Batch ' + batchNumber + ' is now fermenting in ' + vessel
    });
    
  } catch (e) {
    Logger.log('Error finalizing brew: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Add headers to Batch Log if not present
// Run this once to add the new labor columns
// ═══════════════════════════════════════════════════════════════════════════════

function addLaborColumnsToBatchLog() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    if (!sheet) {
      return { success: false, error: 'Batch Log not found' };
    }
    
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var lastCol = sheet.getLastColumn();
    
    // Check which columns need to be added
    var newHeaders = [];
    if (headers.indexOf('Brew Labor $') === -1) newHeaders.push('Brew Labor $');
    if (headers.indexOf('Brewers') === -1) newHeaders.push('Brewers');
    if (headers.indexOf('Cellar Labor $') === -1) newHeaders.push('Cellar Labor $');
    if (headers.indexOf('Pkg Labor $') === -1) newHeaders.push('Pkg Labor $');
    if (headers.indexOf('Packagers') === -1) newHeaders.push('Packagers');
    
    if (newHeaders.length > 0) {
      for (var i = 0; i < newHeaders.length; i++) {
        sheet.getRange(1, lastCol + 1 + i).setValue(newHeaders[i]);
      }
      Logger.log('Added columns to Batch Log: ' + newHeaders.join(', '));
    } else {
      Logger.log('All labor columns already exist');
    }
    
    return { success: true, addedColumns: newHeaders };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}
// ═══════════════════════════════════════════════════════════════════════════════
// ADD THIS FUNCTION TO BRM Code.gs
// Handles starting a brew with crew labor assignment
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Start a brew with crew labor assignment
 * Called from the Brewer's Sheet when user clicks START BREW
 * 
 * @param {string} recipeName - Recipe being brewed
 * @param {number} batchSize - Batch size in BBL
 * @param {string} fermenter - Vessel/fermenter name
 * @param {Array} brewers - Array of brewer names
 * @param {number} batchesToday - Number of batches being brewed today
 * @param {Array} ingredientActuals - Array of {ingredient, actual} objects
 * @param {string} notes - Brew notes
 */
function startBrewWithCrewLabor(recipeName, batchSize, fermenter, brewers, batchesToday, ingredientActuals, notes) {
  try {
    Logger.log('Starting brew with crew: ' + recipeName + ' by ' + brewers.join(', '));
    
    // First, create the batch using existing logic
    var createResult = createBatchFromRecipe(recipeName, batchSize);
    
    if (!createResult.success) {
      return createResult;
    }
    
    var batchNumber = createResult.batchNumber;
    Logger.log('Created batch: ' + batchNumber);
    
    // Assign brew labor
    var laborResult = assignBrewLabor(batchNumber, brewers, batchesToday || 1);
    
    if (!laborResult.success) {
      Logger.log('Warning: Could not assign labor: ' + laborResult.error);
    }
    
    // Update batch with fermenter and notes
    var ss = getBrmSpreadsheet();
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    // Find the batch row
    var data = batchSheet.getDataRange().getValues();
    var batchRow = -1;
    
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === batchNumber) {
        batchRow = i + 1;
        break;
      }
    }
    
    if (batchRow !== -1) {
      // Update status to Fermenting
      batchSheet.getRange(batchRow, 11).setValue('Fermenting');  // K: Status
      
      // Update vessel column (AC = 29)
      batchSheet.getRange(batchRow, 29).setValue(fermenter);
      
      // Add notes if provided
      if (notes) {
        var existingNotes = batchSheet.getRange(batchRow, 16).getValue() || '';
        batchSheet.getRange(batchRow, 16).setValue(existingNotes + (existingNotes ? ' | ' : '') + notes);
      }
      
      // Update vessel status
      if (fermenter) {
        var beerName = batchSheet.getRange(batchRow, 3).getValue();
        updateEquipmentStatus(fermenter, 'In Use', batchNumber, beerName);
      }
    }
    
    // Update ingredient actuals if provided
    if (ingredientActuals && ingredientActuals.length > 0) {
      try {
        updateBatchIngredientActuals(batchNumber, ingredientActuals);
      } catch (ingError) {
        Logger.log('Warning: Could not update ingredient actuals: ' + ingError.toString());
      }
    }
    
    // Consume ingredients from Raw Materials
    try {
      consumeIngredientsForBatch(batchNumber, recipeName, batchSize);
    } catch (consumeError) {
      Logger.log('Warning: Could not consume ingredients: ' + consumeError.toString());
    }
    
    // Log the brew start
    addBatchEntry(batchNumber, 'Brew', {
      description: '🍺 Brew started by ' + brewers.join(', '),
      value: laborResult.brewLabor || 0,
      units: '$ labor',
      notes: 'Vessel: ' + fermenter + ' | Batches today: ' + batchesToday
    });
    
    Logger.log('Brew started: ' + batchNumber + ' in ' + fermenter + ' by ' + brewers.join(', ') + 
               ' | Labor: $' + (laborResult.brewLabor || 0).toFixed(2));
    
    return serializeForHtml({
      success: true,
      batchNumber: batchNumber,
      recipeName: recipeName,
      batchSize: batchSize,
      fermenter: fermenter,
      brewers: brewers,
      brewLabor: laborResult.brewLabor || 0,
      message: '🍺 Batch ' + batchNumber + ' started! Labor: $' + (laborResult.brewLabor || 0).toFixed(2)
    });
    
  } catch (e) {
    Logger.log('Error starting brew with crew: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * Update ingredient actual amounts for a batch
 */
function updateBatchIngredientActuals(batchNumber, ingredientActuals) {
  var ss = getBrmSpreadsheet();
  var biSheet = ss.getSheetByName(SHEETS.BATCH_INGREDIENTS);
  
  if (!biSheet) {
    Logger.log('Batch Ingredients sheet not found');
    return;
  }
  
  var data = biSheet.getDataRange().getValues();
  
  ingredientActuals.forEach(function(item) {
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === batchNumber && data[i][2] === item.ingredient) {
        // Update actual column (assuming column D = 4)
        biSheet.getRange(i + 1, 4).setValue(item.actual);
        break;
      }
    }
  });
}

/**
 * Consume ingredients from Raw Materials inventory
 * Checks ingredientsDepleted flag to prevent double depletion
 */
function consumeIngredientsForBatch(batchNumber, recipeName, batchSize) {
  try {
    var ss = getBrmSpreadsheet();
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    // Check if ingredients already depleted
    if (batchSheet) {
      var batchData = batchSheet.getDataRange().getValues();
      var headers = batchData[0];
      var ingredientsDepletedCol = -1;
      
      // Find ingredientsDepleted column (or add it if missing)
      for (var h = 0; h < headers.length; h++) {
        if ((headers[h] || '').toString().toLowerCase().indexOf('ingredientsdepleted') !== -1) {
          ingredientsDepletedCol = h;
          break;
        }
      }
      
      // Find batch row
      for (var i = 1; i < batchData.length; i++) {
        if (batchData[i][0] && batchData[i][0].toString() === batchNumber) {
          if (ingredientsDepletedCol !== -1) {
            var alreadyDepleted = batchData[i][ingredientsDepletedCol];
            if (alreadyDepleted === true || alreadyDepleted === 'TRUE' || alreadyDepleted === 'Yes' || alreadyDepleted === 'Y') {
              Logger.log('Ingredients already depleted for batch: ' + batchNumber);
              return; // Skip depletion
            }
          }
          
          // Also check Material Log
          if (hasBeenDepleted(batchNumber, null, 'Recipe')) {
            Logger.log('Ingredients already depleted (found in Material Log) for batch: ' + batchNumber);
            // Set flag even if not in column yet
            if (ingredientsDepletedCol === -1) {
              // Add column if missing
              var lastCol = batchSheet.getLastColumn();
              batchSheet.getRange(1, lastCol + 1).setValue('Ingredients Depleted');
              ingredientsDepletedCol = lastCol;
            }
            batchSheet.getRange(i + 1, ingredientsDepletedCol + 1).setValue('Yes');
            return;
          }
          break;
        }
      }
    }
    
    // Get recipe ingredients
    var recipeResult = getRecipeIngredients(recipeName);
    
    if (!recipeResult.success) {
      Logger.log('Could not get recipe ingredients for consumption');
      return;
    }
    
    var rmSheet = ss.getSheetByName(SHEETS.RAW_MATERIALS);
    if (!rmSheet) return;
    
    var rmData = rmSheet.getDataRange().getValues();
    var headers = rmData[0];
    var qtyCol = headers.indexOf('Qty On Hand') + 1 || 4;  // D column
    
    // Scale factor for batch size
    var recipeBatchSize = recipeResult.batchSize || 60;
    var scaleFactor = batchSize / recipeBatchSize;
    
    // Combine all ingredients
    var allIngredients = [].concat(
      recipeResult.grains || [],
      recipeResult.hops || [],
      recipeResult.other || []
    );
    
    allIngredients.forEach(function(ing) {
      var amountNeeded = (ing.amount || 0) * scaleFactor;
      var ingName = (ing.ingredient || ing.name || '').toLowerCase().trim();
      var recipeUOM = (ing.uom || 'lb').toString().trim();
      
      // Find in raw materials and deduct
      for (var i = RAW_MATERIAL_CONFIG.dataStartRow - 1; i < rmData.length; i++) {
        var rmName = (rmData[i][RAW_MATERIAL_CONFIG.columns.item - 1] || '').toString().toLowerCase().trim();
        
        if (rmName === ingName || rmName.indexOf(ingName) !== -1 || ingName.indexOf(rmName) !== -1) {
          var rmUnit = (rmData[i][RAW_MATERIAL_CONFIG.columns.unit - 1] || 'lb').toString().trim();
          var currentQty = parseFloat(rmData[i][RAW_MATERIAL_CONFIG.columns.qtyOnHand - 1]) || 0;
          
          // Convert recipe UOM to Raw Material UOM
          var amountToDeduct = amountNeeded;
          if (recipeUOM !== rmUnit) {
            amountToDeduct = convertUnit(amountNeeded, recipeUOM, rmUnit);
            Logger.log('Unit conversion for ' + ing.ingredient + ': ' + amountNeeded + ' ' + recipeUOM + ' → ' + amountToDeduct.toFixed(4) + ' ' + rmUnit);
          }
          
          var newQty = Math.max(0, currentQty - amountToDeduct);
          rmSheet.getRange(i + 1, RAW_MATERIAL_CONFIG.columns.qtyOnHand).setValue(newQty);
          
          // Log to Material Log with Recipe type
          logMaterialAdjustment(ing.ingredient || ing.name, currentQty, newQty, 'Batch: ' + batchNumber + ', Type: Recipe');
          
          Logger.log('Consumed ' + amountToDeduct.toFixed(4) + ' ' + rmUnit + ' (' + amountNeeded + ' ' + recipeUOM + ') of ' + ing.ingredient + ' (was: ' + currentQty + ', now: ' + newQty + ')');
          break;
        }
      }
    });
    
    // Set ingredientsDepleted flag
    if (batchSheet) {
      var batchData = batchSheet.getDataRange().getValues();
      for (var i = 1; i < batchData.length; i++) {
        if (batchData[i][0] && batchData[i][0].toString() === batchNumber) {
          if (ingredientsDepletedCol === -1) {
            // Add column if missing
            var lastCol = batchSheet.getLastColumn();
            batchSheet.getRange(1, lastCol + 1).setValue('Ingredients Depleted');
            ingredientsDepletedCol = lastCol;
          }
          batchSheet.getRange(i + 1, ingredientsDepletedCol + 1).setValue('Yes');
          Logger.log('Set ingredientsDepleted flag for batch: ' + batchNumber);
          break;
        }
      }
    }
  } catch (e) {
    Logger.log('Error in consumeIngredientsForBatch: ' + e.toString());
  }
}
// ═══════════════════════════════════════════════════════════════════════════════
// RED LEG BREWING - LABOR TRACKING SYSTEM
// Manual Hour Entry with Rate History Support
// Add this code to BRM Code.gs (replaces the old timer-based system)
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: LABOR CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sheet name for labor configuration
 */
var LABOR_RATE_HISTORY_SHEET = 'Labor Config';
var LABOR_RATE_HISTORY_START_ROW = 50; // Row where rate history begins

/**
 * Default rates as fallback (if sheet lookup fails)
 * These should match your Labor Config starting rates for 1/1/2026
 */
var DEFAULT_EMPLOYEE_RATES = {
  'Richard Mar': { hourlyRate: 37.50, type: 'Salaried' },
  'Alex Velasco': { hourlyRate: 31.25, type: 'Salaried' },
  'Jeremy Ueberroth': { hourlyRate: 26.50, type: 'Hourly' },
  'Zach Schneider': { hourlyRate: 27.15, type: 'Hourly' },
  'Dwayne Klaus': { hourlyRate: 20.00, type: 'Hourly' }
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: EMPLOYEE NAME FUNCTIONS (NO RATES EXPOSED)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get employee names ONLY for UI dropdowns
 * CRITICAL: This function NEVER returns rates - only names
 * @returns {Object} { success: boolean, employees: [{name, role}] }
 */
function getEmployeeNames() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.LABOR_CONFIG);
    
    var employees = [];
    
    if (sheet) {
      // Read salaried staff (rows 10-11 in Labor Config, 0-indexed: 9-10)
      var salariedData = sheet.getRange('A10:A11').getValues();
      salariedData.forEach(function(row) {
        var name = (row[0] || '').toString().trim();
        if (name && name !== '' && !name.includes('Subtotal')) {
          employees.push({ name: name, role: 'Brewer' });
        }
      });
      
      // Read hourly staff (rows 16-18 in Labor Config, 0-indexed: 15-17)
      var hourlyData = sheet.getRange('A16:A18').getValues();
      hourlyData.forEach(function(row) {
        var name = (row[0] || '').toString().trim();
        if (name && name !== '' && !name.includes('Subtotal') && !name.includes('[Enter')) {
          employees.push({ name: name, role: 'Cellar/Packaging' });
        }
      });
    }
    
    // Fallback to defaults if nothing found
    if (employees.length === 0) {
      for (var name in DEFAULT_EMPLOYEE_RATES) {
        employees.push({ 
          name: name, 
          role: DEFAULT_EMPLOYEE_RATES[name].type === 'Salaried' ? 'Brewer' : 'Cellar/Packaging'
        });
      }
    }
    
    return serializeForHtml({
      success: true,
      employees: employees
    });
    
  } catch (e) {
    Logger.log('Error in getEmployeeNames: ' + e.toString());
    // Return defaults on error
    var fallback = [];
    for (var name in DEFAULT_EMPLOYEE_RATES) {
      fallback.push({ name: name, role: 'Staff' });
    }
    return { success: true, employees: fallback };
  }
}

/**
 * Get list of brewers only (Richard, Alex) for Brewer's Sheet dropdown
 */
function getBrewerNames() {
  try {
    var result = getEmployeeNames();
    if (result.success) {
      var brewers = result.employees.filter(function(e) {
        return e.role === 'Brewer';
      });
      return serializeForHtml({ success: true, brewers: brewers });
    }
    return result;
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: RATE HISTORY MANAGEMENT (SERVER-SIDE ONLY)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get employee's hourly rate for a specific date
 * Looks up rate history and returns the rate in effect on that date
 * THIS FUNCTION IS SERVER-SIDE ONLY - Never exposed to frontend
 * 
 * @param {string} employeeName - Employee name
 * @param {Date|string} workDate - Date the work was performed
 * @returns {number} Hourly rate in effect on that date
 */
function getEmployeeRateOnDate(employeeName, workDate) {
  try {
    var targetDate = workDate ? new Date(workDate) : new Date();
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.LABOR_CONFIG);
    
    if (!sheet) {
      Logger.log('Labor Config sheet not found, using default rate');
      return DEFAULT_EMPLOYEE_RATES[employeeName] ? DEFAULT_EMPLOYEE_RATES[employeeName].hourlyRate : 25.00;
    }
    
    // Look for Rate History section (starts around row 50)
    var lastRow = sheet.getLastRow();
    var rateHistoryStartRow = -1;
    
    // Find "RATE HISTORY" header
    var searchRange = sheet.getRange('A1:A' + lastRow).getValues();
    for (var i = 0; i < searchRange.length; i++) {
      if (searchRange[i][0] && searchRange[i][0].toString().toUpperCase().includes('RATE HISTORY')) {
        rateHistoryStartRow = i + 2; // Skip header row
        break;
      }
    }
    
    // If rate history section exists, search for matching employee and date
    if (rateHistoryStartRow > 0) {
      var historyData = sheet.getRange(rateHistoryStartRow, 1, lastRow - rateHistoryStartRow + 1, 4).getValues();
      var applicableRate = null;
      var applicableDate = null;
      
      for (var i = 0; i < historyData.length; i++) {
        var rowName = (historyData[i][0] || '').toString().trim();
        var rowRate = parseFloat(historyData[i][1]) || 0;
        var rowEffectiveDate = historyData[i][2];
        
        if (rowName.toLowerCase() === employeeName.toLowerCase() && rowRate > 0 && rowEffectiveDate) {
          var effectiveDate = new Date(rowEffectiveDate);
          
          // Check if this rate was in effect on the target date
          if (effectiveDate <= targetDate) {
            // Keep the most recent rate that's still before/on the target date
            if (!applicableDate || effectiveDate > applicableDate) {
              applicableRate = rowRate;
              applicableDate = effectiveDate;
            }
          }
        }
      }
      
      if (applicableRate !== null) {
        return applicableRate;
      }
    }
    
    // Fallback: Look up current rate from main Labor Config section
    // Salaried employees (rows 10-11)
    var salariedData = sheet.getRange('A10:D11').getValues();
    for (var i = 0; i < salariedData.length; i++) {
      if (salariedData[i][0] && salariedData[i][0].toString().toLowerCase() === employeeName.toLowerCase()) {
        var salary = parseFloat(salariedData[i][1]) || 0;
        if (salary > 0) {
          return salary / 2080; // Convert annual to hourly
        }
      }
    }
    
    // Hourly employees (rows 16-18)
    var hourlyData = sheet.getRange('A16:B18').getValues();
    for (var i = 0; i < hourlyData.length; i++) {
      if (hourlyData[i][0] && hourlyData[i][0].toString().toLowerCase() === employeeName.toLowerCase()) {
        var hourlyRate = parseFloat(hourlyData[i][1]) || 0;
        if (hourlyRate > 0) {
          return hourlyRate;
        }
      }
    }
    
    // Final fallback to defaults
    if (DEFAULT_EMPLOYEE_RATES[employeeName]) {
      return DEFAULT_EMPLOYEE_RATES[employeeName].hourlyRate;
    }
    
    Logger.log('No rate found for ' + employeeName + ', using $25/hr default');
    return 25.00;
    
  } catch (e) {
    Logger.log('Error getting rate for ' + employeeName + ': ' + e.toString());
    return DEFAULT_EMPLOYEE_RATES[employeeName] ? DEFAULT_EMPLOYEE_RATES[employeeName].hourlyRate : 25.00;
  }
}

/**
 * Add a new rate to the rate history
 * Called when an employee gets a raise
 * 
 * @param {string} employeeName - Employee name
 * @param {number} newRate - New hourly rate
 * @param {Date|string} effectiveDate - When the new rate takes effect
 * @param {string} notes - Optional notes (e.g., "Annual raise", "Promotion")
 */
function addRateHistoryEntry(employeeName, newRate, effectiveDate, notes) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.LABOR_CONFIG);
    
    if (!sheet) {
      return { success: false, error: 'Labor Config sheet not found' };
    }
    
    // Find Rate History section
    var lastRow = sheet.getLastRow();
    var rateHistoryStartRow = -1;
    var searchRange = sheet.getRange('A1:A' + lastRow).getValues();
    
    for (var i = 0; i < searchRange.length; i++) {
      if (searchRange[i][0] && searchRange[i][0].toString().toUpperCase().includes('RATE HISTORY')) {
        rateHistoryStartRow = i + 2;
        break;
      }
    }
    
    // If no Rate History section, create one
    if (rateHistoryStartRow === -1) {
      var newSectionRow = lastRow + 3;
      sheet.getRange(newSectionRow, 1).setValue('RATE HISTORY');
      sheet.getRange(newSectionRow, 1).setFontWeight('bold').setBackground('#1a365d').setFontColor('white');
      sheet.getRange(newSectionRow + 1, 1, 1, 4).setValues([['Employee', 'Hourly Rate', 'Effective Date', 'Notes']]);
      sheet.getRange(newSectionRow + 1, 1, 1, 4).setFontWeight('bold');
      rateHistoryStartRow = newSectionRow + 2;
    }
    
    // Find next empty row in rate history
    var historyData = sheet.getRange(rateHistoryStartRow, 1, 100, 1).getValues();
    var insertRow = rateHistoryStartRow;
    for (var i = 0; i < historyData.length; i++) {
      if (!historyData[i][0] || historyData[i][0].toString().trim() === '') {
        insertRow = rateHistoryStartRow + i;
        break;
      }
      insertRow = rateHistoryStartRow + i + 1;
    }
    
    // Insert the new rate entry
    var effDate = effectiveDate ? new Date(effectiveDate) : new Date();
    sheet.getRange(insertRow, 1, 1, 4).setValues([[
      employeeName,
      newRate,
      effDate,
      notes || ''
    ]]);
    
    // Format the row
    sheet.getRange(insertRow, 2).setNumberFormat('$#,##0.00');
    sheet.getRange(insertRow, 3).setNumberFormat('mm/dd/yyyy');
    
    Logger.log('Added rate history: ' + employeeName + ' @ $' + newRate + ' effective ' + effDate);
    
    return serializeForHtml({
      success: true,
      message: 'Rate history updated for ' + employeeName,
      employee: employeeName,
      newRate: newRate,
      effectiveDate: effDate
    });
    
  } catch (e) {
    Logger.log('Error adding rate history: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: LABOR LOGGING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Log brew labor for a batch
 * Called from Brewer's Sheet when brew is finalized
 * 
 * @param {string} batchNumber - Batch number
 * @param {string} employeeName - Brewer's name
 * @param {number} hours - Hours worked on this brew
 * @param {Date|string} workDate - Date the work was performed (optional, defaults to today)
 * @returns {Object} { success, laborCost, hours, message }
 */
function logBrewLabor(batchNumber, employeeName, hours, workDate) {
  try {
    if (!batchNumber || !employeeName || !hours) {
      return { success: false, error: 'Batch number, employee name, and hours are required' };
    }
    
    var hoursWorked = parseFloat(hours) || 0;
    if (hoursWorked <= 0) {
      return { success: false, error: 'Hours must be greater than 0' };
    }
    
    var date = workDate ? new Date(workDate) : new Date();
    
    // Get the rate in effect on the work date (SERVER-SIDE ONLY)
    var hourlyRate = getEmployeeRateOnDate(employeeName, date);
    var laborCost = hoursWorked * hourlyRate;
    
    // Update Batch Log
    var ss = getBrmSpreadsheet();
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    if (!batchSheet) {
      return { success: false, error: 'Batch Log sheet not found' };
    }
    
    // Find the batch row (data starts at row 9, headers at row 9)
    var data = batchSheet.getDataRange().getValues();
    var batchRow = -1;
    var headerRow = -1;
    
    // Find header row
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().includes('Batch #')) {
        headerRow = i;
        break;
      }
    }
    
    if (headerRow === -1) {
      return { success: false, error: 'Could not find Batch Log headers' };
    }
    
    // Find batch row
    for (var i = headerRow + 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === batchNumber) {
        batchRow = i + 1; // Convert to 1-indexed
        break;
      }
    }
    
    if (batchRow === -1) {
      return { success: false, error: 'Batch not found: ' + batchNumber };
    }
    
    // Column mapping based on Batch Log structure:
    // F (6) = Labor Hrs, G (7) = Labor $
    // We need to find or add Brewer column as well
    var headers = data[headerRow];
    var laborHrsCol = 6;  // Column F
    var laborCostCol = 7; // Column G
    
    // Find Brewer column or use a notes approach
    var brewerCol = -1;
    for (var i = 0; i < headers.length; i++) {
      if (headers[i] && headers[i].toString().toLowerCase().includes('brewer')) {
        brewerCol = i + 1;
        break;
      }
    }
    
    // Update Labor Hrs and Labor $
    var existingHours = parseFloat(batchSheet.getRange(batchRow, laborHrsCol).getValue()) || 0;
    var existingCost = parseFloat(batchSheet.getRange(batchRow, laborCostCol).getValue()) || 0;
    
    batchSheet.getRange(batchRow, laborHrsCol).setValue(existingHours + hoursWorked);
    batchSheet.getRange(batchRow, laborCostCol).setValue(existingCost + laborCost);
    
    // Update brewer name if column exists
    // Only update if it doesn't already contain this brewer (to preserve Turn 1 / Turn 2 format)
    if (brewerCol > 0) {
      var existingBrewers = batchSheet.getRange(batchRow, brewerCol).getValue() || '';
      if (!existingBrewers.toString().includes(employeeName)) {
        // If format is "Turn 1 / Turn 2", preserve it; otherwise append
        if (existingBrewers.toString().indexOf(' / ') !== -1) {
          // Already has Turn format, don't modify
        } else {
          var newBrewers = existingBrewers ? existingBrewers + ', ' + employeeName : employeeName;
          batchSheet.getRange(batchRow, brewerCol).setValue(newBrewers);
        }
      }
    }
    
    // Recalculate Total Cost (column I = 9)
    // Total Cost = Recipe Cost + Labor $ + Overhead
    var recipeCost = parseFloat(batchSheet.getRange(batchRow, 5).getValue()) || 0;  // E = Recipe Cost
    var newLaborCost = existingCost + laborCost;
    var overhead = parseFloat(batchSheet.getRange(batchRow, 8).getValue()) || 0;    // H = Overhead
    var totalCost = recipeCost + newLaborCost + overhead;
    batchSheet.getRange(batchRow, 9).setValue(totalCost); // I = Total Cost
    
    // Log to Batch Details
    addBatchEntry(batchNumber, 'Labor', {
      description: 'Brew labor: ' + employeeName,
      value: hoursWorked,
      units: 'hours',
      cost: laborCost,
      notes: 'Rate: $' + hourlyRate.toFixed(2) + '/hr on ' + Utilities.formatDate(date, Session.getScriptTimeZone(), 'MM/dd/yyyy')
    });
    
    // Update YTD labor tracking
    updateLaborYTD(employeeName, hoursWorked, laborCost, 'Brew');
    
    Logger.log('Brew labor logged: ' + batchNumber + ' - ' + employeeName + ' - ' + hoursWorked + ' hrs = $' + laborCost.toFixed(2));
    
    // Return success WITHOUT the rate (only hours visible to frontend)
    return serializeForHtml({
      success: true,
      batchNumber: batchNumber,
      employee: employeeName,
      hours: hoursWorked,
      laborCost: laborCost, // This is OK to return for confirmation, just not the rate
      message: employeeName + ': ' + hoursWorked + ' hours logged'
    });
    
  } catch (e) {
    Logger.log('Error logging brew labor: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * Log cellar task labor for a batch
 * Called when completing cellar tasks (dry hop, transfer, QA, etc.)
 * 
 * @param {string} batchNumber - Batch number
 * @param {string} employeeName - Worker's name
 * @param {number} hours - Hours to complete the task
 * @param {string} taskType - Type of task (Dry Hop, Transfer, QA, etc.)
 * @param {Date|string} workDate - Date the work was performed
 * @returns {Object} { success, laborCost, hours, message }
 */
function logCellarLabor(batchNumber, employeeName, hours, taskType, workDate) {
  try {
    if (!batchNumber || !employeeName || !hours) {
      return { success: false, error: 'Batch number, employee name, and hours are required' };
    }
    
    var hoursWorked = parseFloat(hours) || 0;
    if (hoursWorked <= 0) {
      return { success: false, error: 'Hours must be greater than 0' };
    }
    
    var date = workDate ? new Date(workDate) : new Date();
    var task = taskType || 'Cellar Task';
    
    // Get the rate in effect on the work date
    var hourlyRate = getEmployeeRateOnDate(employeeName, date);
    var laborCost = hoursWorked * hourlyRate;
    
    // Update Batch Log
    var ss = getBrmSpreadsheet();
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    if (!batchSheet) {
      return { success: false, error: 'Batch Log sheet not found' };
    }
    
    // Find batch row
    var data = batchSheet.getDataRange().getValues();
    var batchRow = -1;
    var headerRow = -1;
    
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().includes('Batch #')) {
        headerRow = i;
        break;
      }
    }
    
    for (var i = headerRow + 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === batchNumber) {
        batchRow = i + 1;
        break;
      }
    }
    
    if (batchRow === -1) {
      return { success: false, error: 'Batch not found: ' + batchNumber };
    }
    
    // Accumulate to Labor Hrs (F) and Labor $ (G)
    var laborHrsCol = 6;
    var laborCostCol = 7;
    
    var existingHours = parseFloat(batchSheet.getRange(batchRow, laborHrsCol).getValue()) || 0;
    var existingCost = parseFloat(batchSheet.getRange(batchRow, laborCostCol).getValue()) || 0;
    
    batchSheet.getRange(batchRow, laborHrsCol).setValue(existingHours + hoursWorked);
    batchSheet.getRange(batchRow, laborCostCol).setValue(existingCost + laborCost);
    
    // Recalculate Total Cost
    var recipeCost = parseFloat(batchSheet.getRange(batchRow, 5).getValue()) || 0;
    var newLaborCost = existingCost + laborCost;
    var overhead = parseFloat(batchSheet.getRange(batchRow, 8).getValue()) || 0;
    var totalCost = recipeCost + newLaborCost + overhead;
    batchSheet.getRange(batchRow, 9).setValue(totalCost);
    
    // Log to Batch Details
    addBatchEntry(batchNumber, 'Labor', {
      description: task + ' labor: ' + employeeName,
      value: hoursWorked,
      units: 'hours',
      cost: laborCost,
      notes: task + ' - ' + Utilities.formatDate(date, Session.getScriptTimeZone(), 'MM/dd/yyyy')
    });
    
    // Update YTD labor tracking
    updateLaborYTD(employeeName, hoursWorked, laborCost, 'Cellar');
    
    Logger.log('Cellar labor logged: ' + batchNumber + ' - ' + task + ' - ' + employeeName + ' - ' + hoursWorked + ' hrs = $' + laborCost.toFixed(2));
    
    return serializeForHtml({
      success: true,
      batchNumber: batchNumber,
      employee: employeeName,
      taskType: task,
      hours: hoursWorked,
      laborCost: laborCost,
      message: task + ': ' + employeeName + ' - ' + hoursWorked + ' hours logged'
    });
    
  } catch (e) {
    Logger.log('Error logging cellar labor: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * Log packaging labor for a batch
 * Called during SEND IT when batch is packaged
 * 
 * @param {string} batchNumber - Batch number
 * @param {string} employeeName - Packager's name
 * @param {number} hours - Hours spent packaging
 * @param {Date|string} workDate - Date the work was performed
 * @returns {Object} { success, laborCost, hours, message }
 */
function logPackagingLabor(batchNumber, employeeName, hours, workDate) {
  try {
    if (!batchNumber || !employeeName || !hours) {
      return { success: false, error: 'Batch number, employee name, and hours are required' };
    }
    
    var hoursWorked = parseFloat(hours) || 0;
    if (hoursWorked <= 0) {
      return { success: false, error: 'Hours must be greater than 0' };
    }
    
    var date = workDate ? new Date(workDate) : new Date();
    
    // Get the rate in effect on the work date
    var hourlyRate = getEmployeeRateOnDate(employeeName, date);
    var laborCost = hoursWorked * hourlyRate;
    
    // Update Batch Log
    var ss = getBrmSpreadsheet();
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    if (!batchSheet) {
      return { success: false, error: 'Batch Log sheet not found' };
    }
    
    // Find batch row
    var data = batchSheet.getDataRange().getValues();
    var batchRow = -1;
    var headerRow = -1;
    
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().includes('Batch #')) {
        headerRow = i;
        break;
      }
    }
    
    for (var i = headerRow + 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === batchNumber) {
        batchRow = i + 1;
        break;
      }
    }
    
    if (batchRow === -1) {
      return { success: false, error: 'Batch not found: ' + batchNumber };
    }
    
    // Accumulate to Labor Hrs and Labor $
    var laborHrsCol = 6;
    var laborCostCol = 7;
    
    var existingHours = parseFloat(batchSheet.getRange(batchRow, laborHrsCol).getValue()) || 0;
    var existingCost = parseFloat(batchSheet.getRange(batchRow, laborCostCol).getValue()) || 0;
    
    batchSheet.getRange(batchRow, laborHrsCol).setValue(existingHours + hoursWorked);
    batchSheet.getRange(batchRow, laborCostCol).setValue(existingCost + laborCost);
    
    // Recalculate Total Cost
    var recipeCost = parseFloat(batchSheet.getRange(batchRow, 5).getValue()) || 0;
    var newLaborCost = existingCost + laborCost;
    var overhead = parseFloat(batchSheet.getRange(batchRow, 8).getValue()) || 0;
    var totalCost = recipeCost + newLaborCost + overhead;
    batchSheet.getRange(batchRow, 9).setValue(totalCost);
    
    // Log to Batch Details
    addBatchEntry(batchNumber, 'Labor', {
      description: 'Packaging labor: ' + employeeName,
      value: hoursWorked,
      units: 'hours',
      cost: laborCost,
      notes: 'Packaging - ' + Utilities.formatDate(date, Session.getScriptTimeZone(), 'MM/dd/yyyy')
    });
    
    // Update YTD labor tracking
    updateLaborYTD(employeeName, hoursWorked, laborCost, 'Packaging');
    
    Logger.log('Packaging labor logged: ' + batchNumber + ' - ' + employeeName + ' - ' + hoursWorked + ' hrs = $' + laborCost.toFixed(2));
    
    return serializeForHtml({
      success: true,
      batchNumber: batchNumber,
      employee: employeeName,
      hours: hoursWorked,
      laborCost: laborCost,
      message: 'Packaging: ' + employeeName + ' - ' + hoursWorked + ' hours logged'
    });
    
  } catch (e) {
    Logger.log('Error logging packaging labor: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: YTD LABOR TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Update YTD labor totals in Labor Config
 * Called automatically when labor is logged
 * 
 * @param {string} employeeName - Employee name
 * @param {number} hours - Hours worked
 * @param {number} cost - Labor cost
 * @param {string} laborType - 'Brew', 'Cellar', or 'Packaging'
 */
function updateLaborYTD(employeeName, hours, cost, laborType) {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.LABOR_CONFIG);
    
    if (!sheet) return;
    
    // Find YTD ACTUAL section or create it
    var lastRow = sheet.getLastRow();
    var ytdSectionRow = -1;
    var searchRange = sheet.getRange('A1:A' + lastRow).getValues();
    
    for (var i = 0; i < searchRange.length; i++) {
      if (searchRange[i][0] && searchRange[i][0].toString().toUpperCase().includes('YTD ACTUAL')) {
        ytdSectionRow = i + 1;
        break;
      }
    }
    
    // If no YTD section exists, we'll create one
    if (ytdSectionRow === -1) {
      // Find Rate History section (should be after it) or end of content
      var insertAfterRow = 46; // Default position after existing content
      
      for (var i = 0; i < searchRange.length; i++) {
        if (searchRange[i][0] && searchRange[i][0].toString().toUpperCase().includes('RATE HISTORY')) {
          insertAfterRow = i - 2; // Insert before Rate History
          break;
        }
      }
      
      // Create YTD section
      sheet.getRange(insertAfterRow, 1).setValue('YTD ACTUAL LABOR');
      sheet.getRange(insertAfterRow, 1).setFontWeight('bold').setBackground('#2d5016').setFontColor('white');
      sheet.getRange(insertAfterRow + 1, 1, 1, 5).setValues([['Employee', 'YTD Hours', 'YTD Cost', 'Brew $', 'Cellar/Pkg $']]);
      sheet.getRange(insertAfterRow + 1, 1, 1, 5).setFontWeight('bold');
      ytdSectionRow = insertAfterRow + 2;
      
      // Initialize rows for each employee
      var employees = Object.keys(DEFAULT_EMPLOYEE_RATES);
      for (var i = 0; i < employees.length; i++) {
        sheet.getRange(ytdSectionRow + i, 1, 1, 5).setValues([[employees[i], 0, 0, 0, 0]]);
      }
      
      // Add totals row
      var totalsRow = ytdSectionRow + employees.length;
      sheet.getRange(totalsRow, 1).setValue('TOTAL YTD');
      sheet.getRange(totalsRow, 1).setFontWeight('bold');
      sheet.getRange(totalsRow, 2).setFormula('=SUM(B' + ytdSectionRow + ':B' + (totalsRow - 1) + ')');
      sheet.getRange(totalsRow, 3).setFormula('=SUM(C' + ytdSectionRow + ':C' + (totalsRow - 1) + ')');
    }
    
    // Find the employee's row in YTD section
    var ytdData = sheet.getRange(ytdSectionRow, 1, 10, 5).getValues();
    var employeeRow = -1;
    
    for (var i = 0; i < ytdData.length; i++) {
      if (ytdData[i][0] && ytdData[i][0].toString().toLowerCase() === employeeName.toLowerCase()) {
        employeeRow = ytdSectionRow + i;
        break;
      }
    }
    
    if (employeeRow === -1) {
      // Add new employee row
      for (var i = 0; i < ytdData.length; i++) {
        if (!ytdData[i][0] || ytdData[i][0].toString().trim() === '' || ytdData[i][0].toString().includes('TOTAL')) {
          employeeRow = ytdSectionRow + i;
          sheet.insertRowBefore(employeeRow);
          sheet.getRange(employeeRow, 1, 1, 5).setValues([[employeeName, 0, 0, 0, 0]]);
          break;
        }
      }
    }
    
    if (employeeRow > 0) {
      // Update totals
      var currentHours = parseFloat(sheet.getRange(employeeRow, 2).getValue()) || 0;
      var currentCost = parseFloat(sheet.getRange(employeeRow, 3).getValue()) || 0;
      var currentBrew = parseFloat(sheet.getRange(employeeRow, 4).getValue()) || 0;
      var currentCellarPkg = parseFloat(sheet.getRange(employeeRow, 5).getValue()) || 0;
      
      sheet.getRange(employeeRow, 2).setValue(currentHours + hours);
      sheet.getRange(employeeRow, 3).setValue(currentCost + cost);
      
      if (laborType === 'Brew') {
        sheet.getRange(employeeRow, 4).setValue(currentBrew + cost);
      } else {
        sheet.getRange(employeeRow, 5).setValue(currentCellarPkg + cost);
      }
      
      // Format as currency
      sheet.getRange(employeeRow, 3, 1, 3).setNumberFormat('$#,##0.00');
    }
    
  } catch (e) {
    Logger.log('Error updating YTD labor: ' + e.toString());
  }
}

/**
 * Get YTD labor summary for dashboard/reporting
 */
function getLaborYTDSummary() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.LABOR_CONFIG);
    
    if (!sheet) {
      return { success: false, error: 'Labor Config not found' };
    }
    
    // Get expected annual from Labor Config (B28 = Total Brewing Labor)
    var expectedAnnual = parseFloat(sheet.getRange('B28').getValue()) || 296192;
    var expectedBBL = parseFloat(sheet.getRange('B4').getValue()) || 3800;
    var expectedPerBBL = expectedAnnual / expectedBBL;
    
    // Find YTD section
    var lastRow = sheet.getLastRow();
    var ytdSectionRow = -1;
    var searchRange = sheet.getRange('A1:A' + lastRow).getValues();
    
    for (var i = 0; i < searchRange.length; i++) {
      if (searchRange[i][0] && searchRange[i][0].toString().toUpperCase().includes('YTD ACTUAL')) {
        ytdSectionRow = i + 2; // Skip header
        break;
      }
    }
    
    var ytdTotal = 0;
    var ytdHours = 0;
    var byEmployee = [];
    
    if (ytdSectionRow > 0) {
      var ytdData = sheet.getRange(ytdSectionRow, 1, 10, 5).getValues();
      
      for (var i = 0; i < ytdData.length; i++) {
        var name = ytdData[i][0];
        if (name && name !== '' && !name.toString().includes('TOTAL')) {
          var empHours = parseFloat(ytdData[i][1]) || 0;
          var empCost = parseFloat(ytdData[i][2]) || 0;
          
          ytdHours += empHours;
          ytdTotal += empCost;
          
          byEmployee.push({
            name: name,
            hours: empHours,
            cost: empCost
          });
        } else if (name && name.toString().includes('TOTAL')) {
          ytdTotal = parseFloat(ytdData[i][2]) || ytdTotal;
          ytdHours = parseFloat(ytdData[i][1]) || ytdHours;
          break;
        }
      }
    }
    
    // Calculate actual per BBL (need YTD BBL from somewhere - use batch count × avg batch size)
    var batchesResult = getBatchesData({});
    var ytdBBL = 0;
    if (batchesResult.success && batchesResult.batches) {
      batchesResult.batches.forEach(function(b) {
        if (b.status === 'Packaged') {
          ytdBBL += parseFloat(b.actualYield || b.batchSize) || 0;
        }
      });
    }
    
    var actualPerBBL = ytdBBL > 0 ? ytdTotal / ytdBBL : 0;
    
    return serializeForHtml({
      success: true,
      expected: {
        annual: expectedAnnual,
        perBBL: expectedPerBBL
      },
      actual: {
        ytdTotal: ytdTotal,
        ytdHours: ytdHours,
        ytdBBL: ytdBBL,
        perBBL: actualPerBBL
      },
      variance: {
        perBBL: actualPerBBL - expectedPerBBL,
        percentage: expectedPerBBL > 0 ? ((actualPerBBL - expectedPerBBL) / expectedPerBBL * 100) : 0
      },
      byEmployee: byEmployee
    });
    
  } catch (e) {
    Logger.log('Error getting YTD summary: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: BATCH LABOR TOTAL FOR COGS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get total labor cost for a batch (for COGS calculation)
 * This pulls from actual logged labor, not the flat rate
 * 
 * @param {string} batchNumber - Batch number
 * @returns {Object} { success, totalLabor, totalHours }
 */
function getActualBatchLabor(batchNumber) {
  try {
    var ss = getBrmSpreadsheet();
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    if (!batchSheet) {
      return { success: false, error: 'Batch Log not found' };
    }
    
    var data = batchSheet.getDataRange().getValues();
    var headerRow = -1;
    
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().includes('Batch #')) {
        headerRow = i;
        break;
      }
    }
    
    for (var i = headerRow + 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === batchNumber) {
        var laborHrs = parseFloat(data[i][5]) || 0;  // F = Labor Hrs (0-indexed: 5)
        var laborCost = parseFloat(data[i][6]) || 0; // G = Labor $ (0-indexed: 6)
        
        return serializeForHtml({
          success: true,
          batchNumber: batchNumber,
          totalHours: laborHrs,
          totalLabor: laborCost
        });
      }
    }
    
    return { success: false, error: 'Batch not found' };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: INITIALIZE RATE HISTORY
// Run this once to set up initial rates for 1/1/2026
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Initialize rate history with starting rates
 * Run this once at the beginning of the year
 */
function initializeRateHistory() {
  try {
    var startDate = new Date('2026-01-01');
    
    // Add starting rates for each employee
    addRateHistoryEntry('Richard Mar', 37.50, startDate, 'Starting rate - $78K/2080');
    addRateHistoryEntry('Alex Velasco', 31.25, startDate, 'Starting rate - $65K/2080');
    addRateHistoryEntry('Jeremy Ueberroth', 26.50, startDate, 'Starting rate');
    addRateHistoryEntry('Zach Schneider', 27.15, startDate, 'Starting rate');
    addRateHistoryEntry('Dwayne Klaus', 20.00, startDate, 'Starting rate');
    
    return { success: true, message: 'Rate history initialized for 2026' };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Example: Add a raise for an employee
 * Call this when someone gets a raise
 * 
 * Usage: addEmployeeRaise('Richard Mar', 40.00, '2026-07-01', 'Annual raise')
 */
function addEmployeeRaise(employeeName, newHourlyRate, effectiveDate, notes) {
  return addRateHistoryEntry(employeeName, newHourlyRate, effectiveDate, notes);
}
// ═══════════════════════════════════════════════════════════════════════════════
// RED LEG BREWING - COGS INTEGRATION WITH ACTUAL LABOR
// These functions ensure Beer COGS Master uses actual labor costs
// and flows correctly to Floor Pricing and Fully Loaded Pricing
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Update Beer COGS Master with ACTUAL labor costs from Batch Log
 * This replaces the flat $3,897 with actual averaged labor per beer
 * 
 * Called after each batch is completed (SEND IT)
 * Also can be run manually to recalculate all COGS
 */
function updateBeerCOGSMasterWithActualLabor() {
  try {
    var ss = getBrmSpreadsheet();
    var cogsSheet = ss.getSheetByName(SHEETS.BEER_COGS_MASTER);
    var batchSheet = ss.getSheetByName(SHEETS.BATCH_LOG);
    
    if (!cogsSheet || !batchSheet) {
      return { success: false, error: 'Required sheets not found' };
    }
    
    // Get all packaged batches with actual labor
    var batchData = batchSheet.getDataRange().getValues();
    var headerRow = -1;
    
    for (var i = 0; i < batchData.length; i++) {
      if (batchData[i][0] && batchData[i][0].toString().includes('Batch #')) {
        headerRow = i;
        break;
      }
    }
    
    if (headerRow === -1) {
      return { success: false, error: 'Batch Log header not found' };
    }
    
    // Build labor averages by beer type
    var beerLaborData = {};
    
    for (var i = headerRow + 1; i < batchData.length; i++) {
      var row = batchData[i];
      var batchNum = row[0];
      var beerName = row[2];  // C = Beer Name
      var status = row[10];   // K = Status
      
      if (!batchNum || !beerName) continue;
      
      // Only include packaged batches
      if (status && status.toString().toLowerCase() === 'packaged') {
        var laborHrs = parseFloat(row[5]) || 0;   // F = Labor Hrs
        var laborCost = parseFloat(row[6]) || 0;  // G = Labor $
        var actualYield = parseFloat(row[12]) || parseFloat(row[3]) || 60; // M = Act Yield or D = Size
        
        if (!beerLaborData[beerName]) {
          beerLaborData[beerName] = {
            totalLabor: 0,
            totalHours: 0,
            totalYield: 0,
            batchCount: 0
          };
        }
        
        beerLaborData[beerName].totalLabor += laborCost;
        beerLaborData[beerName].totalHours += laborHrs;
        beerLaborData[beerName].totalYield += actualYield;
        beerLaborData[beerName].batchCount += 1;
      }
    }
    
    // Get default labor from Labor Config (for beers with no batches yet)
    var laborResult = getLaborCostPerBatch();
    var defaultLaborPerBatch = laborResult.totalLabor || 3897.26;
    
    // Update COGS sheet
    var cogsData = cogsSheet.getDataRange().getValues();
    var updatedCount = 0;
    
    // Find column indices (header row is typically row 1)
    var headers = cogsData[0];
    var beerNameCol = 0;
    var brewingLaborCol = -1;
    var totalCogsCol = -1;
    var cogsPerBblCol = -1;
    var expectedYieldCol = -1;
    var ingredientCogsCol = -1;
    var packagingLaborCol = -1;
    
    for (var i = 0; i < headers.length; i++) {
      var h = (headers[i] || '').toString().toLowerCase();
      if (h.includes('brewing labor')) brewingLaborCol = i;
      if (h.includes('total cogs') && !h.includes('per')) totalCogsCol = i;
      if (h.includes('cogs per bbl') || h.includes('per bbl')) cogsPerBblCol = i;
      if (h.includes('expected yield')) expectedYieldCol = i;
      if (h.includes('ingredient')) ingredientCogsCol = i;
      if (h.includes('packaging labor')) packagingLaborCol = i;
    }
    
    // Update each beer row
    for (var i = 1; i < cogsData.length; i++) {
      var beerName = cogsData[i][beerNameCol];
      if (!beerName || beerName.toString().trim() === '') continue;
      
      var actualData = beerLaborData[beerName];
      var laborPerBatch;
      
      if (actualData && actualData.batchCount > 0) {
        // Use actual average labor
        laborPerBatch = actualData.totalLabor / actualData.batchCount;
      } else {
        // Use default from Labor Config
        laborPerBatch = defaultLaborPerBatch;
      }
      
      // Update Brewing Labor column
      if (brewingLaborCol >= 0) {
        cogsSheet.getRange(i + 1, brewingLaborCol + 1).setValue(laborPerBatch);
        updatedCount++;
      }
      
      // Recalculate Total COGS and COGS/BBL if we have the columns
      if (totalCogsCol >= 0 && ingredientCogsCol >= 0) {
        var ingredientCogs = parseFloat(cogsData[i][ingredientCogsCol]) || 0;
        var packagingLabor = packagingLaborCol >= 0 ? (parseFloat(cogsData[i][packagingLaborCol]) || 0) : 0;
        var newTotalCogs = ingredientCogs + laborPerBatch + packagingLabor;
        cogsSheet.getRange(i + 1, totalCogsCol + 1).setValue(newTotalCogs);
        
        if (cogsPerBblCol >= 0 && expectedYieldCol >= 0) {
          var expectedYield = parseFloat(cogsData[i][expectedYieldCol]) || 57; // Default 95% of 60 BBL
          var cogsPerBbl = expectedYield > 0 ? newTotalCogs / expectedYield : 0;
          cogsSheet.getRange(i + 1, cogsPerBblCol + 1).setValue(cogsPerBbl);
        }
      }
    }
    
    // Update timestamp
    var lastCol = cogsSheet.getLastColumn();
    for (var i = 0; i < headers.length; i++) {
      if ((headers[i] || '').toString().toLowerCase().includes('updated')) {
        for (var j = 1; j < cogsData.length; j++) {
          if (cogsData[j][beerNameCol]) {
            cogsSheet.getRange(j + 1, i + 1).setValue(new Date());
          }
        }
        break;
      }
    }
    
    Logger.log('Updated Beer COGS Master with actual labor for ' + updatedCount + ' beers');
    
    // Trigger downstream updates
    updateFloorPricingLabor();
    updateFullyLoadedPricingLabor();
    
    return serializeForHtml({
      success: true,
      message: 'COGS updated with actual labor',
      beersUpdated: updatedCount,
      beerLaborData: beerLaborData
    });
    
  } catch (e) {
    Logger.log('Error updating COGS with actual labor: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * Update Floor Pricing (Taproom) with actual labor per BBL
 * Floor Pricing uses 50% of brewing labor
 */
function updateFloorPricingLabor() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.FLOOR_PRICING);
    
    if (!sheet) {
      Logger.log('Floor Pricing sheet not found');
      return;
    }
    
    // Get actual labor per BBL from Labor Config or calculate from YTD
    var laborYTD = getLaborYTDSummary();
    var laborPerBBL;
    
    if (laborYTD.success && laborYTD.actual.perBBL > 0) {
      // Use actual YTD labor per BBL
      laborPerBBL = laborYTD.actual.perBBL;
    } else {
      // Fall back to expected
      var laborConfig = getLaborCostPerBatch();
      laborPerBBL = laborConfig.laborPerBBL || 77.95;
    }
    
    // Floor Pricing uses 50% of labor
    var halfLaborPerBBL = laborPerBBL * 0.5;
    
    // Update cell B7 (50% Labor $/BBL)
    sheet.getRange('B7').setValue(halfLaborPerBBL);
    
    Logger.log('Updated Floor Pricing labor: $' + halfLaborPerBBL.toFixed(2) + '/BBL (50%)');
    
  } catch (e) {
    Logger.log('Error updating Floor Pricing labor: ' + e.toString());
  }
}

/**
 * Update Fully Loaded Pricing (B2B) with actual labor per BBL
 * Fully Loaded uses 50% of brewing labor + Sales Overhead
 */
function updateFullyLoadedPricingLabor() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.FULLY_LOADED_PRICING);
    
    if (!sheet) {
      Logger.log('Fully Loaded Pricing sheet not found');
      return;
    }
    
    // Get actual labor per BBL
    var laborYTD = getLaborYTDSummary();
    var laborPerBBL;
    
    if (laborYTD.success && laborYTD.actual.perBBL > 0) {
      laborPerBBL = laborYTD.actual.perBBL;
    } else {
      var laborConfig = getLaborCostPerBatch();
      laborPerBBL = laborConfig.laborPerBBL || 77.95;
    }
    
    var halfLaborPerBBL = laborPerBBL * 0.5;
    
    // Update cell B4 (50% Labor $/BBL)
    sheet.getRange('B4').setValue(halfLaborPerBBL);
    
    Logger.log('Updated Fully Loaded Pricing labor: $' + halfLaborPerBBL.toFixed(2) + '/BBL (50%)');
    
  } catch (e) {
    Logger.log('Error updating Fully Loaded Pricing labor: ' + e.toString());
  }
}

/**
 * Get labor variance report for dashboard
 * Compares expected vs actual labor costs
 */
function getLaborVarianceReport() {
  try {
    var ss = getBrmSpreadsheet();
    var laborConfigSheet = ss.getSheetByName(SHEETS.LABOR_CONFIG);
    
    if (!laborConfigSheet) {
      return { success: false, error: 'Labor Config not found' };
    }
    
    // Get expected values from Labor Config
    var expectedAnnual = parseFloat(laborConfigSheet.getRange('B28').getValue()) || 296192;
    var expectedBBL = parseFloat(laborConfigSheet.getRange('B4').getValue()) || 3800;
    var expectedBatches = parseFloat(laborConfigSheet.getRange('B6').getValue()) || 76;
    var expectedPerBatch = expectedAnnual / expectedBatches;
    var expectedPerBBL = expectedAnnual / expectedBBL;
    
    // Get YTD actual
    var ytdSummary = getLaborYTDSummary();
    
    // Calculate where we should be YTD (prorated)
    var now = new Date();
    var startOfYear = new Date(now.getFullYear(), 0, 1);
    var dayOfYear = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
    var yearProgress = dayOfYear / 365;
    
    var expectedYTD = expectedAnnual * yearProgress;
    var expectedYTDBBL = expectedBBL * yearProgress;
    
    var actualYTD = ytdSummary.success ? ytdSummary.actual.ytdTotal : 0;
    var actualYTDBBL = ytdSummary.success ? ytdSummary.actual.ytdBBL : 0;
    
    var varianceYTD = actualYTD - expectedYTD;
    var variancePerBBL = ytdSummary.success && ytdSummary.actual.perBBL > 0 
      ? ytdSummary.actual.perBBL - expectedPerBBL 
      : 0;
    
    return serializeForHtml({
      success: true,
      expected: {
        annual: expectedAnnual,
        perBatch: expectedPerBatch,
        perBBL: expectedPerBBL,
        ytdTarget: expectedYTD,
        ytdBBLTarget: expectedYTDBBL
      },
      actual: {
        ytdTotal: actualYTD,
        ytdBBL: actualYTDBBL,
        perBBL: ytdSummary.success ? ytdSummary.actual.perBBL : 0
      },
      variance: {
        ytdDollars: varianceYTD,
        perBBL: variancePerBBL,
        percentageOfTarget: expectedYTD > 0 ? (varianceYTD / expectedYTD * 100) : 0
      },
      yearProgress: Math.round(yearProgress * 100),
      status: varianceYTD > 0 ? 'OVER' : (varianceYTD < -1000 ? 'UNDER' : 'ON TRACK')
    });
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * TRIGGER: Auto-update COGS after SEND IT
 * Modify sendItComplete to call this automatically
 */
function onBatchComplete(batchNumber) {
  try {
    // Update Beer COGS Master with new actual labor data
    updateBeerCOGSMasterWithActualLabor();
    
    // The pricing sheets are updated automatically via the COGS update
    Logger.log('Post-SEND IT updates completed for batch ' + batchNumber);
    
  } catch (e) {
    Logger.log('Error in post-batch updates: ' + e.toString());
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRATION NOTES FOR TODD
// ═══════════════════════════════════════════════════════════════════════════════
/*

INTEGRATION STEPS:
==================

1. ADD CODE TO BRM Code.gs:
   - Copy all contents from BRM_Labor_Code_Additions.gs
   - Paste at the end of your existing Code.gs (after line 12103)
   - This adds the rate history system and labor logging functions

2. ADD HTML TO BRM_UI:
   - Copy all contents from BRM_Labor_HTML_Additions.html
   - Add the <style> section to your existing <style> area
   - Add the <script> section to your existing <script> area
   - This updates the modals to include worker/hours fields

3. INITIALIZE RATE HISTORY:
   - Run initializeRateHistory() once to set up starting rates for 1/1/2026
   - This creates the Rate History section in Labor Config

4. MODIFY SEND IT TO TRIGGER COGS UPDATE:
   - In the existing sendItComplete() function, add this at the end:
     // Update COGS with actual labor onBatchComplete(batchNumber);
   - This ensures COGS and pricing are updated after each batch

5. TEST THE FLOW:
   a. Go to Recipes → Pick a recipe → Brew This
   b. In Brewer's Sheet, select Brewer and enter Hours
   c. Click START BREW
   d. Do cellar tasks (each prompts for worker + hours)
   e. Package the batch (prompts for packager + hours)
   f. Check Beer COGS Master - should show actual labor
   g. Check Floor Pricing & Fully Loaded - should reflect actual labor/BBL

WHEN AN EMPLOYEE GETS A RAISE:
=============================
Call: addEmployeeRaise('Richard Mar', 40.00, '2026-07-01', 'Annual raise')

This adds to Rate History. All tasks logged after 7/1/2026 will use $40/hr.
Tasks logged before still use the old rate.

IMPORTANT NOTES:
================
- RATES ARE NEVER SHOWN IN THE UI - only names
- Hours × Rate calculation happens SERVER-SIDE ONLY
- Beer COGS Master shows actual labor (averaged across batches of same beer)
- Floor Pricing uses 50% of Labor/BBL
- Fully Loaded uses 50% of Labor/BBL + Sales Overhead
- All flows back to FCCR Command Center through the pricing formulas

*/
// ═══════════════════════════════════════════════════════════════════════════════
// RED LEG BREWING - STANDARD LABOR BASELINE
// Default labor allocation per batch until actual hours are logged
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * STANDARD LABOR ALLOCATION PER BATCH
 * 
 * Brew:      2 brewers × 8 hours = 16 hours
 *            Richard (8 × $37.50) + Alex (8 × $31.25) = $550.00
 * 
 * Cellar:    1 cellarman × 8 hours = 8 hours
 *            8 × $24.55 (avg cellar rate) = $196.40
 * 
 * Packaging: 2 cellarmen × 8 hours = 16 hours  
 *            16 × $24.55 (avg cellar rate) = $392.80
 * 
 * TOTAL:     40 hours, $1,139.20 per batch
 */

var STANDARD_LABOR = {
  brew: {
    workers: 2,
    hoursEach: 8,
    totalHours: 16,
    // Both brewers work together
    cost: (8 * 37.50) + (8 * 31.25)  // $550.00
  },
  cellar: {
    workers: 1,
    hoursEach: 8,
    totalHours: 8,
    avgRate: 24.55,  // Average of Jeremy/Zach/Dwayne: (26.50 + 27.15 + 20.00) / 3
    cost: 8 * 24.55  // $196.40
  },
  packaging: {
    workers: 2,
    hoursEach: 8,
    totalHours: 16,
    avgRate: 24.55,
    cost: 16 * 24.55  // $392.80
  }
};

/**
 * Get standard labor cost per batch
 * Used for recipe previews and initial COGS estimates
 * 
 * @returns {Object} { brewLabor, cellarLabor, packagingLabor, totalLabor, totalHours }
 */
function getStandardLaborPerBatch() {
  var brewLabor = STANDARD_LABOR.brew.cost;
  var cellarLabor = STANDARD_LABOR.cellar.cost;
  var packagingLabor = STANDARD_LABOR.packaging.cost;
  var totalLabor = brewLabor + cellarLabor + packagingLabor;
  var totalHours = STANDARD_LABOR.brew.totalHours + 
                   STANDARD_LABOR.cellar.totalHours + 
                   STANDARD_LABOR.packaging.totalHours;
  
  return {
    brewLabor: brewLabor,           // $550.00
    cellarLabor: cellarLabor,       // $196.40
    packagingLabor: packagingLabor, // $392.80
    totalLabor: totalLabor,         // $1,139.20
    totalHours: totalHours,         // 40 hours
    breakdown: {
      brew: STANDARD_LABOR.brew,
      cellar: STANDARD_LABOR.cellar,
      packaging: STANDARD_LABOR.packaging
    }
  };
}

/**
 * Get labor cost for recipe preview
 * Returns standard labor until we have actual batch data for this beer
 * 
 * @param {string} beerName - Name of the beer (optional - for future averaging)
 * @returns {number} Labor cost estimate
 */
function getRecipeLaborEstimate(beerName) {
  // For now, return standard labor
  // In the future, this could average actual labor for this specific beer
  var standard = getStandardLaborPerBatch();
  return standard.totalLabor;  // $1,139.20
}

/**
 * Update Beer COGS Master with standard labor baseline
 * Run this once to set all beers to the standard labor allocation
 */
function updateCOGSWithStandardLabor() {
  try {
    var ss = getBrmSpreadsheet();
    var cogsSheet = ss.getSheetByName(SHEETS.BEER_COGS_MASTER);
    
    if (!cogsSheet) {
      return { success: false, error: 'Beer COGS Master sheet not found' };
    }
    
    var standard = getStandardLaborPerBatch();
    var data = cogsSheet.getDataRange().getValues();
    
    // Find column indices
    var headers = data[0];
    var beerNameCol = -1;
    var brewingLaborCol = -1;
    var packagingLaborCol = -1;
    var totalCogsCol = -1;
    var cogsPerBblCol = -1;
    var ingredientCogsCol = -1;
    var expectedYieldCol = -1;
    
    for (var i = 0; i < headers.length; i++) {
      var h = (headers[i] || '').toString().toLowerCase();
      if (h.includes('beer name') || h === 'beer') beerNameCol = i;
      if (h.includes('brewing labor')) brewingLaborCol = i;
      if (h.includes('packaging labor')) packagingLaborCol = i;
      if (h.includes('total cogs') && !h.includes('per')) totalCogsCol = i;
      if (h.includes('cogs per bbl') || h.includes('per bbl')) cogsPerBblCol = i;
      if (h.includes('ingredient')) ingredientCogsCol = i;
      if (h.includes('expected yield') || h.includes('yield')) expectedYieldCol = i;
    }
    
    if (beerNameCol === -1) {
      return { success: false, error: 'Could not find Beer Name column' };
    }
    
    var updatedCount = 0;
    
    // Update each beer row
    for (var i = 1; i < data.length; i++) {
      var beerName = data[i][beerNameCol];
      if (!beerName || beerName.toString().trim() === '') continue;
      
      // Brewing Labor = Brew ($550) + Cellar ($196.40) = $746.40
      // We combine brew + cellar into "Brewing Labor" since that's pre-packaging
      var brewingLabor = standard.brewLabor + standard.cellarLabor;  // $746.40
      var packagingLabor = standard.packagingLabor;  // $392.80
      
      // Update Brewing Labor column
      if (brewingLaborCol >= 0) {
        cogsSheet.getRange(i + 1, brewingLaborCol + 1).setValue(brewingLabor);
      }
      
      // Update Packaging Labor column (if exists)
      if (packagingLaborCol >= 0) {
        cogsSheet.getRange(i + 1, packagingLaborCol + 1).setValue(packagingLabor);
      }
      
      // Recalculate Total COGS
      if (totalCogsCol >= 0 && ingredientCogsCol >= 0) {
        var ingredientCogs = parseFloat(data[i][ingredientCogsCol]) || 0;
        var totalLabor = brewingLabor + packagingLabor;  // $1,139.20
        var newTotalCogs = ingredientCogs + totalLabor;
        cogsSheet.getRange(i + 1, totalCogsCol + 1).setValue(newTotalCogs);
        
        // Recalculate COGS/BBL
        if (cogsPerBblCol >= 0 && expectedYieldCol >= 0) {
          var expectedYield = parseFloat(data[i][expectedYieldCol]) || 57;
          var cogsPerBbl = expectedYield > 0 ? newTotalCogs / expectedYield : 0;
          cogsSheet.getRange(i + 1, cogsPerBblCol + 1).setValue(cogsPerBbl);
        }
      }
      
      updatedCount++;
    }
    
    Logger.log('Updated ' + updatedCount + ' beers with standard labor: $' + standard.totalLabor.toFixed(2));
    
    return serializeForHtml({
      success: true,
      message: 'Updated ' + updatedCount + ' beers with standard labor baseline',
      standardLabor: standard
    });
    
  } catch (e) {
    Logger.log('Error updating COGS with standard labor: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * Update Labor Config with correct baseline values
 * This ensures the Labor Config sheet shows accurate per-batch expectations
 */
function updateLaborConfigBaseline() {
  try {
    var ss = getBrmSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.LABOR_CONFIG);
    
    if (!sheet) {
      return { success: false, error: 'Labor Config sheet not found' };
    }
    
    var standard = getStandardLaborPerBatch();
    
    // Update Brewing Labor Per Batch (cell B33)
    // This should be the total labor per batch: $1,139.20
    sheet.getRange('B33').setValue(standard.totalLabor);
    
    // Update Total Labor Per Batch (cell B35)
    sheet.getRange('B35').setValue(standard.totalLabor);
    
    // Recalculate Labor $/BBL based on standard labor
    // Assuming 57 BBL yield (95% of 60 BBL)
    var laborPerBBL = standard.totalLabor / 57;  // ~$19.99/BBL
    sheet.getRange('B40').setValue(laborPerBBL);  // Labor $/BBL (Full)
    
    // 50% for Floor Pricing and Fully Loaded
    var halfLaborPerBBL = laborPerBBL * 0.5;  // ~$10.00/BBL
    sheet.getRange('B41').setValue(halfLaborPerBBL);  // 50% Labor $/BBL (TRM)
    sheet.getRange('B42').setValue(halfLaborPerBBL);  // 50% Labor $/BBL (CRM)
    
    Logger.log('Updated Labor Config baseline: $' + standard.totalLabor.toFixed(2) + '/batch, $' + laborPerBBL.toFixed(2) + '/BBL');
    
    return serializeForHtml({
      success: true,
      message: 'Labor Config updated with standard baseline',
      laborPerBatch: standard.totalLabor,
      laborPerBBL: laborPerBBL
    });
    
  } catch (e) {
    Logger.log('Error updating Labor Config baseline: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * MASTER FUNCTION: Initialize all labor baselines
 * Run this once to set up standard labor across all sheets
 */
function initializeStandardLaborBaseline() {
  try {
    var results = [];
    
    // 1. Update Beer COGS Master
    var cogsResult = updateCOGSWithStandardLabor();
    results.push('COGS: ' + (cogsResult.success ? 'OK' : cogsResult.error));
    
    // 2. Update Labor Config
    var configResult = updateLaborConfigBaseline();
    results.push('Labor Config: ' + (configResult.success ? 'OK' : configResult.error));
    
    // 3. Update Floor Pricing
    updateFloorPricingLabor();
    results.push('Floor Pricing: OK');
    
    // 4. Update Fully Loaded Pricing
    updateFullyLoadedPricingLabor();
    results.push('Fully Loaded: OK');
    
    var standard = getStandardLaborPerBatch();
    
    Logger.log('Standard labor baseline initialized:');
    Logger.log('  Brew Labor: $' + standard.brewLabor.toFixed(2) + ' (16 hrs)');
    Logger.log('  Cellar Labor: $' + standard.cellarLabor.toFixed(2) + ' (8 hrs)');
    Logger.log('  Packaging Labor: $' + standard.packagingLabor.toFixed(2) + ' (16 hrs)');
    Logger.log('  TOTAL: $' + standard.totalLabor.toFixed(2) + ' (40 hrs)');
    
    return {
      success: true,
      message: 'Standard labor baseline initialized',
      results: results,
      standardLabor: {
        brew: '$' + standard.brewLabor.toFixed(2) + ' (16 hrs)',
        cellar: '$' + standard.cellarLabor.toFixed(2) + ' (8 hrs)',
        packaging: '$' + standard.packagingLabor.toFixed(2) + ' (16 hrs)',
        total: '$' + standard.totalLabor.toFixed(2) + ' (40 hrs)'
      }
    };
    
  } catch (e) {
    Logger.log('Error initializing labor baseline: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATE RECIPE PREVIEW TO USE STANDARD LABOR
// Find the function that renders recipe preview and update labor calculation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get recipe cost summary with standard labor
 * This should be called by the recipe preview modal
 * 
 * @param {Object} recipe - Recipe data with ingredients
 * @returns {Object} { ingredientCost, laborCost, totalCost, cogsPerBBL }
 */
function getRecipeCostSummary(recipe) {
  var ingredientCost = parseFloat(recipe.ingredientCost) || parseFloat(recipe.totalCOGS) || 0;
  var laborCost = getRecipeLaborEstimate(recipe.name);  // $1,139.20 standard
  var totalCost = ingredientCost + laborCost;
  var expectedYield = (parseFloat(recipe.batchSize) || 60) * 0.95;  // 95% yield
  var cogsPerBBL = expectedYield > 0 ? totalCost / expectedYield : 0;
  
  return {
    ingredientCost: ingredientCost,
    laborCost: laborCost,
    totalCost: totalCost,
    cogsPerBBL: cogsPerBBL,
    expectedYield: expectedYield
  };
}
// ═══════════════════════════════════════════════════════════════════════════════
// RED LEG BREWING - MULTI-ENTRY BREW LABOR SUPPORT
// Allows multiple brewers to log hours to the same batch
// Add this to your Code.gs
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all brew labor entries for a batch
 * Used to show accumulated labor in Brewer's Sheet
 * 
 * @param {string} batchNumber - Batch number
 * @returns {Object} { success, entries: [{employee, hours, timestamp}], totalHours, totalCost }
 */
function getBatchBrewLabor(batchNumber) {
  try {
    var ss = getBrmSpreadsheet();
    var detailsSheet = ss.getSheetByName(SHEETS.BATCH_DETAILS);
    
    if (!detailsSheet) {
      return { success: true, entries: [], totalHours: 0, totalCost: 0 };
    }
    
    var data = detailsSheet.getDataRange().getValues();
    var entries = [];
    var totalHours = 0;
    var totalCost = 0;
    
    // Find labor entries for this batch
    for (var i = 1; i < data.length; i++) {
      var rowBatch = data[i][0];
      var rowType = data[i][3];  // Type column
      var rowDesc = data[i][4];  // Description column
      var rowValue = data[i][5]; // Value (hours)
      var rowCost = data[i][7];  // Cost column
      var rowDate = data[i][1];  // Date column
      
      if (rowBatch && rowBatch.toString() === batchNumber && 
          rowType && rowType.toString() === 'Labor' &&
          rowDesc && rowDesc.toString().toLowerCase().includes('brew labor')) {
        
        // Extract employee name from description "Brew labor: Richard Mar"
        var employeeName = rowDesc.toString().replace('Brew labor:', '').replace('Brew Labor:', '').trim();
        var hours = parseFloat(rowValue) || 0;
        var cost = parseFloat(rowCost) || 0;
        
        entries.push({
          employee: employeeName,
          hours: hours,
          cost: cost,
          timestamp: rowDate
        });
        
        totalHours += hours;
        totalCost += cost;
      }
    }
    
    return serializeForHtml({
      success: true,
      batchNumber: batchNumber,
      entries: entries,
      totalHours: totalHours,
      totalCost: totalCost
    });
    
  } catch (e) {
    Logger.log('Error getting batch brew labor: ' + e.toString());
    return { success: false, error: e.toString(), entries: [], totalHours: 0, totalCost: 0 };
  }
}

/**
 * Add brew labor entry to an existing batch
 * Called when second brewer logs their turn
 * 
 * @param {string} batchNumber - Batch number
 * @param {string} employeeName - Brewer name
 * @param {number} hours - Hours worked
 * @returns {Object} { success, totalHours, message }
 */
function addBrewLaborEntry(batchNumber, employeeName, hours) {
  try {
    if (!batchNumber || !employeeName || !hours) {
      return { success: false, error: 'Batch number, employee, and hours required' };
    }
    
    var hoursWorked = parseFloat(hours) || 0;
    if (hoursWorked <= 0) {
      return { success: false, error: 'Hours must be greater than 0' };
    }
    
    // Log the brew labor (this function already exists)
    var result = logBrewLabor(batchNumber, employeeName, hoursWorked);
    
    if (result.success) {
      // Get updated totals
      var totals = getBatchBrewLabor(batchNumber);
      
      return serializeForHtml({
        success: true,
        batchNumber: batchNumber,
        employee: employeeName,
        hoursAdded: hoursWorked,
        totalHours: totals.totalHours || hoursWorked,
        totalEntries: totals.entries ? totals.entries.length : 1,
        message: employeeName + ': ' + hoursWorked + ' hrs logged (Total: ' + (totals.totalHours || hoursWorked) + ' hrs)'
      });
    }
    /* ═══════════════════════════════════════════════════════════════════════════
   ADD THIS FUNCTION TO YOUR Code.gs FILE
   
   Just copy and paste this entire function anywhere in your Code.gs
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Update a Finished Goods item from the BRM UI
 */
function updateFinishedGoodsItem(data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('FG Inventory') || ss.getSheetByName('Finished Goods');
    if (!sheet) return { success: false, error: 'FG Inventory sheet not found' };
    
    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();
    var headers = values[0];
    
    // Find column indices with fallbacks for different naming conventions
    var beerCol = headers.indexOf('Beer');
    if (beerCol === -1) beerCol = headers.indexOf('Beer Name');
    
    var pkgCol = headers.indexOf('Package');
    if (pkgCol === -1) pkgCol = headers.indexOf('Package Type');
    
    var qtyCol = headers.indexOf('Qty On Hand');
    if (qtyCol === -1) qtyCol = headers.indexOf('On Hand');
    if (qtyCol === -1) qtyCol = headers.indexOf('Quantity');
    
    var minCol = headers.indexOf('Min Qty');
    if (minCol === -1) minCol = headers.indexOf('Reorder Point');
    if (minCol === -1) minCol = headers.indexOf('Min');
    
    var costCol = headers.indexOf('Unit Cost');
    if (costCol === -1) costCol = headers.indexOf('Cost/Unit');
    if (costCol === -1) costCol = headers.indexOf('Cost');
    
    // Find the matching row by Beer + Package
    for (var i = 1; i < values.length; i++) {
      if (values[i][beerCol] === data.beer && values[i][pkgCol] === data.package) {
        // Update the values
        if (qtyCol !== -1) sheet.getRange(i + 1, qtyCol + 1).setValue(data.qtyOnHand);
        if (minCol !== -1) sheet.getRange(i + 1, minCol + 1).setValue(data.minQty);
        if (costCol !== -1) sheet.getRange(i + 1, costCol + 1).setValue(data.unitCost);
        
        return { success: true };
      }
    }
    
    return { success: false, error: 'Item not found: ' + data.beer + ' / ' + data.package };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}
    
    return result;
    
  } catch (e) {
    Logger.log('Error adding brew labor entry: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}
// ══════════════════════════════════════════════════════════════════════════════
// RED LEG BRM - EDIT MODAL BACKEND FUNCTIONS
// PASTE THIS AT THE END OF YOUR Code.js FILE (before the final closing brace if any)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Update a Finished Goods item from the BRM UI edit modal
 * Called by saveEditFG() in BRM_UI.html
 */
function updateFinishedGoodsItem(data) {
  try {
    var ss = SpreadsheetApp.openById('1bbbvYjFRO5peYuMPNaxcl10X--Wg5RjjJvs_No4Ch16WjpfO80oP-tqJ');
    var sheet = ss.getSheetByName('FG Inventory') || ss.getSheetByName('Finished Goods');
    if (!sheet) return { success: false, error: 'Finished Goods sheet not found' };
    
    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();
    var headers = values[0];
    
    // Find column indices
    var beerCol = -1, pkgCol = -1, qtyCol = -1, minCol = -1, costCol = -1, totalCol = -1, statusCol = -1;
    for (var c = 0; c < headers.length; c++) {
      var h = (headers[c] || '').toString().toLowerCase();
      if (h.indexOf('beer') !== -1 || h === 'name') beerCol = c;
      if (h.indexOf('package') !== -1 || h.indexOf('type') !== -1) pkgCol = c;
      if (h.indexOf('qty') !== -1 || h.indexOf('on hand') !== -1 || h.indexOf('quantity') !== -1) qtyCol = c;
      if (h.indexOf('min') !== -1 || h.indexOf('reorder') !== -1) minCol = c;
      if (h.indexOf('cost') !== -1 && h.indexOf('total') === -1) costCol = c;
      if (h.indexOf('total') !== -1 || h.indexOf('value') !== -1) totalCol = c;
      if (h.indexOf('status') !== -1) statusCol = c;
    }
    
    // Find the row
    for (var i = 1; i < values.length; i++) {
      var rowBeer = (values[i][beerCol] || '').toString().trim();
      var rowPkg = (values[i][pkgCol] || '').toString().trim();
      
      if (rowBeer.toLowerCase() === data.beer.toLowerCase() && 
          rowPkg.toLowerCase() === data.package.toLowerCase()) {
        
        var qty = parseFloat(data.qtyOnHand) || 0;
        var minQty = parseFloat(data.minQty) || 0;
        var unitCost = parseFloat(data.unitCost) || 0;
        var totalValue = qty * unitCost;
        
        // Determine status
        var status = '✅ OK';
        if (qty <= 0) status = '🚨 OUT';
        else if (qty <= minQty) status = '⚠️ LOW';
        
        // Update cells
        var rowNum = i + 1;
        if (qtyCol >= 0) sheet.getRange(rowNum, qtyCol + 1).setValue(qty);
        if (minCol >= 0) sheet.getRange(rowNum, minCol + 1).setValue(minQty);
        if (costCol >= 0) sheet.getRange(rowNum, costCol + 1).setValue(unitCost);
        if (totalCol >= 0) sheet.getRange(rowNum, totalCol + 1).setValue(totalValue);
        if (statusCol >= 0) sheet.getRange(rowNum, statusCol + 1).setValue(status);
        
        // Log the change
        try {
          logFGAdjustment(data.beer, data.package, values[i][qtyCol], qty, 'EDIT', 'UI edit');
        } catch(logErr) {
          // Logging is optional
        }
        
        return { success: true, message: 'Finished good updated' };
      }
    }
    return { success: false, error: 'Item not found: ' + data.beer + ' / ' + data.package };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Update a Raw Material item from the BRM UI edit modal
 * Called by saveEditRM() in BRM_UI.html
 */
function updateRawMaterialItem(data) {
  try {
    Logger.log('updateRawMaterialItem called with item: ' + data.item);
    // Use getActiveSpreadsheet() since this runs from the bound spreadsheet
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      Logger.log('getActiveSpreadsheet() failed, trying getBrmSpreadsheet()');
      ss = getBrmSpreadsheet();
    }
    
    // Use the same sheet name and structure as other Raw Materials functions
    var sheet = ss.getSheetByName(RAW_MATERIAL_CONFIG.sheetName);
    if (!sheet) {
      // Fallback to common name
      sheet = ss.getSheetByName('Raw Materials');
      if (!sheet) return { success: false, error: 'Raw Materials sheet not found' };
    }
    Logger.log('Found Raw Materials sheet: ' + sheet.getName());
    
    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();
    
    // Use RAW_MATERIAL_CONFIG structure (header at row 4, data starts at row 5)
    var cols = RAW_MATERIAL_CONFIG.columns;
    var dataStartRow = RAW_MATERIAL_CONFIG.dataStartRow - 1; // Convert to 0-indexed
    
    Logger.log('Searching for item: "' + data.item + '" (trimmed: "' + data.item.trim() + '")');
    Logger.log('Item column: ' + (cols.item - 1) + ' (1-indexed: ' + cols.item + ')');
    Logger.log('Data starts at row index: ' + dataStartRow + ' (sheet row: ' + (dataStartRow + 1) + ')');
    
    // Log first few items for debugging
    var sampleItems = [];
    for (var s = dataStartRow; s < Math.min(dataStartRow + 5, values.length); s++) {
      var sampleItem = (values[s][cols.item - 1] || '').toString().trim();
      sampleItems.push(sampleItem);
    }
    Logger.log('Sample items from sheet: ' + sampleItems.join(', '));
    
    // Find the row - start from dataStartRow, not row 1
    var searchItem = (data.item || '').toString().trim().toLowerCase();
    var foundRow = -1;
    
    for (var i = dataStartRow; i < values.length; i++) {
      var itemName = (values[i][cols.item - 1] || '').toString().trim();
      var itemNameLower = itemName.toLowerCase();
      
      Logger.log('Comparing: "' + itemName + '" (lower: "' + itemNameLower + '") with "' + searchItem + '"');
      
      if (itemNameLower === searchItem) {
        foundRow = i;
        Logger.log('Found item at row index: ' + i + ' (sheet row: ' + (i + 1) + ')');
        break;
      }
    }
    
    if (foundRow === -1) {
      Logger.log('Item not found. Searched ' + (values.length - dataStartRow) + ' rows');
      return { success: false, error: 'Item not found: ' + data.item + '. Check logs for details.' };
    }
    
    // Found the item, now update it
    var i = foundRow;
    var qty = parseFloat(data.qtyOnHand) || 0;
    var avgCost = parseFloat(data.avgCost) || 0;
    var reorderPoint = parseFloat(data.reorderPoint) || 0;
    var reorderQty = parseFloat(data.reorderQty) || 0;
    var totalValue = qty * avgCost;
    
    // Get current values for logging
    var currentQty = parseFloat(values[i][cols.qtyOnHand - 1]) || 0;
    
    // Determine status
    var status = '✅ OK';
    if (qty <= 0) status = '🚨 OUT';
    else if (reorderPoint > 0 && qty <= reorderPoint) status = '⚠️ REORDER';
    
    // Update cells using RAW_MATERIAL_CONFIG column numbers (1-indexed)
    var rowNum = i + 1;
    Logger.log('Updating row ' + rowNum);
    
    sheet.getRange(rowNum, cols.qtyOnHand).setValue(qty);
    if (data.unit) sheet.getRange(rowNum, cols.unit).setValue(data.unit);
    sheet.getRange(rowNum, cols.avgCost).setValue(avgCost);
    sheet.getRange(rowNum, cols.totalValue).setValue(Math.round(totalValue * 100) / 100);
    sheet.getRange(rowNum, cols.reorderPoint).setValue(reorderPoint);
    sheet.getRange(rowNum, cols.reorderQty).setValue(reorderQty);
    sheet.getRange(rowNum, cols.status).setValue(status);
    if (data.supplier && cols.supplier) sheet.getRange(rowNum, cols.supplier).setValue(data.supplier);
    if (data.notes !== undefined && cols.notes) sheet.getRange(rowNum, cols.notes).setValue(data.notes);
    
    Logger.log('Updated: Qty=' + qty + ', Unit=' + (data.unit || 'unchanged') + ', Cost=' + avgCost);
    
    // Log the change
    try {
      logMaterialAdjustment(data.item, currentQty, qty, 'UI edit', 'EDIT');
    } catch(logErr) {
      Logger.log('Warning: Could not log material adjustment: ' + logErr.toString());
    }
    
    return { success: true, message: 'Raw material updated' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}