# Production Calendar with Sales Velocity Integration
## Design Document & Implementation Plan

---

## 📊 **Data Flow Diagram**

```
┌─────────────────┐
│  CRM/Sales Data │  (Sales Depletion Sheet)
│  - Date         │
│  - Beer Name    │
│  - Package Type │
│  - Quantity     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Sales Velocity Calculator          │
│  - Last 30 days average            │
│  - Rolling 7-day average           │
│  - Trend (↑/→/↓)                    │
│  - Daily velocity per beer/pkg      │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Inventory Days Calculator          │
│  Days Remaining =                   │
│  Current FG Inventory ÷            │
│  Daily Velocity                     │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Smart Suggestions Engine          │
│  - "Brew by [date]" alerts         │
│  - Velocity trend warnings         │
│  - Seasonal reminders               │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Production Calendar                │
│  - Visual calendar view            │
│  - Scheduled brews                 │
│  - Status tracking                  │
│  - Tank assignments                 │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Raw Material Planner               │
│  - Recipe → Ingredients needed      │
│  - Check RM availability            │
│  - Auto-create PO requests          │
└─────────────────────────────────────┘
```

---

## 🗄️ **Database Changes Needed**

### 1. **Production Calendar Sheet** (Already exists - enhance structure)

**Current Columns:**
- Week #
- Beer Type
- Brew Date
- Package Date
- Batch Size (BBL)
- Expected Yield
- Product Type
- Status
- Tank
- Notes

**New Columns to Add:**
- **Column K:** `Days Inventory Remaining` (calculated)
- **Column L:** `Sales Velocity (BBL/week)` (calculated)
- **Column M:** `Velocity Trend` (↑/→/↓)
- **Column N:** `Is Seasonal` (TRUE/FALSE)
- **Column O:** `Target Availability Date` (for seasonal)
- **Column P:** `Auto-Suggested` (TRUE/FALSE)
- **Column Q:** `Raw Materials Status` (✅/⚠️/❌)

### 2. **New Sheet: Sales Velocity Cache** (Optional - for performance)

**Purpose:** Store calculated velocity metrics to avoid recalculating every time

**Columns:**
- Beer Name
- Package Type
- Date Range Start
- Date Range End
- Total Qty Sold
- Daily Velocity
- Weekly Velocity
- Monthly Velocity
- Trend Direction
- Last Calculated

### 3. **New Sheet: Seasonal Planning** (Optional)

**Columns:**
- Beer Name
- Season
- Target Availability Date
- Brew Date Target
- Material Order Date Target
- Status
- Notes

---

## 🎨 **UI Design**

### **Option 1: Calendar Grid View** (Recommended for MVP)

```
┌─────────────────────────────────────────────────────────────────┐
│  📅 Production Calendar                    [Month] [Year] [<] [>]│
├─────────────────────────────────────────────────────────────────┤
│  [Smart Suggestions] [Raw Materials Check] [Seasonal Planning]  │
├─────────────────────────────────────────────────────────────────┤
│  Sun    Mon    Tue    Wed    Thu    Fri    Sat                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐            │
│  │ 1  │ │ 2  │ │ 3  │ │ 4  │ │ 5  │ │ 6  │ │ 7  │            │
│  │    │ │    │ │    │ │Howi│ │Howi│ │    │ │    │            │
│  │    │ │    │ │    │ │Brew│ │Pack│ │    │ │    │            │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘            │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐            │
│  │ 8  │ │ 9  │ │10  │ │11  │ │12  │ │13  │ │14  │            │
│  │    │ │    │ │    │ │    │ │    │ │    │ │    │            │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘            │
└─────────────────────────────────────────────────────────────────┘

Color Coding:
- 🟢 Green = Complete
- 🟡 Yellow = In Progress (Brewing/Fermenting)
- 🔵 Blue = Planned
- 🔴 Red = Urgent (Low inventory)
- 🟣 Purple = Seasonal
```

### **Option 2: List View with Alerts** (Simpler for MVP)

```
┌─────────────────────────────────────────────────────────────────┐
│  📅 Production Calendar                                          │
├─────────────────────────────────────────────────────────────────┤
│  🔴 URGENT: Howitzer Amber - 8 days inventory remaining         │
│     → Schedule brew by: Jan 15, 2025                            │
│     → Suggested brew date: Jan 8, 2025                          │
│     → Package date: Jan 22, 2025                                 │
│     [Schedule Brew] [View Recipe] [Check Materials]              │
├─────────────────────────────────────────────────────────────────┤
│  ⚠️  Springs Lite velocity up 25% - consider increasing batch   │
│     Current: 12 BBL/week | Trend: ↑                             │
│     [View Details] [Schedule Additional Batch]                  │
├─────────────────────────────────────────────────────────────────┤
│  📅 SCHEDULED BREWS                                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Jan 8  │ Howitzer Amber │ 60 BBL │ FV-1 │ 🟡 Brewing    │   │
│  │ Jan 15 │ Springs Lite   │ 60 BBL │ FV-2 │ 🔵 Planned    │   │
│  │ Jan 22 │ Oktoberfest    │ 60 BBL │ FV-3 │ 🟣 Seasonal   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### **Option 3: Gantt Chart View** (Advanced - Phase 2)

Timeline view showing batches across weeks with dependencies.

---

## 📐 **Sales Velocity Calculation Strategy**

### **Recommended Approach: Weighted Recent Average**

```javascript
// Option 1: Last 30 days (simple, good for MVP)
dailyVelocity = totalQtySoldLast30Days / 30

// Option 2: Rolling 7-day average (more responsive)
dailyVelocity = totalQtySoldLast7Days / 7

// Option 3: Weighted (most recent = higher weight) - BEST
// Week 1 (most recent): weight = 1.0
// Week 2: weight = 0.8
// Week 3: weight = 0.6
// Week 4: weight = 0.4
weightedVelocity = (week1*1.0 + week2*0.8 + week3*0.6 + week4*0.4) / 2.8
```

**Recommendation:** Start with **Last 30 days** for MVP, upgrade to **Weighted** in Phase 2.

### **Trend Calculation:**
```javascript
trend = (last7Days - previous7Days) / previous7Days
if (trend > 0.1) return '↑'  // Increasing
if (trend < -0.1) return '↓'  // Decreasing
return '→'  // Stable
```

---

## 🔗 **CRM Connection Strategy**

### **Option 1: Direct Sheet Access** (Recommended for MVP)
- CRM writes to `Sales Depletion` sheet (already exists)
- BRM reads from `Sales Depletion` sheet
- **Pros:** Simple, no API needed
- **Cons:** Requires CRM to write to shared sheet

### **Option 2: Apps Script Web App API**
- CRM calls BRM web app endpoint: `logB2BSale()`
- BRM updates `Sales Depletion` sheet
- **Pros:** Decoupled, real-time
- **Cons:** More complex setup

### **Option 3: Manual Import** (Fallback)
- Export from CRM → Import to BRM
- **Pros:** Works with any CRM
- **Cons:** Not real-time

**Recommendation:** Use **Option 1** (already implemented via `logB2BSale()`)

---

## 🚀 **Phased Implementation Plan**

### **Phase 1: MVP - Core Functionality** (2-3 weeks)

**Week 1: Backend - Sales Velocity**
- [ ] Create `calculateSalesVelocity(beerName, packageType, days)` function
- [ ] Create `getInventoryDaysRemaining(beerName, packageType)` function
- [ ] Create `getProductionSuggestions()` function
- [ ] Test with real sales data

**Week 2: Backend - Production Calendar**
- [ ] Create `getProductionCalendar(year, month)` function
- [ ] Create `scheduleBatch(batchData)` function
- [ ] Create `updateBatchStatus(batchId, status)` function
- [ ] Link to existing Batch Log

**Week 3: Frontend - Basic UI**
- [ ] Add "Production Calendar" tab to BRM UI
- [ ] List view with alerts
- [ ] Schedule batch form
- [ ] Display scheduled batches

**Deliverables:**
- ✅ Sales velocity calculation working
- ✅ Inventory days remaining displayed
- ✅ Basic scheduling interface
- ✅ Smart suggestions showing

---

### **Phase 2: Enhanced Features** (2-3 weeks)

**Week 4: Visual Calendar**
- [ ] Calendar grid view
- [ ] Color coding by status
- [ ] Drag-and-drop scheduling (optional)

**Week 5: Raw Material Integration**
- [ ] Check RM availability when scheduling
- [ ] Auto-create PO requests for missing materials
- [ ] Material status indicators

**Week 6: Seasonal Planning**
- [ ] Mark beers as seasonal
- [ ] Work backwards from availability date
- [ ] Reminder notifications

**Deliverables:**
- ✅ Visual calendar grid
- ✅ RM planning integration
- ✅ Seasonal planning tools

---

### **Phase 3: Advanced Analytics** (2-3 weeks)

**Week 7-8: Advanced Analytics**
- [ ] Weighted velocity calculation
- [ ] Forecast future inventory needs
- [ ] Batch frequency recommendations
- [ ] Cost optimization suggestions

**Week 9: Notifications & Alerts**
- [ ] Email/Slack notifications for low inventory
- [ ] Weekly production planning reports
- [ ] Material order reminders

**Deliverables:**
- ✅ Advanced analytics dashboard
- ✅ Automated notifications
- ✅ Production planning reports

---

## 💻 **Code Reuse Opportunities**

### **Existing Functions We Can Reuse:**

1. **`getSalesData(filters)`** - Already gets sales from Sales Depletion sheet
   - ✅ Reuse for velocity calculation

2. **`getFinishedGoodsData(filters)`** - Gets current inventory
   - ✅ Reuse for inventory days calculation

3. **`getAllRecipesEnhanced()`** - Gets recipes with ingredients
   - ✅ Reuse for material planning

4. **`getRawMaterialsInventory(filters)`** - Gets RM inventory
   - ✅ Reuse for material availability checks

5. **`getBatchesData(filters)`** - Gets batch history
   - ✅ Reuse for historical batch timing

6. **`addPurchaseRequest(data)`** - Creates PO requests
   - ✅ Reuse for auto-creating material orders

7. **`createBatch(recipeData)`** - Creates batch records
   - ✅ Reuse for scheduling brews

### **New Functions Needed:**

```javascript
// Sales Velocity
calculateSalesVelocity(beerName, packageType, days)
getVelocityTrend(beerName, packageType)
getInventoryDaysRemaining(beerName, packageType)

// Production Calendar
getProductionCalendar(year, month)
scheduleBatch(batchData)
updateProductionCalendarStatus(batchId, status)
getProductionSuggestions()

// Raw Material Planning
checkMaterialsForBatch(recipeName, batchSize)
createMaterialPOsForBatch(recipeName, batchSize)

// Seasonal Planning
getSeasonalBeers()
calculateSeasonalMilestones(targetDate, beerName)
```

---

## 📍 **Where Should Calendar Live?**

### **Recommendation: New Tab in BRM UI**

**Location:** Add as a new tab button: `📅 Production Calendar`

**Rationale:**
- Keeps all production planning in one place
- Easy access from main navigation
- Can link to existing Batches, Recipes, Raw Materials tabs
- Consistent with current UI structure

**Alternative:** Dashboard widget (smaller, less detailed)
- Good for quick overview
- Full calendar in separate tab

---

## 🎯 **Minimum Viable Version (MVP)**

### **What We Need First:**

1. **Sales Velocity Display**
   - Show "X days inventory remaining" for each beer
   - Simple calculation: Last 30 days average

2. **Smart Suggestions**
   - Alert when inventory < 14 days
   - Suggest brew date based on lead time

3. **Basic Scheduling**
   - Form to schedule a batch
   - Save to Production Calendar sheet
   - Show scheduled batches in list

4. **Status Tracking**
   - Planned → Brewing → Fermenting → Packaging → Complete
   - Update from existing batch workflow

### **What Can Wait:**
- ❌ Visual calendar grid (use list view first)
- ❌ Advanced velocity weighting
- ❌ Seasonal planning (manual for now)
- ❌ Auto-material ordering (manual for now)
- ❌ Notifications (manual check for now)

---

## 🔧 **Implementation Details**

### **1. Sales Velocity Function**

```javascript
/**
 * Calculate sales velocity for a beer/package combination
 * @param {string} beerName - Name of the beer
 * @param {string} packageType - Package type (e.g., "1/2 BBL Keg")
 * @param {number} days - Number of days to look back (default: 30)
 * @returns {object} { dailyVelocity, weeklyVelocity, trend, totalSold }
 */
function calculateSalesVelocity(beerName, packageType, days) {
  days = days || 30;
  var salesData = getSalesData({});
  if (!salesData.success) return { error: 'Could not load sales data' };
  
  var cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  var relevantSales = salesData.sales.filter(function(sale) {
    var saleDate = new Date(sale.date);
    return sale.beer === beerName && 
           sale.package === packageType &&
           saleDate >= cutoffDate;
  });
  
  var totalQty = relevantSales.reduce(function(sum, s) { 
    return sum + (s.qty || 0); 
  }, 0);
  
  var dailyVelocity = totalQty / days;
  var weeklyVelocity = dailyVelocity * 7;
  
  // Calculate trend (last 7 days vs previous 7 days)
  var last7Days = relevantSales.filter(function(s) {
    var saleDate = new Date(s.date);
    return saleDate >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  }).reduce(function(sum, s) { return sum + (s.qty || 0); }, 0);
  
  var prev7Days = relevantSales.filter(function(s) {
    var saleDate = new Date(s.date);
    var weekAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    var sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return saleDate >= weekAgo && saleDate < sevenDaysAgo;
  }).reduce(function(sum, s) { return sum + (s.qty || 0); }, 0);
  
  var trend = prev7Days > 0 ? ((last7Days - prev7Days) / prev7Days) : 0;
  var trendDirection = trend > 0.1 ? '↑' : trend < -0.1 ? '↓' : '→';
  
  return {
    dailyVelocity: Math.round(dailyVelocity * 100) / 100,
    weeklyVelocity: Math.round(weeklyVelocity * 100) / 100,
    monthlyVelocity: Math.round(dailyVelocity * 30 * 100) / 100,
    trend: trendDirection,
    trendPercent: Math.round(trend * 100),
    totalSold: totalQty,
    daysAnalyzed: days
  };
}
```

### **2. Inventory Days Remaining**

```javascript
/**
 * Calculate days of inventory remaining
 * @param {string} beerName - Name of the beer
 * @param {string} packageType - Package type
 * @returns {object} { daysRemaining, currentInventory, dailyVelocity, status }
 */
function getInventoryDaysRemaining(beerName, packageType) {
  var fgData = getFinishedGoodsData({});
  if (!fgData.success) return { error: 'Could not load inventory' };
  
  var inventory = fgData.inventory.find(function(item) {
    return item.beerName === beerName && item.packageType === packageType;
  });
  
  if (!inventory) {
    return { 
      daysRemaining: 0, 
      currentInventory: 0, 
      status: 'NOT_FOUND' 
    };
  }
  
  var velocity = calculateSalesVelocity(beerName, packageType, 30);
  if (velocity.error || velocity.dailyVelocity <= 0) {
    return {
      daysRemaining: 999, // Infinite if no sales
      currentInventory: inventory.qtyOnHand || 0,
      dailyVelocity: 0,
      status: 'NO_SALES'
    };
  }
  
  var daysRemaining = (inventory.qtyOnHand || 0) / velocity.dailyVelocity;
  
  var status = 'OK';
  if (daysRemaining <= 7) status = 'CRITICAL';
  else if (daysRemaining <= 14) status = 'LOW';
  else if (daysRemaining <= 21) status = 'WARNING';
  
  return {
    daysRemaining: Math.round(daysRemaining * 10) / 10,
    currentInventory: inventory.qtyOnHand || 0,
    dailyVelocity: velocity.dailyVelocity,
    weeklyVelocity: velocity.weeklyVelocity,
    trend: velocity.trend,
    status: status
  };
}
```

### **3. Production Suggestions**

```javascript
/**
 * Get smart production suggestions based on inventory and velocity
 * @returns {array} Array of suggestion objects
 */
function getProductionSuggestions() {
  var suggestions = [];
  var fgData = getFinishedGoodsData({});
  if (!fgData.success) return suggestions;
  
  fgData.inventory.forEach(function(item) {
    var inventoryDays = getInventoryDaysRemaining(item.beerName, item.packageType);
    
    if (inventoryDays.status === 'CRITICAL' || inventoryDays.status === 'LOW') {
      // Calculate suggested brew date
      // Lead time: 7 days brewing + 14 days fermentation + 3 days packaging = 24 days
      var leadTimeDays = 24;
      var targetInventoryDays = 30; // Want 30 days of inventory
      var daysUntilTarget = targetInventoryDays - inventoryDays.daysRemaining;
      var suggestedBrewDate = new Date();
      suggestedBrewDate.setDate(suggestedBrewDate.getDate() + daysUntilTarget - leadTimeDays);
      
      suggestions.push({
        beerName: item.beerName,
        packageType: item.packageType,
        priority: inventoryDays.status === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
        currentInventory: inventoryDays.currentInventory,
        daysRemaining: inventoryDays.daysRemaining,
        dailyVelocity: inventoryDays.dailyVelocity,
        trend: inventoryDays.trend,
        suggestedBrewDate: suggestedBrewDate,
        suggestedPackageDate: new Date(suggestedBrewDate.getTime() + 24 * 24 * 60 * 60 * 1000),
        message: item.beerName + ': ' + inventoryDays.daysRemaining + ' days inventory remaining - schedule brew by ' + 
                 Utilities.formatDate(suggestedBrewDate, Session.getScriptTimeZone(), 'MMM d, yyyy')
      });
    }
    
    // Check for velocity trends
    if (inventoryDays.trend === '↑' && inventoryDays.daysRemaining < 30) {
      suggestions.push({
        beerName: item.beerName,
        packageType: item.packageType,
        priority: 'LOW',
        type: 'VELOCITY_INCREASE',
        trend: inventoryDays.trend,
        message: item.beerName + ' velocity up - consider increasing batch frequency'
      });
    }
  });
  
  // Sort by priority
  suggestions.sort(function(a, b) {
    var priorityOrder = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
    return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
  });
  
  return suggestions;
}
```

---

## ✅ **Next Steps**

1. **Review this design** with the team
2. **Prioritize features** for MVP
3. **Start Phase 1 implementation:**
   - Backend: Sales velocity functions
   - Backend: Production calendar functions
   - Frontend: Basic UI tab
4. **Test with real data**
5. **Iterate based on feedback**

---

## 📝 **Questions Answered**

### **Q: How should we calculate sales velocity?**
**A:** Start with **Last 30 days average** for MVP. Upgrade to **weighted recent average** in Phase 2.

### **Q: Where should the calendar live?**
**A:** **New tab in BRM UI** - "📅 Production Calendar" - keeps everything in one place.

### **Q: How do we connect CRM sales data?**
**A:** **Already connected!** CRM writes to `Sales Depletion` sheet via `logB2BSale()`. BRM reads from same sheet.

### **Q: What's the minimum viable version?**
**A:** 
- Sales velocity calculation (30-day average)
- Inventory days remaining display
- Smart suggestions (alerts for < 14 days)
- Basic scheduling form
- List view of scheduled batches

### **Q: How should the UI look?**
**A:** Start with **List View** (simpler, faster to build). Add **Calendar Grid** in Phase 2.

---

**Ready to start implementation?** Let me know which phase you'd like to begin with!

