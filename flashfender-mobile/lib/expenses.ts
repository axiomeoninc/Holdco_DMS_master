import { apiFetch } from '@/lib/api';
import { asFiniteNumber, asString, isRecord, listPayload, unwrapData } from '@/lib/parse';
import type {
  CreateExpenseInput,
  Expense,
  ExpenseListResult,
  ExpenseVendorSummary,
} from '@/lib/types';

function parseVendorSummary(value: unknown): ExpenseVendorSummary | null {
  if (!isRecord(value)) return null;
  return {
    id: asString(value.id),
    vendor_name: asString(value.vendor_name),
    phone: asString(value.phone),
  };
}

export function parseExpense(value: unknown): Expense | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) {
    return null;
  }
  return {
    id: value.id,
    description: asString(value.description),
    amount: asFiniteNumber(value.amount),
    tax_amount: asFiniteNumber(value.tax_amount),
    category: asString(value.category),
    status: asString(value.status),
    expense_date: asString(value.expense_date),
    due_date: asString(value.due_date),
    vendor: parseVendorSummary(value.vendor),
  };
}

export function parseExpenseList(body: unknown): ExpenseListResult {
  const { raw, count } = listPayload(body);
  const expenses: Expense[] = [];
  for (const item of raw) {
    const expense = parseExpense(item);
    if (expense) expenses.push(expense);
  }
  return { expenses, count };
}

export async function listExpenses(limit = 50): Promise<ExpenseListResult> {
  const body = await apiFetch(`/api/expenses?limit=${limit}`);
  return parseExpenseList(body);
}

export async function getExpense(id: string): Promise<Expense> {
  const body = await apiFetch(`/api/expenses/${encodeURIComponent(id)}`);
  const expense = parseExpense(unwrapData(body));
  if (!expense) throw new Error('Invalid expense response');
  return expense;
}

export async function createExpense(input: CreateExpenseInput): Promise<Expense> {
  const body = await apiFetch('/api/expenses', {
    method: 'POST',
    body: {
      amount: input.amount,
      category: input.category,
      expense_date: input.expense_date,
      ...(input.description ? { description: input.description } : {}),
    },
  });
  const expense = parseExpense(unwrapData(body));
  if (!expense) throw new Error('Invalid create-expense response');
  return expense;
}

export function expenseTitle(expense: Expense): string {
  if (expense.description) return expense.description;
  if (expense.category) return expense.category;
  return 'Expense';
}

export function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
