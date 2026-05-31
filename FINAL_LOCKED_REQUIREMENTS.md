# MGLP-1 APP - FINAL COMPREHENSIVE REQUIREMENTS (LOCKED IN ✅)

**Status:** Ready for Code Implementation  
**Last Updated:** Today  
**Version:** 2.0 - All Clarifications Confirmed

---

## **PROGRAM CONTEXT**
- **Program:** MGLP-1 (Mimicking GLP-1)
- **Duration:** 18 months (June 1, 2026 - Dec 31, 2027)
- **Goal:** Lose 15% of body mass
- **Start Date:** June 1, 2026 = Day 1
- **Failure Rate Allowed:** 10%

---

# **PART 1: DAILY LOG PAGE**

## **1.1 Day Display & Progress Tracking**
- ✅ Day number (Day 1, Day 15, etc.) NOT prominently visible
- ✅ Replace with **visual progress bar** showing:
  - Days completed vs. 548 total days
  - Percentage complete (0-100%)
  - Visual representation only (no day numbers)

## **1.2 Meal Bowls - Enhanced Validation (LOCKED IN)**

### **Bowl Count Limits:**
| Gender | Max Bowls | Rule |
|--------|-----------|------|
| **Men** | < 10 | Warning if ≥ 10 bowls |
| **Women** | < 8 | Warning if ≥ 8 bowls |

### **Specific Bowl Type Violations:**
- ⚠️ Carbs (C): Warning if > 1 bowl
- ⚠️ Rice (R): Warning if > 2 bowls

### **Meals Check Logic:**
✅ TICK meals_check ONLY if:
1. Bowl count within gender limit (<10 men, <8 women)
2. Carbs ≤ 1 bowl
3. Rice ≤ 2 bowls
4. All conditions met

❌ DO NOT TICK if any rule violated

### **Visual Warnings:**
- Show clear alert: "⚠️ Men: Max 10 bowls (currently: 12)"
- Show bowl-specific alerts: "⚠️ Carbs: Max 1 (currently: 2)"
- Red background for violations, Green for compliant
- **Type:** Alerts only (users can override and save)

## **1.3 Supplement Check Logic (LOCKED IN)**
- ✅ TICK supplements_check if **≥ 75% of planned supplements taken**
  - Example: If 8 supplements planned, need ≥ 6 taken
  - Example: If 10 supplements planned, need ≥ 8 taken
  - Calculate: (Supplements taken / Planned) × 100 ≥ 75%

## **1.4 WhatsApp Share**
- ✅ Keep current format - PERFECT
- No changes needed for now

## **1.5 Other Daily Features**
- ✅ Fasting window (as is)
- ✅ Movement tracking (as is)
- ✅ Hydration tracking (as is)
- ✅ Sleep tracking (as is)
- ✅ Weight tracking (as is)
- ✅ Notes (as is)

---

# **PART 2: WEEKLY REFLECTION PAGE**

## **2.1 Header Display (LOCKED IN)**
- ✅ **PROMINENT** display: "Week 15 (Dec 15-21, 2026)"
- ✅ Show full date range clearly
- ✅ Visual indicator of current week

## **2.2 Weekly Target Analysis - SECTOR-WISE (LOCKED IN)**

### **Analysis Breakdown by Sector:**
Show performance for each of the 5 habit sectors:

```
WEEKLY TARGET ANALYSIS
├─ Meals: 6/7 days ✅
├─ Supplements: 4/7 days ⚠️ (Below 5/7)
├─ Hydration: 7/7 days ✅
├─ Movement: 5/7 days ✅
├─ Sleep: 6/7 days ✅
│
└─ Overall: 5/7 days hit 4-of-5 habit target = 71% (WIN RATE)
```

### **Comparison Metrics (LOCKED IN):**
For each sector, show:
- **vs. Previous Week:** Direct week-to-week change
  - "Meals: 6/7 this week vs 5/7 last week (+1)"
- **vs. Average:** Compare to average of all previous weeks
  - "Meals: 6/7 avg vs 6/7 this week (=)"

### **Visualization:**
- Card-based layout for each sector
- Progress bar for each (0/7 to 7/7)
- Trend indicator: ↑ (improving), ↓ (declining), = (steady)
- Overall win percentage

## **2.3 Weekly Weigh-In Tracker (LOCKED IN)**

### **New Feature: Dedicated Weekly Weigh-In Section**
- ✅ **Separate** from daily weight entries
- ✅ Card/section on weekly reflection page
- ✅ Optional (users can skip a week)
- ✅ Allow users to enter weekly weight anytime

### **Weight Visualization:**
- Trend line showing weekly progression
- Progress vs goal visualization
- Metrics displayed:
  - Current weight
  - Goal weight (min & max)
  - Weight lost this week
  - Total weight lost since start
  - Remaining to goal
  - % of goal achieved

## **2.4 Reflection Questions**
- ✅ Keep current 7 questions (no changes)

---

# **PART 3: MONTHLY REFLECTION PAGE**

## **3.1 Month Display (LOCKED IN)**
- ✅ **PROMINENT** header: "June 2026" or "December 2026"
- ✅ Show full date range: "(June 1-30, 2026)"
- ✅ Visual emphasis on month/year

## **3.2 Goal Progress Visualization (LOCKED IN)**

### **Metrics to Display:**
- Starting weight for month
- Current weight
- Goal weights (min & max)
- Weight change for month
- % progress to goal
- Total progress since start

### **Visualizations - THREE Charts Required:**
1. **Entire Month Journey**
   - All daily weights for the current month
   - Visual line chart for month progression

2. **Journey to Date**
   - All weights since June 1, 2026 to today
   - Complete program journey visualization

3. **Trend Lines**
   - Show overall direction/momentum
   - Help see if weight loss is accelerating, stable, or slowing

❌ **NO projections** - don't predict future weight

## **3.3 Mentor's Word & Reflection (LOCKED IN - PRIORITY)**

### **NEW PRIORITY FEATURE:**
- ✅ **Dedicated section** (top of reflection form)
- ✅ **User inputs the mentor's word** (not admin)
- ✅ Prominently displayed with large text input
- ✅ Different styling to distinguish from other questions

### **Layout:**
```
═══════════════════════════════════════════════════════
  MENTOR'S WORD FOR THIS MONTH: [Word Here]

  Reflect on this word and its significance for you:
  [Large text input area - required field]
═══════════════════════════════════════════════════════

Below that: Other Reflection Questions...
```

### **Function:**
- User sees mentor's word at top when opening monthly reflection
- Reflects on how this word applied to their month
- This becomes the FIRST and MOST IMPORTANT reflection entry

## **3.4 Other Reflection Questions**
- ✅ Keep current 8 questions (no changes)

## **3.5 Additional Metrics**
- Show appropriate metrics: Monthly adherence, best week, etc.

---

# **PART 4: DASHBOARD - BLOOD WORK TRACKER (VISION DEFINED)**

## **4.1 Blood Work Tracker - Phase 1 (MVP - Synthesis Only)**

### **Vision Statement:**
**Long-term goal:** Create a comprehensive "Health Marker Dashboard" that tracks blood work markers over time with trend analysis, reference ranges, and health status indicators.

### **Phase 1 Scope (For Now - Synthesized Requirements):**
- ✅ Database structure to store blood work entries
- ✅ Flexible marker tracking system
- ✅ Date + Marker value input capability
- ✅ Support for unlimited test entries over time
- ✅ Trend visualization foundation
- ✅ Reference range integration (manual input)

### **Initial Markers to Support:**
Based on user's blood work database, track these categories:

#### **Metabolic & Glucose Control:**
- Fasting glucose
- Insulin
- HbA1c
- C-peptide

#### **Lipid Panel:**
- Total cholesterol
- LDL (bad cholesterol)
- HDL (good cholesterol)
- Triglycerides

#### **Liver Function Tests (LFT):**
- AST (SGOT)
- ALT (SGPT)
- Bilirubin (total & direct)
- Alkaline Phosphatase
- Gamma-GT

#### **Kidney Function Tests (KFT):**
- Creatinine
- BUN (Blood Urea Nitrogen)
- eGFR (Estimated Glomerular Filtration Rate)

#### **Inflammation Markers:**
- CRP (C-Reactive Protein)
- Homocysteine
- Uric Acid
- Fibrinogen

#### **Other Important Markers:**
- Weight / BMI
- Blood Pressure (Systolic & Diastolic)
- Vitamin D
- Thyroid markers (TSH, T3, T4)

### **Data Structure (To Be Locked In Later):**
- Blood work entry: Date + Marker name + Value + Unit
- Reference ranges: Marker + Min normal + Max normal + Ideal value
- Status indicator: Normal / High / Low / Ideal
- Trend calculation: Change from previous test

### **Visualization Foundation (To Be Built Later):**
- Line charts showing marker trends over time
- Reference range bands (ideal zone vs. caution zone)
- Latest value display with status
- Comparison to baseline (first test)
- Rate of change indicator

### **Features Deferred:**
- ❌ NOT building visualization yet
- ❌ NOT finalizing marker list yet
- ❌ NOT implementing alerts/notifications yet
- ❌ NOT creating detailed dashboard layout yet

### **Next Steps for Blood Work:**
1. User provides sample marker list + reference ranges
2. Design database schema
3. Create input form for blood work entries
4. Implement trend calculations
5. Build comprehensive dashboard
6. Add alerts for abnormal values
7. Create health marker insights

**Timeline:** Detailed blood work requirements will be finalized in next iteration.

---

# **PART 5: CROSS-PAGE ALIGNMENT**

## **5.1 Visual Consistency (LOCKED IN)**
- ✅ Same design system across all pages
- ✅ Consistent colors, typography, spacing
- ✅ Same component patterns

## **5.2 Navigation & Access (LOCKED IN)**
- ✅ Dashboard is the hub
- ✅ Users access Weekly & Monthly Reflections FROM dashboard
- ✅ Daily Log is ONLY for daily logging
- ✅ Clear navigation between pages

## **5.3 Mobile Experience (LOCKED IN)**
- ✅ Daily Log: Mobile good (as is)
- ⚠️ Weekly & Monthly: Need mobile optimization
- ⚠️ Blood Work: Will need mobile-friendly charts later

## **5.4 Progress Bar Display (LOCKED IN)**
- ✅ **Daily Log:** Program progress (0-548 days)
- ✅ **Weekly Page:** Program progress (0-548 days)
- ✅ Both visual bar + percentage shown

---

# **PART 6: PROGRAM ACCOUNTABILITY**

## **6.1 Rules to Support in App**
1. **Daily Accountability:** Log within 24-36 hours
2. **Weekly Reflection:** Every Sunday
3. **Weekly Weigh-In:** Optional (but prompted)
4. **Monthly Submission:** MANDATORY with mentor's word
5. **Failure Rate:** 10% allowed (calculate & alert)
6. **Timeline:** 18 months starting June 1, 2026
7. **Goal:** 15% body mass loss

---

# **SUMMARY OF ALL CHANGES**

## **Daily Log:**
- [ ] Add progress bar (not day numbers)
- [ ] Add meal bowl validation: <10 men, <8 women, <1 C, <2 R
- [ ] Show warnings (alerts only, can override)
- [ ] Add supplement check: 75% minimum
- [ ] Only tick if all rules met

## **Weekly Reflection:**
- [ ] Add prominent week header with dates
- [ ] Add sector-wise target analysis (Meals, Supplements, Hydration, Movement, Sleep)
- [ ] Add comparisons: vs. previous week AND vs. average
- [ ] Add weekly weigh-in tracker (optional, card on page)
- [ ] Add weight visualization (trend line, progress to goal)
- [ ] Show overall win rate

## **Monthly Reflection:**
- [ ] Make month display prominent with dates
- [ ] Add goal progress visualization
- [ ] Show 3 charts: entire month journey + journey to date + trend lines
- [ ] Add PRIORITY section: Mentor's Word (user inputs)
- [ ] Add reflection input for mentor's word

## **Dashboard:**
- [ ] Add Blood Work Tracker section (MVP - structure only)
- [ ] Design marker input form
- [ ] Plan for trend visualization
- [ ] Document marker categories and reference ranges

## **Mobile:**
- [ ] Optimize Weekly Reflection for mobile
- [ ] Optimize Monthly Reflection for mobile
- [ ] Ensure all charts are mobile-responsive

---

# **REMAINING CLARIFICATIONS - NONE**

✅ All requirements are now locked in and clear.

✅ No ambiguity remaining.

✅ Ready for code implementation.

---

# **KEY DECISION SUMMARY**

| Item | Decision | Notes |
|------|----------|-------|
| Meal Bowl Violations | Alerts only | Users can override |
| Supplement Tick | ≥75% taken | Calculate as percentage |
| Weekly Weigh-In | Optional | Card on weekly page |
| Mentor's Word | User inputs | Not admin input |
| Blood Work | Phase 1 only | Detailed work later |
| Progress Bar | Both on pages | Daily + Weekly |
| Sector Analysis | 5 categories | Meals, Supp, Hydra, Move, Sleep |
| Comparisons | Both types | vs. Previous + vs. Average |

---

**✅ READY TO BUILD! ALL REQUIREMENTS LOCKED IN.** 🚀
