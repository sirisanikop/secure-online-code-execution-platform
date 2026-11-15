# Issue #28 — Persist Runs Verification

- Requirement: CEP-F-030 (Functional), SRS 4.4
- Priority/module/design: High / HistoryModule / DS-HIS-01
- Test case: TC-HIS-01

## Requirement
The system shall persist every execution (code, stdin, status, output, runtime, timestamp) linked to the submitting user.

## Acceptance criterion
After a run, the record is retrievable by its ID.

## Existing implementation status
The issue states this was implemented in merged PR #2. It remains open pending re-verification. This document does not assume the criterion has passed.

## Verification procedure
1. Authenticate as a platform user.
2. Submit and execute a program, providing stdin if applicable.
3. Capture the execution/run ID returned by the application.
4. Retrieve the execution record using the documented history or run-by-ID endpoint.
5. Confirm that the record is returned for the captured ID.
6. Inspect code, stdin, status, output, runtime, timestamp, and submitting-user association where those fields are exposed.
7. Save response output or screenshots as evidence.

## Results
- Run ID: Add after execution
- Record retrieved by ID: Pending execution
- Persisted fields inspected: Pending execution
- Evidence: Add after running TC-HIS-01

## Conclusion
Not yet verified. Close issue #28 only after a completed run's record is successfully retrieved using its ID.

## Suggested commit
`docs: add issue 28 persist runs verification notes`

## Suggested PR description
Adds the verification procedure for CEP-F-030. The issue reports implementation in merged PR #2; this document records the re-verification steps and leaves results pending until TC-HIS-01 is executed.
