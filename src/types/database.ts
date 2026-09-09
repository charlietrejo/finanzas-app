// "credit" se conserva solo para leer cuentas archivadas (legacy, ver
// 017_credit_cards_back_to_debts.sql) — ya no se ofrece al crear una cuenta.
export type AccountType = "cash" | "debit" | "credit" | "investment" | "savings";
export type CategoryType = "income" | "expense";
export type TransactionType = "income" | "expense" | "transfer";
export type DebtType = "credit_card" | "loan" | "personal";
// "custom" usa recurring_interval_days; las otras tres tienen cadencia fija.
export type RecurringFrequency = "weekly" | "monthly" | "annual" | "custom";

// Nota: se usan `type` (no `interface`) porque los Row de la tabla deben ser
// estructuralmente asignables a Record<string, unknown> para satisfacer
// GenericSchema de @supabase/postgrest-js; las interfaces no lo son.
export type Account = {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  bank_name: string | null;
  initial_balance: number;
  current_balance: number;
  // No nulo = cuenta archivada (ej. tarjeta migrada a `debts`, sección 6 del
  // doc): se conserva el saldo histórico, pero ya no se muestra activa ni
  // se pueden crear cuentas nuevas type="credit".
  archived_at: string | null;
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
  // due_day: préstamo/personal. credit_limit/bank_name/cutoff_day/payment_due_day:
  // solo type="credit_card" (sección 6 del doc: las tarjetas viven completa
  // y únicamente aquí, nunca en `accounts`). Mutuamente excluyentes con due_day.
  due_day: number | null;
  credit_limit: number | null;
  bank_name: string | null;
  cutoff_day: number | null;
  payment_due_day: number | null;
  current_balance: number;
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
  // Exactamente uno de account_id/debt_id en un gasto (pagado con cuenta O
  // con tarjeta directamente); income/transfer siempre usan account_id.
  account_id: string | null;
  debt_id: string | null;
  to_account_id: string | null;
  // category_id: no aplica a transfer. merchant_id/tags: solo aplican a expense.
  category_id: string | null;
  merchant_id: string | null;
  type: TransactionType;
  amount: number;
  date: string;
  note: string | null;
  tags: string[];
  is_recurring: boolean;
  // Los 3 solo se llenan si is_recurring; recurring_interval_days solo si
  // recurring_frequency="custom". El ancla de la recurrencia es `date`
  // (sección 3.2/4 del doc — ya no se guarda un "next_date" aparte).
  recurring_frequency: RecurringFrequency | null;
  recurring_interval_days: number | null;
  recurring_end_date: string | null;
  // Fase 8 del doc: solo se llena si is_recurring — el motor de
  // recurrencias (cron) lo usa para saber cuándo generar la siguiente
  // ocurrencia real, y lo avanza un periodo cada vez que genera una.
  next_occurrence_date: string | null;
  created_at: string;
};

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: Account;
        Insert: Omit<Account, "id" | "user_id" | "created_at" | "current_balance" | "archived_at"> & {
          id?: string;
          user_id?: string;
          created_at?: string;
          current_balance?: number;
          archived_at?: string | null;
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
        Insert: Omit<
          Debt,
          | "id"
          | "user_id"
          | "created_at"
          | "current_balance"
          | "due_day"
          | "credit_limit"
          | "bank_name"
          | "cutoff_day"
          | "payment_due_day"
          | "archived_at"
        > & {
          id?: string;
          user_id?: string;
          created_at?: string;
          current_balance?: number;
          due_day?: number | null;
          credit_limit?: number | null;
          bank_name?: string | null;
          cutoff_day?: number | null;
          payment_due_day?: number | null;
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
          p_account_id: string | null;
          p_type: TransactionType;
          p_amount: number;
          p_date: string;
          p_category_id?: string | null;
          p_merchant_id?: string | null;
          p_to_account_id?: string | null;
          p_note?: string | null;
          p_tags?: string[];
          p_is_recurring?: boolean;
          p_debt_id?: string | null;
          p_recurring_frequency?: RecurringFrequency | null;
          p_recurring_interval_days?: number | null;
          p_recurring_end_date?: string | null;
          p_next_occurrence_date?: string | null;
        };
        Returns: Transaction;
      };
      update_transaction: {
        Args: {
          p_id: string;
          p_account_id: string | null;
          p_type: TransactionType;
          p_amount: number;
          p_date: string;
          p_category_id?: string | null;
          p_merchant_id?: string | null;
          p_to_account_id?: string | null;
          p_note?: string | null;
          p_tags?: string[];
          p_is_recurring?: boolean;
          p_debt_id?: string | null;
          p_recurring_frequency?: RecurringFrequency | null;
          p_recurring_interval_days?: number | null;
          p_recurring_end_date?: string | null;
          p_next_occurrence_date?: string | null;
        };
        Returns: Transaction;
      };
      delete_transaction: {
        Args: { p_id: string };
        Returns: void;
      };
      // Fase 8: solo invocable con el service role key (ver
      // 019_recurring_engine.sql / 020_fix_recurring_null_serialization.sql).
      // Retorna jsonb (no `transactions`) a propósito: un jsonb null llega
      // como JSON null real; un row type NULL llegaría como fila de
      // columnas null (ver comentario en la migración 020).
      generate_recurring_occurrence: {
        Args: { p_template_id: string; p_next_occurrence_date: string };
        Returns: Transaction | null;
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
