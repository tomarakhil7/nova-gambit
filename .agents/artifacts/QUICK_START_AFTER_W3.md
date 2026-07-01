# ⚡ QUICK START: WHEN WORKFLOW #3 COMPLETES

**This is your action card. Print it mentally and follow it immediately when W3 finishes.**

---

## STEP 1: You Got The Notification! (0 min)

Workflow #3 is complete. Adrenaline pumping? Good. Let's go.

---

## STEP 2: Extract Findings (5 minutes)

```bash
# 1. Find the output file from Workflow #3
# Look in: /private/tmp/claude-*/tasks/ or .agents/artifacts/

# 2. Open the file and copy the JSON output
# 3. Paste it into a temp file: /Users/a.tomar/Documents/Work/chess/.agents/artifacts/WORKFLOW_3_OUTPUT.json

# 4. Extract the key sections:
#    - gameAnalyses (array of 10 game analyses)
#    - blunderAnalysis (patterns across games)
#    - finalSynthesis (top recommended fixes)
```

**Done when:** You have identified the top 5 recommended fixes in priority order

---

## STEP 3: Understand The Findings (10 minutes)

Read the output and answer:

```
Q1: What's the #1 most common mistake?
→ [WRITE ANSWER]

Q2: How many times did it happen in 10 games?
→ [NUMBER] 

Q3: What's the impact per occurrence?
→ [MATERIAL LOSS / WIN IMPACT]

Q4: Which power combos were most frequently missed?
→ [LIST TOP 3]

Q5: Were SHIELD+DOUBLE_ATTACK combos missed? How often?
→ [YES/NO] [NUMBER OF TIMES]
```

---

## STEP 4: Create Prioritized Fix List (10 minutes)

Make a simple list:

```
CRITICAL (must fix first):
1. [Issue #1] - Frequency: [X/10] games - Impact: HIGH
   → File: game/js/bot.js
   → Lines: [XXX-YYY]
   → Fix: [One sentence description]

2. [Issue #2] - Frequency: [X/10] games - Impact: HIGH
   → File: game/js/bot.js
   → Lines: [XXX-YYY]
   → Fix: [One sentence description]

HIGH (implement next):
1. [Issue #3] - Frequency: [X/10] games - Impact: MEDIUM
   → File: game/js/bot.js
   → Lines: [XXX-YYY]
   → Fix: [One sentence description]
```

---

## STEP 5: Implement Fix #1 (30-45 minutes)

```bash
# 1. Open game/js/bot.js to the line range identified

# 2. Understand the current code
#    - Why is it wrong?
#    - What behavior do we want?

# 3. Write the fix
#    - Make the smallest change that addresses the issue
#    - Add inline comments explaining the fix
#    - Reference WORKFLOW_3_FINDINGS in your comments

# 4. Save and commit with specific message:
git commit -m "bot: Fix [issue name] - improve [X by Y%]

Issue: [description of problem]
Solution: [what was changed]
Impact: [expected improvement]
Files: game/js/bot.js (lines XXXX-YYYY)
Workflow: Workflow #3 blunder analysis"
```

---

## STEP 6: Test Fix #1 (20 minutes)

Open in browser:
```
file:///Users/a.tomar/Documents/Work/chess/.agents/artifacts/VALIDATION_TEST_5_GAMES.html
```

Check:
- ✅ All 5 games complete without errors
- ✅ No crashes or hangs
- ✅ Game length similar to baseline (±5%)
- ✅ Power spends detected
- ✅ Aether waste near 0

If PASS → Go to Step 7  
If FAIL → Debug, fix code, test again

---

## STEP 7: Implement Fix #2 (30-45 minutes)

Same as Step 5, but for the second fix.

---

## STEP 8: Test Fix #2 (20 minutes)

Same as Step 6.

---

## STEP 9: Implement Fix #3 (30-45 minutes)

Same as Step 5, but for the third fix (if there is one).

---

## STEP 10: Test Fix #3 (20 minutes)

Same as Step 6.

---

## STEP 11: Comprehensive Validation (45 minutes)

Run 10 games and track:

```
Metrics to measure:
- Total games completed: 10
- White wins: __
- Black wins: __
- Draws: __
- Average game length: __ moves
- Total aether waste: __ instances (target: 0)
- Average fountain occupancy: __% (target: 70%+)
- Power combos executed: __ (target: 10+)
- Critical blunders: __ (target: 0-1)

Compare vs baseline:
- Improvement: [+X% win rate, -Y blunders, etc]
```

---

## STEP 12: Document Results (30 minutes)

Create file: `FIXES_IMPLEMENTED.md`

```markdown
# Fixes Implemented After Workflow #3

## Summary
Applied [3-5] critical fixes to improve bot intelligence

## Fixes Applied

### Fix #1: [Name]
- Issue: [description]
- Solution: [what changed]
- Impact: [improvement]
- File: game/js/bot.js, lines XXX-YYY

### Fix #2: [Name]
- Issue: [description]
- Solution: [what changed]
- Impact: [improvement]
- File: game/js/bot.js, lines XXX-YYY

## Results (10-game validation)
- Win rate: X% (was Y%)
- Blunders: X (was Y)
- Aether waste: X (was Y)
- Power combos: X (was Y)
- Improvement: [+Z% overall]

## Testing
All fixes passed 10-game validation suite
No regressions detected
No crashes or errors

## Commit History
- [hash1] bot: Fix Issue #1
- [hash2] bot: Fix Issue #2
- [hash3] bot: Final validation and summary
```

---

## STEP 13: Final Commit (10 minutes)

```bash
git commit -m "bot: Apply [N] critical fixes from Workflow #3 analysis

Fixes implemented:
1. [Fix 1 with brief description]
2. [Fix 2 with brief description]
3. [Fix 3 with brief description]

Results:
- Win rate improvement: +X%
- Blunders reduced: Y→Z (X% reduction)
- Aether waste: near 0
- Power combo execution: +X%

Validation: 10 games passed, no regressions
Files: game/js/bot.js (lines XXXX-YYYY)
Workflow: Phase 5 implementation from Workflow #3 findings"

git log --oneline -3  # Show final commits
```

---

## STEP 14: Celebrate! 🎉

You've:
- ✅ Analyzed 10 real hard vs hard games
- ✅ Found specific blunders and missed opportunities
- ✅ Implemented targeted fixes
- ✅ Validated improvements with comprehensive testing
- ✅ Documented all changes

**Your bot is now significantly smarter!**

---

## TIMING SUMMARY

```
Step 1-4: Extract & Analyze ................ 25 min
Step 5-6: Fix #1 (code + test) ............ 50 min
Step 7-8: Fix #2 (code + test) ............ 50 min
Step 9-10: Fix #3 (code + test) ........... 50 min
Step 11: Comprehensive validation ......... 45 min
Step 12: Documentation .................... 30 min
Step 13: Final commit ..................... 10 min

TOTAL: ~250 minutes = ~4.25 hours
```

---

## IF YOU GET STUCK

**"Workflow #3 output is hard to parse"**
→ Read: `.agents/artifacts/WORKFLOW_3_COMPLETION_CHECKLIST.md` (Step 1-2)

**"I don't understand what the issue is"**
→ Read: `.agents/artifacts/POWER_STRATEGY_QUICK_REFERENCE.md`

**"I'm not sure how to fix it"**
→ Look at nearby code in bot.js
→ Check comments from Workflow #2 fixes (commit b023d1e)
→ Use the specific line numbers from Workflow #3 findings

**"My test is failing"**
→ Check browser console for errors
→ Verify game completes without crashes
→ Compare metrics vs baseline
→ Revert change and try different approach

**"I'm running out of time"**
→ Implement Fix #1 only
→ Test and commit
→ You've still made solid progress!

---

## REMEMBER

- **Small changes, big impact:** Don't overthink it
- **Test after each fix:** Catch regressions early
- **Commit frequently:** Never lose work
- **Document as you go:** Future you will thank you
- **You've got this:** 60% done already!

---

**Ready? Workflow #3 completion notification incoming soon!** 🚀
