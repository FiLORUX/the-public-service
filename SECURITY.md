# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please follow responsible disclosure practices.

### How to Report

1. **Do not** open a public GitHub issue for security vulnerabilities
2. Email your findings to: **security@thepublicservice.se** (or use GitHub's private vulnerability reporting)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Any suggested fixes (optional)

### What to Expect

- **Acknowledgement**: Within 48 hours of your report
- **Initial Assessment**: Within 7 days
- **Resolution Timeline**: Depends on severity
  - Critical: 24-72 hours
  - High: 7 days
  - Medium: 30 days
  - Low: 90 days

### Scope

The following are in scope for security reports:

- Authentication and authorisation flaws
- Data exposure vulnerabilities
- Injection vulnerabilities (SQL, XSS, etc.)
- CORS misconfigurations
- Secrets exposure
- Cloudflare Worker security issues
- Supabase RLS policy bypasses

### Out of Scope

- Issues in third-party dependencies (report to upstream)
- Social engineering attacks
- Physical security
- Denial of service attacks

## Security Measures

This project implements several security measures:

### API Security

- Webhook secret verification for all sync endpoints
- Rate limiting (60 requests/minute per client)
- Input validation with Zod schemas
- Restricted CORS with explicit origin allowlist

### Database Security

- Row Level Security (RLS) policies
- Service role separation
- Audit logging of all changes
- Soft deletes (data recovery possible)

### Infrastructure Security

- Secrets managed via Cloudflare Workers secrets
- No secrets in version control
- HTTPS-only communication

## Acknowledgements

We appreciate the security research community's efforts in helping keep this project secure. Responsible disclosure will be acknowledged in our release notes (with your permission).
