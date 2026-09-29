# SAMS Frontend

React + TypeScript + Vite + Tailwind CSS frontend for the Student Attendance Management System.

## Development

```bash
npm install
npm run dev
```

The production default uses the same-origin canonical API at `/api/v1`.

For local API development, copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` to the local backend origin.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
```

Production output is the static `dist/` directory. Node.js is a build-time/development dependency; the production architecture does not require a Node server.

## Architecture

Pages compose feature workflows. Feature adapters own API transport details, and a typed HTTP client will isolate canonical/legacy backend differences as the reconstruction progresses.

Final visual design is intentionally not frozen in this foundation phase; it will be established during the dedicated design R&D and Figma stage.
