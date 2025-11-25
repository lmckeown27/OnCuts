# Security Policy

## Reporting a Vulnerability

The CampusCuts team takes security bugs seriously. We appreciate your efforts to responsibly disclose your findings.

### How to Report

**Please DO NOT open a public GitHub issue for security vulnerabilities.**

Instead, email us at: **security@campuscuts.com**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Fix Timeline**: Depends on severity
  - Critical: 24-48 hours
  - High: 1 week
  - Medium: 2 weeks
  - Low: 1 month

### Scope

**In Scope:**
- Backend API vulnerabilities
- Smart contract vulnerabilities
- iOS app security issues
- Authentication/authorization bypasses
- Payment processing vulnerabilities
- Data exposure issues
- Injection attacks (SQL, XSS, etc.)

**Out of Scope:**
- Social engineering
- Physical attacks
- Denial of service attacks
- Issues in third-party dependencies (report to them directly)

---

## Security Measures

### Smart Contracts

- **Audited** by third-party security firm
- **Open source** for community review
- **Immutable** once deployed (carefully tested)
- **Event-based** for transparency
- **Access controls** on critical functions

### Backend API

- **HTTPS only** in production
- **JWT authentication** with expiration
- **bcrypt** for password hashing (10 rounds)
- **Rate limiting** to prevent abuse
- **Input validation** on all endpoints
- **SQL parameterization** to prevent injection
- **Helmet.js** for security headers
- **CORS** properly configured

### Database

- **Encrypted connections** (SSL/TLS)
- **Principle of least privilege** for DB users
- **Regular backups** with encryption
- **No sensitive data** in logs
- **Audit logging** for critical operations

### Payment Security

- **PCI DSS compliant** via Stripe
- **No card data stored** on our servers
- **Webhook signature verification**
- **Encrypted payment tokens**
- **Fraud detection** via Stripe Radar

### iOS App

- **Keychain** for secure token storage
- **Certificate pinning** for API calls
- **Biometric authentication** option
- **No sensitive data** in UserDefaults
- **Obfuscated API keys**

### Data Privacy

- **GDPR compliant** data handling
- **CCPA compliant** for California users
- **User data deletion** capability
- **Encrypted data at rest**
- **Encrypted data in transit**
- **Minimal data collection**

---

## Best Practices for Contributors

### Code Review

- All PRs require review
- Security-sensitive changes require 2+ reviews
- Automated security scanning via GitHub

### Dependencies

- Regular updates for security patches
- Automated vulnerability scanning
- Lock files committed to repo

### Secrets Management

- **Never commit** secrets to Git
- Use environment variables
- AWS Secrets Manager or similar in production
- Rotate secrets regularly

### Authentication

- Strong password requirements (min 8 chars)
- Email verification required
- Student ID verification for barbers
- JWT tokens with expiration
- Refresh token rotation

---

## Security Headers

The backend API implements these security headers:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
```

---

## Vulnerability Disclosure Timeline

1. **Report received** → Acknowledged within 48h
2. **Validated** → Assessment within 1 week
3. **Fixed** → Based on severity
4. **Disclosed** → 90 days after fix or by agreement

---

## Hall of Fame

We recognize security researchers who help make CampusCuts safer:

<!-- Contributors who report valid security issues will be listed here -->

---

## Contact

- **Security Email**: security@campuscuts.com
- **General Contact**: contact@campuscuts.com
- **Bug Bounty**: Coming soon

---

Thank you for helping keep CampusCuts secure! 🔒

