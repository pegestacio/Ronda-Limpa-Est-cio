-- ==========================================================
-- RondaLimpa — schema do banco (rodar no SQL Editor do Supabase)
-- ==========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- Usuários (login simples: e-mail + senha em texto)
-- ATENÇÃO: para um app interno pequeno isso já resolve, mas
-- não é o mesmo nível de segurança do Supabase Auth (a senha
-- fica visível para quem tiver a anon key). Veja o aviso no
-- README sobre como evoluir para Supabase Auth se quiser.
-- ---------------------------------------------------------
create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null unique,
  senha text not null,
  perfil text not null check (perfil in ('administrador', 'inspetor')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Ambientes
-- ---------------------------------------------------------
create table if not exists ambientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo text not null unique,
  bloco text not null,
  andar text not null,
  tipo text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Inspeções
-- ---------------------------------------------------------
create table if not exists inspecoes (
  id uuid primary key default gen_random_uuid(),
  ambiente_id uuid references ambientes(id) on delete set null,
  ambiente_nome text not null,
  inspetor_id uuid references usuarios(id) on delete set null,
  inspetor_nome text not null,
  status text not null check (status in ('limpo', 'parcial', 'nao_limpo')),
  observacao text,
  foto_url text,
  data text not null,
  hora text not null,
  data_key date not null,
  criado_em timestamptz not null default now(),
  geo jsonb
);

create index if not exists idx_inspecoes_ambiente on inspecoes(ambiente_id);
create index if not exists idx_inspecoes_data_key on inspecoes(data_key);

-- ---------------------------------------------------------
-- Notificações (geradas quando status = 'nao_limpo')
-- ---------------------------------------------------------
create table if not exists notificacoes (
  id uuid primary key default gen_random_uuid(),
  ambiente_nome text not null,
  foto_url text,
  observacao text,
  data text not null,
  hora text not null,
  inspetor_nome text not null,
  lida boolean not null default false,
  criado_em timestamptz not null default now()
);

-- ==========================================================
-- Row Level Security
-- Como o app usa a anon key (não há sessão de usuário do
-- Supabase Auth), liberamos leitura/escrita para a anon key.
-- A "segurança de acesso" do app é feita na aplicação (tela
-- de login), não no banco. Se quiser reforçar, restrinja
-- depois via Supabase Auth + políticas por usuário.
-- ==========================================================
alter table usuarios enable row level security;
alter table ambientes enable row level security;
alter table inspecoes enable row level security;
alter table notificacoes enable row level security;

create policy "anon full access usuarios" on usuarios for all using (true) with check (true);
create policy "anon full access ambientes" on ambientes for all using (true) with check (true);
create policy "anon full access inspecoes" on inspecoes for all using (true) with check (true);
create policy "anon full access notificacoes" on notificacoes for all using (true) with check (true);

-- ==========================================================
-- Storage: bucket público para as fotos de evidência
-- ==========================================================
insert into storage.buckets (id, name, public)
values ('evidencias', 'evidencias', true)
on conflict (id) do nothing;

create policy "leitura publica evidencias" on storage.objects
  for select using (bucket_id = 'evidencias');

create policy "upload publico evidencias" on storage.objects
  for insert with check (bucket_id = 'evidencias');
