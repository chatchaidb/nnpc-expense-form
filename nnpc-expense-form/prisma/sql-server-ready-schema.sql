/*
  NNPC expense SQL Server schema readiness script.

  Scope:
  - Better Auth email/password login tables.
  - App-level user management tables and constraints.
  - Expense creation tables, indexes, and starter expense types.
  - Receipt/logo columns remain metadata/data-url compatible until object storage is configured.

  Super admin setup:
  1. Create the user through the app sign-up flow so Better Auth writes [user]/[account].
  2. Promote the matching app account through SQL editor:

     UPDATE dbo.user_accounts
     SET role = 'central_admin',
         access_status = 'approved',
         approved_at = SYSUTCDATETIME(),
         approved_by = NULL,
         disabled_at = NULL,
         disabled_by = NULL,
         updated_at = SYSUTCDATETIME()
     WHERE email = 'admin@example.com';
*/

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.[user]', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.[user] (
    id uniqueidentifier NOT NULL CONSTRAINT user_id_df DEFAULT newid(),
    name nvarchar(255) NOT NULL,
    email nvarchar(320) NOT NULL,
    emailVerified bit NOT NULL CONSTRAINT user_email_verified_df DEFAULT 0,
    image nvarchar(2048) NULL,
    createdAt datetime2 NOT NULL CONSTRAINT user_created_at_df DEFAULT sysutcdatetime(),
    updatedAt datetime2 NOT NULL CONSTRAINT user_updated_at_df DEFAULT sysutcdatetime(),
    CONSTRAINT user_pk PRIMARY KEY (id),
    CONSTRAINT user_email_unique UNIQUE (email)
  );
END;

IF OBJECT_ID(N'dbo.[session]', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.[session] (
    id uniqueidentifier NOT NULL CONSTRAINT session_id_df DEFAULT newid(),
    expiresAt datetime2 NOT NULL,
    token nvarchar(255) NOT NULL,
    createdAt datetime2 NOT NULL CONSTRAINT session_created_at_df DEFAULT sysutcdatetime(),
    updatedAt datetime2 NOT NULL CONSTRAINT session_updated_at_df DEFAULT sysutcdatetime(),
    ipAddress nvarchar(64) NULL,
    userAgent nvarchar(1024) NULL,
    userId uniqueidentifier NOT NULL,
    CONSTRAINT session_pk PRIMARY KEY (id),
    CONSTRAINT session_token_unique UNIQUE (token),
    CONSTRAINT session_user_fk FOREIGN KEY (userId) REFERENCES dbo.[user] (id) ON DELETE CASCADE
  );
END;

IF OBJECT_ID(N'dbo.[account]', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.[account] (
    id uniqueidentifier NOT NULL CONSTRAINT account_id_df DEFAULT newid(),
    accountId nvarchar(255) NOT NULL,
    providerId nvarchar(255) NOT NULL,
    userId uniqueidentifier NOT NULL,
    accessToken nvarchar(max) NULL,
    refreshToken nvarchar(max) NULL,
    idToken nvarchar(max) NULL,
    accessTokenExpiresAt datetime2 NULL,
    refreshTokenExpiresAt datetime2 NULL,
    scope nvarchar(1024) NULL,
    password nvarchar(1024) NULL,
    createdAt datetime2 NOT NULL CONSTRAINT account_created_at_df DEFAULT sysutcdatetime(),
    updatedAt datetime2 NOT NULL CONSTRAINT account_updated_at_df DEFAULT sysutcdatetime(),
    CONSTRAINT account_pk PRIMARY KEY (id),
    CONSTRAINT account_user_fk FOREIGN KEY (userId) REFERENCES dbo.[user] (id) ON DELETE CASCADE,
    CONSTRAINT account_provider_account_unique UNIQUE (providerId, accountId)
  );
END;

IF OBJECT_ID(N'dbo.[verification]', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.[verification] (
    id uniqueidentifier NOT NULL CONSTRAINT verification_id_df DEFAULT newid(),
    identifier nvarchar(255) NOT NULL,
    value nvarchar(max) NOT NULL,
    expiresAt datetime2 NOT NULL,
    createdAt datetime2 NOT NULL CONSTRAINT verification_created_at_df DEFAULT sysutcdatetime(),
    updatedAt datetime2 NOT NULL CONSTRAINT verification_updated_at_df DEFAULT sysutcdatetime(),
    CONSTRAINT verification_pk PRIMARY KEY (id)
  );
END;

IF OBJECT_ID(N'dbo.user_accounts', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.user_accounts (
    user_id uniqueidentifier NOT NULL CONSTRAINT user_accounts_user_id_df DEFAULT newid(),
    email nvarchar(320) NULL,
    display_name nvarchar(255) NOT NULL,
    role nvarchar(32) NOT NULL CONSTRAINT user_accounts_role_df DEFAULT N'user',
    access_status nvarchar(32) NOT NULL CONSTRAINT user_accounts_access_status_df DEFAULT N'pending',
    approved_at datetime2 NULL,
    approved_by uniqueidentifier NULL,
    disabled_at datetime2 NULL,
    disabled_by uniqueidentifier NULL,
    created_at datetime2 NOT NULL CONSTRAINT user_accounts_created_at_df DEFAULT sysutcdatetime(),
    updated_at datetime2 NOT NULL CONSTRAINT user_accounts_updated_at_df DEFAULT sysutcdatetime(),
    CONSTRAINT user_accounts_pk PRIMARY KEY (user_id)
  );
END;

IF OBJECT_ID(N'dbo.profiles', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.profiles (
    id uniqueidentifier NOT NULL,
    full_name nvarchar(255) NULL,
    employee_code nvarchar(64) NULL,
    department nvarchar(255) NULL,
    cost_center nvarchar(128) NULL,
    created_at datetime2 NOT NULL CONSTRAINT profiles_created_at_df DEFAULT sysutcdatetime(),
    updated_at datetime2 NOT NULL CONSTRAINT profiles_updated_at_df DEFAULT sysutcdatetime(),
    CONSTRAINT profiles_pk PRIMARY KEY (id),
    CONSTRAINT profiles_user_fk FOREIGN KEY (id) REFERENCES dbo.user_accounts (user_id) ON DELETE CASCADE
  );
END;

IF OBJECT_ID(N'dbo.user_companies', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.user_companies (
    id uniqueidentifier NOT NULL CONSTRAINT user_companies_id_df DEFAULT newid(),
    user_id uniqueidentifier NOT NULL,
    company_address nvarchar(max) NULL,
    company_name nvarchar(255) NOT NULL,
    company_tax_id nvarchar(64) NULL,
    logo_data_url ntext NULL,
    logo_bucket_name nvarchar(128) NULL CONSTRAINT user_companies_logo_bucket_df DEFAULT N'company-assets',
    logo_object_path nvarchar(1024) NULL,
    original_logo_file_name nvarchar(255) NULL,
    created_at datetime2 NOT NULL CONSTRAINT user_companies_created_at_df DEFAULT sysutcdatetime(),
    updated_at datetime2 NOT NULL CONSTRAINT user_companies_updated_at_df DEFAULT sysutcdatetime(),
    CONSTRAINT user_companies_pk PRIMARY KEY (id),
    CONSTRAINT user_companies_user_fk FOREIGN KEY (user_id) REFERENCES dbo.user_accounts (user_id)
  );
END;

IF OBJECT_ID(N'dbo.expense_types', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.expense_types (
    id bigint IDENTITY(1,1) NOT NULL,
    code nvarchar(64) NOT NULL,
    label nvarchar(128) NOT NULL,
    description nvarchar(max) NULL,
    requires_receipt bit NOT NULL CONSTRAINT expense_types_requires_receipt_df DEFAULT 1,
    is_active bit NOT NULL CONSTRAINT expense_types_is_active_df DEFAULT 1,
    sort_order int NOT NULL CONSTRAINT expense_types_sort_order_df DEFAULT 100,
    created_at datetime2 NOT NULL CONSTRAINT expense_types_created_at_df DEFAULT sysutcdatetime(),
    CONSTRAINT expense_types_pk PRIMARY KEY (id),
    CONSTRAINT expense_types_code_unique UNIQUE (code)
  );
END;

IF OBJECT_ID(N'dbo.expense_reports', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.expense_reports (
    id uniqueidentifier NOT NULL CONSTRAINT expense_reports_id_df DEFAULT newid(),
    user_id uniqueidentifier NOT NULL,
    reference_sequence bigint IDENTITY(1,1) NOT NULL,
    expense_code nvarchar(32) NOT NULL,
    expense_date date NOT NULL,
    company_id uniqueidentifier NULL,
    company_address nvarchar(max) NULL,
    company_name nvarchar(255) NULL,
    company_tax_id nvarchar(64) NULL,
    company_logo_data_url ntext NULL,
    company_logo_bucket_name nvarchar(128) NULL,
    company_logo_object_path nvarchar(1024) NULL,
    export_language nvarchar(8) NOT NULL CONSTRAINT expense_reports_export_language_df DEFAULT N'en',
    employee_name nvarchar(255) NULL,
    department nvarchar(255) NULL,
    cost_center nvarchar(128) NULL,
    note nvarchar(4000) NULL,
    status nvarchar(32) NOT NULL CONSTRAINT expense_reports_status_df DEFAULT N'draft',
    total_amount_thb decimal(12,2) NOT NULL CONSTRAINT expense_reports_total_amount_df DEFAULT 0,
    submitted_at datetime2 NULL,
    exported_at datetime2 NULL,
    created_at datetime2 NOT NULL CONSTRAINT expense_reports_created_at_df DEFAULT sysutcdatetime(),
    updated_at datetime2 NOT NULL CONSTRAINT expense_reports_updated_at_df DEFAULT sysutcdatetime(),
    CONSTRAINT expense_reports_pk PRIMARY KEY (id),
    CONSTRAINT expense_reports_user_date_unique UNIQUE (user_id, expense_date),
    CONSTRAINT expense_reports_reference_sequence_unique UNIQUE (reference_sequence),
    CONSTRAINT expense_reports_expense_code_unique UNIQUE (expense_code),
    CONSTRAINT expense_reports_user_fk FOREIGN KEY (user_id) REFERENCES dbo.user_accounts (user_id),
    CONSTRAINT expense_reports_company_fk FOREIGN KEY (company_id) REFERENCES dbo.user_companies (id)
  );
END;

IF OBJECT_ID(N'dbo.expense_items', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.expense_items (
    id uniqueidentifier NOT NULL CONSTRAINT expense_items_id_df DEFAULT newid(),
    report_id uniqueidentifier NOT NULL,
    expense_type_id bigint NULL,
    expense_type_label nvarchar(128) NOT NULL,
    amount_thb decimal(12,2) NOT NULL,
    remark nvarchar(max) NULL,
    line_number int NOT NULL CONSTRAINT expense_items_line_number_df DEFAULT 1,
    created_at datetime2 NOT NULL CONSTRAINT expense_items_created_at_df DEFAULT sysutcdatetime(),
    updated_at datetime2 NOT NULL CONSTRAINT expense_items_updated_at_df DEFAULT sysutcdatetime(),
    CONSTRAINT expense_items_pk PRIMARY KEY (id),
    CONSTRAINT expense_items_report_fk FOREIGN KEY (report_id) REFERENCES dbo.expense_reports (id) ON DELETE CASCADE,
    CONSTRAINT expense_items_type_fk FOREIGN KEY (expense_type_id) REFERENCES dbo.expense_types (id)
  );
END;

IF OBJECT_ID(N'dbo.expense_receipts', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.expense_receipts (
    id uniqueidentifier NOT NULL CONSTRAINT expense_receipts_id_df DEFAULT newid(),
    expense_item_id uniqueidentifier NOT NULL,
    bucket_name nvarchar(128) NOT NULL CONSTRAINT expense_receipts_bucket_name_df DEFAULT N'expense-receipts',
    object_path nvarchar(1024) NOT NULL,
    original_file_name nvarchar(255) NOT NULL,
    mime_type nvarchar(128) NULL,
    file_size_bytes bigint NULL,
    created_at datetime2 NOT NULL CONSTRAINT expense_receipts_created_at_df DEFAULT sysutcdatetime(),
    CONSTRAINT expense_receipts_pk PRIMARY KEY (id),
    CONSTRAINT expense_receipts_object_path_unique UNIQUE (object_path),
    CONSTRAINT expense_receipts_item_fk FOREIGN KEY (expense_item_id) REFERENCES dbo.expense_items (id) ON DELETE CASCADE
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'user_accounts_auth_user_fk')
  AND OBJECT_ID(N'dbo.[user]', N'U') IS NOT NULL
  AND OBJECT_ID(N'dbo.user_accounts', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM dbo.user_accounts AS app_user
    LEFT JOIN dbo.[user] AS auth_user
      ON auth_user.id = app_user.user_id
    WHERE auth_user.id IS NULL
  )
BEGIN
  ALTER TABLE dbo.user_accounts
    ADD CONSTRAINT user_accounts_auth_user_fk
    FOREIGN KEY (user_id) REFERENCES dbo.[user] (id);
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'user_accounts_approved_by_fk')
BEGIN
  ALTER TABLE dbo.user_accounts
    ADD CONSTRAINT user_accounts_approved_by_fk
    FOREIGN KEY (approved_by) REFERENCES dbo.user_accounts (user_id);
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'user_accounts_disabled_by_fk')
BEGIN
  ALTER TABLE dbo.user_accounts
    ADD CONSTRAINT user_accounts_disabled_by_fk
    FOREIGN KEY (disabled_by) REFERENCES dbo.user_accounts (user_id);
END;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'user_accounts_display_name_nonempty')
  ALTER TABLE dbo.user_accounts ADD CONSTRAINT user_accounts_display_name_nonempty CHECK (LEN(LTRIM(RTRIM(display_name))) > 0);

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'user_accounts_role_check')
  ALTER TABLE dbo.user_accounts ADD CONSTRAINT user_accounts_role_check CHECK (role IN (N'user', N'admin', N'central_admin'));

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'user_accounts_access_status_check')
  ALTER TABLE dbo.user_accounts ADD CONSTRAINT user_accounts_access_status_check CHECK (access_status IN (N'pending', N'approved', N'disabled'));

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'user_companies_company_name_nonempty')
  ALTER TABLE dbo.user_companies ADD CONSTRAINT user_companies_company_name_nonempty CHECK (LEN(LTRIM(RTRIM(company_name))) > 0);

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'expense_reports_export_language_check')
  ALTER TABLE dbo.expense_reports ADD CONSTRAINT expense_reports_export_language_check CHECK (export_language IN (N'en', N'th'));

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'expense_reports_status_check')
  ALTER TABLE dbo.expense_reports ADD CONSTRAINT expense_reports_status_check CHECK (status IN (N'draft', N'submitted', N'approved', N'rejected', N'exported'));

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'expense_reports_total_amount_nonnegative')
  ALTER TABLE dbo.expense_reports ADD CONSTRAINT expense_reports_total_amount_nonnegative CHECK (total_amount_thb >= 0);

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'expense_items_amount_positive')
  ALTER TABLE dbo.expense_items ADD CONSTRAINT expense_items_amount_positive CHECK (amount_thb > 0);

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'expense_items_line_number_positive')
  ALTER TABLE dbo.expense_items ADD CONSTRAINT expense_items_line_number_positive CHECK (line_number > 0);

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'expense_receipts_file_size_positive')
  ALTER TABLE dbo.expense_receipts ADD CONSTRAINT expense_receipts_file_size_positive CHECK (file_size_bytes IS NULL OR file_size_bytes > 0);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'session_user_id_idx' AND object_id = OBJECT_ID(N'dbo.[session]'))
  CREATE INDEX session_user_id_idx ON dbo.[session] (userId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'account_user_id_idx' AND object_id = OBJECT_ID(N'dbo.[account]'))
  CREATE INDEX account_user_id_idx ON dbo.[account] (userId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'verification_identifier_idx' AND object_id = OBJECT_ID(N'dbo.[verification]'))
  CREATE INDEX verification_identifier_idx ON dbo.[verification] (identifier);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'user_accounts_role_idx' AND object_id = OBJECT_ID(N'dbo.user_accounts'))
  CREATE INDEX user_accounts_role_idx ON dbo.user_accounts (role);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'user_accounts_access_status_idx' AND object_id = OBJECT_ID(N'dbo.user_accounts'))
  CREATE INDEX user_accounts_access_status_idx ON dbo.user_accounts (access_status);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'user_accounts_access_status_role_idx' AND object_id = OBJECT_ID(N'dbo.user_accounts'))
  CREATE INDEX user_accounts_access_status_role_idx ON dbo.user_accounts (access_status, role);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'user_companies_user_created_idx' AND object_id = OBJECT_ID(N'dbo.user_companies'))
  CREATE INDEX user_companies_user_created_idx ON dbo.user_companies (user_id, created_at DESC);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'user_companies_logo_path_idx' AND object_id = OBJECT_ID(N'dbo.user_companies'))
  CREATE UNIQUE INDEX user_companies_logo_path_idx
  ON dbo.user_companies (logo_bucket_name, logo_object_path)
  WHERE logo_object_path IS NOT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'expense_reports_user_date_idx' AND object_id = OBJECT_ID(N'dbo.expense_reports'))
  CREATE INDEX expense_reports_user_date_idx ON dbo.expense_reports (user_id, expense_date DESC);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'expense_reports_company_idx' AND object_id = OBJECT_ID(N'dbo.expense_reports'))
  CREATE INDEX expense_reports_company_idx ON dbo.expense_reports (company_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'expense_items_report_line_idx' AND object_id = OBJECT_ID(N'dbo.expense_items'))
  CREATE INDEX expense_items_report_line_idx ON dbo.expense_items (report_id, line_number);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'expense_receipts_item_idx' AND object_id = OBJECT_ID(N'dbo.expense_receipts'))
  CREATE INDEX expense_receipts_item_idx ON dbo.expense_receipts (expense_item_id);

MERGE dbo.expense_types AS target
USING (VALUES
  (N'transportation', N'Transportation', 10),
  (N'client_food', N'Client food', 20),
  (N'gas', N'Gas', 30),
  (N'toll_fee', N'Toll fee', 40),
  (N'misc', N'Miscellaneous', 50)
) AS source (code, label, sort_order)
ON target.code = source.code
WHEN MATCHED THEN
  UPDATE SET label = source.label, sort_order = source.sort_order, is_active = 1
WHEN NOT MATCHED THEN
  INSERT (code, label, sort_order, requires_receipt, is_active)
  VALUES (source.code, source.label, source.sort_order, 1, 1);

COMMIT TRANSACTION;
