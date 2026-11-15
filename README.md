# Secure Online Code Execution Platform

A web-based platform for submitting and executing code in a controlled environment. The repository separates the backend, frontend, sandbox-related modules, tests, and project documentation.

## Project Purpose

The purpose of this project is to provide an online interface for code submissions and coordinate their execution through a sandbox component, rather than running submitted code directly inside the main application process.

## Repository Components

| Directory / File | Purpose |
|---|---|
| `backend/` | Backend application and API logic |
| `frontend/` | User-facing web application |
| `app/` | Application modules, including routers, services, and sandbox-related code |
| `tests/` | Automated tests |
| `testing/` | Testing documentation and sample programs |
| `docs/` | Project and implementation documentation |
| `reports/` | Sprint and verification reports |
| `HOW_TO_RUN.md` | Detailed local setup and run instructions |

## Main Project Areas

- **Code execution:** Accepts code submissions and coordinates execution.
- **Sandboxing:** Contains the project components intended to isolate submitted code.
- **Backend API:** Implements application-side logic and routes.
- **Frontend:** Provides the user-facing interface.
- **Testing:** Includes automated tests and sample testing material.

## Prerequisites

Install the tools and dependencies specified in [`HOW_TO_RUN.md`](HOW_TO_RUN.md). These may include Python and backend packages, Node.js and npm for the frontend, and any additional system dependencies required by the project.

## Setup and Run

Use [`HOW_TO_RUN.md`](HOW_TO_RUN.md) as the source of truth for exact commands, environment variables, service startup order, and local URLs.

1. Clone the repository:

   ```bash
   git clone https://github.com/sirisanikop/secure-online-code-execution-platform.git
   cd secure-online-code-execution-platform
   ```

2. Follow the prerequisite and environment-configuration steps in `HOW_TO_RUN.md`.
3. Install backend dependencies using the command specified in `HOW_TO_RUN.md`.
4. Start the backend using the command specified in `HOW_TO_RUN.md`.
5. If the frontend runs as a separate service, install its dependencies and start it using the commands specified in `HOW_TO_RUN.md`.
6. Open the local frontend URL shown in the run instructions.

Do not assume default ports or environment-variable values. Use the checked-in configuration and `HOW_TO_RUN.md`.

## Testing

The repository includes automated tests under `tests/` and additional testing material under `testing/`. Follow the test commands documented in `HOW_TO_RUN.md` and the relevant test configuration files. Report environment-specific limitations accurately.

## Team

The repository and sprint assignment material identify these team accounts:

- `shamikamahesh223-lang`
- `samarthrao2`
- `sirisanikop`
- `subhassiyengar`

## Project Demonstration

- **Demo video:** _Add the final team demonstration video URL._
- **Walkthrough / presentation:** _Add the relevant walkthrough or presentation URL, if available._

## Further Documentation

- [Local setup and run instructions](HOW_TO_RUN.md)
- [Project documentation](docs/)
- [Testing material](testing/)
- [Sprint and verification reports](reports/)

---

Keep this README aligned with the actual implementation and setup guide. Add the final demonstration link before submitting the documentation deliverable.
