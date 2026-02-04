# CLAUDE.md

> This file provides guidance for AI assistants (Claude, etc.) working in this repository.

## Repository Overview

- **Name**: savvyventure/main
- **Status**: Newly initialized repository (no application code yet)
- **Primary branch**: `main` (or default branch once established)

## Project Setup

This repository is currently empty. When the project is initialized, update this section with:

- Language/runtime requirements and versions
- Package manager and dependency installation commands
- Environment variables and configuration files needed
- Database or service dependencies

## Common Commands

<!-- Update these as the project develops -->

```bash
# Install dependencies
# (e.g., npm install, pip install -r requirements.txt, cargo build)

# Run the application
# (e.g., npm start, python main.py, cargo run)

# Run tests
# (e.g., npm test, pytest, cargo test)

# Run linter / formatter
# (e.g., npm run lint, ruff check ., cargo clippy)

# Build for production
# (e.g., npm run build, cargo build --release)
```

## Architecture

<!-- Describe the high-level architecture once the project takes shape -->

- Directory structure and module organization
- Key design patterns in use
- Data flow and state management approach
- External service integrations

## Code Conventions

- Follow the existing style and patterns established in the codebase
- Match the formatting enforced by any configured linter/formatter
- Write clear, descriptive commit messages
- Keep changes focused and minimal; avoid unrelated modifications in the same commit

## Testing

- Run the full test suite before committing changes
- Add tests for new functionality
- Ensure existing tests pass after modifications

## Git Workflow

- Develop on feature branches; do not push directly to the default branch
- Use clear, conventional commit messages
- Push changes and create pull requests for review

## Notes for AI Assistants

- **Read before editing**: Always read a file before modifying it
- **Minimal changes**: Only change what is necessary to accomplish the task
- **No over-engineering**: Avoid adding abstractions, utilities, or features beyond what is requested
- **Security**: Do not commit secrets, credentials, or `.env` files
- **Verify**: Run tests, linters, and builds after making changes to confirm nothing is broken
- **Update this file**: When significant project structure or tooling changes are made, update this CLAUDE.md accordingly
