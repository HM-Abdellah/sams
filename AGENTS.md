# SAMS Engineering Rules

## Mission
SAMS is a school attendance system. Optimize for correctness, reliability, security, maintainability, and a practical teacher workflow.

## Workflow
For significant changes:
1. Understand the existing system.
2. Write a concrete implementation plan.
3. Define testable user journeys and acceptance criteria.
4. Use TDD when suitable: RED -> GREEN -> REFACTOR.
5. Review the change from a fresh context.
6. Run verification before calling the work complete.
7. Record evidence; never claim a check that was not actually run.

## Repository rules
- Do not invent patterns when an existing repository pattern can be reused.
- Do not delete working production paths until their replacement exists and is verified.
- Prefer small, reversible changes inside each migration phase.
- Business rules belong in the PHP service/domain layer, not browser code.
- Repositories own database access; controllers do not contain SQL.
- Browser validation is UX only; server-side authorization and integrity are authoritative.
- Persistent mutations must enforce authentication, authorization, validation, CSRF where applicable, transaction boundaries, and audit logging.
- Never commit secrets, real student data, production credentials, or runtime logs.

## Target stack
- PHP 8.3
- MySQL / MariaDB
- Apache-compatible deployment
- React + TypeScript + Vite
- React Router
- Tailwind CSS
- REST / JSON
- PHPUnit
- Playwright
- PWA support without offline attendance synchronization

Do not add Redux, Next.js, GraphQL, WebSockets, microservices, Kubernetes, Docker Swarm, or a large UI framework unless a later architecture decision documents a concrete need.

## Completion standard
For the relevant scope, verify build, typecheck, lint, tests, database integration, critical E2E flows, security-sensitive paths, and the changed-file diff. Report actual results and known gaps.
