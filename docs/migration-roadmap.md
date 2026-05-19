# Migration Roadmap

This project is being migrated from a Google AI Studio Build export into a
React + Express + SQLite architecture suitable for a small collaborative team.

## Current target stack

- Frontend: React + Vite
- Backend: Express
- Database: SQLite via `better-sqlite3`
- Auth: local accounts
- File storage: Volcengine TOS
- Deployment: single cloud server

## New domain model

- `WorkspaceProject`: project metadata shown in group/project lists
- `CanvasDocument`: the actual canvas payload (`nodes`, `edges`, `viewport`)

These are intentionally separate.

## Preferred APIs

- `/api/auth/*`
- `/api/users`
- `/api/groups`
- `/api/groups/:groupId/projects`
- `/api/workspace-projects/:id`
- `/api/canvas-documents/:workspaceProjectId`

## Legacy APIs

The following route family is retained only for backward compatibility with the
original exported prototype and should not receive new features:

- `/api/projects`

The legacy route stores data through `database.json`.

## Migration status

Completed:

- App shell split from auth/user management UI
- API-first repositories for users and workspace metadata
- SQLite schema and initialization module
- SQLite-backed users, groups, workspace projects, and canvas documents
- Minimal backend auth routes

Still pending:

- Asset persistence and TOS integration
- Task persistence and provider execution backend
- Operation logs
- Session persistence / stronger auth
- Further `InfiniteCanvas.tsx` decomposition
- Legacy route retirement

## Rule of thumb for new work

Do not add new features to the legacy `/api/projects` path. New functionality
should be implemented against the explicit domain model and the newer API
families above.
