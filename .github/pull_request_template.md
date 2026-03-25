## Summary

_What does this PR do? Link to task/issue._

## Type of change

- [ ] Bug fix
- [ ] New feature / endpoint
- [ ] Database migration
- [ ] Refactor
- [ ] Documentation

## NC Articles affected

_List any NC articles whose logic is changed (e.g. Art.5.3.1, Art.18, Art.20.4.2)_

## Migration checklist

- [ ] Migration file follows `NNN_description.sql` naming
- [ ] Migration is idempotent (`IF NOT EXISTS`, `OR REPLACE`)
- [ ] Rollback is documented in the migration file header

## Test checklist

- [ ] Unit tests added / updated
- [ ] `npm run test` passes locally
- [ ] `npm run lint` passes
- [ ] Manual smoke test via Swagger UI

## ADR

_If this introduces an architectural decision, add an ADR entry to `reports/roadmap.md`._
