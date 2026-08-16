# Route 404 Audit Matrix

Generated: `2026-08-15T17:26:05.488Z`
Script: `scripts/audit-routes.mjs`

Static inventory only. Dynamic `[param]` targets are ignored when a matching page/API pattern exists. No secrets.

## Summary

| Metric | Count |
|--------|------:|
| App pages (`page.tsx`) | 72 |
| API routes (`route.ts`) | 153 |
| Unique static page hrefs found | 70 |
| Unique static API paths found | 76 |
| **Orphan page hrefs** (no matching page) | **4** |
| **Orphan API calls** (no matching route) | **1** |
| Allowlisted page strings (not orphans) | 6 |
| Allowlisted API prefixes (not orphans) | 2 |
| Static pages with no in-src reference (info) | 0 |

## Orphan page hrefs

| Path | Kinds | Example sources |
|------|-------|-----------------|
| `/embed` | string-literal | `src/middleware.ts` |
| `/object/public/vehicles` | string-literal | `src/lib/vehicle-storage.ts` |
| `/review` | string-literal | `src/middleware.ts` |
| `/showroom` | string-literal | `src/middleware.ts` |

## Orphan API paths

| Path | Kinds | Example sources |
|------|-------|-----------------|
| `/api/showroom` | api-literal | `src/middleware.ts` |

## Allowlist (documented non-orphans)

Page allowlist: `/week`, `/month`, `/bi-week`, `/edit`, `/oauth/access_token`, `/me/accounts`

API allowlist: `/api/auth`, `/api/webhooks`

## Known pages

| URL | Pattern | File |
|-----|---------|------|
| `/` | `/` | `src/app/page.tsx` |
| `/calendar` | `/calendar` | `src/app/(dashboard)/calendar/page.tsx` |
| `/customers` | `/customers` | `src/app/(dashboard)/customers/page.tsx` |
| `/customers/[id]` | `/customers/[param]` | `src/app/(dashboard)/customers/[id]/page.tsx` |
| `/dashboard` | `/dashboard` | `src/app/(dashboard)/dashboard/page.tsx` |
| `/dealerships` | `/dealerships` | `src/app/(dashboard)/dealerships/page.tsx` |
| `/dealerships/[id]/users` | `/dealerships/[param]/users` | `src/app/(dashboard)/dealerships/[id]/users/page.tsx` |
| `/deals` | `/deals` | `src/app/(dashboard)/deals/page.tsx` |
| `/deals/[id]` | `/deals/[param]` | `src/app/(dashboard)/deals/[id]/page.tsx` |
| `/deals/new` | `/deals/new` | `src/app/(dashboard)/deals/new/page.tsx` |
| `/email-sequences` | `/email-sequences` | `src/app/(dashboard)/email-sequences/page.tsx` |
| `/embed/vehicles/[id]` | `/embed/vehicles/[param]` | `src/app/embed/vehicles/[id]/page.tsx` |
| `/expenses` | `/expenses` | `src/app/(dashboard)/expenses/page.tsx` |
| `/finance` | `/finance` | `src/app/(dashboard)/finance/page.tsx` |
| `/finance/credit` | `/finance/credit` | `src/app/(dashboard)/finance/credit/page.tsx` |
| `/finance/credit/[id]` | `/finance/credit/[param]` | `src/app/(dashboard)/finance/credit/[id]/page.tsx` |
| `/finance/credit/new` | `/finance/credit/new` | `src/app/(dashboard)/finance/credit/new/page.tsx` |
| `/follow-ups` | `/follow-ups` | `src/app/(dashboard)/follow-ups/page.tsx` |
| `/forgot-password` | `/forgot-password` | `src/app/(auth)/forgot-password/page.tsx` |
| `/inventory` | `/inventory` | `src/app/(dashboard)/inventory/page.tsx` |
| `/inventory/[vin]` | `/inventory/[param]` | `src/app/(dashboard)/inventory/[vin]/page.tsx` |
| `/inventory/[vin]/edit` | `/inventory/[param]/edit` | `src/app/(dashboard)/inventory/[vin]/edit/page.tsx` |
| `/inventory/[vin]/print` | `/inventory/[param]/print` | `src/app/(dashboard)/inventory/[vin]/print/page.tsx` |
| `/inventory/add` | `/inventory/add` | `src/app/(dashboard)/inventory/add/page.tsx` |
| `/inventory/gallery` | `/inventory/gallery` | `src/app/(dashboard)/inventory/gallery/page.tsx` |
| `/inventory/new` | `/inventory/new` | `src/app/(dashboard)/inventory/new/page.tsx` |
| `/inventory/purchases` | `/inventory/purchases` | `src/app/(dashboard)/inventory/purchases/page.tsx` |
| `/invoices` | `/invoices` | `src/app/(dashboard)/invoices/page.tsx` |
| `/leads` | `/leads` | `src/app/(dashboard)/leads/page.tsx` |
| `/login` | `/login` | `src/app/(auth)/login/page.tsx` |
| `/platform` | `/platform` | `src/app/(dashboard)/platform/page.tsx` |
| `/platform/analytics` | `/platform/analytics` | `src/app/(dashboard)/platform/analytics/page.tsx` |
| `/platform/audit-logs` | `/platform/audit-logs` | `src/app/(dashboard)/platform/audit-logs/page.tsx` |
| `/platform/feature-flags` | `/platform/feature-flags` | `src/app/(dashboard)/platform/feature-flags/page.tsx` |
| `/platform/impersonate` | `/platform/impersonate` | `src/app/(dashboard)/platform/impersonate/page.tsx` |
| `/platform/login-history` | `/platform/login-history` | `src/app/(dashboard)/platform/login-history/page.tsx` |
| `/platform/reset-password` | `/platform/reset-password` | `src/app/(dashboard)/platform/reset-password/page.tsx` |
| `/platform/subscriptions` | `/platform/subscriptions` | `src/app/(dashboard)/platform/subscriptions/page.tsx` |
| `/profile` | `/profile` | `src/app/(dashboard)/profile/page.tsx` |
| `/quotations` | `/quotations` | `src/app/(dashboard)/quotations/page.tsx` |
| `/register` | `/register` | `src/app/(auth)/register/page.tsx` |
| `/reports` | `/reports` | `src/app/(dashboard)/reports/page.tsx` |
| `/reset-password` | `/reset-password` | `src/app/(auth)/reset-password/page.tsx` |
| `/review/[token]` | `/review/[param]` | `src/app/review/[token]/page.tsx` |
| `/roles` | `/roles` | `src/app/(dashboard)/roles/page.tsx` |
| `/service` | `/service` | `src/app/(dashboard)/service/page.tsx` |
| `/settings/accounting` | `/settings/accounting` | `src/app/(dashboard)/settings/accounting/page.tsx` |
| `/settings/ai-governance` | `/settings/ai-governance` | `src/app/(dashboard)/settings/ai-governance/page.tsx` |
| `/settings/audit` | `/settings/audit` | `src/app/(dashboard)/settings/audit/page.tsx` |
| `/settings/billing` | `/settings/billing` | `src/app/(dashboard)/settings/billing/page.tsx` |
| `/settings/business` | `/settings/business` | `src/app/(dashboard)/settings/business/page.tsx` |
| `/settings/integrations` | `/settings/integrations` | `src/app/(dashboard)/settings/integrations/page.tsx` |
| `/settings/locations` | `/settings/locations` | `src/app/(dashboard)/settings/locations/page.tsx` |
| `/settings/platform` | `/settings/platform` | `src/app/(dashboard)/settings/platform/page.tsx` |
| `/settings/retention` | `/settings/retention` | `src/app/(dashboard)/settings/retention/page.tsx` |
| `/settings/reviews` | `/settings/reviews` | `src/app/(dashboard)/settings/reviews/page.tsx` |
| `/settings/subscription` | `/settings/subscription` | `src/app/(dashboard)/settings/subscription/page.tsx` |
| `/settings/website` | `/settings/website` | `src/app/(dashboard)/settings/website/page.tsx` |
| `/showroom/[slug]` | `/showroom/[param]` | `src/app/showroom/[slug]/page.tsx` |
| `/signatures/[documentType]/[documentId]` | `/signatures/[param]/[param]` | `src/app/(dashboard)/signatures/[documentType]/[documentId]/page.tsx` |
| `/sms-sequences` | `/sms-sequences` | `src/app/(dashboard)/sms-sequences/page.tsx` |
| `/sms-sequences/[id]` | `/sms-sequences/[param]` | `src/app/(dashboard)/sms-sequences/[id]/page.tsx` |
| `/sms-sequences/new` | `/sms-sequences/new` | `src/app/(dashboard)/sms-sequences/new/page.tsx` |
| `/social` | `/social` | `src/app/(dashboard)/social/page.tsx` |
| `/tasks` | `/tasks` | `src/app/(dashboard)/tasks/page.tsx` |
| `/test-drives` | `/test-drives` | `src/app/(dashboard)/test-drives/page.tsx` |
| `/tickets` | `/tickets` | `src/app/(dashboard)/tickets/page.tsx` |
| `/tools` | `/tools` | `src/app/(dashboard)/tools/page.tsx` |
| `/unsubscribe` | `/unsubscribe` | `src/app/unsubscribe/page.tsx` |
| `/users` | `/users` | `src/app/(dashboard)/users/page.tsx` |
| `/vendors` | `/vendors` | `src/app/(dashboard)/vendors/page.tsx` |
| `/verify-email` | `/verify-email` | `src/app/(auth)/verify-email/page.tsx` |

## Known API routes

| URL | Pattern | File |
|-----|---------|------|
| `/api/accounting/export` | `/api/accounting/export` | `src/app/api/accounting/export/route.ts` |
| `/api/admin/bulk-upload-images` | `/api/admin/bulk-upload-images` | `src/app/api/admin/bulk-upload-images/route.ts` |
| `/api/ai/copilot` | `/api/ai/copilot` | `src/app/api/ai/copilot/route.ts` |
| `/api/ai/corrections` | `/api/ai/corrections` | `src/app/api/ai/corrections/route.ts` |
| `/api/ai/description` | `/api/ai/description` | `src/app/api/ai/description/route.ts` |
| `/api/ai/desk-brief` | `/api/ai/desk-brief` | `src/app/api/ai/desk-brief/route.ts` |
| `/api/ai/disclosure` | `/api/ai/disclosure` | `src/app/api/ai/disclosure/route.ts` |
| `/api/ai/follow-up` | `/api/ai/follow-up` | `src/app/api/ai/follow-up/route.ts` |
| `/api/ai/inventory-search` | `/api/ai/inventory-search` | `src/app/api/ai/inventory-search/route.ts` |
| `/api/ai/lead-explanation` | `/api/ai/lead-explanation` | `src/app/api/ai/lead-explanation/route.ts` |
| `/api/ai/price-narrative` | `/api/ai/price-narrative` | `src/app/api/ai/price-narrative/route.ts` |
| `/api/ai/quote-coach` | `/api/ai/quote-coach` | `src/app/api/ai/quote-coach/route.ts` |
| `/api/ai/status` | `/api/ai/status` | `src/app/api/ai/status/route.ts` |
| `/api/audit-logs` | `/api/audit-logs` | `src/app/api/audit-logs/route.ts` |
| `/api/auth/forgot-password` | `/api/auth/forgot-password` | `src/app/api/auth/forgot-password/route.ts` |
| `/api/auth/login` | `/api/auth/login` | `src/app/api/auth/login/route.ts` |
| `/api/auth/logout` | `/api/auth/logout` | `src/app/api/auth/logout/route.ts` |
| `/api/auth/mobile/login` | `/api/auth/mobile/login` | `src/app/api/auth/mobile/login/route.ts` |
| `/api/auth/mobile/logout` | `/api/auth/mobile/logout` | `src/app/api/auth/mobile/logout/route.ts` |
| `/api/auth/mobile/push-token` | `/api/auth/mobile/push-token` | `src/app/api/auth/mobile/push-token/route.ts` |
| `/api/auth/mobile/refresh` | `/api/auth/mobile/refresh` | `src/app/api/auth/mobile/refresh/route.ts` |
| `/api/auth/otp/send` | `/api/auth/otp/send` | `src/app/api/auth/otp/send/route.ts` |
| `/api/auth/otp/verify` | `/api/auth/otp/verify` | `src/app/api/auth/otp/verify/route.ts` |
| `/api/auth/register-dealership` | `/api/auth/register-dealership` | `src/app/api/auth/register-dealership/route.ts` |
| `/api/auth/reset-password` | `/api/auth/reset-password` | `src/app/api/auth/reset-password/route.ts` |
| `/api/bill-of-sale` | `/api/bill-of-sale` | `src/app/api/bill-of-sale/route.ts` |
| `/api/bill-of-sale/[id]` | `/api/bill-of-sale/[param]` | `src/app/api/bill-of-sale/[id]/route.ts` |
| `/api/carfax` | `/api/carfax` | `src/app/api/carfax/route.ts` |
| `/api/carfax/upload` | `/api/carfax/upload` | `src/app/api/carfax/upload/route.ts` |
| `/api/compliance-pack` | `/api/compliance-pack` | `src/app/api/compliance-pack/route.ts` |
| `/api/crm/credit-applications` | `/api/crm/credit-applications` | `src/app/api/crm/credit-applications/route.ts` |
| `/api/crm/credit-applications/[id]` | `/api/crm/credit-applications/[param]` | `src/app/api/crm/credit-applications/[id]/route.ts` |
| `/api/crm/credit-applications/[id]/submit` | `/api/crm/credit-applications/[param]/submit` | `src/app/api/crm/credit-applications/[id]/submit/route.ts` |
| `/api/customers` | `/api/customers` | `src/app/api/customers/route.ts` |
| `/api/customers/[id]` | `/api/customers/[param]` | `src/app/api/customers/[id]/route.ts` |
| `/api/customers/[id]/related` | `/api/customers/[param]/related` | `src/app/api/customers/[id]/related/route.ts` |
| `/api/customers/duplicates` | `/api/customers/duplicates` | `src/app/api/customers/duplicates/route.ts` |
| `/api/customers/merge` | `/api/customers/merge` | `src/app/api/customers/merge/route.ts` |
| `/api/dashboard` | `/api/dashboard` | `src/app/api/dashboard/route.ts` |
| `/api/dealerships` | `/api/dealerships` | `src/app/api/dealerships/route.ts` |
| `/api/dealerships/[id]` | `/api/dealerships/[param]` | `src/app/api/dealerships/[id]/route.ts` |
| `/api/dealerships/[id]/subscription` | `/api/dealerships/[param]/subscription` | `src/app/api/dealerships/[id]/subscription/route.ts` |
| `/api/deals` | `/api/deals` | `src/app/api/deals/route.ts` |
| `/api/deals/[id]` | `/api/deals/[param]` | `src/app/api/deals/[id]/route.ts` |
| `/api/email-sequences` | `/api/email-sequences` | `src/app/api/email-sequences/route.ts` |
| `/api/email-sequences/[id]` | `/api/email-sequences/[param]` | `src/app/api/email-sequences/[id]/route.ts` |
| `/api/email-sequences/enrollments` | `/api/email-sequences/enrollments` | `src/app/api/email-sequences/enrollments/route.ts` |
| `/api/email-sequences/enrollments/[id]/send-next` | `/api/email-sequences/enrollments/[param]/send-next` | `src/app/api/email-sequences/enrollments/[id]/send-next/route.ts` |
| `/api/email-sequences/enrollments/[id]/stop` | `/api/email-sequences/enrollments/[param]/stop` | `src/app/api/email-sequences/enrollments/[id]/stop/route.ts` |
| `/api/email-sequences/process-due` | `/api/email-sequences/process-due` | `src/app/api/email-sequences/process-due/route.ts` |
| `/api/email-sequences/send-due` | `/api/email-sequences/send-due` | `src/app/api/email-sequences/send-due/route.ts` |
| `/api/embed/settings` | `/api/embed/settings` | `src/app/api/embed/settings/route.ts` |
| `/api/equity/triggers` | `/api/equity/triggers` | `src/app/api/equity/triggers/route.ts` |
| `/api/esign/signatures` | `/api/esign/signatures` | `src/app/api/esign/signatures/route.ts` |
| `/api/esign/signed-pdf` | `/api/esign/signed-pdf` | `src/app/api/esign/signed-pdf/route.ts` |
| `/api/expenses` | `/api/expenses` | `src/app/api/expenses/route.ts` |
| `/api/expenses/[id]` | `/api/expenses/[param]` | `src/app/api/expenses/[id]/route.ts` |
| `/api/export` | `/api/export` | `src/app/api/export/route.ts` |
| `/api/external/v1/deals` | `/api/external/v1/deals` | `src/app/api/external/v1/deals/route.ts` |
| `/api/external/v1/inventory` | `/api/external/v1/inventory` | `src/app/api/external/v1/inventory/route.ts` |
| `/api/external/v1/leads` | `/api/external/v1/leads` | `src/app/api/external/v1/leads/route.ts` |
| `/api/finance-calculations` | `/api/finance-calculations` | `src/app/api/finance-calculations/route.ts` |
| `/api/follow-ups` | `/api/follow-ups` | `src/app/api/follow-ups/route.ts` |
| `/api/follow-ups/[id]` | `/api/follow-ups/[param]` | `src/app/api/follow-ups/[id]/route.ts` |
| `/api/health` | `/api/health` | `src/app/api/health/route.ts` |
| `/api/invoices` | `/api/invoices` | `src/app/api/invoices/route.ts` |
| `/api/invoices/[id]` | `/api/invoices/[param]` | `src/app/api/invoices/[id]/route.ts` |
| `/api/invoices/[id]/payments` | `/api/invoices/[param]/payments` | `src/app/api/invoices/[id]/payments/route.ts` |
| `/api/invoices/[id]/send` | `/api/invoices/[param]/send` | `src/app/api/invoices/[id]/send/route.ts` |
| `/api/leads` | `/api/leads` | `src/app/api/leads/route.ts` |
| `/api/leads/[id]` | `/api/leads/[param]` | `src/app/api/leads/[id]/route.ts` |
| `/api/leads/[id]/after-hours` | `/api/leads/[param]/after-hours` | `src/app/api/leads/[id]/after-hours/route.ts` |
| `/api/leads/[id]/convert` | `/api/leads/[param]/convert` | `src/app/api/leads/[id]/convert/route.ts` |
| `/api/leads/[id]/log-call` | `/api/leads/[param]/log-call` | `src/app/api/leads/[id]/log-call/route.ts` |
| `/api/me` | `/api/me` | `src/app/api/me/route.ts` |
| `/api/notifications` | `/api/notifications` | `src/app/api/notifications/route.ts` |
| `/api/ocr-documents` | `/api/ocr-documents` | `src/app/api/ocr-documents/route.ts` |
| `/api/payments/checkout` | `/api/payments/checkout` | `src/app/api/payments/checkout/route.ts` |
| `/api/payments/config` | `/api/payments/config` | `src/app/api/payments/config/route.ts` |
| `/api/payments/webhook` | `/api/payments/webhook` | `src/app/api/payments/webhook/route.ts` |
| `/api/platform/analytics` | `/api/platform/analytics` | `src/app/api/platform/analytics/route.ts` |
| `/api/platform/audit-logs` | `/api/platform/audit-logs` | `src/app/api/platform/audit-logs/route.ts` |
| `/api/platform/feature-flags` | `/api/platform/feature-flags` | `src/app/api/platform/feature-flags/route.ts` |
| `/api/platform/impersonate` | `/api/platform/impersonate` | `src/app/api/platform/impersonate/route.ts` |
| `/api/platform/impersonate/exit` | `/api/platform/impersonate/exit` | `src/app/api/platform/impersonate/exit/route.ts` |
| `/api/platform/login-history` | `/api/platform/login-history` | `src/app/api/platform/login-history/route.ts` |
| `/api/platform/reset-password` | `/api/platform/reset-password` | `src/app/api/platform/reset-password/route.ts` |
| `/api/platform/subscriptions` | `/api/platform/subscriptions` | `src/app/api/platform/subscriptions/route.ts` |
| `/api/profile` | `/api/profile` | `src/app/api/profile/route.ts` |
| `/api/purchases` | `/api/purchases` | `src/app/api/purchases/route.ts` |
| `/api/purchases/[id]` | `/api/purchases/[param]` | `src/app/api/purchases/[id]/route.ts` |
| `/api/quotations` | `/api/quotations` | `src/app/api/quotations/route.ts` |
| `/api/quotations/[id]` | `/api/quotations/[param]` | `src/app/api/quotations/[id]/route.ts` |
| `/api/quotations/[id]/convert` | `/api/quotations/[param]/convert` | `src/app/api/quotations/[id]/convert/route.ts` |
| `/api/quotations/[id]/send` | `/api/quotations/[param]/send` | `src/app/api/quotations/[id]/send/route.ts` |
| `/api/reports` | `/api/reports` | `src/app/api/reports/route.ts` |
| `/api/retention/export` | `/api/retention/export` | `src/app/api/retention/export/route.ts` |
| `/api/reviews/requests` | `/api/reviews/requests` | `src/app/api/reviews/requests/route.ts` |
| `/api/reviews/settings` | `/api/reviews/settings` | `src/app/api/reviews/settings/route.ts` |
| `/api/roles` | `/api/roles` | `src/app/api/roles/route.ts` |
| `/api/roles/[id]` | `/api/roles/[param]` | `src/app/api/roles/[id]/route.ts` |
| `/api/sales` | `/api/sales` | `src/app/api/sales/route.ts` |
| `/api/service/reactivation` | `/api/service/reactivation` | `src/app/api/service/reactivation/route.ts` |
| `/api/service/records` | `/api/service/records` | `src/app/api/service/records/route.ts` |
| `/api/service/records/[id]` | `/api/service/records/[param]` | `src/app/api/service/records/[id]/route.ts` |
| `/api/settings/ai-governance` | `/api/settings/ai-governance` | `src/app/api/settings/ai-governance/route.ts` |
| `/api/settings/api-tokens` | `/api/settings/api-tokens` | `src/app/api/settings/api-tokens/route.ts` |
| `/api/settings/api-tokens/[id]` | `/api/settings/api-tokens/[param]` | `src/app/api/settings/api-tokens/[id]/route.ts` |
| `/api/settings/business` | `/api/settings/business` | `src/app/api/settings/business/route.ts` |
| `/api/settings/email/test` | `/api/settings/email/test` | `src/app/api/settings/email/test/route.ts` |
| `/api/settings/integrations` | `/api/settings/integrations` | `src/app/api/settings/integrations/route.ts` |
| `/api/settings/locations` | `/api/settings/locations` | `src/app/api/settings/locations/route.ts` |
| `/api/settings/sms` | `/api/settings/sms` | `src/app/api/settings/sms/route.ts` |
| `/api/showroom/[slug]/lead` | `/api/showroom/[param]/lead` | `src/app/api/showroom/[slug]/lead/route.ts` |
| `/api/sms/activity` | `/api/sms/activity` | `src/app/api/sms/activity/route.ts` |
| `/api/sms/inbound` | `/api/sms/inbound` | `src/app/api/sms/inbound/route.ts` |
| `/api/sms/opt-in` | `/api/sms/opt-in` | `src/app/api/sms/opt-in/route.ts` |
| `/api/sms/send` | `/api/sms/send` | `src/app/api/sms/send/route.ts` |
| `/api/sms/sequences` | `/api/sms/sequences` | `src/app/api/sms/sequences/route.ts` |
| `/api/sms/sequences/[id]` | `/api/sms/sequences/[param]` | `src/app/api/sms/sequences/[id]/route.ts` |
| `/api/sms/sequences/[id]/enroll` | `/api/sms/sequences/[param]/enroll` | `src/app/api/sms/sequences/[id]/enroll/route.ts` |
| `/api/sms/sequences/enrollments` | `/api/sms/sequences/enrollments` | `src/app/api/sms/sequences/enrollments/route.ts` |
| `/api/sms/sequences/enrollments/[id]/send-next` | `/api/sms/sequences/enrollments/[param]/send-next` | `src/app/api/sms/sequences/enrollments/[id]/send-next/route.ts` |
| `/api/sms/sequences/send-due` | `/api/sms/sequences/send-due` | `src/app/api/sms/sequences/send-due/route.ts` |
| `/api/sms/status` | `/api/sms/status` | `src/app/api/sms/status/route.ts` |
| `/api/social/caption` | `/api/social/caption` | `src/app/api/social/caption/route.ts` |
| `/api/social/facebook` | `/api/social/facebook` | `src/app/api/social/facebook/route.ts` |
| `/api/social/facebook/callback` | `/api/social/facebook/callback` | `src/app/api/social/facebook/callback/route.ts` |
| `/api/social/posts` | `/api/social/posts` | `src/app/api/social/posts/route.ts` |
| `/api/social/publish-scheduled` | `/api/social/publish-scheduled` | `src/app/api/social/publish-scheduled/route.ts` |
| `/api/tasks` | `/api/tasks` | `src/app/api/tasks/route.ts` |
| `/api/tasks/[id]` | `/api/tasks/[param]` | `src/app/api/tasks/[id]/route.ts` |
| `/api/tasks/[id]/notes` | `/api/tasks/[param]/notes` | `src/app/api/tasks/[id]/notes/route.ts` |
| `/api/tasks/[id]/reminders` | `/api/tasks/[param]/reminders` | `src/app/api/tasks/[id]/reminders/route.ts` |
| `/api/test-drives` | `/api/test-drives` | `src/app/api/test-drives/route.ts` |
| `/api/test-drives/[id]` | `/api/test-drives/[param]` | `src/app/api/test-drives/[id]/route.ts` |
| `/api/tickets` | `/api/tickets` | `src/app/api/tickets/route.ts` |
| `/api/tickets/[id]` | `/api/tickets/[param]` | `src/app/api/tickets/[id]/route.ts` |
| `/api/unsubscribe` | `/api/unsubscribe` | `src/app/api/unsubscribe/route.ts` |
| `/api/users` | `/api/users` | `src/app/api/users/route.ts` |
| `/api/users/[id]` | `/api/users/[param]` | `src/app/api/users/[id]/route.ts` |
| `/api/vehicles` | `/api/vehicles` | `src/app/api/vehicles/route.ts` |
| `/api/vehicles/[id]` | `/api/vehicles/[param]` | `src/app/api/vehicles/[id]/route.ts` |
| `/api/vehicles/[id]/images` | `/api/vehicles/[param]/images` | `src/app/api/vehicles/[id]/images/route.ts` |
| `/api/vehicles/[id]/syndication` | `/api/vehicles/[param]/syndication` | `src/app/api/vehicles/[id]/syndication/route.ts` |
| `/api/vehicles/public` | `/api/vehicles/public` | `src/app/api/vehicles/public/route.ts` |
| `/api/vehicles/syndication` | `/api/vehicles/syndication` | `src/app/api/vehicles/syndication/route.ts` |
| `/api/vendors` | `/api/vendors` | `src/app/api/vendors/route.ts` |
| `/api/vendors/[id]` | `/api/vendors/[param]` | `src/app/api/vendors/[id]/route.ts` |
| `/api/vin-lookup` | `/api/vin-lookup` | `src/app/api/vin-lookup/route.ts` |
| `/api/webhooks` | `/api/webhooks` | `src/app/api/webhooks/route.ts` |
| `/api/webhooks/[id]` | `/api/webhooks/[param]` | `src/app/api/webhooks/[id]/route.ts` |
| `/api/webhooks/deliveries` | `/api/webhooks/deliveries` | `src/app/api/webhooks/deliveries/route.ts` |

## Unreferenced static pages (informational)

These pages exist but no static href/push/redirect to them was found in `src/`. Not necessarily bugs.

_None._

---
Phase 0 of Deep 404 Swarm. Fix orphans in later lanes; do not treat this file as a deploy artifact.
