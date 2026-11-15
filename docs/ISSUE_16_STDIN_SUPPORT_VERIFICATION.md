# Issue #16 — stdin Support Verification

- Requirement: CEP-F-014 (Functional), SRS 4.2
- Priority/module/design: Medium / SandboxModule / DS-SBX-03
- Test case: TC-EXE-05

## Requirement
The system shall supply submitted stdin to the program and deliver end-of-file once it is consumed.

## Acceptance criterion
A program using input() echoes the supplied lines; reading past the end of the supplied input raises EOFError.

## Existing implementation status
The issue states this was implemented in merged PR #2. It remains open pending re-verification. This document does not assume the criterion has passed.

## Verification procedure
1. Submit a program that reads lines using Python input().
2. Supply multiple lines through the platform's stdin field.
3. Confirm that the program echoes all supplied lines in order.
4. Submit a separate program that attempts to read beyond the supplied input.
5. Confirm that the extra read raises EOFError.
6. Save test output or screenshots as evidence.

## Example program
```python
first = input()
second = input()
print(first)
print(second)
```

Supply two lines and confirm both are echoed. For the EOF check, attempt one additional input() after the supplied lines have been consumed.

## Results
- Supplied lines echoed in order: Pending execution
- Read beyond supplied input raises EOFError: Pending execution
- Evidence: Add after running TC-EXE-05

## Conclusion
Not yet verified. Close issue #16 only after both stdin behaviours are demonstrated.

## Suggested commit
`docs: add issue 16 stdin verification notes`

## Suggested PR description
Adds the verification procedure for CEP-F-014. The issue reports implementation in merged PR #2; this document records the re-verification steps and leaves results pending until TC-EXE-05 is executed.
