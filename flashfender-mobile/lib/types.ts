export type MobileUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  dealership_id: string | null;
};

export type LoginSuccess = {
  accessToken: string;
  expiresIn: number | null;
  user: MobileUser;
};

export type Vehicle = {
  id: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  stock_number: string | null;
  status: string | null;
  odometer: number | null;
  retail_price: number | null;
  purchase_price: number | null;
  condition: string | null;
  known_damage: boolean | null;
  disclosure: string | null;
  image_gallery: string[];
};

export type VehicleListResult = {
  vehicles: Vehicle[];
  count: number;
  fromCache?: boolean;
};

export type CreateVehicleInput = {
  vin: string;
  year: number;
  make: string;
  model: string;
  condition: string;
  purchase_price: number;
  retail_price: number;
};

export const LEAD_STATUSES = [
  'Not Started',
  'In Progress',
  'Qualified',
  'Closed',
  'Lost',
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type LeadCustomerSummary = {
  id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
};

export type Lead = {
  id: string;
  status: string | null;
  source: string | null;
  temperature: string | null;
  notes: string | null;
  created_at: string | null;
  customer: LeadCustomerSummary | null;
};

export type LeadListResult = {
  leads: Lead[];
  count: number;
  fromCache?: boolean;
};

export const LEAD_SOURCES = [
  'Website',
  'Referral',
  'Event',
  'Walk-in',
  'Facebook',
  'Craigslist',
  'Kijiji',
  'Phone',
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

export type CreateLeadInput = {
  customer_id: string;
  source?: LeadSource;
  status?: LeadStatus;
  notes?: string;
  interest_vehicle_id?: string;
};

export type Customer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  source: string | null;
  marketing_consent: boolean | null;
  sms_consent: boolean | null;
  created_at: string | null;
};

export type CustomerListResult = {
  customers: Customer[];
  count: number;
  fromCache?: boolean;
};

export type CreateCustomerInput = {
  name: string;
  email?: string;
  phone?: string;
  /** CASL — must default false on create forms */
  marketing_consent: boolean;
  /** CASL — must default false on create forms */
  sms_consent: boolean;
};

export type DealVehicleSummary = {
  id: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  vin: string | null;
};

export type Deal = {
  id: string;
  deal_status: string | null;
  sale_price: number | null;
  down_payment: number | null;
  trade_in_value: number | null;
  finance_term: number | null;
  interest_rate: number | null;
  created_at: string | null;
  customer: LeadCustomerSummary | null;
  vehicle: DealVehicleSummary | null;
};

export type DealListResult = {
  deals: Deal[];
  count: number;
};

export type CreateDealInput = {
  vehicle_id: string;
  sale_price: number;
  customer_id?: string;
  deal_status?: string;
  notes?: string;
};

export type FollowUp = {
  id: string;
  title: string | null;
  status: string | null;
  priority: string | null;
  follow_up_date: string | null;
  notes: string | null;
  customer: LeadCustomerSummary | null;
};

export type FollowUpListResult = {
  followUps: FollowUp[];
  count: number;
};

export type PatchFollowUpInput = {
  status?: 'Pending' | 'Completed' | 'Cancelled';
  follow_up_date?: string;
  notes?: string;
};

export type Task = {
  id: string;
  title: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  description: string | null;
};

export type TaskListResult = {
  tasks: Task[];
  count: number;
};

export type Invoice = {
  id: string;
  invoice_number: string | null;
  status: string | null;
  invoice_date: string | null;
  due_date: string | null;
  payment_amount: number | null;
  tax_amount: number | null;
  total: number | null;
  amount_paid: number | null;
  notes: string | null;
  customer: LeadCustomerSummary | null;
};

export type InvoiceListResult = {
  invoices: Invoice[];
  count: number;
};

export type ExpenseVendorSummary = {
  id: string | null;
  vendor_name: string | null;
  phone: string | null;
};

export type Expense = {
  id: string;
  description: string | null;
  amount: number | null;
  tax_amount: number | null;
  category: string | null;
  status: string | null;
  expense_date: string | null;
  due_date: string | null;
  vendor: ExpenseVendorSummary | null;
};

export type ExpenseListResult = {
  expenses: Expense[];
  count: number;
};

export const EXPENSE_CATEGORIES = [
  'Vehicle Acquisition',
  'Repair & Maintenance',
  'Parts & Supplies',
  'Utilities',
  'Rent & Lease',
  'Insurance',
  'Marketing',
  'Office Supplies',
  'Professional Services',
  'Travel & Entertainment',
  'Payroll',
  'Taxes & Licenses',
  'Interest & Finance',
  'Miscellaneous',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type CreateExpenseInput = {
  amount: number;
  category: ExpenseCategory;
  expense_date: string;
  description?: string;
};

export type Vendor = {
  id: string;
  vendor_name: string | null;
  vendor_type: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
};

export type VendorListResult = {
  vendors: Vendor[];
  count: number;
};

export type CreditApplication = {
  id: string;
  status: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string | null;
  customer: LeadCustomerSummary | null;
  vehicle: DealVehicleSummary | null;
};

export type CreditApplicationListResult = {
  applications: CreditApplication[];
  count: number;
};

export type HomeKpis = {
  followUps: number | null;
  tasks: number | null;
  leads: number | null;
  stock: number | null;
  errors: string[];
  fromCache?: boolean;
};

export const CALENDAR_EVENT_TYPES = [
  'test_drive',
  'follow_up',
  'delivery',
  'invoice',
  'appointment',
] as const;

export type CalendarEventType = (typeof CALENDAR_EVENT_TYPES)[number];

export type CalendarEvent = {
  id: string;
  type: CalendarEventType;
  title: string;
  subtitle: string | null;
  dateIso: string;
  status: string | null;
  href: string;
};

export type CalendarListResult = {
  events: CalendarEvent[];
  count: number;
};

export type TestDriveVehicleSummary = {
  id: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  vin: string | null;
  stock_number: string | null;
};

export type TestDrive = {
  id: string;
  status: string | null;
  outcome: string | null;
  notes: string | null;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  customer: LeadCustomerSummary | null;
  vehicle: TestDriveVehicleSummary | null;
};

export type TestDriveListResult = {
  testDrives: TestDrive[];
  count: number;
};

export type TicketAssigneeSummary = {
  id: string | null;
  full_name: string | null;
  email: string | null;
};

export type Ticket = {
  id: string;
  subject: string | null;
  description: string | null;
  status: string | null;
  priority: string | null;
  created_at: string | null;
  assigned_user: TicketAssigneeSummary | null;
};

export type TicketListResult = {
  tickets: Ticket[];
  count: number;
};

export type ServiceRecord = {
  id: string;
  service_type: string | null;
  status: string | null;
  service_date: string | null;
  notes: string | null;
  customer: LeadCustomerSummary | null;
  vehicle: DealVehicleSummary | null;
};

export type ServiceRecordListResult = {
  records: ServiceRecord[];
  count: number;
};

export type FlashAiMessage = {
  role: 'user' | 'assistant';
  content: string;
};
