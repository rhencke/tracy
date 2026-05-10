# Repository Instructions

## No Semantic Evasion

Do not satisfy a test, static check, benchmark, or review comment by disguising
the same behavior in a form the guardrail no longer recognizes.

Bad:
- splitting forbidden strings into fragments
- moving logic into a helper solely to dodge a regex
- relaxing or rewriting a guardrail to bless the current implementation
- replacing a real check with an echo, stub, skipped test, or weaker assertion
- increasing budgets/timeouts to make CI pass without fixing the cause

When a guardrail fails, first explain the protected semantic property in plain
English. Then fix the implementation so the property is true. Only change the
guardrail if it was wrong, and in that case strengthen it with an observed
behavioral test when possible.
