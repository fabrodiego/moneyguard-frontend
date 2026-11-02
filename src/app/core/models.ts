export type TransactionType = 'EXPENSE' | 'INCOME';
export type TransactionSource = 'WEB' | 'DISCORD' | 'RECURRENCE';
export type Frequency = 'MONTHLY' | 'YEARLY';
export type InsightPeriod = 'MONTH' | 'QUARTER' | 'SEMESTER' | 'YEAR';

export interface TokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface Me {
  id: number;
  name: string;
  email: string;
}

export interface Category {
  id: number;
  name: string;
  type: TransactionType;
  color: string | null;
}

export interface Merchant {
  id: number;
  name: string;
  category: Category;
}

export interface Transaction {
  id: number;
  type: TransactionType;
  amount: number;
  description: string | null;
  occurredOn: string;
  source: TransactionSource;
  category: Category;
  merchant: { id: number; name: string } | null;
}

export interface TransactionRequest {
  categoryId: number;
  merchantId: number | null;
  amount: number;
  description: string | null;
  occurredOn: string | null;
}

export interface Goal {
  id: number;
  name: string;
  target: number;
  deadline: string | null;
  priority: number;
  archived: boolean;
  saved: number;
  remaining: number;
  percent: number;
  monthsLeft: number | null;
  monthlyNeeded: number | null;
}

export interface GoalRequest {
  name: string;
  target: number;
  deadline: string | null;
  priority: number;
  archived?: boolean;
}

export interface GoalSummary {
  balance: number;
  allocated: number;
  available: number;
  goals: Goal[];
}

export interface Contribution {
  id: number;
  amount: number;
  note: string | null;
  contributedOn: string;
}

export interface Totals {
  income: number;
  expense: number;
  balance: number;
}

export interface CategoryTotal {
  categoryId: number;
  name: string;
  type: TransactionType;
  color: string | null;
  total: number;
  percent: number;
  count: number;
}

export interface SeriesPoint {
  label: string;
  from: string;
  to: string;
  income: number;
  expense: number;
  balance: number;
}

export interface Recurrence {
  id: number;
  name: string;
  type: TransactionType;
  amount: number;
  monthlyAmount: number;
  frequency: Frequency;
  dayOfMonth: number;
  monthOfYear: number | null;
  startDate: string;
  endDate: string | null;
  nextDueOn: string | null;
  active: boolean;
  category: Category;
  merchant: { id: number; name: string } | null;
}

export interface RecurrenceRequest {
  name: string;
  categoryId: number;
  merchantId: number | null;
  amount: number;
  frequency: Frequency;
  dayOfMonth: number;
  monthOfYear: number | null;
  startDate: string | null;
  endDate: string | null;
  active: boolean;
}

export interface RecurrenceSummary {
  monthlyExpenses: number;
  monthlyIncomes: number;
  monthlyBalance: number;
  activeCount: number;
  next30Days: { recurrenceId: number; name: string; type: TransactionType; amount: number; dueOn: string }[];
}

export interface DiscordLinkStatus {
  linked: boolean;
  discordUserId: string | null;
  linkedAt: string | null;
}

export interface DiscordLinkCode {
  code: string;
  expiresAt: string;
}

export interface Insight {
  period: InsightPeriod;
  year: number;
  number: number;
  from: string;
  to: string;
  totals: Totals;
  previous: Totals;
  expensesByCategory: CategoryTotal[];
  incomesByCategory: CategoryTotal[];
  series: SeriesPoint[];
}
