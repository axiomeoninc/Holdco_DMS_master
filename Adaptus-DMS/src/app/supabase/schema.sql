-- ============================================================================
-- ADAPTUS DMS - COMPLETE DATABASE SCHEMA
-- Single file: Creates tables, policies, indexes, triggers if not exists
-- Consolidates all SQL files into one for simplicity
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- MULTI-TENANT DEALERSHIP TABLES
-- ============================================================================

-- Dealerships table (tenant/workspace container)
CREATE TABLE IF NOT EXISTS dealerships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    subdomain TEXT UNIQUE,
    business_name TEXT,
    business_address TEXT,
    business_phone TEXT,
    business_email TEXT,
    logo_url TEXT,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended', 'Trial', 'Cancelled')),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table (updated with dealership_id and platform admin)
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    phone TEXT,
    avatar TEXT,
    role TEXT DEFAULT 'Staff' CHECK (role IN ('Admin', 'Manager', 'Staff', 'Salesperson')),
    dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL,
    is_platform_admin BOOLEAN DEFAULT false, -- Platform super admin (AdaptUs)
    is_active BOOLEAN DEFAULT true,
    start_date DATE,
    last_login TIMESTAMPTZ,
    user_permissions JSONB DEFAULT '[]', -- Individual permissions for this user
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roles table (per dealership, defines role types)
CREATE TABLE IF NOT EXISTS roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (name IN ('Admin', 'Manager', 'Salesperson', 'Staff')),
    description TEXT,
    is_system BOOLEAN DEFAULT false, -- true for built-in roles
    permissions JSONB DEFAULT '[]', -- Array of permission strings
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(dealership_id, name)
);

-- User roles table (user <-> role mapping)
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, role_id)
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE UNIQUE,
    plan_name TEXT DEFAULT 'Basic',
    plan_price NUMERIC(10,2) DEFAULT 0,
    billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
    status TEXT DEFAULT 'Trial' CHECK (status IN ('Trial', 'Active', 'PastDue', 'Cancelled', 'Suspended')),
    features JSONB DEFAULT '[]',
    limits JSONB DEFAULT '{"users": 5, "vehicles": 50, "storage_gb": 10}',
    trial_ends_at TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Billing information table
CREATE TABLE IF NOT EXISTS billing_information (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE UNIQUE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    payment_method_type TEXT,
    payment_method_last4 TEXT,
    payment_method_brand TEXT,
    billing_name TEXT,
    billing_email TEXT,
    billing_phone TEXT,
    billing_address_line1 TEXT,
    billing_address_line2 TEXT,
    billing_city TEXT,
    billing_province TEXT,
    billing_postal_code TEXT,
    billing_country TEXT DEFAULT 'Canada',
    tax_exempt BOOLEAN DEFAULT false,
    tax_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PLATFORM SETTINGS TABLES
-- ============================================================================

-- Feature Flags table (platform-wide feature toggles)
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT true,
    value_type TEXT DEFAULT 'boolean' CHECK (value_type IN ('boolean', 'string', 'number', 'json')),
    value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default feature flags
INSERT INTO feature_flags (key, name, description, enabled, value_type) VALUES
    ('ai_receptionist', 'AI Receptionist', 'Enable AI-powered receptionist for handling customer inquiries', true, 'boolean'),
    ('ai_marketplace', 'AI Marketplace Posting', 'Enable AI-generated marketplace listings', true, 'boolean'),
    ('ai_content', 'AI Content Generator', 'Enable AI-powered content generation', true, 'boolean'),
    ('ai_reports', 'AI Reports', 'Enable AI-powered analytics and insights', true, 'boolean'),
    ('support_tickets', 'Support Tickets', 'Enable customer support ticket system', false, 'boolean'),
    ('export_csv', 'CSV Export', 'Enable CSV export functionality', true, 'boolean'),
    ('export_pdf', 'PDF Export', 'Enable PDF export functionality', true, 'boolean'),
    ('ocr_scan', 'OCR Document Scanning', 'Enable OCR document scanning feature', true, 'boolean'),
    ('vin_lookup', 'VIN Lookup', 'Enable VIN lookup feature', true, 'boolean'),
    ('finance_calculator', 'Finance Calculator', 'Enable finance calculator tool', true, 'boolean')
ON CONFLICT (key) DO NOTHING;

-- Platform Announcements table
CREATE TABLE IF NOT EXISTS announcements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    target_audience TEXT DEFAULT 'all' CHECK (target_audience IN ('all', 'admins', 'platform')),
    is_active BOOLEAN DEFAULT true,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CORE TABLES (UPDATED WITH DEALERSHIP_ID)
-- ============================================================================

-- Vehicles table (updated)
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vin TEXT NOT NULL,
    stock_number TEXT,
    year INTEGER NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    trim TEXT,
    odometer INTEGER DEFAULT 0,
    condition TEXT DEFAULT 'Used' CHECK (condition IN ('New', 'Used', 'Certified')),
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Sold', 'Pending', 'Traded', 'Coming Soon', 'Inactive')),
    exterior_color TEXT,
    interior_color TEXT,
    fuel_type TEXT,
    transmission TEXT,
    drivetrain TEXT,
    engine TEXT,
    body_style TEXT,
    purchase_price NUMERIC(12,2) DEFAULT 0,
    retail_price NUMERIC(12,2) DEFAULT 0,
    extra_costs NUMERIC(12,2) DEFAULT 0,
    taxes NUMERIC(12,2) DEFAULT 0,
    image_gallery TEXT[],
    images TEXT,
    description TEXT,
    features TEXT[],
    carfax_report_url TEXT,
    purchased_from TEXT,
    fuel_capacity TEXT,
    city_fuel TEXT,
    highway_fuel TEXT,
    doors INTEGER,
    passengers INTEGER,
    msrp NUMERIC(12,2),
    title_status TEXT,
    special_price NUMERIC(12,2),
    warranty TEXT,
    disclosure TEXT,
    known_damage BOOLEAN NOT NULL DEFAULT false,
    internal_notes TEXT,
    youtube_url TEXT,
    inspection_report_url TEXT,
    dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent Hillz parity columns (safe on existing deployments)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'purchased_from') THEN
        ALTER TABLE vehicles ADD COLUMN purchased_from TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'fuel_capacity') THEN
        ALTER TABLE vehicles ADD COLUMN fuel_capacity TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'city_fuel') THEN
        ALTER TABLE vehicles ADD COLUMN city_fuel TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'highway_fuel') THEN
        ALTER TABLE vehicles ADD COLUMN highway_fuel TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'doors') THEN
        ALTER TABLE vehicles ADD COLUMN doors INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'passengers') THEN
        ALTER TABLE vehicles ADD COLUMN passengers INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'msrp') THEN
        ALTER TABLE vehicles ADD COLUMN msrp NUMERIC(12,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'title_status') THEN
        ALTER TABLE vehicles ADD COLUMN title_status TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'special_price') THEN
        ALTER TABLE vehicles ADD COLUMN special_price NUMERIC(12,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'warranty') THEN
        ALTER TABLE vehicles ADD COLUMN warranty TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'disclosure') THEN
        ALTER TABLE vehicles ADD COLUMN disclosure TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'known_damage') THEN
        ALTER TABLE vehicles ADD COLUMN known_damage BOOLEAN NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'internal_notes') THEN
        ALTER TABLE vehicles ADD COLUMN internal_notes TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'youtube_url') THEN
        ALTER TABLE vehicles ADD COLUMN youtube_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'inspection_report_url') THEN
        ALTER TABLE vehicles ADD COLUMN inspection_report_url TEXT;
    END IF;
END $$;

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    province TEXT,
    postal_code TEXT,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    source TEXT,
    notes TEXT,
    marketing_consent BOOLEAN NOT NULL DEFAULT false,
    sms_consent BOOLEAN NOT NULL DEFAULT false,
    marketing_consent_at TIMESTAMPTZ,
    sms_consent_at TIMESTAMPTZ,
    marketing_consent_ip TEXT,
    sms_consent_ip TEXT,
    marketing_unsubscribed_at TIMESTAMPTZ,
    marketing_consent_source TEXT,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent CASL consent columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'marketing_consent') THEN
        ALTER TABLE customers ADD COLUMN marketing_consent BOOLEAN NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'sms_consent') THEN
        ALTER TABLE customers ADD COLUMN sms_consent BOOLEAN NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'marketing_consent_at') THEN
        ALTER TABLE customers ADD COLUMN marketing_consent_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'sms_consent_at') THEN
        ALTER TABLE customers ADD COLUMN sms_consent_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'marketing_consent_ip') THEN
        ALTER TABLE customers ADD COLUMN marketing_consent_ip TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'sms_consent_ip') THEN
        ALTER TABLE customers ADD COLUMN sms_consent_ip TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'marketing_unsubscribed_at') THEN
        ALTER TABLE customers ADD COLUMN marketing_unsubscribed_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'marketing_consent_source') THEN
        ALTER TABLE customers ADD COLUMN marketing_consent_source TEXT;
    END IF;
END $$;

-- Sales Deals table
CREATE TABLE IF NOT EXISTS sales_deals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    salesperson_id UUID REFERENCES users(id) ON DELETE SET NULL,
    deal_date DATE DEFAULT CURRENT_DATE,
    sale_price NUMERIC(12,2) NOT NULL,
    down_payment NUMERIC(12,2) DEFAULT 0,
    trade_in_value NUMERIC(12,2) DEFAULT 0,
    deal_status TEXT DEFAULT 'Open' CHECK (deal_status IN ('Open', 'Pending', 'Closed', 'Lost', 'Cancelled')),
    financing_notes TEXT,
    warranty_package TEXT,
    gap_coverage BOOLEAN DEFAULT false,
    tire_coverage BOOLEAN DEFAULT false,
    paint_protection BOOLEAN DEFAULT false,
    extended_service BOOLEAN DEFAULT false,
    admin_fee NUMERIC(12,2) DEFAULT 0,
    total_price NUMERIC(12,2),
    dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_number TEXT UNIQUE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES sales_deals(id) ON DELETE SET NULL,
    invoice_date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    payment_amount NUMERIC(12,2) DEFAULT 0,
    tax_amount NUMERIC(12,2) DEFAULT 0,
    total NUMERIC(12,2) DEFAULT 0,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Paid', 'Overdue', 'Cancelled')),
    notes TEXT,
    dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wave M0/M3 invoice columns (idempotent for existing DBs)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) DEFAULT 13;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS package_name TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS line_items JSONB;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) DEFAULT 0;
ALTER TABLE sales_deals ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2);
ALTER TABLE sales_deals ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(12,2);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    interest_vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    source TEXT DEFAULT 'Website' CHECK (source IN ('Website', 'Referral', 'Event', 'Walk-in', 'Facebook', 'Craigslist', 'Kijiji', 'Phone', 'Instagram')),
    status TEXT DEFAULT 'Not Started' CHECK (status IN ('Not Started', 'In Progress', 'Qualified', 'Closed', 'Lost')),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    lead_creation_date TIMESTAMPTZ DEFAULT NOW(),
    last_engagement TIMESTAMPTZ DEFAULT NOW(),
    dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test Drives table
CREATE TABLE IF NOT EXISTS test_drives (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    scheduled_date TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Completed', 'Cancelled', 'No Show')),
    notes TEXT,
    outcome TEXT,
    dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendors table (creates if not exists, adds columns if missing, migrates data)
CREATE TABLE IF NOT EXISTS vendors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vendor_type TEXT DEFAULT 'General',
    vendor_name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    gst_number TEXT,
    hst_number TEXT,
    pst_number TEXT,
    city TEXT,
    province TEXT,
    postal_code TEXT,
    contact_name TEXT,
    contact_email TEXT,
    dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL,
    contact_phone TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns (safe - won't affect existing data)
DO $$
BEGIN
    -- Add new columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'vendor_type') THEN
        ALTER TABLE vendors ADD COLUMN vendor_type TEXT DEFAULT 'General';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'vendor_name') THEN
        ALTER TABLE vendors ADD COLUMN vendor_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'phone') THEN
        ALTER TABLE vendors ADD COLUMN phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'gst_number') THEN
        ALTER TABLE vendors ADD COLUMN gst_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'hst_number') THEN
        ALTER TABLE vendors ADD COLUMN hst_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'pst_number') THEN
        ALTER TABLE vendors ADD COLUMN pst_number TEXT;
    END IF;
END $$;

-- Migrate data from old 'name' column to 'vendor_name'
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'name')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'vendor_name') THEN
        -- Copy name to vendor_name where vendor_name is null
        UPDATE vendors SET vendor_name = name WHERE vendor_name IS NULL AND name IS NOT NULL;
        -- Drop the old name column if it exists (after data migration)
        ALTER TABLE vendors DROP COLUMN IF EXISTS name;
    END IF;
END $$;

-- Make vendor_name NOT NULL after data migration
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'vendor_name') THEN
        ALTER TABLE vendors ALTER COLUMN vendor_name SET NOT NULL;
    END IF;
END $$;

-- ============================================================================
-- OPERATIONS TABLES
-- ============================================================================

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    description TEXT,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    category TEXT DEFAULT 'General',
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    expense_date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Paid', 'Cancelled')),
    reference_number TEXT,
    notes TEXT,
    tax_amount NUMERIC(12, 2) DEFAULT 0,
    payment_method TEXT,
    entered_by UUID REFERENCES users(id) ON DELETE SET NULL,
    source_type TEXT,
    source_id UUID,
    paid_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks table (enhanced)
CREATE TABLE IF NOT EXISTS tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    due_date TIMESTAMPTZ,
    reminder_at TIMESTAMPTZ,
    priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Cancelled', 'On Hold')),
    notes TEXT,
    tags TEXT[],
    completed_at TIMESTAMPTZ,
    source_type TEXT,
    source_id UUID,
    dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task Notes table
CREATE TABLE IF NOT EXISTS task_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task Attachments table
CREATE TABLE IF NOT EXISTS task_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task Reminders table
CREATE TABLE IF NOT EXISTS task_reminders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    remind_at TIMESTAMPTZ NOT NULL,
    message TEXT,
    is_sent BOOLEAN DEFAULT false,
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task Links table (links tasks to various modules)
CREATE TABLE IF NOT EXISTS task_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
    link_type TEXT NOT NULL CHECK (link_type IN ('lead', 'customer', 'test_drive', 'deal', 'vehicle', 'invoice')),
    linked_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(task_id, link_type, linked_id)
);

-- Task Automation Rules table
CREATE TABLE IF NOT EXISTS task_automation_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL,
    trigger_config JSONB,
    action_type TEXT NOT NULL,
    action_config JSONB,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task Activity Log table
CREATE TABLE IF NOT EXISTS task_activity (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subject TEXT NOT NULL,
    description TEXT,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    status TEXT DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    source_type TEXT,
    source_id UUID,
    dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ticket Comments table
CREATE TABLE IF NOT EXISTS ticket_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ticket Attachments table
CREATE TABLE IF NOT EXISTS ticket_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ticket Activity Log table
CREATE TABLE IF NOT EXISTS ticket_activity (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Follow-ups table
CREATE TABLE IF NOT EXISTS follow_ups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    follow_up_date DATE NOT NULL,
    follow_up_time TIME,
    priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Completed', 'Cancelled', 'Rescheduled')),
    notes TEXT,
    reminder_at TIMESTAMPTZ,
    source_type TEXT,
    source_id UUID,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Follow-up History table
CREATE TABLE IF NOT EXISTS follow_up_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    follow_up_id UUID REFERENCES follow_ups(id) ON DELETE CASCADE NOT NULL,
    edited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    edited_at TIMESTAMPTZ DEFAULT NOW(),
    previous_description TEXT,
    new_description TEXT,
    previous_status TEXT,
    new_status TEXT,
    action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'status_changed', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Follow-up Activity Log table
CREATE TABLE IF NOT EXISTS follow_up_activity (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    follow_up_id UUID REFERENCES follow_ups(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expense Activity Log table
CREATE TABLE IF NOT EXISTS expense_activity (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bill of Sale table (Ontario BOS + legacy required columns)
CREATE TABLE IF NOT EXISTS bill_of_sale (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    deal_id UUID REFERENCES sales_deals(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    document_number TEXT UNIQUE,
    sale_date DATE DEFAULT CURRENT_DATE,
    buyer_name TEXT NOT NULL,
    buyer_address TEXT,
    buyer_phone TEXT,
    buyer_email TEXT,
    buyer_dl_number TEXT,
    seller_name TEXT,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    vehicle_description TEXT,
    sale_type TEXT,
    vin TEXT,
    year INTEGER,
    make TEXT,
    model TEXT,
    sale_price NUMERIC(12,2) NOT NULL,
    tax_amount NUMERIC(12,2) DEFAULT 0,
    total_amount NUMERIC(12,2) NOT NULL,
    odometer INTEGER,
    odometer_reading INTEGER,
    is_financed BOOLEAN DEFAULT false,
    lender_name TEXT,
    lender_address TEXT,
    status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Signed', 'Completed', 'Cancelled', 'Sold')),
    payment_status TEXT DEFAULT 'Not Paid',
    warranty_period TEXT,
    -- Section B: Pricing
    price_vehicle NUMERIC(12,2) DEFAULT 0,
    additional_equipment NUMERIC(12,2) DEFAULT 0,
    services_warranties NUMERIC(12,2) DEFAULT 0,
    documentation_fees NUMERIC(12,2) DEFAULT 0,
    vsa_levy_recovery NUMERIC(12,2) DEFAULT 0,
    extra_fee_1_taxable NUMERIC(12,2) DEFAULT 0,
    discount NUMERIC(12,2) DEFAULT 0,
    subtotal NUMERIC(12,2) DEFAULT 0,
    trade_in_allowance NUMERIC(12,2) DEFAULT 0,
    net_difference NUMERIC(12,2) DEFAULT 0,
    -- GST/PST
    gst_rate NUMERIC(5,2) DEFAULT 5.00,
    gst_amount NUMERIC(12,2) DEFAULT 0,
    pst_rate NUMERIC(5,2) DEFAULT 7.00,
    pst_amount NUMERIC(12,2) DEFAULT 0,
    purchase_price_with_gst_pst NUMERIC(12,2) DEFAULT 0,
    gst_enabled BOOLEAN DEFAULT true,
    pst_enabled BOOLEAN DEFAULT true,
    -- Section C: Additional fees
    licence_fee NUMERIC(12,2) DEFAULT 0,
    gasoline_fee NUMERIC(12,2) DEFAULT 0,
    finance_fee NUMERIC(12,2) DEFAULT 0,
    lien_payout NUMERIC(12,2) DEFAULT 0,
    extra_fee_2_non_taxable NUMERIC(12,2) DEFAULT 0,
    sub_total NUMERIC(12,2) DEFAULT 0,
    deposit NUMERIC(12,2) DEFAULT 0,
    down_payments NUMERIC(12,2) DEFAULT 0,
    down_payment NUMERIC(12,2) DEFAULT 0,
    insurance_life NUMERIC(12,2) DEFAULT 0,
    insurance_gap NUMERIC(12,2) DEFAULT 0,
    rst_on_insurance NUMERIC(12,2) DEFAULT 0,
    total_purchase_price NUMERIC(12,2) DEFAULT 0,
    ppsa_fee NUMERIC(12,2) DEFAULT 0,
    admin_fee NUMERIC(12,2) DEFAULT 0,
    amount_to_finance NUMERIC(12,2) DEFAULT 0,
    total_balance_due NUMERIC(12,2) DEFAULT 0,
    -- Section D: Financing
    payment_type TEXT,
    cost_of_borrowing NUMERIC(12,2) DEFAULT 0,
    payment_start_date DATE,
    finance_amount NUMERIC(12,2) DEFAULT 0,
    finance_term INTEGER,
    interest_rate NUMERIC(5,2),
    finance_company TEXT,
    payment_frequency TEXT,
    number_of_payments INTEGER,
    -- Section E: Trade-in vehicle
    trade_in_year INTEGER,
    trade_in_make TEXT,
    trade_in_model TEXT,
    trade_in_series TEXT,
    trade_in_cylinders INTEGER,
    trade_in_odometer INTEGER,
    trade_in_kms_miles TEXT DEFAULT 'KMS',
    trade_in_exterior_color TEXT,
    trade_in_interior_color TEXT,
    trade_in_vin TEXT,
    trade_in_stock_number TEXT,
    trade_in_owing_to TEXT,
    trade_in_odometer_delivery INTEGER DEFAULT 0,
    trade_in_disclosure TEXT,
    notes TEXT,
    is_new_version BOOLEAN DEFAULT false,
    dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bill_of_sale_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bill_of_sale_id UUID NOT NULL REFERENCES bill_of_sale(id) ON DELETE CASCADE,
    payment_name TEXT NOT NULL DEFAULT '',
    payment_type TEXT NOT NULL DEFAULT '',
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    payment_date DATE DEFAULT CURRENT_DATE,
    dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SOCIAL MEDIA TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS social_media_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    platform TEXT NOT NULL CHECK (platform IN ('Facebook', 'Instagram', 'Twitter', 'LinkedIn')),
    content TEXT NOT NULL,
    media_urls TEXT[],
    scheduled_date TIMESTAMPTZ,
    published_date TIMESTAMPTZ,
    status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Scheduled', 'Published', 'Failed')),
    notes TEXT,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS facebook_business_account (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_name TEXT NOT NULL,
    page_id TEXT,
    page_name TEXT,
    access_token TEXT,
    is_active BOOLEAN DEFAULT true,
    dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PURCHASE TRACKING TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS purchase_from_public (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    purchase_date DATE NOT NULL,
    purchase_price NUMERIC(12,2) NOT NULL,
    seller_name TEXT NOT NULL,
    seller_phone TEXT,
    seller_address TEXT,
    vin_verified BOOLEAN DEFAULT false,
    title_received BOOLEAN DEFAULT false,
    title_number TEXT,
    notes TEXT,
    dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FINANCIAL TRANSACTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS financial_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('Sale', 'Expense', 'Refund', 'Payment', 'Adjustment')),
    category TEXT,
    amount NUMERIC(12,2) NOT NULL,
    description TEXT,
    reference_id UUID,
    reference_type TEXT,
    transaction_date DATE DEFAULT CURRENT_DATE,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_task_notes_task_id ON task_notes(task_id);
CREATE INDEX IF NOT EXISTS idx_task_reminders_task_id ON task_reminders(task_id);
CREATE INDEX IF NOT EXISTS idx_task_reminders_remind_at ON task_reminders(remind_at) WHERE is_sent = false;
CREATE INDEX IF NOT EXISTS idx_task_links_task_id ON task_links(task_id);
CREATE INDEX IF NOT EXISTS idx_task_links_linked ON task_links(link_type, linked_id);

CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id ON ticket_attachments(ticket_id);

CREATE INDEX IF NOT EXISTS idx_follow_ups_customer_id ON follow_ups(customer_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_lead_id ON follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_assigned_to ON follow_ups(assigned_to);
CREATE INDEX IF NOT EXISTS idx_follow_ups_created_by ON follow_ups(created_by);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);
CREATE INDEX IF NOT EXISTS idx_follow_ups_follow_up_date ON follow_ups(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_follow_up_history_follow_up_id ON follow_up_history(follow_up_id);

CREATE INDEX IF NOT EXISTS idx_expenses_vendor_id ON expenses(vendor_id);
CREATE INDEX IF NOT EXISTS idx_expenses_vehicle_id ON expenses(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date);

CREATE INDEX IF NOT EXISTS idx_leads_customer_id ON leads(customer_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);

CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_make ON vehicles(make);
CREATE INDEX IF NOT EXISTS idx_vehicles_vin ON vehicles(vin);
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_dealership_id_vin_key ON vehicles(dealership_id, vin);

CREATE INDEX IF NOT EXISTS idx_deals_vehicle_id ON sales_deals(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_deals_customer_id ON sales_deals(customer_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON sales_deals(deal_status);

CREATE INDEX IF NOT EXISTS idx_test_drives_vehicle_id ON test_drives(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_test_drives_customer_id ON test_drives(customer_id);
CREATE INDEX IF NOT EXISTS idx_test_drives_scheduled_date ON test_drives(scheduled_date);

-- ============================================================================
-- DEALERSHIP INDEXES (Multi-tenant performance optimization)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_dealerships_slug ON dealerships(slug);
CREATE INDEX IF NOT EXISTS idx_dealerships_subdomain ON dealerships(subdomain);
CREATE INDEX IF NOT EXISTS idx_dealerships_status ON dealerships(status);

CREATE INDEX IF NOT EXISTS idx_users_dealership_id ON users(dealership_id);
CREATE INDEX IF NOT EXISTS idx_roles_dealership_id ON roles(dealership_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_dealership_id ON subscriptions(dealership_id);
CREATE INDEX IF NOT EXISTS idx_billing_information_dealership_id ON billing_information(dealership_id);

CREATE INDEX IF NOT EXISTS idx_vehicles_dealership_id ON vehicles(dealership_id);
CREATE INDEX IF NOT EXISTS idx_customers_dealership_id ON customers(dealership_id);
CREATE INDEX IF NOT EXISTS idx_customers_assigned_to ON customers(assigned_to);
CREATE INDEX IF NOT EXISTS idx_sales_deals_dealership_id ON sales_deals(dealership_id);
CREATE INDEX IF NOT EXISTS idx_invoices_dealership_id ON invoices(dealership_id);
CREATE INDEX IF NOT EXISTS idx_leads_dealership_id ON leads(dealership_id);
CREATE INDEX IF NOT EXISTS idx_test_drives_dealership_id ON test_drives(dealership_id);
CREATE INDEX IF NOT EXISTS idx_vendors_dealership_id ON vendors(dealership_id);
CREATE INDEX IF NOT EXISTS idx_expenses_dealership_id ON expenses(dealership_id);
CREATE INDEX IF NOT EXISTS idx_tasks_dealership_id ON tasks(dealership_id);
CREATE INDEX IF NOT EXISTS idx_tickets_dealership_id ON tickets(dealership_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_dealership_id ON follow_ups(dealership_id);
CREATE INDEX IF NOT EXISTS idx_bill_of_sale_dealership_id ON bill_of_sale(dealership_id);
CREATE INDEX IF NOT EXISTS idx_bill_of_sale_customer_id ON bill_of_sale(customer_id);
CREATE INDEX IF NOT EXISTS idx_bill_of_sale_deal_id ON bill_of_sale(deal_id);
CREATE INDEX IF NOT EXISTS idx_bill_of_sale_payments_bill_id ON bill_of_sale_payments(bill_of_sale_id);
CREATE INDEX IF NOT EXISTS idx_bill_of_sale_payments_dealership_id ON bill_of_sale_payments(dealership_id);
CREATE INDEX IF NOT EXISTS idx_social_media_posts_dealership_id ON social_media_posts(dealership_id);
CREATE INDEX IF NOT EXISTS idx_facebook_business_account_dealership_id ON facebook_business_account(dealership_id);
CREATE INDEX IF NOT EXISTS idx_purchase_from_public_dealership_id ON purchase_from_public(dealership_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_dealership_id ON financial_transactions(dealership_id);

-- ============================================================================
-- TRIGGER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create/update triggers (drop first if exists to recreate)
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vehicles_updated_at ON vehicles;
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_task_notes_updated_at ON task_notes;
CREATE TRIGGER update_task_notes_updated_at BEFORE UPDATE ON task_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ticket_comments_updated_at ON ticket_comments;
CREATE TRIGGER update_ticket_comments_updated_at BEFORE UPDATE ON ticket_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_follow_ups_updated_at ON follow_ups;
CREATE TRIGGER update_follow_ups_updated_at BEFORE UPDATE ON follow_ups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sales_deals_updated_at ON sales_deals;
CREATE TRIGGER update_sales_deals_updated_at BEFORE UPDATE ON sales_deals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_test_drives_updated_at ON test_drives;
CREATE TRIGGER update_test_drives_updated_at BEFORE UPDATE ON test_drives FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION log_task_activity(
    p_task_id UUID,
    p_user_id UUID,
    p_action TEXT,
    p_old_value JSONB DEFAULT NULL,
    p_new_value JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_activity_id UUID;
BEGIN
    INSERT INTO task_activity (task_id, user_id, action, old_value, new_value)
    VALUES (p_task_id, p_user_id, p_action, p_old_value, p_new_value)
    RETURNING id INTO v_activity_id;
    RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_ticket_activity(
    p_ticket_id UUID,
    p_user_id UUID,
    p_action TEXT,
    p_old_value JSONB DEFAULT NULL,
    p_new_value JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_activity_id UUID;
BEGIN
    INSERT INTO ticket_activity (ticket_id, user_id, action, old_value, new_value)
    VALUES (p_ticket_id, p_user_id, p_action, p_old_value, p_new_value)
    RETURNING id INTO v_activity_id;
    RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_follow_up_activity(
    p_follow_up_id UUID,
    p_user_id UUID,
    p_action TEXT,
    p_old_value JSONB DEFAULT NULL,
    p_new_value JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_activity_id UUID;
BEGIN
    INSERT INTO follow_up_activity (follow_up_id, user_id, action, old_value, new_value)
    VALUES (p_follow_up_id, p_user_id, p_action, p_old_value, p_new_value)
    RETURNING id INTO v_activity_id;
    RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_expense_activity(
    p_expense_id UUID,
    p_user_id UUID,
    p_action TEXT,
    p_old_value JSONB DEFAULT NULL,
    p_new_value JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_activity_id UUID;
BEGIN
    INSERT INTO expense_activity (expense_id, user_id, action, old_value, new_value)
    VALUES (p_expense_id, p_user_id, p_action, p_old_value, p_new_value)
    RETURNING id INTO v_activity_id;
    RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_drives ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_of_sale ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_of_sale_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_media_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE facebook_business_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_from_public ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_information ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- MULTI-TENANT RLS POLICIES
-- ============================================================================
-- These policies enforce dealership-level data isolation
-- Users can only access data that belongs to their dealership
-- ============================================================================

-- Helper function to get current user's dealership_id from their profile
CREATE OR REPLACE FUNCTION get_user_dealership_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT dealership_id
        FROM users
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to check if current user is platform admin
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT is_platform_admin
        FROM users
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Dealerships table - platform admins can manage all, dealership users see their own
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'dealerships_all_policy' AND polrelid = 'dealerships'::regclass) THEN
        CREATE POLICY dealerships_all_policy ON dealerships FOR ALL USING (is_platform_admin() = true) WITH CHECK (is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'dealerships_tenant_select_policy' AND polrelid = 'dealerships'::regclass) THEN
        CREATE POLICY dealerships_tenant_select_policy ON dealerships FOR SELECT USING (id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
END $$;

-- Users policies - filtered by dealership_id, platform admins see all
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'users_select_policy' AND polrelid = 'users'::regclass) THEN
        CREATE POLICY users_select_policy ON users FOR SELECT USING (is_platform_admin() = true OR dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'users_insert_policy' AND polrelid = 'users'::regclass) THEN
        CREATE POLICY users_insert_policy ON users FOR INSERT WITH CHECK (is_platform_admin() = true OR dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'users_update_policy' AND polrelid = 'users'::regclass) THEN
        CREATE POLICY users_update_policy ON users FOR UPDATE USING (is_platform_admin() = true OR dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'users_delete_policy' AND polrelid = 'users'::regclass) THEN
        CREATE POLICY users_delete_policy ON users FOR DELETE USING (is_platform_admin() = true OR dealership_id = get_user_dealership_id());
    END IF;
END $$;

-- Dealer peers cannot flip is_platform_admin or move users between dealerships.
-- Service-role (auth.uid() IS NULL) is allowed so seeds/admin APIs still work.
CREATE OR REPLACE FUNCTION prevent_user_privilege_escalation()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' THEN
        IF NEW.is_platform_admin = true AND COALESCE(is_platform_admin(), false) = false THEN
            RAISE EXCEPTION 'Unauthorized: cannot set is_platform_admin';
        END IF;
        RETURN NEW;
    END IF;
    IF NEW.is_platform_admin IS DISTINCT FROM OLD.is_platform_admin
       AND COALESCE(is_platform_admin(), false) = false THEN
        RAISE EXCEPTION 'Unauthorized: cannot change is_platform_admin';
    END IF;
    IF NEW.dealership_id IS DISTINCT FROM OLD.dealership_id
       AND COALESCE(is_platform_admin(), false) = false THEN
        RAISE EXCEPTION 'Unauthorized: cannot change dealership_id';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS prevent_user_privilege_escalation ON users;
CREATE TRIGGER prevent_user_privilege_escalation
    BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION prevent_user_privilege_escalation();

-- Roles policies - filtered by dealership_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'roles_select_policy' AND polrelid = 'roles'::regclass) THEN
        CREATE POLICY roles_select_policy ON roles FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'roles_insert_policy' AND polrelid = 'roles'::regclass) THEN
        CREATE POLICY roles_insert_policy ON roles FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'roles_update_policy' AND polrelid = 'roles'::regclass) THEN
        CREATE POLICY roles_update_policy ON roles FOR UPDATE USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'roles_delete_policy' AND polrelid = 'roles'::regclass) THEN
        CREATE POLICY roles_delete_policy ON roles FOR DELETE USING (dealership_id = get_user_dealership_id());
    END IF;
END $$;

-- User roles (join table) — scoped via the mapped user's dealership
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'user_roles_select_policy' AND polrelid = 'user_roles'::regclass) THEN
        CREATE POLICY user_roles_select_policy ON user_roles FOR SELECT USING (
            is_platform_admin() = true
            OR EXISTS (
                SELECT 1 FROM users u
                WHERE u.id = user_roles.user_id
                  AND u.dealership_id = get_user_dealership_id()
            )
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'user_roles_insert_policy' AND polrelid = 'user_roles'::regclass) THEN
        CREATE POLICY user_roles_insert_policy ON user_roles FOR INSERT WITH CHECK (
            is_platform_admin() = true
            OR EXISTS (
                SELECT 1 FROM users u
                WHERE u.id = user_roles.user_id
                  AND u.dealership_id = get_user_dealership_id()
            )
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'user_roles_delete_policy' AND polrelid = 'user_roles'::regclass) THEN
        CREATE POLICY user_roles_delete_policy ON user_roles FOR DELETE USING (
            is_platform_admin() = true
            OR EXISTS (
                SELECT 1 FROM users u
                WHERE u.id = user_roles.user_id
                  AND u.dealership_id = get_user_dealership_id()
            )
        );
    END IF;
END $$;

-- Subscriptions policies - filtered by dealership_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'subscriptions_select_policy' AND polrelid = 'subscriptions'::regclass) THEN
        CREATE POLICY subscriptions_select_policy ON subscriptions FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'subscriptions_insert_policy' AND polrelid = 'subscriptions'::regclass) THEN
        CREATE POLICY subscriptions_insert_policy ON subscriptions FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'subscriptions_update_policy' AND polrelid = 'subscriptions'::regclass) THEN
        CREATE POLICY subscriptions_update_policy ON subscriptions FOR UPDATE USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'subscriptions_delete_policy' AND polrelid = 'subscriptions'::regclass) THEN
        CREATE POLICY subscriptions_delete_policy ON subscriptions FOR DELETE USING (dealership_id = get_user_dealership_id());
    END IF;
END $$;

-- Billing information policies - filtered by dealership_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'billing_information_select_policy' AND polrelid = 'billing_information'::regclass) THEN
        CREATE POLICY billing_information_select_policy ON billing_information FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'billing_information_insert_policy' AND polrelid = 'billing_information'::regclass) THEN
        CREATE POLICY billing_information_insert_policy ON billing_information FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'billing_information_update_policy' AND polrelid = 'billing_information'::regclass) THEN
        CREATE POLICY billing_information_update_policy ON billing_information FOR UPDATE USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'billing_information_delete_policy' AND polrelid = 'billing_information'::regclass) THEN
        CREATE POLICY billing_information_delete_policy ON billing_information FOR DELETE USING (dealership_id = get_user_dealership_id());
    END IF;
END $$;

-- Vehicles policies - filtered by dealership_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'vehicles_select_policy' AND polrelid = 'vehicles'::regclass) THEN
        CREATE POLICY vehicles_select_policy ON vehicles FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'vehicles_insert_policy' AND polrelid = 'vehicles'::regclass) THEN
        CREATE POLICY vehicles_insert_policy ON vehicles FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'vehicles_update_policy' AND polrelid = 'vehicles'::regclass) THEN
        CREATE POLICY vehicles_update_policy ON vehicles FOR UPDATE USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'vehicles_delete_policy' AND polrelid = 'vehicles'::regclass) THEN
        CREATE POLICY vehicles_delete_policy ON vehicles FOR DELETE USING (dealership_id = get_user_dealership_id());
    END IF;
END $$;

-- Customers policies - filtered by dealership_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'customers_select_policy' AND polrelid = 'customers'::regclass) THEN
        CREATE POLICY customers_select_policy ON customers FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'customers_insert_policy' AND polrelid = 'customers'::regclass) THEN
        CREATE POLICY customers_insert_policy ON customers FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'customers_update_policy' AND polrelid = 'customers'::regclass) THEN
        CREATE POLICY customers_update_policy ON customers FOR UPDATE USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'customers_delete_policy' AND polrelid = 'customers'::regclass) THEN
        CREATE POLICY customers_delete_policy ON customers FOR DELETE USING (dealership_id = get_user_dealership_id());
    END IF;
END $$;

-- Sales Deals policies - filtered by dealership_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'sales_deals_select_policy' AND polrelid = 'sales_deals'::regclass) THEN
        CREATE POLICY sales_deals_select_policy ON sales_deals FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'sales_deals_insert_policy' AND polrelid = 'sales_deals'::regclass) THEN
        CREATE POLICY sales_deals_insert_policy ON sales_deals FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'sales_deals_update_policy' AND polrelid = 'sales_deals'::regclass) THEN
        CREATE POLICY sales_deals_update_policy ON sales_deals FOR UPDATE USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'sales_deals_delete_policy' AND polrelid = 'sales_deals'::regclass) THEN
        CREATE POLICY sales_deals_delete_policy ON sales_deals FOR DELETE USING (dealership_id = get_user_dealership_id());
    END IF;
END $$;

-- Invoices policies - filtered by dealership_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'invoices_select_policy' AND polrelid = 'invoices'::regclass) THEN
        CREATE POLICY invoices_select_policy ON invoices FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'invoices_insert_policy' AND polrelid = 'invoices'::regclass) THEN
        CREATE POLICY invoices_insert_policy ON invoices FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'invoices_update_policy' AND polrelid = 'invoices'::regclass) THEN
        CREATE POLICY invoices_update_policy ON invoices FOR UPDATE USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'invoices_delete_policy' AND polrelid = 'invoices'::regclass) THEN
        CREATE POLICY invoices_delete_policy ON invoices FOR DELETE USING (dealership_id = get_user_dealership_id());
    END IF;
END $$;

-- Leads policies - filtered by dealership_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'leads_select_policy' AND polrelid = 'leads'::regclass) THEN
        CREATE POLICY leads_select_policy ON leads FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'leads_insert_policy' AND polrelid = 'leads'::regclass) THEN
        CREATE POLICY leads_insert_policy ON leads FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'leads_update_policy' AND polrelid = 'leads'::regclass) THEN
        CREATE POLICY leads_update_policy ON leads FOR UPDATE USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'leads_delete_policy' AND polrelid = 'leads'::regclass) THEN
        CREATE POLICY leads_delete_policy ON leads FOR DELETE USING (dealership_id = get_user_dealership_id());
    END IF;
END $$;

-- Test Drives policies - filtered by dealership_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'test_drives_select_policy' AND polrelid = 'test_drives'::regclass) THEN
        CREATE POLICY test_drives_select_policy ON test_drives FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'test_drives_insert_policy' AND polrelid = 'test_drives'::regclass) THEN
        CREATE POLICY test_drives_insert_policy ON test_drives FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'test_drives_update_policy' AND polrelid = 'test_drives'::regclass) THEN
        CREATE POLICY test_drives_update_policy ON test_drives FOR UPDATE USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'test_drives_delete_policy' AND polrelid = 'test_drives'::regclass) THEN
        CREATE POLICY test_drives_delete_policy ON test_drives FOR DELETE USING (dealership_id = get_user_dealership_id());
    END IF;
END $$;

-- Vendors policies - filtered by dealership_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'vendors_select_policy' AND polrelid = 'vendors'::regclass) THEN
        CREATE POLICY vendors_select_policy ON vendors FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'vendors_insert_policy' AND polrelid = 'vendors'::regclass) THEN
        CREATE POLICY vendors_insert_policy ON vendors FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'vendors_update_policy' AND polrelid = 'vendors'::regclass) THEN
        CREATE POLICY vendors_update_policy ON vendors FOR UPDATE USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'vendors_delete_policy' AND polrelid = 'vendors'::regclass) THEN
        CREATE POLICY vendors_delete_policy ON vendors FOR DELETE USING (dealership_id = get_user_dealership_id());
    END IF;
END $$;

-- Expenses policies - filtered by dealership_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'expenses_select_policy' AND polrelid = 'expenses'::regclass) THEN
        CREATE POLICY expenses_select_policy ON expenses FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'expenses_insert_policy' AND polrelid = 'expenses'::regclass) THEN
        CREATE POLICY expenses_insert_policy ON expenses FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'expenses_update_policy' AND polrelid = 'expenses'::regclass) THEN
        CREATE POLICY expenses_update_policy ON expenses FOR UPDATE USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'expenses_delete_policy' AND polrelid = 'expenses'::regclass) THEN
        CREATE POLICY expenses_delete_policy ON expenses FOR DELETE USING (dealership_id = get_user_dealership_id());
    END IF;
END $$;

-- Tasks policies - filtered by dealership_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'tasks_select_policy' AND polrelid = 'tasks'::regclass) THEN
        CREATE POLICY tasks_select_policy ON tasks FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'tasks_insert_policy' AND polrelid = 'tasks'::regclass) THEN
        CREATE POLICY tasks_insert_policy ON tasks FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'tasks_update_policy' AND polrelid = 'tasks'::regclass) THEN
        CREATE POLICY tasks_update_policy ON tasks FOR UPDATE USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'tasks_delete_policy' AND polrelid = 'tasks'::regclass) THEN
        CREATE POLICY tasks_delete_policy ON tasks FOR DELETE USING (dealership_id = get_user_dealership_id());
    END IF;
END $$;

-- Tickets policies - filtered by dealership_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'tickets_select_policy' AND polrelid = 'tickets'::regclass) THEN
        CREATE POLICY tickets_select_policy ON tickets FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'tickets_insert_policy' AND polrelid = 'tickets'::regclass) THEN
        CREATE POLICY tickets_insert_policy ON tickets FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'tickets_update_policy' AND polrelid = 'tickets'::regclass) THEN
        CREATE POLICY tickets_update_policy ON tickets FOR UPDATE USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'tickets_delete_policy' AND polrelid = 'tickets'::regclass) THEN
        CREATE POLICY tickets_delete_policy ON tickets FOR DELETE USING (dealership_id = get_user_dealership_id());
    END IF;
END $$;

-- Follow-ups policies - filtered by dealership_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'follow_ups_select_policy' AND polrelid = 'follow_ups'::regclass) THEN
        CREATE POLICY follow_ups_select_policy ON follow_ups FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'follow_ups_insert_policy' AND polrelid = 'follow_ups'::regclass) THEN
        CREATE POLICY follow_ups_insert_policy ON follow_ups FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'follow_ups_update_policy' AND polrelid = 'follow_ups'::regclass) THEN
        CREATE POLICY follow_ups_update_policy ON follow_ups FOR UPDATE USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'follow_ups_delete_policy' AND polrelid = 'follow_ups'::regclass) THEN
        CREATE POLICY follow_ups_delete_policy ON follow_ups FOR DELETE USING (dealership_id = get_user_dealership_id());
    END IF;
END $$;

-- Bill of Sale policies - filtered by dealership_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'bill_of_sale_select_policy' AND polrelid = 'bill_of_sale'::regclass) THEN
        CREATE POLICY bill_of_sale_select_policy ON bill_of_sale FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'bill_of_sale_insert_policy' AND polrelid = 'bill_of_sale'::regclass) THEN
        CREATE POLICY bill_of_sale_insert_policy ON bill_of_sale FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'bill_of_sale_update_policy' AND polrelid = 'bill_of_sale'::regclass) THEN
        CREATE POLICY bill_of_sale_update_policy ON bill_of_sale FOR UPDATE USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'bill_of_sale_delete_policy' AND polrelid = 'bill_of_sale'::regclass) THEN
        CREATE POLICY bill_of_sale_delete_policy ON bill_of_sale FOR DELETE USING (dealership_id = get_user_dealership_id());
    END IF;
END $$;

-- Bill of Sale Payments policies - filtered by dealership_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'bill_of_sale_payments_select_policy' AND polrelid = 'bill_of_sale_payments'::regclass) THEN
        CREATE POLICY bill_of_sale_payments_select_policy ON bill_of_sale_payments FOR SELECT USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'bill_of_sale_payments_insert_policy' AND polrelid = 'bill_of_sale_payments'::regclass) THEN
        CREATE POLICY bill_of_sale_payments_insert_policy ON bill_of_sale_payments FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'bill_of_sale_payments_update_policy' AND polrelid = 'bill_of_sale_payments'::regclass) THEN
        CREATE POLICY bill_of_sale_payments_update_policy ON bill_of_sale_payments FOR UPDATE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'bill_of_sale_payments_delete_policy' AND polrelid = 'bill_of_sale_payments'::regclass) THEN
        CREATE POLICY bill_of_sale_payments_delete_policy ON bill_of_sale_payments FOR DELETE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
END $$;

-- Social Media Posts policies - filtered by dealership_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'social_media_posts_select_policy' AND polrelid = 'social_media_posts'::regclass) THEN
        CREATE POLICY social_media_posts_select_policy ON social_media_posts FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'social_media_posts_insert_policy' AND polrelid = 'social_media_posts'::regclass) THEN
        CREATE POLICY social_media_posts_insert_policy ON social_media_posts FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'social_media_posts_update_policy' AND polrelid = 'social_media_posts'::regclass) THEN
        CREATE POLICY social_media_posts_update_policy ON social_media_posts FOR UPDATE USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'social_media_posts_delete_policy' AND polrelid = 'social_media_posts'::regclass) THEN
        CREATE POLICY social_media_posts_delete_policy ON social_media_posts FOR DELETE USING (dealership_id = get_user_dealership_id());
    END IF;
END $$;

-- Purchase from Public policies - filtered by dealership_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'purchase_from_public_select_policy' AND polrelid = 'purchase_from_public'::regclass) THEN
        CREATE POLICY purchase_from_public_select_policy ON purchase_from_public FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'purchase_from_public_insert_policy' AND polrelid = 'purchase_from_public'::regclass) THEN
        CREATE POLICY purchase_from_public_insert_policy ON purchase_from_public FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'purchase_from_public_update_policy' AND polrelid = 'purchase_from_public'::regclass) THEN
        CREATE POLICY purchase_from_public_update_policy ON purchase_from_public FOR UPDATE USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'purchase_from_public_delete_policy' AND polrelid = 'purchase_from_public'::regclass) THEN
        CREATE POLICY purchase_from_public_delete_policy ON purchase_from_public FOR DELETE USING (dealership_id = get_user_dealership_id());
    END IF;
END $$;

-- Financial Transactions policies - filtered by dealership_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'financial_transactions_select_policy' AND polrelid = 'financial_transactions'::regclass) THEN
        CREATE POLICY financial_transactions_select_policy ON financial_transactions FOR SELECT USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'financial_transactions_insert_policy' AND polrelid = 'financial_transactions'::regclass) THEN
        CREATE POLICY financial_transactions_insert_policy ON financial_transactions FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'financial_transactions_update_policy' AND polrelid = 'financial_transactions'::regclass) THEN
        CREATE POLICY financial_transactions_update_policy ON financial_transactions FOR UPDATE USING (dealership_id = get_user_dealership_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'financial_transactions_delete_policy' AND polrelid = 'financial_transactions'::regclass) THEN
        CREATE POLICY financial_transactions_delete_policy ON financial_transactions FOR DELETE USING (dealership_id = get_user_dealership_id());
    END IF;
END $$;

-- ============================================================================
-- DEFAULT AUTOMATION RULES
-- ============================================================================

INSERT INTO task_automation_rules (name, description, trigger_type, trigger_config, action_type, action_config)
SELECT 'Follow up new leads', 'Create follow-up task when new lead is created', 'lead_created', '{}', 'create_task', '{"title": "Follow up with new lead", "priority": "High", "due_date_hours": 24}'
WHERE NOT EXISTS (SELECT 1 FROM task_automation_rules WHERE name = 'Follow up new leads');

INSERT INTO task_automation_rules (name, description, trigger_type, trigger_config, action_type, action_config)
SELECT 'Test drive confirmation', 'Create confirmation task when test drive is booked', 'test_drive_booked', '{}', 'create_task', '{"title": "Confirm test drive appointment", "priority": "Medium", "due_date_hours": 2}'
WHERE NOT EXISTS (SELECT 1 FROM task_automation_rules WHERE name = 'Test drive confirmation');

INSERT INTO task_automation_rules (name, description, trigger_type, trigger_config, action_type, action_config)
SELECT 'Deal pending review', 'Create task when deal status changes to pending', 'deal_pending', '{}', 'create_task', '{"title": "Review pending deal", "priority": "High", "due_date_hours": 48}'
WHERE NOT EXISTS (SELECT 1 FROM task_automation_rules WHERE name = 'Deal pending review');

INSERT INTO task_automation_rules (name, description, trigger_type, trigger_config, action_type, action_config)
SELECT 'Vehicle inspection', 'Create inspection task when vehicle enters inventory', 'vehicle_added', '{}', 'create_task', '{"title": "Complete vehicle inspection", "priority": "Medium", "due_date_hours": 72}'
WHERE NOT EXISTS (SELECT 1 FROM task_automation_rules WHERE name = 'Vehicle inspection');

-- ============================================================================
-- OCR Scanned Documents table
CREATE TABLE IF NOT EXISTS ocr_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('drivers_license', 'government_id', 'passport', 'other')),
    document_number TEXT,
    first_name TEXT,
    last_name TEXT,
    date_of_birth DATE,
    expiry_date DATE,
    address TEXT,
    city TEXT,
    province TEXT,
    postal_code TEXT,
    issue_date DATE,
    country TEXT DEFAULT 'Canada',
    raw_ocr_text TEXT,
    confidence_score NUMERIC(5,2),
    image_url TEXT,
    is_verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- VIN Lookup History table
CREATE TABLE IF NOT EXISTS vin_lookup_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vin TEXT NOT NULL,
    year INTEGER,
    make TEXT,
    model TEXT,
    trim TEXT,
    engine TEXT,
    body_style TEXT,
    fuel_type TEXT,
    transmission TEXT,
    drivetrain TEXT,
    exterior_color TEXT,
    interior_color TEXT,
    cached_at TIMESTAMPTZ DEFAULT NOW(),
    source TEXT DEFAULT 'NHTSA',
    dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Carfax Reports table
CREATE TABLE IF NOT EXISTS carfax_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    vin TEXT NOT NULL,
    report_url TEXT,
    report_data JSONB,
    ownership_count INTEGER,
    accident_count INTEGER,
    service_records BOOLEAN DEFAULT false,
    title_status TEXT,
    last_updated TIMESTAMPTZ,
    purchased_at TIMESTAMPTZ DEFAULT NOW(),
    dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FINANCE CALCULATOR TABLES
-- ============================================================================

-- Finance Calculator History table
CREATE TABLE IF NOT EXISTS finance_calculations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    sale_price NUMERIC(12,2) NOT NULL,
    down_payment NUMERIC(12,2) DEFAULT 0,
    trade_in_value NUMERIC(12,2) DEFAULT 0,
    interest_rate NUMERIC(5,2) NOT NULL,
    term_months INTEGER NOT NULL,
    payment_type TEXT DEFAULT 'monthly' CHECK (payment_type IN ('monthly', 'biweekly', 'weekly')),
    payment_amount NUMERIC(12,2) NOT NULL,
    total_interest NUMERIC(12,2) DEFAULT 0,
    total_cost NUMERIC(12,2) DEFAULT 0,
    tax_amount NUMERIC(12,2) DEFAULT 0,
    admin_fee NUMERIC(12,2) DEFAULT 0,
    dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR NEW TABLES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ocr_documents_customer_id ON ocr_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_ocr_documents_document_type ON ocr_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_vin_lookup_history_vin ON vin_lookup_history(vin);
CREATE INDEX IF NOT EXISTS idx_carfax_reports_vehicle_id ON carfax_reports(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_carfax_reports_vin ON carfax_reports(vin);
CREATE INDEX IF NOT EXISTS idx_finance_calculations_vehicle_id ON finance_calculations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_finance_calculations_customer_id ON finance_calculations(customer_id);

-- ============================================================================
-- TRIGGERS FOR NEW TABLES
-- ============================================================================

DROP TRIGGER IF EXISTS update_ocr_documents_updated_at ON ocr_documents;
CREATE TRIGGER update_ocr_documents_updated_at BEFORE UPDATE ON ocr_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_carfax_reports_updated_at ON carfax_reports;
CREATE TRIGGER update_carfax_reports_updated_at BEFORE UPDATE ON carfax_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS POLICIES FOR NEW TABLES
-- ============================================================================

ALTER TABLE ocr_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE vin_lookup_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE carfax_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_calculations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'ocr_documents_select_policy' AND polrelid = 'ocr_documents'::regclass) THEN
        CREATE POLICY ocr_documents_select_policy ON ocr_documents FOR SELECT USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'ocr_documents_insert_policy' AND polrelid = 'ocr_documents'::regclass) THEN
        CREATE POLICY ocr_documents_insert_policy ON ocr_documents FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'ocr_documents_update_policy' AND polrelid = 'ocr_documents'::regclass) THEN
        CREATE POLICY ocr_documents_update_policy ON ocr_documents FOR UPDATE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'ocr_documents_delete_policy' AND polrelid = 'ocr_documents'::regclass) THEN
        CREATE POLICY ocr_documents_delete_policy ON ocr_documents FOR DELETE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'vin_lookup_history_select_policy' AND polrelid = 'vin_lookup_history'::regclass) THEN
        CREATE POLICY vin_lookup_history_select_policy ON vin_lookup_history FOR SELECT USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'vin_lookup_history_insert_policy' AND polrelid = 'vin_lookup_history'::regclass) THEN
        CREATE POLICY vin_lookup_history_insert_policy ON vin_lookup_history FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'vin_lookup_history_update_policy' AND polrelid = 'vin_lookup_history'::regclass) THEN
        CREATE POLICY vin_lookup_history_update_policy ON vin_lookup_history FOR UPDATE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'vin_lookup_history_delete_policy' AND polrelid = 'vin_lookup_history'::regclass) THEN
        CREATE POLICY vin_lookup_history_delete_policy ON vin_lookup_history FOR DELETE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'carfax_reports_select_policy' AND polrelid = 'carfax_reports'::regclass) THEN
        CREATE POLICY carfax_reports_select_policy ON carfax_reports FOR SELECT USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'carfax_reports_insert_policy' AND polrelid = 'carfax_reports'::regclass) THEN
        CREATE POLICY carfax_reports_insert_policy ON carfax_reports FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'carfax_reports_update_policy' AND polrelid = 'carfax_reports'::regclass) THEN
        CREATE POLICY carfax_reports_update_policy ON carfax_reports FOR UPDATE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'carfax_reports_delete_policy' AND polrelid = 'carfax_reports'::regclass) THEN
        CREATE POLICY carfax_reports_delete_policy ON carfax_reports FOR DELETE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'finance_calculations_select_policy' AND polrelid = 'finance_calculations'::regclass) THEN
        CREATE POLICY finance_calculations_select_policy ON finance_calculations FOR SELECT USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'finance_calculations_insert_policy' AND polrelid = 'finance_calculations'::regclass) THEN
        CREATE POLICY finance_calculations_insert_policy ON finance_calculations FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'finance_calculations_update_policy' AND polrelid = 'finance_calculations'::regclass) THEN
        CREATE POLICY finance_calculations_update_policy ON finance_calculations FOR UPDATE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'finance_calculations_delete_policy' AND polrelid = 'finance_calculations'::regclass) THEN
        CREATE POLICY finance_calculations_delete_policy ON finance_calculations FOR DELETE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
END $$;

-- ============================================================================
-- AUDIT LOGS TABLE (Platform Admin tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action TEXT NOT NULL, -- e.g., 'user.suspend', 'dealership.create', 'deal.close'
    entity_type TEXT NOT NULL, -- e.g., 'user', 'dealership', 'deal', 'vehicle'
    entity_id UUID,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_email TEXT,
    actor_role TEXT,
    target_id UUID,
    target_email TEXT,
    metadata JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_id);

-- ============================================================================
-- LOGIN HISTORY TABLE (Security tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS login_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    login_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    device_type TEXT DEFAULT 'Desktop',
    success BOOLEAN DEFAULT true,
    failure_reason TEXT,
    dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, login_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_ip ON login_history(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_history_time ON login_history(login_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_success ON login_history(success);

-- ============================================================================
-- AUDIT LOGGING HELPER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION log_audit_action(
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id UUID DEFAULT NULL,
    p_actor_id UUID DEFAULT NULL,
    p_target_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::JSONB,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_audit_id UUID;
    v_actor_email TEXT;
    v_actor_role TEXT;
    v_target_email TEXT;
    v_dealership_id UUID;
BEGIN
    -- Get actor info
    IF p_actor_id IS NOT NULL THEN
        SELECT email, role, dealership_id INTO v_actor_email, v_actor_role, v_dealership_id
        FROM users WHERE id = p_actor_id;
    END IF;

    -- Get target email
    IF p_target_id IS NOT NULL THEN
        SELECT email INTO v_target_email FROM users WHERE id = p_target_id;
    END IF;

    INSERT INTO audit_logs (
        action, entity_type, entity_id, actor_id, actor_email, actor_role,
        target_id, target_email, metadata, ip_address, user_agent, dealership_id
    ) VALUES (
        p_action, p_entity_type, p_entity_id, p_actor_id, v_actor_email, v_actor_role,
        p_target_id, v_target_email, p_metadata, p_ip_address, p_user_agent, v_dealership_id
    ) RETURNING id INTO v_audit_id;

    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- LOGIN HISTORY LOGGING HELPER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION log_user_login(
    p_user_id UUID,
    p_email TEXT,
    p_success BOOLEAN DEFAULT true,
    p_failure_reason TEXT DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_dealership_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_login_id UUID;
    v_device_type TEXT;
BEGIN
    -- Determine device type from user agent
    IF p_user_agent ILIKE '%mobile%' OR p_user_agent ILIKE '%android%' OR p_user_agent ILIKE '%iphone%' THEN
        v_device_type := 'Mobile';
    ELSIF p_user_agent ILIKE '%tablet%' OR p_user_agent ILIKE '%ipad%' THEN
        v_device_type := 'Tablet';
    ELSE
        v_device_type := 'Desktop';
    END IF;

    INSERT INTO login_history (user_id, email, success, failure_reason, ip_address, user_agent, device_type, dealership_id)
    VALUES (p_user_id, p_email, p_success, p_failure_reason, p_ip_address, p_user_agent, v_device_type, p_dealership_id)
    RETURNING id INTO v_login_id;

    RETURN v_login_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RLS POLICIES FOR PLATFORM SETTINGS
-- ============================================================================
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Feature flags: only platform admins can manage, everyone can read
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'feature_flags_all_policy' AND polrelid = 'feature_flags'::regclass) THEN
        CREATE POLICY feature_flags_all_policy ON feature_flags FOR ALL
            USING (is_platform_admin() = true)
            WITH CHECK (is_platform_admin() = true);
    END IF;
END $$;

-- Announcements: only platform admins can manage, everyone can read
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'announcements_all_policy' AND polrelid = 'announcements'::regclass) THEN
        CREATE POLICY announcements_all_policy ON announcements FOR ALL
            USING (is_platform_admin() = true)
            WITH CHECK (is_platform_admin() = true);
    END IF;
END $$;

-- ============================================================================
-- RLS POLICIES FOR AUDIT LOGS AND LOGIN HISTORY
-- ============================================================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;

-- Audit logs: only platform admins can see all, others see nothing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'audit_logs_platform_admin_policy' AND polrelid = 'audit_logs'::regclass) THEN
        CREATE POLICY audit_logs_platform_admin_policy ON audit_logs FOR ALL
            USING (is_platform_admin() = true)
            WITH CHECK (is_platform_admin() = true);
    END IF;
END $$;

-- Login history: only platform admins can see all, users can see their own
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'login_history_platform_admin_policy' AND polrelid = 'login_history'::regclass) THEN
        CREATE POLICY login_history_platform_admin_policy ON login_history FOR SELECT
            USING (is_platform_admin() = true OR user_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'login_history_insert_policy' AND polrelid = 'login_history'::regclass) THEN
        CREATE POLICY login_history_insert_policy ON login_history FOR INSERT
            WITH CHECK (true); -- Allow anyone to insert (for login tracking)
    END IF;
END $$;

-- ============================================================================
-- QUOTATIONS (Phase C ROI)
-- ============================================================================

CREATE TABLE IF NOT EXISTS quotations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    quote_number TEXT,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    salesperson_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Accepted', 'Expired', 'Converted', 'Cancelled')),
    sale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    down_payment NUMERIC(12,2) DEFAULT 0,
    trade_in_value NUMERIC(12,2) DEFAULT 0,
    finance_term INTEGER,
    interest_rate NUMERIC(5,2),
    finance_company TEXT,
    tax_rate NUMERIC(5,2) DEFAULT 13,
    admin_fee NUMERIC(12,2) DEFAULT 0,
    monthly_payment NUMERIC(12,2),
    notes TEXT,
    valid_until DATE,
    converted_deal_id UUID REFERENCES sales_deals(id) ON DELETE SET NULL,
    dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sales_deals ADD COLUMN IF NOT EXISTS finance_term INTEGER;
ALTER TABLE sales_deals ADD COLUMN IF NOT EXISTS interest_rate NUMERIC(5,2);
ALTER TABLE sales_deals ADD COLUMN IF NOT EXISTS finance_company TEXT;
ALTER TABLE sales_deals ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE sales_deals ADD COLUMN IF NOT EXISTS deal_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE sales_deals ADD COLUMN IF NOT EXISTS trade_in_value NUMERIC(12,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_quotations_dealership_id ON quotations(dealership_id);
CREATE INDEX IF NOT EXISTS idx_quotations_customer_id ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_vehicle_id ON quotations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_created_at ON quotations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_deals_customer_null ON sales_deals(dealership_id) WHERE customer_id IS NULL;

DROP TRIGGER IF EXISTS update_quotations_updated_at ON quotations;
CREATE TRIGGER update_quotations_updated_at BEFORE UPDATE ON quotations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'quotations_select_policy' AND polrelid = 'quotations'::regclass) THEN
        CREATE POLICY quotations_select_policy ON quotations FOR SELECT USING (dealership_id = get_user_dealership_id() OR is_platform_admin());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'quotations_insert_policy' AND polrelid = 'quotations'::regclass) THEN
        CREATE POLICY quotations_insert_policy ON quotations FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id() OR is_platform_admin());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'quotations_update_policy' AND polrelid = 'quotations'::regclass) THEN
        CREATE POLICY quotations_update_policy ON quotations FOR UPDATE USING (dealership_id = get_user_dealership_id() OR is_platform_admin());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'quotations_delete_policy' AND polrelid = 'quotations'::regclass) THEN
        CREATE POLICY quotations_delete_policy ON quotations FOR DELETE USING (dealership_id = get_user_dealership_id() OR is_platform_admin());
    END IF;
END $$;

-- ============================================================================
-- SCHEMA COMPLETE
-- ============================================================================
