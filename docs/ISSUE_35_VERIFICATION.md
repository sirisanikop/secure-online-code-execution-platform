# CEP-F-043 (#35) — Auth + History UI Verification

**Requirement:** Functional, SRS section 4.5  
**Module:** FrontendUI | **Design spec:** DS-UI-02 | **Test case:** TC-UI-04

## Scope and acceptance criteria

Verify that the web interface provides registration and login forms with inline validation messages, and a history page that lists past runs and opens their details.

- Invalid input displays a validation message next to the relevant field.
- The history page lists past runs.
- A user can open a listed run and view its details.

## Verification procedure

### Registration and login validation
1. Open the application and navigate to registration.
2. Submit invalid input (for example, leave a required field empty or enter a value the form rejects).
3. Record whether a validation message appears next to the relevant field.
4. Correct the input and note whether the message clears or updates.
5. Repeat the invalid-input check on the login form.

### Execution history
1. Sign in using a test account.
2. Navigate to the history page.
3. Check whether previous execution records for that account are listed.
4. Select a listed run and verify that its detail view opens.
5. Record what is actually displayed.

## Results

| Check | Expected result | Actual result | Status |
|---|---|---|---|
| Registration invalid input | Inline message beside relevant field | To be recorded | Not run |
| Login invalid input | Inline message beside relevant field | To be recorded | Not run |
| History listing | Past runs are listed | To be recorded | Not run |
| Open run details | Selected run detail opens | To be recorded | Not run |

## Evidence to attach

- [ ] Registration validation screenshot
- [ ] Login validation screenshot
- [ ] History list screenshot
- [ ] Opened run detail screenshot

## Verification outcome

**Pending execution.** Complete the checks and attach evidence before treating TC-UI-04 as verified or closing issue #35.
