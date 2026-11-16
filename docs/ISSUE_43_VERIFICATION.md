# CEP-NF-005 (#43) — Usability Verification

**Requirement:** Non-functional / Usability, SRS section 5  
**Module:** FrontendUI | **Design spec:** DS-UI-01 | **Test case:** TC-UX-01

## Requirement

A first-time user should be able to register, log in, and run a program within 2 minutes without documentation. The UI should work in current Chrome, Edge, and Firefox at 1280×720 or larger.

## Acceptance criterion

A usability walkthrough with 3 users succeeds.

## Verification procedure

1. Recruit three people who have not previously used the application and obtain their agreement.
2. Prepare a clean first-time-user state for each participant.
3. Record the browser/version and display resolution (at least 1280×720).
4. Start timing when the participant is asked to begin.
5. Give only this task: register, log in, and run the supplied program. Do not provide documentation or step-by-step help.
6. Stop timing when the program has run and its result is visible.
7. Record completion time, task completion, assistance, browser, resolution, and observations.
8. Repeat for all three participants.
9. Record failures and blockers accurately.

## Per-participant pass rule

A participant passes only if they independently complete registration, login, and program execution in **2 minutes or less**, without documentation.

## Results summary

| Participant | Browser/version | Resolution | All tasks completed? | Time | Assistance used? | Result |
|---|---|---|---|---|---|---|
| P1 | To be recorded | To be recorded | To be recorded | To be recorded | To be recorded | Not run |
| P2 | To be recorded | To be recorded | To be recorded | To be recorded | To be recorded | Not run |
| P3 | To be recorded | To be recorded | To be recorded | To be recorded | To be recorded | Not run |

## Browser coverage

Record the actual browser and version for every participant. The requirement names current Chrome, Edge, and Firefox; note which were exercised. Do not claim coverage for browsers that were not tested.

## Evidence to attach

- [ ] Completed participant results
- [ ] Start/end timing notes
- [ ] Browser versions and display resolutions
- [ ] Screenshots or recording, where participants have consented

## Verification outcome

**Pending execution.** The issue description says TC-UX-01 has not been executed. Keep issue #43 open until the three-user walkthrough is completed and the results support the acceptance criterion.
