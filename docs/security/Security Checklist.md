# SAMS Security Checklist

Status: Normative release gate
Version: 2026-10-06

## 1. How to use this checklist

This checklist is the operational verification companion to:
- `Security.md`
- `Auth.md`
- `Data security.md`
- `Threat Model.md`

Each release/change should be evaluated against the relevant items.

Do not mark an item PASS based on memory. Record actual evidence such as:
- command output;
- test result;
- code inspection;
- runtime response;
- browser evidence;
- CI result;
- backup/restore evidence.

## 2. Control catalog

| # | Control | Current SAMS baseline | Release verification |
|---:|---|---|---|
| 1 | Hide API keys/secrets | Frontend config is same-origin public config; local config is intended to stay untracked | Scan source, build output, Git tree/history |
| 2 | Check environment variables | Local `app.php` and database config are used; production values are deployment-specific | Validate required config, debug=false, no dev defaults/secrets exposed |
| 3 | Protect admin routes | Server-side admin role checks exist in canonical controllers | Test anonymous/teacher/counselor/admin access to each admin endpoint |
| 4 | Proper authentication | PHP session + login throttling + account state checks + session version | Test login, lockout, expiry, logout, invalidation |
| 5 | Check user access | Role + school/resource/assignment scoping exists in architecture | Adversarial object/function/tenant authorization tests |
| 6 | Sanitize/validate forms | Server-side validation patterns exist | Test type, length, format, semantic and unexpected-field cases |
| 7 | Protect XSS | React text rendering and Phase 19 XSS regression baseline | Re-run XSS payload suite and inspect dangerous sinks |
| 8 | Rate limiting | Login lockout and onboarding IP rate limiting exist | Test login/onboarding abuse; review sensitive endpoint coverage |
| 9 | Secure API endpoints | Canonical /api/v1, CSRF, auth, authorization, input/body limits | Endpoint inventory + negative authorization tests |
| 10 | Check CORS | Same-origin architecture; no intended permissive CORS | Verify no wildcard/reflective CORS in production |
| 11 | Security headers | Baseline headers exist in PHP/Apache/frontend deployment surfaces | Verify actual HTTP responses in production-like runtime |
| 12 | Turn off debug | Production guide requires `debug=false`; local config remains development | Runtime config verification and intentional failure test |
| 13 | Update dependencies | Composer/npm audits are part of release process | Run audits and review relevant advisories |
| 14 | Remove unused packages | No blanket removal; dependency graph review required | Inspect direct/indirect usage before removal |
| 15 | Check exposed files | .htaccess/public-root protections exist | Probe .env/.git/config/dumps/logs/private files |
| 16 | Secure DB access | Prepared PDO and transaction patterns exist | Verify runtime DB account permissions, host restrictions, TLS where needed |
| 17 | Hash passwords properly | password_hash/password_verify/password_needs_rehash used | Inspect algorithm/runtime settings and recovery flows |
| 18 | Check Git for secrets | .gitignore and secret audit baseline exist | Scan worktree + history; enable GitHub push protection where available |
| 19 | Full security audit | Prior security phases exist; final system-wide audit remains a release activity | Run full security suite and record result |

## 3. Mandatory pre-release gates

### Authentication
- [ ] Successful login verified.
- [ ] Invalid credentials return safe errors.
- [ ] Login throttling/lockout verified.
- [ ] Inactive account blocked.
- [ ] Session timeout verified.
- [ ] Session-version invalidation verified.
- [ ] Logout verified.
- [ ] No password/token leakage in responses or logs.

### Authorization
- [ ] Anonymous user blocked from protected functions.
- [ ] Teacher blocked from admin functions.
- [ ] Counselor blocked from admin-only functions.
- [ ] Cross-school access denied.
- [ ] Cross-class/assignment access denied.
- [ ] Direct endpoint access tested, not only UI navigation.
- [ ] Privileged mutations audited.

### Input/API
- [ ] Request-size limits verified.
- [ ] Server-side validation verified.
- [ ] Prepared SQL verified.
- [ ] Unexpected content types/fields handled safely.
- [ ] Rate limits verified for abuse-sensitive endpoints.
- [ ] CSRF verified for protected state-changing routes.
- [ ] Public onboarding exception verified separately.

### Browser
- [ ] XSS regression passes.
- [ ] No dangerous DOM execution sinks introduced.
- [ ] CSP/header behavior verified.
- [ ] CORS behavior verified.
- [ ] Secure cookies verified.
- [ ] No credential persistence in web storage.

### Secrets/configuration
- [ ] No .env or local secret config committed.
- [ ] No secrets in build output.
- [ ] No secrets in logs.
- [ ] Production debug disabled.
- [ ] Production configuration uses non-demo credentials.
- [ ] Git history checked when a secret leak is suspected.
- [ ] GitHub push protection enabled where repository capabilities allow it.

### Database/data
- [ ] Production DB account is least-privileged.
- [ ] Real-school DB is separate from test/demo.
- [ ] Tenant isolation verified.
- [ ] Historical attendance integrity verified.
- [ ] Import limits verified.
- [ ] Sensitive export paths reviewed.
- [ ] Backup completed before migration/upgrade.

### Recovery/operations
- [ ] Backup is readable.
- [ ] Restore has been tested.
- [ ] RTO/RPO decision exists for the production deployment.
- [ ] Admin recovery path is documented.
- [ ] Teacher recovery path is documented.
- [ ] Incident response path is documented.
- [ ] Rollback path is documented.
- [ ] Academic-year rollover procedure is documented and tested.

## 4. Evidence record

For each release, record:

`Release/commit:
Environment:
Database baseline:
Security test command:
Security test result:
Dependency audit:
Secret scan:
Browser security tests:
Backup/restore evidence:
Reviewer:
Date:
Open risks:
`

## 5. Release rule

A release MUST NOT be considered security-green when any unresolved Critical item exists.

High-risk unresolved items require explicit review and a documented decision before production.

A green checklist does not mean “zero vulnerabilities.” It means the documented controls were checked with the recorded evidence.

## 6. References

- OWASP ASVS 5: https://cornucopia.owasp.org/taxonomy/asvs-5.0/
- OWASP API Security Top 10: https://api-security.owasp.org/editions/2023/en/0x11-t10/
- OWASP REST Security: https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- OWASP HTTP Headers: https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
- OWASP Threat Modeling: https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html
- NIST CSF 2.0: https://www.nist.gov/cyberframework

