# Supabase migrations

Ejecuta estas migraciones en este orden en tu proyecto de Supabase:

1. 001_profiles.sql
2. 002_accounts.sql
3. 003_categories.sql
4. 004_transactions.sql
5. 005_recurring.sql
6. 006_budgets.sql
7. 007_goals.sql

Cada migración incluye políticas de Row Level Security para que los usuarios solo puedan acceder a sus propios datos, además de categorías base para ingresos y gastos.
