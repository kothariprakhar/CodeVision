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

### 004_add_git_metadata_to_analysis.sql
**Status:** Pending manual execution
**Description:** Chrome plugin support - git metadata for analysis tracking:
- Adds `branch` column to analysis_results table (nullable)
- Adds `commit_hash` column to analysis_results table (nullable, 40-char SHA)
- Adds `commit_url` column to analysis_results table (nullable, GitHub commit link)
- Enables Chrome plugin to display "Analysis: main@abc123" with commit links

**Note:** Existing analyses will have NULL values for these fields. New analyses will capture git metadata automatically.

### 005_create_workspaces_table.sql
**Status:** Pending manual execution
**Description:** Chrome plugin support - multi-repository workspace management:
- Creates `workspaces` table for linking multiple repository analyses
- `domain_mappings` JSONB field maps domains to analysis IDs
- `analysis_ids` text array for workspace-owned analyses
- `manual_mappings` JSONB for API endpoint overrides
- Full RLS policies (SELECT, INSERT, UPDATE, DELETE)
- Indexes on user_id and analysis_ids for performance

**Note:** Workspaces enable Chrome plugin users to inspect full-stack applications where frontend and backend are separate repositories.

### 006_create_elements_table.sql
**Status:** Pending manual execution
**Description:** Chrome plugin support - element-level code inspection:
- Creates `elements` table for UI element analysis
- `handlers` JSONB field stores event handler details
- `api_calls` JSONB field stores API calls made by element
- `state_updates` JSONB field stores state changes
- Supports hierarchical elements via `parent_element_id`
- Full RLS policies for all CRUD operations
- Indexes on analysis_id and selectors for fast lookups

**Note:** Elements table enables Chrome plugin to trace data flow from UI element → API call → database for each inspected element.

### 007_add_email_verification.sql
**Status:** Pending manual execution
**Description:** Email verification system using OTP codes sent via email:
- Adds `email_verified` column to users table (defaults to false)
- Creates `email_verifications` table for storing 6-digit OTP codes
- Includes expiration tracking (15-minute validity)
- Foreign key constraints and indexes for performance
- Supports resend functionality with rate limiting

**Required Environment Variables:**
- `RESEND_API_KEY` - For sending OTP emails via Resend

**Note:** All existing users will have `email_verified = false` after migration. You may want to manually update trusted users.

### 008_add_business_lenses_to_analysis.sql
**Status:** Pending manual execution
**Description:** Business-facing architecture lenses for non-technical stakeholders:
- Adds `capability_graph` JSONB column to `analysis_results`
- Adds `journey_graph` JSONB column to `analysis_results`
- Adds `quality_report` JSONB column to `analysis_results`
- Enables storing deterministic business capability and user journey outputs

**Note:** Existing analyses will have `NULL` values for these fields. New analyses populate them automatically during analysis.

### 009_add_module_graph_artifacts.sql
**Status:** Pending manual execution
**Description:** Architecture Diagram artifacts for module-level 2D/3D visualization:
- Adds `module_graph` JSONB column to `analysis_results`
- Adds `module_quality_report` JSONB column to `analysis_results`
- Adds `module_graph_3d` JSONB column to `analysis_results`
- Adds `visual_quality_report` JSONB column to `analysis_results`
- Enables storing deterministic module graph outputs and 3D-ready visual payloads

**Note:** Existing analyses will have `NULL` values for these fields. New analyses populate them automatically during analysis.

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
| 004 | add_git_metadata_to_analysis | 2025-12-17 | Pending | Pending |
| 005 | create_workspaces_table | 2025-12-17 | Pending | Pending |
| 006 | create_elements_table | 2025-12-17 | Pending | Pending |
| 007 | add_email_verification | 2025-12-17 | Pending | Pending |
| 008 | add_business_lenses_to_analysis | 2026-03-03 | Pending | Pending |
| 009 | add_module_graph_artifacts | 2026-03-06 | Pending | Pending |

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
