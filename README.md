# Northstar Finance

Aplicación premium de finanzas personales construida con Next.js, TypeScript, Tailwind CSS y una arquitectura modular preparada para Supabase, autenticación, RLS, PWA y futuro Capacitor.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-inspired component system
- Lucide Icons
- Zod
- Supabase client

## Requisitos

- Node.js 20+
- npm

## Instalación

```bash
npm install
cp .env.example .env.local
```

## Variables de entorno

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

## Ejecución local

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Próximos pasos

- Integrar Supabase Auth y middleware protegido.
- Crear migraciones SQL y políticas RLS.
- Implementar CRUD de movimientos, categorías, cuentas, presupuestos y metas.
- Añadir PWA real con iconos y splash screen de producción.
