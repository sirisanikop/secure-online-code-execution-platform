# Issue #38 — Admin RBAC Verification

- Requirement: CEP-F-052 (Functional), SRS 4.6
- Priority/module/design: High / AdminModule / DS-ADM-01
- Test case: TC-ADM-03

## Requirement
The system shall respond with HTTP 403 to any non-administrator calling an admin endpoint.

## Acceptance criterion
A normal user's token on `/api/admin/*` returns HTTP 403.

## Existing implementation status
The issue states this was implemented in merged PR #2. It remains open pending re-verification. This document does not assume the criterion has passed.

## Verification procedure
1. Obtain a valid authentication token for a normal, non-administrator user.
2. Use that token to call an available protected endpoint under `/api/admin/*`.
3. Confirm HTTP 403 Forbidden.
4. Record the endpoint tested, the user's role, and the response status.
5. Save response output or screenshots as evidence.

## Results
- Endpoint tested: Add after execution
- Token role: Normal user
- Response status: Pending execution
- Evidence: Add after running TC-ADM-03

## Conclusion
Not yet verified. Close issue #38 only after a normal user's token is confirmed to receive HTTP 403 from an admin endpoint.

## Suggested commit
`docs: add issue 38 admin RBAC verification notes`

## Suggested PR description
Adds the verification procedure for CEP-F-052. The issue reports implementation in merged PR #2; this document records the re-verification steps and leaves results pending until TC-ADM-03 is executed.
