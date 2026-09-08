-- Auditoría de seguridad (Fase 6): las políticas de insert/update existentes
-- solo verifican `user_id = auth.uid()` en la fila propia, pero nunca revisan
-- que las columnas que referencian OTRA tabla (account_id, category_id,
-- debt_id, goal_id, parent_id) pertenezcan también al mismo usuario. Esto
-- permitía, vía la API REST de Supabase (sin pasar por la app ni por las
-- funciones RPC), insertar filas propias que apuntan a IDs de otro usuario.
-- No exponía datos ajenos (siguen protegidos por el RLS de sus propias
-- tablas), pero permitía asociar datos falsos a IDs ajenos. Las RPC atómicas
-- ya validan esta dueñidad antes de escribir, así que este fix es
-- retrocompatible: no cambia el comportamiento de la app, solo cierra el
-- camino directo por REST.

alter policy "categories_insert_own" on categories
  with check (
    user_id = auth.uid()
    and (parent_id is null or exists (
      select 1 from categories p where p.id = parent_id and p.user_id = auth.uid()
    ))
  );

alter policy "categories_update_own" on categories
  with check (
    user_id = auth.uid()
    and (parent_id is null or exists (
      select 1 from categories p where p.id = parent_id and p.user_id = auth.uid()
    ))
  );

alter policy "transactions_insert_own" on transactions
  with check (
    user_id = auth.uid()
    and exists (select 1 from accounts a where a.id = account_id and a.user_id = auth.uid())
    and (to_account_id is null or exists (
      select 1 from accounts a where a.id = to_account_id and a.user_id = auth.uid()
    ))
    and (category_id is null or exists (
      select 1 from categories c where c.id = category_id and c.user_id = auth.uid()
    ))
  );

alter policy "transactions_update_own" on transactions
  with check (
    user_id = auth.uid()
    and exists (select 1 from accounts a where a.id = account_id and a.user_id = auth.uid())
    and (to_account_id is null or exists (
      select 1 from accounts a where a.id = to_account_id and a.user_id = auth.uid()
    ))
    and (category_id is null or exists (
      select 1 from categories c where c.id = category_id and c.user_id = auth.uid()
    ))
  );

alter policy "budgets_insert_own" on budgets
  with check (
    user_id = auth.uid()
    and exists (select 1 from categories c where c.id = category_id and c.user_id = auth.uid())
  );

alter policy "budgets_update_own" on budgets
  with check (
    user_id = auth.uid()
    and exists (select 1 from categories c where c.id = category_id and c.user_id = auth.uid())
  );

alter policy "goals_insert_own" on goals
  with check (
    user_id = auth.uid()
    and (account_id is null or exists (
      select 1 from accounts a where a.id = account_id and a.user_id = auth.uid()
    ))
  );

alter policy "goals_update_own" on goals
  with check (
    user_id = auth.uid()
    and (account_id is null or exists (
      select 1 from accounts a where a.id = account_id and a.user_id = auth.uid()
    ))
  );

alter policy "debt_payments_insert_own" on debt_payments
  with check (
    user_id = auth.uid()
    and exists (select 1 from debts d where d.id = debt_id and d.user_id = auth.uid())
    and exists (select 1 from accounts a where a.id = account_id and a.user_id = auth.uid())
  );

alter policy "goal_contributions_insert_own" on goal_contributions
  with check (
    user_id = auth.uid()
    and exists (select 1 from goals g where g.id = goal_id and g.user_id = auth.uid())
    and exists (select 1 from accounts a where a.id = account_id and a.user_id = auth.uid())
  );
