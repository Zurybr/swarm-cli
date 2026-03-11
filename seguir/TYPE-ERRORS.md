# TypeScript Type Errors Report

**Generated:** 2026-03-11
**Command:** `npx tsc --noEmit`
**Status:** ❌ Type errors found

## Summary

- **Total Errors:** 23
- **Files with Issues:** 2
- **Severity:** Syntax errors (non-blocking for runtime, but prevents type checking)

---

## Files Affected

### 1. `tests/fixtures/sample-code/complex.ts`

**Error Count:** 12 errors

**Lines Affected:** 2-4

**Errors:**
- Line 2, Col 2: TS1109 - Expression expected
- Line 2, Col 11: TS1005 - ';' expected
- Line 2, Col 19: TS1434 - Unexpected keyword or identifier
- Line 2, Col 28: TS1005 - '(' expected
- Line 2, Col 36: TS1005 - ';' expected
- Line 2, Col 48: TS1005 - ';' expected
- Line 3, Col 13: TS1005 - ')' expected
- Line 3, Col 28: TS1005 - '(' expected
- Line 3, Col 33: TS1005 - ')' expected
- Line 3, Col 44: TS1434 - Unexpected keyword or identifier
- Line 3, Col 55: TS1434 - Unexpected keyword or identifier
- Line 3, Col 59: TS1434 - Unexpected keyword or identifier
- Line 4, Col 3: TS1161 - Unterminated regular expression literal

### 2. `tests/fixtures/sample-code/undocumented.ts`

**Error Count:** 11 errors

**Lines Affected:** 2-4

**Errors:**
- Line 2, Col 2: TS1109 - Expression expected
- Line 2, Col 11: TS1005 - ';' expected
- Line 2, Col 24: TS1434 - Unexpected keyword or identifier
- Line 2, Col 33: TS1005 - '(' expected
- Line 2, Col 41: TS1005 - ';' expected
- Line 2, Col 55: TS1005 - ';' expected
- Line 3, Col 13: TS1005 - ')' expected
- Line 3, Col 28: TS1005 - '(' expected
- Line 3, Col 36: TS1005 - ')' expected
- Line 3, Col 39: TS1434 - Unexpected keyword or identifier
- Line 4, Col 3: TS1161 - Unterminated regular expression literal

---

## Analysis

### Error Pattern
Both files exhibit similar syntax error patterns, suggesting:
1. **Possible malformed code** - These appear to be test fixture files that may contain intentionally broken code for testing purposes
2. **Syntax issues** - Missing semicolons, unexpected tokens, unterminated literals

### Impact
- **Type Safety:** Cannot perform full type checking on these files
- **Build Process:** May affect compilation if these files are included in the build target
- **Test Fixtures:** These are test fixtures, so they may be intentionally malformed

---

## Recommendations

1. **Verify Intent:** Check if these test fixtures are supposed to contain invalid TypeScript code
2. **Exclude from Type Check:** If intentional, consider excluding `tests/fixtures/sample-code/` from TypeScript compilation
3. **Fix if Unintentional:** If these should be valid TypeScript, investigate the syntax errors

---

## Next Steps

- [ ] Review fixture files to determine if errors are intentional
- [ ] Update `tsconfig.json` to exclude test fixtures if needed
- [ ] Fix syntax errors if files should be valid TypeScript

---

**Note:** This report only documents the errors. No fixes were applied as per task requirements.
