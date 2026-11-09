# Manual test TC-UX-01 - First-time user usability (requirement CEP-NF-005)

**Requirement:** a first-time user can register, log in and run a program within **2 minutes** without documentation, in a current Chrome, Edge or Firefox at 1280x720 or larger.

**Pass criteria:** at least 3 of 3 participants complete tasks 1-4 within 2 minutes each, with no help from the observer.

## Setup
- Start the app as in HOW_TO_RUN.md and open `http://127.0.0.1:8000` in a private window.
- Use participants who have not seen the app. Give no instructions beyond the task text.
- Observer starts a timer when the participant reads task 1 and stops after task 4.

## Tasks (read aloud)
1. Create an account.
2. Make the program print your name (the editor has an example already).
3. Run it and tell me what it printed.
4. Find the run you just did in the history.

## Record the results

| Participant | Browser | Task 1 | Task 2 | Task 3 | Task 4 | Total time | Help needed? | Pass? |
|---|---|---|---|---|---|---|---|---|
| P1 | | | | | | | | |
| P2 | | | | | | | | |
| P3 | | | | | | | | |

## Observations
- Where did people hesitate or click the wrong thing?
- Was any message unclear (validation, errors, blocked code)?
- Any accessibility issue (keyboard-only use, contrast)?

## Outcome
Result: ______ (Passed / Failed)   Date: ______   Observer: ______

If passed, update `docs/tools/results.js` (`TC-UX-01` -> "Passed") and regenerate the documents (HOW_TO_RUN.md section 6.3).
