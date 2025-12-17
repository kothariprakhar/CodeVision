# Database Migrations

This directory contains all SQL migrations for the Code Vision application. Migrations should be executed in order using the Supabase SQL Editor.

## Migration Order

Execute these migrations in the following order:

### 001_initial_setup.sql
**Status:** Applied (initial deployment)
**Description:** Core database schema including:
- Users table (extends Supabase Auth)
- Projects table (code repositories for analysis)
- Documents table (uploaded requirements, PRDs)
- Analysis results table (AI analysis outputs)
- Row Level Security (RLS) policies for all tables
- Indexes for common queries

### 002_northwestern_features.sql
**Status:** Applied
**Description:** Northwestern University access control and waitlist system:
- Admin configuration table for runtime config
- Waitlist requests table for non-Northwestern users
- Feedback submissions table (simple version)
- RLS policies and indexes

### 003_feedback_table.sql
**Status:** Pending manual execution
**Description:** Rich feedback system with comprehensive context capture:
- Feedback table with category, browser info, console logs
- Project associations for context-aware feedback
- Status tracking (new, reviewed, resolved)
- RLS policies for user privacy
- Indexes for common queries

**Note:** This creates a new `feedback` table separate from the `feedback_submissions` table in migration 002. The new table has richer context capture capabilities.

## How to Apply Migrations

1. Navigate to your Supabase project dashboard
2. Go to the SQL Editor
3. Copy the contents of the migration file
4. Paste into the SQL Editor
5. Execute the SQL
6. Verify the migration succeeded:
   - Check that tables were created
   - Verify indexes are in place
   - Test RLS policies

## Verification Queries

After applying a migration, run these queries to verify success:

```sql
-- Check if tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Verify indexes for a specific table
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'your_table_name';

-- Verify RLS policies for a specific table
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'your_table_name';
```

## Adding New Migrations

When creating a new migration:

1. Create a new SQL file with the next sequential number:
   - Format: `{number}_{descriptive_name}.sql`
   - Example: `004_add_analytics_table.sql`

2. Include ABOUTME comments at the top:
   ```sql
   -- ABOUTME: Brief description of what this migration does
   -- ABOUTME: Additional context or important notes
   ```

3. Use `IF NOT EXISTS` clauses to make migrations idempotent:
   ```sql
   CREATE TABLE IF NOT EXISTS table_name ...
   CREATE INDEX IF NOT EXISTS index_name ...
   ```

4. Always include:
   - Appropriate indexes for foreign keys and frequently queried columns
   - Row Level Security (RLS) policies
   - Check constraints for data validation
   - Comments for complex logic

5. Update this README with:
   - Migration number and name
   - Status (Pending/Applied)
   - Description of changes
   - Any special instructions or dependencies

## Rollback Strategy

Currently, we don't have automated rollback scripts. If you need to rollback a migration:

1. Document the rollback SQL in a comment in the migration file
2. Create a separate `{number}_rollback.sql` file if the rollback is complex
3. Test rollback thoroughly in a development environment first

## Best Practices

- **Never modify applied migrations** - create a new migration instead
- **Test in development first** - always test migrations in a dev environment
- **Use transactions** - wrap migrations in transactions when possible:
  ```sql
  BEGIN;
  -- migration SQL here
  COMMIT;
  ```
- **Backup before major changes** - create a database backup before applying migrations
- **Document breaking changes** - clearly document any breaking changes in this README
- **Check for locks** - ensure no long-running queries before applying migrations

## Migration History

| Number | Name | Applied Date | Applied By | Status |
|--------|------|-------------|------------|--------|
| 001 | initial_setup | 2024-11-XX | System | Applied |
| 002 | northwestern_features | 2024-12-13 | System | Applied |
| 003 | feedback_table | 2025-12-16 | Pending | Pending |

## Troubleshooting

### Common Issues

**Issue:** "relation already exists"
- **Solution:** The migration has already been applied, or there's a naming conflict

**Issue:** "permission denied"
- **Solution:** Ensure you're using the service role key or have appropriate permissions

**Issue:** "foreign key constraint"
- **Solution:** Ensure referenced tables exist and migrations are applied in order

**Issue:** "RLS policy conflict"
- **Solution:** Drop existing policies before creating new ones, or use `CREATE OR REPLACE POLICY`

## Support

For migration issues:
1. Check the Supabase dashboard logs
2. Review the SQL error message carefully
3. Verify all dependencies are met
4. Test the migration in a development environment
5. Contact the development team if issues persist
