export type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER" | "DEBT_PAYMENT";
export type AccountType = "CASH" | "BANK" | "CREDIT_CARD" | "SAVINGS" | "INVESTMENT" | "OTHER";
export type CategoryType = "INCOME" | "EXPENSE";
export type DebtType = "CREDIT_CARD" | "LOAN" | "OTHER";


export type Debt = {
  id: string;
  user_id: string;
  name: string;
  type: DebtType;
  initial_amount: number;
  current_balance: number;
  due_date?: string | null;
  created_at: string;
  updated_at: string;
};
export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  initial_balance: number;
  current_balance: number;
  created_at: string;
  updated_at?: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  category_id?: string | null;
  debt_id: string | null;
  destination_account_id?: string | null;
  type: TransactionType;
  amount: number;
  description: string;
  notes?: string;
  transaction_date: string;
  created_at: string;
  updated_at?: string;
}

export interface Category {
  id: string;
  user_id?: string | null;
  name: string;
  type: CategoryType;
  parent_id?: string | null;
  icon?: string;
  color?: string;
  is_default?: boolean;
  created_at?: string;
}

export interface Budget {
  id: string;
  category_id: string;
  amount: number;
  period: string;
  start_date: string;
}

export interface Goal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date?: string;
}
