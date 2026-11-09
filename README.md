# Chart of Accounts / General Ledger - v2.1

Clone and integrate the entire codebase from this public GitHub repository into this project:https://github.com/ahtisham-omne/Partner-Mangemnet.git
This is a Vite + React + TypeScript app using Tailwind CSS v4, react-router, and Radix UI components. Here's what you need to do:1. Pull ALL files from the repo including: src/app/ (components, data, routes), src/styles/ (theme.css, index.css, fonts.css, tailwind.css), src/imports/ (reference TSX/TS files for context), src/assets/, src/main.tsx, and all root config files (package.json, vite.config.ts, postcss.config.mjs, index.html).2. The src/imports/ directory contains Figma Make export files (.tsx, .ts, .txt). These are reference files only — add "exclude": ["src/imports"] to tsconfig.app.json so they don't break the build but stay available for context.3. The app uses react-router v7 with createBrowserRouter. Lovable uses react-router-dom v6. Align ALL routing to react-router-dom v6 — update imports in routes.ts, layout.tsx, and any component using useNavigate, useParams, useLocation, Outlet, or RouterProvider to import from "react-router-dom" instead of "react".4. The entry point is src/main.tsx which renders the App component from src/app/App.tsx.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6277ab35-232c-4f79-bcdb-3d54599a2ff9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
