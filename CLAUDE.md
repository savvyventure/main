# CLAUDE.md

> This file provides guidance for AI assistants (Claude, etc.) working in this repository.

## Repository Overview

- **Name**: savvyventure/main
- **Project**: SyncUp - Social platform for party and event enthusiasts
- **Primary branch**: `main`

## Project Setup

- **Runtime**: Node.js (v18+)
- **Package manager**: npm
- **Database**: SQLite (via better-sqlite3), stored in `data/syncup.db`
- **Template engine**: EJS
- **Session store**: SQLite (via connect-sqlite3), stored in `data/sessions.db`

```bash
# Install dependencies
npm install

# Initialize the database (creates tables)
npm run db:init

# Run in development mode (auto-restart on file changes)
npm run dev

# Run in production mode
npm start
```

The app runs on `http://localhost:3000` by default (configurable via `PORT` env var).

## Common Commands

```bash
npm install          # Install dependencies
npm run dev          # Development server with auto-reload
npm start            # Production server
npm run db:init      # Initialize/reset database tables
```

## Architecture

```
src/
  server.js          # Entry point - Express app setup, middleware, Socket.io
  db/
    database.js      # SQLite connection (shared singleton)
    schema.sql       # All table definitions
    init.js          # Database initialization script
  routes/
    index.js         # Home page
    auth.js          # Signup, login, logout
    events.js        # Event CRUD, search, filtering
    tables.js        # VIP table listings and bookings
    messages.js      # Chat consent, inbox, conversations
    reviews.js       # Event reviews and ratings
    profile.js       # User profiles
  middleware/
    auth.js          # requireAuth, redirectIfAuth middleware
  utils/
    socket.js        # Socket.io real-time messaging handler
views/
  partials/          # Shared header/footer EJS templates
  pages/             # Page-level EJS templates
public/
  css/style.css      # All styles
  js/                # Client-side JavaScript (if needed)
  images/            # Static images
data/                # SQLite database files (gitignored)
```

- **Pattern**: Server-side rendered MVC (Model-View-Controller)
- **Auth**: Session-based with bcrypt password hashing
- **Real-time**: Socket.io for private messaging
- **Database**: Synchronous better-sqlite3 queries

## Code Conventions

- Follow the existing style and patterns established in the codebase
- Use `require()` (CommonJS modules) — no ES module imports
- SQL queries use prepared statements to prevent injection
- Form validation via express-validator
- Keep changes focused and minimal; avoid unrelated modifications

## Testing

- Run `npm start` and verify the app loads at `http://localhost:3000`
- Test authentication flows (signup, login, logout)
- Test event creation, editing, and search
- Test VIP table booking workflow
- Test chat consent and messaging

## Git Workflow

- Develop on feature branches; do not push directly to the default branch
- Use clear, conventional commit messages
- Push changes and create pull requests for review

## Notes for AI Assistants

- **Read before editing**: Always read a file before modifying it
- **Minimal changes**: Only change what is necessary to accomplish the task
- **No over-engineering**: Avoid adding abstractions, utilities, or features beyond what is requested
- **Security**: Do not commit secrets, credentials, or `.env` files
- **Verify**: Run the app after making changes to confirm nothing is broken
- **Update this file**: When significant project structure or tooling changes are made, update this CLAUDE.md accordingly
