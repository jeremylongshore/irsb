# 031-DR-CHKL-security-hardening-checklist

**Document ID:** 031-DR-CHKL-security-hardening-checklist
**Repository:** irsb-solver
**Last Updated:** 2026-02-05
**Timezone:** America/Chicago

---

## Purpose

This checklist provides security hardening steps for future phases. Claude (or human operators) should follow this when implementing new features.

---

## 1. Input Validation Checklist

- [ ] **Schema validation**: All external inputs validated with Zod
- [ ] **Size limits**: Maximum payload size enforced
- [ ] **Type coercion**: Explicit type handling, no implicit coercion
- [ ] **Allowlists**: Use allowlists over blocklists where possible
- [ ] **Sanitization**: Remove/escape special characters as needed

---

## 2. Authentication & Authorization Checklist

- [ ] **No hardcoded credentials**: All secrets from environment
- [ ] **Least privilege**: Service runs with minimal permissions
- [ ] **API authentication**: Protected endpoints require auth tokens
- [ ] **Rate limiting**: Applied to authenticated endpoints
- [ ] **Audit logging**: Auth events logged with correlation IDs

---

## 3. Data Protection Checklist

- [ ] **Encryption at rest**: Sensitive data encrypted in storage
- [ ] **Encryption in transit**: TLS for all network communication
- [ ] **Log redaction**: Secrets never appear in logs
- [ ] **Secure deletion**: Sensitive data properly wiped
- [ ] **Backup security**: Backups encrypted and access-controlled

---

## 4. Execution Sandbox Checklist

- [ ] **Process isolation**: Jobs run in isolated processes
- [ ] **Resource limits**: CPU, memory, disk quotas
- [ ] **Network isolation**: No outbound network by default
- [ ] **Filesystem isolation**: Chroot or container filesystem
- [ ] **Time limits**: Maximum execution duration enforced

---

## 5. Evidence Integrity Checklist

- [ ] **Hashing**: All artifacts hashed with SHA-256
- [ ] **Manifest signing**: Manifest cryptographically signed
- [ ] **Append-only storage**: Evidence cannot be modified
- [ ] **Timestamp verification**: createdAt within acceptable range
- [ ] **Chain anchoring**: Hash anchored to blockchain (future)

---

## 6. API Security Checklist

- [ ] **Input validation**: Request bodies validated before processing
- [ ] **Output encoding**: Responses properly encoded
- [ ] **Error handling**: No stack traces in production errors
- [ ] **CORS policy**: Restrictive CORS for browser clients
- [ ] **Security headers**: Helmet.js or equivalent headers

---

## 7. Dependency Security Checklist

- [ ] **Audit**: `pnpm audit` run in CI
- [ ] **Lock files**: pnpm-lock.yaml committed
- [ ] **Updates**: Dependencies updated regularly
- [ ] **Minimal deps**: Only necessary dependencies included
- [ ] **License check**: Dependencies have compatible licenses

---

## 8. Deployment Security Checklist

- [ ] **Environment separation**: Dev/staging/prod isolated
- [ ] **Secret management**: Secrets from vault, not files
- [ ] **Container hardening**: Non-root user, read-only filesystem
- [ ] **Network policy**: Ingress/egress restricted
- [ ] **Monitoring**: Security events monitored and alerted

---

## 9. CI/CD Security Checklist

- [ ] **Branch protection**: Main branch protected
- [ ] **Code review**: All changes reviewed
- [ ] **Signed commits**: GPG signing enabled
- [ ] **SAST scanning**: CodeQL or equivalent
- [ ] **Secret scanning**: No secrets in commits

---

## 10. Incident Response Checklist

- [ ] **Logging**: Sufficient logs for investigation
- [ ] **Alerting**: Security alerts configured
- [ ] **Runbook**: Incident response documented
- [ ] **Contact list**: Security contacts identified
- [ ] **Post-mortem**: Process for learning from incidents

---

## Quick Reference: Per-Phase Security Gates

| Phase | Security Focus |
|-------|----------------|
| New endpoint | Input validation, rate limiting, auth |
| New job type | Sandbox, resource limits, allowlist |
| External API | TLS, auth, audit logging |
| Chain interaction | Key management, tx signing, replay protection |
| Production deploy | All checklists above |

---

*End of Document*
