# SQL Server Migration Notes

This project is moving from Supabase/PostgreSQL to an internal Microsoft SQL Server database through Prisma.

## Prisma Setup

Use the SQL Server provider in `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "sqlserver"
}
```

Use a SQL Server connection string in `DATABASE_URL`:

```env
DATABASE_URL="sqlserver://internal-sql-host:1433;database=nnpc_expense;schema=dbo;encrypt=true;trustServerCertificate=true"
```

For production, prefer a trusted certificate and remove `trustServerCertificate=true` once the server certificate chain is configured.

## Ready-to-run Schema Script

Use `prisma/sql-server-ready-schema.sql` to prepare a SQL Server database for the current app runtime. It creates the Better Auth login tables, app-owned `user_accounts`, profile/company/expense tables, key constraints, indexes, and starter expense types.

Super admins are not created through the app UI. Create the account through the normal sign-up flow first, then promote it in SQL editor:

```sql
UPDATE dbo.user_accounts
SET role = 'central_admin',
    access_status = 'approved',
    approved_at = SYSUTCDATETIME(),
    approved_by = NULL,
    disabled_at = NULL,
    disabled_by = NULL,
    updated_at = SYSUTCDATETIME()
WHERE email = 'admin@example.com';
```

The local project currently needs Prisma packages installed before project-root Prisma commands can load `prisma.config.ts`:

```bash
npm install --save-dev prisma
npm install @prisma/client
```

## Deliberate Schema Choices

- `user_accounts` is now the application-owned user root. The Supabase `auth.users` schema does not exist in SQL Server, so app tables reference `user_accounts.user_id`.
- UUID columns use SQL Server `uniqueidentifier` through `@db.UniqueIdentifier`.
- UUID primary keys use `newid()` database defaults. If insert locality becomes important, change these defaults to `newsequentialid()` in the first SQL Server migration.
- Large stored image data URLs use `ntext` because Prisma's SQL Server connector exposes `@db.NText`. Object storage should still be preferred for new file data.
- Role/status/language fields remain strings. Prisma does not support SQL Server enums, so use database `CHECK` constraints in the migration SQL.
- Referential actions are conservative on user-owned data to avoid SQL Server multiple-cascade-path issues. Delete workflows should remove dependent rows explicitly where the app also needs to clean up files.

## Prisma Gaps To Handle In SQL Migrations

Prisma cannot express every PostgreSQL feature currently used by `supabase/schema.sql`. Add these manually in the generated SQL Server migration before applying it:

```sql
ALTER TABLE dbo.user_accounts ADD CONSTRAINT user_accounts_display_name_nonempty
CHECK (LEN(LTRIM(RTRIM(display_name))) > 0);

ALTER TABLE dbo.user_accounts ADD CONSTRAINT user_accounts_role_check
CHECK (role IN ('user', 'admin', 'central_admin'));

ALTER TABLE dbo.user_accounts ADD CONSTRAINT user_accounts_access_status_check
CHECK (access_status IN ('pending', 'approved', 'disabled'));

ALTER TABLE dbo.user_companies ADD CONSTRAINT user_companies_company_name_nonempty
CHECK (LEN(LTRIM(RTRIM(company_name))) > 0);

CREATE UNIQUE INDEX user_companies_logo_path_idx
ON dbo.user_companies (logo_bucket_name, logo_object_path)
WHERE logo_object_path IS NOT NULL;

ALTER TABLE dbo.expense_reports ADD CONSTRAINT expense_reports_export_language_check
CHECK (export_language IN ('en', 'th'));

ALTER TABLE dbo.expense_reports ADD CONSTRAINT expense_reports_status_check
CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'exported'));

ALTER TABLE dbo.expense_reports ADD CONSTRAINT expense_reports_total_amount_nonnegative
CHECK (total_amount_thb >= 0);

ALTER TABLE dbo.expense_items ADD CONSTRAINT expense_items_amount_positive
CHECK (amount_thb > 0);

ALTER TABLE dbo.expense_items ADD CONSTRAINT expense_items_line_number_positive
CHECK (line_number > 0);

ALTER TABLE dbo.expense_receipts ADD CONSTRAINT expense_receipts_file_size_positive
CHECK (file_size_bytes IS NULL OR file_size_bytes > 0);
```

## Migration Work Still Needed

- Port the PostgreSQL RPC functions into service-layer code or SQL Server stored procedures.
- Replace Supabase RLS policies with application authorization checks. SQL Server row-level security is possible, but it will need an explicit user context strategy.
- Replace Supabase Storage calls with the chosen internal file storage system.
- Decide whether `expense_code` should be generated in application code or by a SQL Server trigger/stored procedure. Prisma can model the column but not the old PostgreSQL trigger logic.
