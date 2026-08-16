# ZAP staging baseline

- CI: `.github/workflows/security-staging.yml` (schedule + dispatch).
- Target: secret `STAGING_BASE_URL` only — never production.
- Rules placeholder: `.zap-rules.tsv` (empty; add `RULE_ID\tIGNORE\tcomment` rows as needed).
