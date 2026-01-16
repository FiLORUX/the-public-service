# Contributing to The Public Service

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this broadcast production toolkit.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Code Style](#code-style)
- [Commit Messages](#commit-messages)
- [Pull Requests](#pull-requests)
- [Testing](#testing)

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Google account (for Apps Script development)
- Cloudflare account (for Worker development)
- Supabase account (for database development)

### Repository Structure

```
the-public-service/
├── *.gs                 # Google Apps Script files
├── worker/              # Cloudflare Worker (TypeScript)
├── studio-app/          # React PWA for iPad
├── supabase/            # Database schema
└── docs/                # Documentation
```

## Development Setup

### Google Apps Script

1. Create a new Google Sheet
2. Open Extensions → Apps Script
3. Copy `.gs` files into the script editor
4. Configure Script Properties with required secrets

For local development with version control:

```bash
npm install -g @google/clasp
clasp login
clasp clone <script-id>
```

### Cloudflare Worker

```bash
cd worker
npm install
npm run dev          # Local development
npm run typecheck    # Type checking
npm run deploy       # Deploy to Cloudflare
```

### Studio PWA

```bash
cd studio-app
npm install
npm run dev          # Local development (port 7700)
npm run build        # Production build
npm run preview      # Preview production build
```

## Making Changes

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `chore/` - Maintenance tasks

Example: `feature/add-export-functionality`

### Before You Start

1. Check existing issues and PRs
2. Open an issue to discuss significant changes
3. Fork the repository
4. Create a feature branch from `main`

## Code Style

### Language Policy

**All code, comments, and documentation must be in British English.**

- Use "colour" not "color"
- Use "initialise" not "initialize"
- Use "behaviour" not "behavior"
- Use "programme" not "program" (when referring to broadcast content)

### TypeScript

- Strict mode enabled
- No `any` types (use proper typing or `unknown`)
- Explicit return types on functions
- Use Zod for runtime validation

### Formatting

This project uses ESLint and Prettier. Run before committing:

```bash
npm run lint:fix
npm run format
```

Configuration:

- 2 space indentation
- Single quotes
- No semicolons
- 100 character line width
- Trailing commas

### Error Handling

- Never swallow errors silently
- Use custom error classes from `worker/src/errors.ts`
- Log detailed errors server-side
- Return safe messages to clients

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Formatting (no code change)
- `refactor:` - Code restructuring
- `perf:` - Performance improvement
- `test:` - Adding tests
- `chore:` - Maintenance
- `ci:` - CI/CD changes
- `build:` - Build system changes

### Scopes

- `worker` - Cloudflare Worker
- `studio` - Studio PWA
- `sheets` - Google Apps Script
- `db` - Database/Supabase
- `docs` - Documentation

### Examples

```
feat(worker): add Zod validation for sync payloads
fix(studio): correct timer drift with performance.now()
docs: update API documentation with new endpoints
chore(ci): add CodeQL security scanning
```

### Rules

- Present tense ("add feature" not "added feature")
- Lowercase first letter
- No period at the end
- Reference issues when relevant: `fixes #123`

## Pull Requests

### Before Submitting

1. Ensure all checks pass:

   ```bash
   npm run check  # Runs lint, format check, and typecheck
   ```

2. Update documentation if needed

3. Add tests for new functionality (when test framework is in place)

### PR Template

Your PR should include:

- Clear description of changes
- Type of change (bug fix, feature, etc.)
- Related issues
- Testing performed
- Screenshots (for UI changes)
- Breaking changes (if any)

### Review Process

1. Automated checks must pass
2. At least one maintainer review required
3. All conversations must be resolved
4. Branch must be up to date with `main`

## Testing

### Current Status

The test suite is being developed. When contributing:

1. Ensure existing functionality isn't broken
2. Test manually in appropriate environment
3. Document testing steps in PR

### Running Checks

```bash
# All checks
npm run check

# Individual checks
npm run lint
npm run format:check
npm run typecheck
```

### Manual Testing

- **Apps Script**: Test in a copy of the production sheet
- **Worker**: Use `wrangler dev` for local testing
- **Studio PWA**: Test in Chrome DevTools mobile emulation

## Questions?

- Open a [Discussion](https://github.com/thepublicservice/the-public-service/discussions)
- Check the [FAQ](FAQ.md)
- Review existing [Issues](https://github.com/thepublicservice/the-public-service/issues)

---

Thank you for contributing to open broadcast infrastructure!
