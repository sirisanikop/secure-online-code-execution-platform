# Issue #14 – Execution Status Classification

## Status definitions

The execution manager defines the following statuses:

- COMPLETED
- RUNTIME_ERROR
- TIMEOUT
- MEMORY_LIMIT
- OUTPUT_LIMIT
- BLOCKED
- INTERNAL_ERROR

## Verification

Test case: TC-EXE-03 – Status Classification

The test covers completed execution, runtime errors, timeouts,
memory limits, output limits and blocked code.

## Platform limitation

The sandbox uses Windows Job Objects.
Execution verification on macOS returns INTERNAL_ERROR because
the required Windows sandbox environment is unavailable.

Full status-classification verification must therefore be
performed on a supported Windows environment.

