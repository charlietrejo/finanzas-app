export type AccountType = "cash" | "debit" | "credit" | "investment" | "savings";
export type CategoryType = "income" | "expense";
export type TransactionType = "income" | "expense" | "transfer";
// "credit_card" se conserva solo para leer deudas archivadas (legacy, ver
// 016_credit_card_account_fields.sql) — ya no se ofrece al crear una deuda.
export type DebtType = "credit_card" | "loan" | "personal";

// Nota: se usan `type` (no `interface`) porque los Row de la tabla deben ser
// estructuralmente asignables a Record<string, unknown> para satisfacer
// GenericSchema de @supabase/postgrest-js; las interfaces no lo son.
export type RecurringRule = {
  frequency: "daily" | "weekly" | "monthly";
  interval: number;
  next_date: string;
};

export type Account = {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  bank_name: string | null;
  initial_balance: number;
  current_balance: number;
  credit_limit: number | null;
  // Datos de deuda de la tarjeta (solo type="credit"; sección 6 del doc: una
  // cuenta de crédito ES la deuda, no se duplica en `debts`).
  interest_rate: number | null;
  minimum_payment: number | null;
  cutoff_day: number | null;
  payment_due_day: number | null;
  created_at: string;
};

export type Category = {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  type: CategoryType;
  icon: string | null;
  color: string | null;
  created_at: string;
};

export type Merchant = {
  id: string;
  name: string;
  default_category_name: string | null;
  created_at: string;
};

export type Budget = {
  id: string;
  user_id: string;
  category_id: string;
  month: string;
  amount_limit: number;
  alert_threshold_pct: number;
  created_at: string;
};

export type Debt = {
  id: string;
  user_id: string;
  name: string;
  type: DebtType;
  principal: number;
  interest_rate: number;
  minimum_payment: number;
  due_day: number | null;
  current_balance: number;
  // No nulo = deuda archivada (ej. tarjeta migrada a `accounts`): se
  // conserva el histórico, pero ya no se muestra activa. Ver sección 6.
  archived_at: string | null;
  created_at: string;
};

export type DebtPayment = {
  id: string;
  user_id: string;
  debt_id: string;
  account_id: string;
  amount: number;
  date: string;
  note: string | null;
  created_at: string;
};

export type Goal = {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string;
  account_id: string | null;
  created_at: string;
};

export type GoalContribution = {
  id: string;
  user_id: string;
  goal_id: string;
  account_id: string;
  amount: number;
  date: string;
  note: string | null;
  created_at: string;
};

export type Transaction = {
  id: string;
  user_id: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  merchant_id: string | null;
  type: TransactionType;
  amount: number;
  date: string;
  note: string | null;
  tags: string[];
  is_recurring: boolean;
  recurring_rule: RecurringRule | null;
  created_at: string;
};

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: Account;
        Insert: Omit<
          Account,
          "id" | "user_id" | "created_at" | "current_balance" | "interest_rate" | "minimum_payment" | "cutoff_day" | "payment_due_day"
        > & {
          id?: string;
          user_id?: string;
          created_at?: string;
          current_balance?: number;
          interest_rate?: number | null;
          minimum_payment?: number | null;
          cutoff_day?: number | null;
          payment_due_day?: number | null;
        };
        Update: Partial<Omit<Account, "id" | "user_id">>;
        Relationships: [];
      };
      categories: {
        Row: Category;
        Insert: Omit<Category, "id" | "user_id" | "created_at" | "parent_id" | "icon" | "color"> & {
          id?: string;
          user_id?: string;
          created_at?: string;
          parent_id?: string | null;
          icon?: string | null;
          color?: string | null;
        };
        Update: Partial<Omit<Category, "id" | "user_id">>;
        Relationships: [];
      };
      merchants: {
        Row: Merchant;
        Insert: Omit<Merchant, "id" | "created_at" | "default_category_name"> & {
          id?: string;
          created_at?: string;
          default_category_name?: string | null;
        };
        Update: Partial<Merchant>;
        Relationships: [];
      };
      transactions: {
        Row: Transaction;
        Insert: Omit<Transaction, "id" | "user_id" | "created_at"> & {
          id?: string;
          user_id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Transaction, "id" | "user_id">>;
        Relationships: [];
      };
      budgets: {
        Row: Budget;
        Insert: Omit<Budget, "id" | "user_id" | "created_at" | "alert_threshold_pct"> & {
          id?: string;
          user_id?: string;
          created_at?: string;
          alert_threshold_pct?: number;
        };
        Update: Partial<Omit<Budget, "id" | "user_id">>;
        Relationships: [];
      };
      debts: {
        Row: Debt;
        Insert: Omit<Debt, "id" | "user_id" | "created_at" | "current_balance" | "due_day" | "archived_at"> & {
          id?: string;
          user_id?: string;
          created_at?: string;
          current_balance?: number;
          due_day?: number | null;
          archived_at?: string | null;
        };
        Update: Partial<Omit<Debt, "id" | "user_id">>;
        Relationships: [];
      };
      debt_payments: {
        Row: DebtPayment;
        Insert: Omit<DebtPayment, "id" | "user_id" | "created_at" | "note"> & {
          id?: string;
          user_id?: string;
          created_at?: string;
          note?: string | null;
        };
        Update: Partial<Omit<DebtPayment, "id" | "user_id">>;
        Relationships: [];
      };
      goals: {
        Row: Goal;
        Insert: Omit<Goal, "id" | "user_id" | "created_at" | "current_amount" | "account_id"> & {
          id?: string;
          user_id?: string;
          created_at?: string;
          current_amount?: number;
          account_id?: string | null;
        };
        Update: Partial<Omit<Goal, "id" | "user_id">>;
        Relationships: [];
      };
      goal_contributions: {
        Row: GoalContribution;
        Insert: Omit<GoalContribution, "id" | "user_id" | "created_at" | "note"> & {
          id?: string;
          user_id?: string;
          created_at?: string;
          note?: string | null;
        };
        Update: Partial<Omit<GoalContribution, "id" | "user_id">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
    Functions: {
      create_transaction: {
        Args: {
          p_account_id: string;
          p_type: TransactionType;
          p_amount: number;
          p_date: string;
          p_category_id?: string | null;
          p_merchant_id?: string | null;
          p_to_account_id?: string | null;
          p_note?: string | null;
          p_tags?: string[];
          p_is_recurring?: boolean;
          p_recurring_rule?: RecurringRule | null;
        };
        Returns: Transaction;
      };
      update_transaction: {
        Args: {
          p_id: string;
          p_account_id: string;
          p_type: TransactionType;
          p_amount: number;
          p_date: string;
          p_category_id?: string | null;
          p_merchant_id?: string | null;
          p_to_account_id?: string | null;
          p_note?: string | null;
          p_tags?: string[];
          p_is_recurring?: boolean;
          p_recurring_rule?: RecurringRule | null;
        };
        Returns: Transaction;
      };
      delete_transaction: {
        Args: { p_id: string };
        Returns: void;
      };
      create_debt_payment: {
        Args: {
          p_debt_id: string;
          p_account_id: string;
          p_amount: number;
          p_date: string;
          p_note?: string | null;
        };
        Returns: DebtPayment;
      };
      delete_debt_payment: {
        Args: { p_id: string };
        Returns: void;
      };
      create_goal_contribution: {
        Args: {
          p_goal_id: string;
          p_account_id: string;
          p_amount: number;
          p_date: string;
          p_note?: string | null;
        };
        Returns: GoalContribution;
      };
      delete_goal_contribution: {
        Args: { p_id: string };
        Returns: void;
      };
    };
  };
}
