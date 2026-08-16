-- Child-table tenant RLS (API-touched rows without their own dealership_id).
-- Idempotent: ENABLE RLS, DROP named policies, ADD tenant policies.
-- Every policy keeps OR is_platform_admin() so Act-as / platform JWT still works.
-- Parents: tasks, tickets, follow_ups, expenses; facebook_business_account is direct.

-- Core dealer tables currently omit is_platform_admin(); add it without
-- dropping tenant-equality (JWT dealers still match get_user_dealership_id()).
DROP POLICY IF EXISTS vehicles_select_policy ON public.vehicles;
DROP POLICY IF EXISTS vehicles_insert_policy ON public.vehicles;
DROP POLICY IF EXISTS vehicles_update_policy ON public.vehicles;
DROP POLICY IF EXISTS vehicles_delete_policy ON public.vehicles;
CREATE POLICY vehicles_select_policy ON public.vehicles
    FOR SELECT USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
CREATE POLICY vehicles_insert_policy ON public.vehicles
    FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
CREATE POLICY vehicles_update_policy ON public.vehicles
    FOR UPDATE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
CREATE POLICY vehicles_delete_policy ON public.vehicles
    FOR DELETE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);

ALTER TABLE public.task_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facebook_business_account ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Helper: child row is visible when parent.dealership_id matches caller
-- SECURITY DEFINER so parent RLS cannot hide the join from the policy.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tenant_owns_task(p_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(is_platform_admin(), false)
        OR EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = p_task_id
              AND t.dealership_id = get_user_dealership_id()
        );
$$;

CREATE OR REPLACE FUNCTION public.tenant_owns_ticket(p_ticket_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(is_platform_admin(), false)
        OR EXISTS (
            SELECT 1 FROM public.tickets t
            WHERE t.id = p_ticket_id
              AND t.dealership_id = get_user_dealership_id()
        );
$$;

CREATE OR REPLACE FUNCTION public.tenant_owns_follow_up(p_follow_up_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(is_platform_admin(), false)
        OR EXISTS (
            SELECT 1 FROM public.follow_ups f
            WHERE f.id = p_follow_up_id
              AND f.dealership_id = get_user_dealership_id()
        );
$$;

CREATE OR REPLACE FUNCTION public.tenant_owns_expense(p_expense_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(is_platform_admin(), false)
        OR EXISTS (
            SELECT 1 FROM public.expenses e
            WHERE e.id = p_expense_id
              AND e.dealership_id = get_user_dealership_id()
        );
$$;

GRANT EXECUTE ON FUNCTION public.tenant_owns_task(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_owns_ticket(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_owns_follow_up(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_owns_expense(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- task_* children
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS task_notes_select_policy ON public.task_notes;
DROP POLICY IF EXISTS task_notes_insert_policy ON public.task_notes;
DROP POLICY IF EXISTS task_notes_update_policy ON public.task_notes;
DROP POLICY IF EXISTS task_notes_delete_policy ON public.task_notes;
CREATE POLICY task_notes_select_policy ON public.task_notes
    FOR SELECT USING (tenant_owns_task(task_id) OR is_platform_admin() = true);
CREATE POLICY task_notes_insert_policy ON public.task_notes
    FOR INSERT WITH CHECK (tenant_owns_task(task_id) OR is_platform_admin() = true);
CREATE POLICY task_notes_update_policy ON public.task_notes
    FOR UPDATE USING (tenant_owns_task(task_id) OR is_platform_admin() = true);
CREATE POLICY task_notes_delete_policy ON public.task_notes
    FOR DELETE USING (tenant_owns_task(task_id) OR is_platform_admin() = true);

DROP POLICY IF EXISTS task_attachments_select_policy ON public.task_attachments;
DROP POLICY IF EXISTS task_attachments_insert_policy ON public.task_attachments;
DROP POLICY IF EXISTS task_attachments_update_policy ON public.task_attachments;
DROP POLICY IF EXISTS task_attachments_delete_policy ON public.task_attachments;
CREATE POLICY task_attachments_select_policy ON public.task_attachments
    FOR SELECT USING (tenant_owns_task(task_id) OR is_platform_admin() = true);
CREATE POLICY task_attachments_insert_policy ON public.task_attachments
    FOR INSERT WITH CHECK (tenant_owns_task(task_id) OR is_platform_admin() = true);
CREATE POLICY task_attachments_update_policy ON public.task_attachments
    FOR UPDATE USING (tenant_owns_task(task_id) OR is_platform_admin() = true);
CREATE POLICY task_attachments_delete_policy ON public.task_attachments
    FOR DELETE USING (tenant_owns_task(task_id) OR is_platform_admin() = true);

DROP POLICY IF EXISTS task_reminders_select_policy ON public.task_reminders;
DROP POLICY IF EXISTS task_reminders_insert_policy ON public.task_reminders;
DROP POLICY IF EXISTS task_reminders_update_policy ON public.task_reminders;
DROP POLICY IF EXISTS task_reminders_delete_policy ON public.task_reminders;
CREATE POLICY task_reminders_select_policy ON public.task_reminders
    FOR SELECT USING (tenant_owns_task(task_id) OR is_platform_admin() = true);
CREATE POLICY task_reminders_insert_policy ON public.task_reminders
    FOR INSERT WITH CHECK (tenant_owns_task(task_id) OR is_platform_admin() = true);
CREATE POLICY task_reminders_update_policy ON public.task_reminders
    FOR UPDATE USING (tenant_owns_task(task_id) OR is_platform_admin() = true);
CREATE POLICY task_reminders_delete_policy ON public.task_reminders
    FOR DELETE USING (tenant_owns_task(task_id) OR is_platform_admin() = true);

DROP POLICY IF EXISTS task_links_select_policy ON public.task_links;
DROP POLICY IF EXISTS task_links_insert_policy ON public.task_links;
DROP POLICY IF EXISTS task_links_update_policy ON public.task_links;
DROP POLICY IF EXISTS task_links_delete_policy ON public.task_links;
CREATE POLICY task_links_select_policy ON public.task_links
    FOR SELECT USING (tenant_owns_task(task_id) OR is_platform_admin() = true);
CREATE POLICY task_links_insert_policy ON public.task_links
    FOR INSERT WITH CHECK (tenant_owns_task(task_id) OR is_platform_admin() = true);
CREATE POLICY task_links_update_policy ON public.task_links
    FOR UPDATE USING (tenant_owns_task(task_id) OR is_platform_admin() = true);
CREATE POLICY task_links_delete_policy ON public.task_links
    FOR DELETE USING (tenant_owns_task(task_id) OR is_platform_admin() = true);

DROP POLICY IF EXISTS task_activity_select_policy ON public.task_activity;
DROP POLICY IF EXISTS task_activity_insert_policy ON public.task_activity;
DROP POLICY IF EXISTS task_activity_update_policy ON public.task_activity;
DROP POLICY IF EXISTS task_activity_delete_policy ON public.task_activity;
CREATE POLICY task_activity_select_policy ON public.task_activity
    FOR SELECT USING (tenant_owns_task(task_id) OR is_platform_admin() = true);
CREATE POLICY task_activity_insert_policy ON public.task_activity
    FOR INSERT WITH CHECK (tenant_owns_task(task_id) OR is_platform_admin() = true);
CREATE POLICY task_activity_update_policy ON public.task_activity
    FOR UPDATE USING (tenant_owns_task(task_id) OR is_platform_admin() = true);
CREATE POLICY task_activity_delete_policy ON public.task_activity
    FOR DELETE USING (tenant_owns_task(task_id) OR is_platform_admin() = true);

-- Global seeds have created_by NULL (visible to every rooftop). Tenant-owned
-- rules stay scoped via the author's dealership_id.
DROP POLICY IF EXISTS task_automation_rules_select_policy ON public.task_automation_rules;
DROP POLICY IF EXISTS task_automation_rules_insert_policy ON public.task_automation_rules;
DROP POLICY IF EXISTS task_automation_rules_update_policy ON public.task_automation_rules;
DROP POLICY IF EXISTS task_automation_rules_delete_policy ON public.task_automation_rules;
CREATE POLICY task_automation_rules_select_policy ON public.task_automation_rules
    FOR SELECT USING (
        is_platform_admin() = true
        OR created_by IS NULL
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = task_automation_rules.created_by
              AND u.dealership_id = get_user_dealership_id()
        )
    );
CREATE POLICY task_automation_rules_insert_policy ON public.task_automation_rules
    FOR INSERT WITH CHECK (
        is_platform_admin() = true
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = task_automation_rules.created_by
              AND u.dealership_id = get_user_dealership_id()
        )
    );
CREATE POLICY task_automation_rules_update_policy ON public.task_automation_rules
    FOR UPDATE USING (
        is_platform_admin() = true
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = task_automation_rules.created_by
              AND u.dealership_id = get_user_dealership_id()
        )
    );
CREATE POLICY task_automation_rules_delete_policy ON public.task_automation_rules
    FOR DELETE USING (
        is_platform_admin() = true
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = task_automation_rules.created_by
              AND u.dealership_id = get_user_dealership_id()
        )
    );

-- ---------------------------------------------------------------------------
-- ticket_* children
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS ticket_comments_select_policy ON public.ticket_comments;
DROP POLICY IF EXISTS ticket_comments_insert_policy ON public.ticket_comments;
DROP POLICY IF EXISTS ticket_comments_update_policy ON public.ticket_comments;
DROP POLICY IF EXISTS ticket_comments_delete_policy ON public.ticket_comments;
CREATE POLICY ticket_comments_select_policy ON public.ticket_comments
    FOR SELECT USING (tenant_owns_ticket(ticket_id) OR is_platform_admin() = true);
CREATE POLICY ticket_comments_insert_policy ON public.ticket_comments
    FOR INSERT WITH CHECK (tenant_owns_ticket(ticket_id) OR is_platform_admin() = true);
CREATE POLICY ticket_comments_update_policy ON public.ticket_comments
    FOR UPDATE USING (tenant_owns_ticket(ticket_id) OR is_platform_admin() = true);
CREATE POLICY ticket_comments_delete_policy ON public.ticket_comments
    FOR DELETE USING (tenant_owns_ticket(ticket_id) OR is_platform_admin() = true);

DROP POLICY IF EXISTS ticket_attachments_select_policy ON public.ticket_attachments;
DROP POLICY IF EXISTS ticket_attachments_insert_policy ON public.ticket_attachments;
DROP POLICY IF EXISTS ticket_attachments_update_policy ON public.ticket_attachments;
DROP POLICY IF EXISTS ticket_attachments_delete_policy ON public.ticket_attachments;
CREATE POLICY ticket_attachments_select_policy ON public.ticket_attachments
    FOR SELECT USING (tenant_owns_ticket(ticket_id) OR is_platform_admin() = true);
CREATE POLICY ticket_attachments_insert_policy ON public.ticket_attachments
    FOR INSERT WITH CHECK (tenant_owns_ticket(ticket_id) OR is_platform_admin() = true);
CREATE POLICY ticket_attachments_update_policy ON public.ticket_attachments
    FOR UPDATE USING (tenant_owns_ticket(ticket_id) OR is_platform_admin() = true);
CREATE POLICY ticket_attachments_delete_policy ON public.ticket_attachments
    FOR DELETE USING (tenant_owns_ticket(ticket_id) OR is_platform_admin() = true);

DROP POLICY IF EXISTS ticket_activity_select_policy ON public.ticket_activity;
DROP POLICY IF EXISTS ticket_activity_insert_policy ON public.ticket_activity;
DROP POLICY IF EXISTS ticket_activity_update_policy ON public.ticket_activity;
DROP POLICY IF EXISTS ticket_activity_delete_policy ON public.ticket_activity;
CREATE POLICY ticket_activity_select_policy ON public.ticket_activity
    FOR SELECT USING (tenant_owns_ticket(ticket_id) OR is_platform_admin() = true);
CREATE POLICY ticket_activity_insert_policy ON public.ticket_activity
    FOR INSERT WITH CHECK (tenant_owns_ticket(ticket_id) OR is_platform_admin() = true);
CREATE POLICY ticket_activity_update_policy ON public.ticket_activity
    FOR UPDATE USING (tenant_owns_ticket(ticket_id) OR is_platform_admin() = true);
CREATE POLICY ticket_activity_delete_policy ON public.ticket_activity
    FOR DELETE USING (tenant_owns_ticket(ticket_id) OR is_platform_admin() = true);

-- ---------------------------------------------------------------------------
-- follow_up_* children
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS follow_up_history_select_policy ON public.follow_up_history;
DROP POLICY IF EXISTS follow_up_history_insert_policy ON public.follow_up_history;
DROP POLICY IF EXISTS follow_up_history_update_policy ON public.follow_up_history;
DROP POLICY IF EXISTS follow_up_history_delete_policy ON public.follow_up_history;
CREATE POLICY follow_up_history_select_policy ON public.follow_up_history
    FOR SELECT USING (tenant_owns_follow_up(follow_up_id) OR is_platform_admin() = true);
CREATE POLICY follow_up_history_insert_policy ON public.follow_up_history
    FOR INSERT WITH CHECK (tenant_owns_follow_up(follow_up_id) OR is_platform_admin() = true);
CREATE POLICY follow_up_history_update_policy ON public.follow_up_history
    FOR UPDATE USING (tenant_owns_follow_up(follow_up_id) OR is_platform_admin() = true);
CREATE POLICY follow_up_history_delete_policy ON public.follow_up_history
    FOR DELETE USING (tenant_owns_follow_up(follow_up_id) OR is_platform_admin() = true);

DROP POLICY IF EXISTS follow_up_activity_select_policy ON public.follow_up_activity;
DROP POLICY IF EXISTS follow_up_activity_insert_policy ON public.follow_up_activity;
DROP POLICY IF EXISTS follow_up_activity_update_policy ON public.follow_up_activity;
DROP POLICY IF EXISTS follow_up_activity_delete_policy ON public.follow_up_activity;
CREATE POLICY follow_up_activity_select_policy ON public.follow_up_activity
    FOR SELECT USING (tenant_owns_follow_up(follow_up_id) OR is_platform_admin() = true);
CREATE POLICY follow_up_activity_insert_policy ON public.follow_up_activity
    FOR INSERT WITH CHECK (tenant_owns_follow_up(follow_up_id) OR is_platform_admin() = true);
CREATE POLICY follow_up_activity_update_policy ON public.follow_up_activity
    FOR UPDATE USING (tenant_owns_follow_up(follow_up_id) OR is_platform_admin() = true);
CREATE POLICY follow_up_activity_delete_policy ON public.follow_up_activity
    FOR DELETE USING (tenant_owns_follow_up(follow_up_id) OR is_platform_admin() = true);

-- ---------------------------------------------------------------------------
-- expense_activity
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS expense_activity_select_policy ON public.expense_activity;
DROP POLICY IF EXISTS expense_activity_insert_policy ON public.expense_activity;
DROP POLICY IF EXISTS expense_activity_update_policy ON public.expense_activity;
DROP POLICY IF EXISTS expense_activity_delete_policy ON public.expense_activity;
CREATE POLICY expense_activity_select_policy ON public.expense_activity
    FOR SELECT USING (tenant_owns_expense(expense_id) OR is_platform_admin() = true);
CREATE POLICY expense_activity_insert_policy ON public.expense_activity
    FOR INSERT WITH CHECK (tenant_owns_expense(expense_id) OR is_platform_admin() = true);
CREATE POLICY expense_activity_update_policy ON public.expense_activity
    FOR UPDATE USING (tenant_owns_expense(expense_id) OR is_platform_admin() = true);
CREATE POLICY expense_activity_delete_policy ON public.expense_activity
    FOR DELETE USING (tenant_owns_expense(expense_id) OR is_platform_admin() = true);

-- ---------------------------------------------------------------------------
-- facebook_business_account (own dealership_id)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS facebook_business_account_select_policy ON public.facebook_business_account;
DROP POLICY IF EXISTS facebook_business_account_insert_policy ON public.facebook_business_account;
DROP POLICY IF EXISTS facebook_business_account_update_policy ON public.facebook_business_account;
DROP POLICY IF EXISTS facebook_business_account_delete_policy ON public.facebook_business_account;
CREATE POLICY facebook_business_account_select_policy ON public.facebook_business_account
    FOR SELECT USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
CREATE POLICY facebook_business_account_insert_policy ON public.facebook_business_account
    FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
CREATE POLICY facebook_business_account_update_policy ON public.facebook_business_account
    FOR UPDATE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
CREATE POLICY facebook_business_account_delete_policy ON public.facebook_business_account
    FOR DELETE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);

NOTIFY pgrst, 'reload schema';
