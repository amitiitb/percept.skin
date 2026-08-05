create table if not exists public.perceptgpt_conversations_v2 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_session_id uuid not null references public.analysis_sessions_v2(id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists perceptgpt_conversations_v2_user_updated_idx
  on public.perceptgpt_conversations_v2(user_id, updated_at desc);

alter table public.perceptgpt_conversations_v2 enable row level security;
create policy perceptgpt_conversations_v2_select on public.perceptgpt_conversations_v2
  for select using (auth.uid() = user_id);
create policy perceptgpt_conversations_v2_insert on public.perceptgpt_conversations_v2
  for insert with check (auth.uid() = user_id);
create policy perceptgpt_conversations_v2_update on public.perceptgpt_conversations_v2
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy perceptgpt_conversations_v2_delete on public.perceptgpt_conversations_v2
  for delete using (auth.uid() = user_id);

create table if not exists public.perceptgpt_messages_v2 (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.perceptgpt_conversations_v2(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 12000),
  created_at timestamptz not null default now()
);

create index if not exists perceptgpt_messages_v2_conversation_created_idx
  on public.perceptgpt_messages_v2(conversation_id, created_at);

alter table public.perceptgpt_messages_v2 enable row level security;
create policy perceptgpt_messages_v2_select on public.perceptgpt_messages_v2
  for select using (auth.uid() = user_id);
create policy perceptgpt_messages_v2_insert on public.perceptgpt_messages_v2
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.perceptgpt_conversations_v2 c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );
create policy perceptgpt_messages_v2_delete on public.perceptgpt_messages_v2
  for delete using (auth.uid() = user_id);
