---
name: Slither Finding
about: Track findings from Slither static analysis
title: "[SLITHER] "
labels: security, static-analysis
assignees: ""
---

## Finding Summary

**Detector:** <!-- e.g., reentrancy-eth, uninitialized-local -->
**Severity:** <!-- High / Medium / Low / Informational -->
**Confidence:** <!-- High / Medium / Low -->

## Location

**File:** `src/ContractName.sol`
**Line(s):**

## Description

<!-- Paste Slither output -->

```
[Detector output here]
```

## Analysis

### Is this a true positive?
- [ ] Yes - needs fix
- [ ] No - false positive (explain why)
- [ ] Unclear - needs investigation

### If false positive, why?
<!-- Explain why this is not a real issue -->

## Remediation

<!-- If true positive, describe the fix -->

## Checklist

- [ ] Analyzed the finding
- [ ] Determined true/false positive
- [ ] If true positive: fix implemented
- [ ] If false positive: added to `slither.config.json` filters
- [ ] Verified fix doesn't break tests
