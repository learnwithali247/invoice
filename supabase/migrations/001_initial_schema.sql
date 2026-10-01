-- ===========================================================================
--  Invoice Generator — Initial schema
--  Target: a completely fresh Supabase project.
--  Run with:  supabase db reset        (local)
--         or:  paste into Dashboard -> SQL Editor -> Run
--
--  Contents
--   1. Extensions
--   2. Enums
--   3. Tables
--   4. Indexes
--   5. Triggers & functions (incl. server-side recalculation)
--   6. Row Level Security + policies
--   7. Storage buckets + policies
--   8. Public (token) access function
--   9. Backfill for accounts that predate the schema
--  10. System invoice templates
--  Idempotent: safe to run more than once.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto" with schema extensions;

-- ---------------------------------------------------------------------------
-- 2. Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.invoice_status as enum ('draft', 'sent', 'viewed', 'paid', 'partial', 'overdue', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('unpaid', 'pending', 'paid', 'partially_paid', 'overdue', 'cancelled', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invoice_type as enum ('standard', 'tax', 'proforma', 'commercial', 'custom');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_provider as enum ('stripe', 'paypal', 'manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.transaction_status as enum ('created', 'pending', 'succeeded', 'failed', 'refunded', 'cancelled');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 3. Tables
-- ---------------------------------------------------------------------------

-- profiles -------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text,
  avatar_url    text,
  timezone      text default 'UTC',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- business_settings ----------------------------------------------------------
-- one row per user; holds business identity + invoice defaults
create table if not exists public.business_settings (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null unique references auth.users (id) on delete cascade,

  -- business identity
  business_name           text not null default '',
  logo_path               text,
  logo_url                text,
  email                   text,
  phone                   text,
  website                 text,
  address_line1           text,
  address_line2           text,
  city                    text,
  state                   text,
  postal_code             text,
  country                 text,
  tax_id                  text,
  registration_number     text,
  additional_info         text,

  -- invoice defaults
  default_currency        text not null default 'USD',
  default_template        text not null default 'modern',
  invoice_prefix          text not null default 'INV-',
  next_invoice_number     integer not null default 1,
  number_padding          integer not null default 6 check (number_padding between 0 and 12),
  default_payment_terms   text not null default 'Payment due within 14 days.',
  default_notes           text not null default 'Thank you for your business.',
  default_terms           text not null default '',
  default_design          jsonb not null default '{}'::jsonb,
  default_payment_enabled boolean not null default false,
  default_payment_provider public.payment_provider not null default 'manual',

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- customers -------------------------------------------------------------------
create table if not exists public.customers (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  name             text not null,
  company          text,
  email            text,
  phone            text,
  billing_address  text,
  shipping_address text,
  tax_id           text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- invoice_templates ----------------------------------------------------------
-- is_system = true rows ship with the app and are readable by everyone;
-- user rows are private to the owner.
create table if not exists public.invoice_templates (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users (id) on delete cascade,
  slug            text not null,
  name            text not null,
  description     text,
  thumbnail       text,
  design_settings jsonb not null default '{}'::jsonb,
  is_system       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- invoices --------------------------------------------------------------------
create table if not exists public.invoices (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  invoice_number      text not null,
  invoice_type        public.invoice_type not null default 'standard',

  -- billing parties (denormalised snapshot so historic invoices never change)
  customer_id         uuid references public.customers (id) on delete set null,
  customer_name       text not null default '',
  customer_company    text,
  customer_email      text,
  customer_phone      text,
  customer_address    text,
  customer_shipping   text,
  customer_tax_id     text,

  -- meta
  invoice_date        date not null default current_date,
  due_date            date,
  po_number           text,
  reference           text,
  currency            text not null default 'USD',
  currency_symbol     text,
  payment_terms       text,
  status              public.invoice_status not null default 'draft',
  payment_status      public.payment_status not null default 'unpaid',

  -- money (all numeric(15,4) / numeric(15,2); recalculated server-side)
  subtotal            numeric(15,4) not null default 0,
  discount_type       text not null default 'percent' check (discount_type in ('percent', 'fixed')),
  discount_value      numeric(15,4) not null default 0,
  discount_total      numeric(15,2) not null default 0,
  tax_total           numeric(15,2) not null default 0,
  shipping            numeric(15,2) not null default 0,
  fees                numeric(15,2) not null default 0,
  adjustment          numeric(15,2) not null default 0,
  total               numeric(15,2) not null default 0,
  amount_paid         numeric(15,2) not null default 0,
  amount_due          numeric(15,2) not null default 0,

  -- presentation & content
  template            text not null default 'modern',
  design_settings     jsonb not null default '{}'::jsonb,
  notes               text,
  terms               text,
  footer_text         text,
  payment_instructions text,

  -- payments / sharing
  payment_enabled     boolean not null default false,
  payment_provider    public.payment_provider,
  public_token        text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  published_at        timestamptz,

  -- soft delete
  deleted_at          timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint invoices_number_present check (length(trim(invoice_number)) > 0)
);

-- invoice_items ---------------------------------------------------------------
create table if not exists public.invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null default '',
  description text,
  quantity    numeric(15,4) not null default 1 check (quantity >= 0),
  unit_price  numeric(15,4) not null default 0 check (unit_price >= 0),
  discount    numeric(7,4) not null default 0 check (discount >= 0 and discount <= 100),
  tax         numeric(7,4) not null default 0 check (tax >= 0 and tax <= 100),
  -- derived, never supplied by the client
  line_total  numeric(15,2) generated always as (
      round(
        greatest(0, quantity * unit_price)
        * (1 - least(discount, 100) / 100)
        * (1 + tax / 100)
      , 2)
    ) stored,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- payment_transactions ---------------------------------------------------------
create table if not exists public.payment_transactions (
  id                    uuid primary key default gen_random_uuid(),
  invoice_id            uuid not null references public.invoices (id) on delete cascade,
  user_id               uuid not null references auth.users (id) on delete cascade,
  provider              public.payment_provider not null,
  provider_session_id   text,
  provider_payment_id   text,
  amount                numeric(15,2) not null default 0,
  currency              text not null default 'USD',
  status                public.transaction_status not null default 'created',
  is_test               boolean not null default true,
  raw_event             jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------------
create index if not exists invoices_user_id_idx        on public.invoices (user_id);
create index if not exists invoices_created_at_idx     on public.invoices (user_id, created_at desc);
create index if not exists invoices_due_date_idx       on public.invoices (user_id, due_date);
create index if not exists invoices_status_idx         on public.invoices (user_id, status);
create index if not exists invoices_payment_status_idx on public.invoices (user_id, payment_status);
create index if not exists invoices_invoice_number_idx  on public.invoices (user_id, invoice_number);
create index if not exists invoices_customer_id_idx    on public.invoices (customer_id);
create index if not exists invoices_public_token_idx   on public.invoices (public_token);

create unique index if not exists invoices_user_number_unique
  on public.invoices (user_id, lower(invoice_number))
  where deleted_at is null;

create unique index if not exists invoices_public_token_unique
  on public.invoices (public_token);

create index if not exists invoice_items_invoice_id_idx on public.invoice_items (invoice_id, sort_order);
create index if not exists invoice_items_user_id_idx    on public.invoice_items (user_id);

create index if not exists customers_user_id_idx        on public.customers (user_id, created_at desc);
create index if not exists customers_user_email_idx     on public.customers (user_id, lower(email));

create unique index if not exists templates_system_slug_unique
  on public.invoice_templates (slug) where is_system = true;

create index if not exists templates_user_slug_unique   on public.invoice_templates (user_id, slug) where user_id is not null;

create index if not exists transactions_invoice_id_idx   on public.payment_transactions (invoice_id);
create index if not exists transactions_user_id_idx      on public.payment_transactions (user_id);
create index if not exists transactions_session_idx      on public.payment_transactions (provider, provider_session_id);
create index if not exists transactions_external_idx     on public.payment_transactions (provider, provider_payment_id);
-- guarantee webhook idempotency
create unique index if not exists transactions_provider_event_uniq
  on public.payment_transactions (provider, provider_session_id, status)
  where provider_session_id is not null;

-- ---------------------------------------------------------------------------
-- 5. Triggers & functions
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists business_settings_set_updated_at on public.business_settings;
create trigger business_settings_set_updated_at before update on public.business_settings
  for each row execute function public.set_updated_at();

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();

drop trigger if exists invoice_items_set_updated_at on public.invoice_items;
create trigger invoice_items_set_updated_at before update on public.invoice_items
  for each row execute function public.set_updated_at();

drop trigger if exists templates_set_updated_at on public.invoice_templates;
create trigger templates_set_updated_at before update on public.invoice_templates
  for each row execute function public.set_updated_at();

drop trigger if exists transactions_set_updated_at on public.payment_transactions;
create trigger transactions_set_updated_at before update on public.payment_transactions
  for each row execute function public.set_updated_at();

-- handle_new_user: create profile + default business settings ----------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.business_settings (user_id, business_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'business_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- recalculate_invoice_totals -------------------------------------------------
-- THE source of truth for money. Any change to items, discount, shipping,
-- fees, adjustment or amount_paid re-derives every total with exact numeric
-- arithmetic.
--
-- Order of operations (mirrored 1:1 by lib/invoice/calculate.ts):
--   base_i            = quantity_i * unit_price_i
--   item discount_i   = base_i * (d_i / 100)
--   netAfterItems     = SUM(base_i) - SUM(item discount_i)
--   invoice discount  = percent ? rate * netAfterItems : LEAST(netAfterItems, value)
--   effectiveRate_i   = (1 - d_i/100) * (percent ? 1 - rate : 1)
--   tax_i             = ROUND(base_i * effectiveRate_i * t_i / 100, 2)
--   total             = netAfterItems - invoiceDiscount + SUM(tax_i) + shipping + fees + adjustment
create or replace function public.recalculate_invoice_totals(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gross            numeric(15,4) := 0;   -- SUM(quantity * unit_price)
  v_item_discount    numeric(15,4) := 0;   -- SUM(item-level discounts)
  v_net_after_items  numeric(15,4) := 0;
  v_tax              numeric(15,2) := 0;
  v_invoice_discount numeric(15,2) := 0;
  v_discount_total   numeric(15,2) := 0;
  v_total            numeric(15,2) := 0;
  v_due              numeric(15,2) := 0;
  v_paid             numeric(15,2) := 0;
  v_rate             numeric(9,6) := 0;    -- invoice-level percent, as a fraction
  v_inv_type         text;
  v_inv_value        numeric(15,4);
  v_shipping         numeric(15,2);
  v_fees             numeric(15,2);
  v_adjust           numeric(15,2);
begin
  if p_invoice_id is null then
    return;
  end if;

  select discount_type, discount_value, shipping, fees, adjustment, amount_paid
    into v_inv_type, v_inv_value, v_shipping, v_fees, v_adjust, v_paid
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    return;
  end if;

  v_rate := case
              when v_inv_type = 'percent'
                then least(100, greatest(0, coalesce(v_inv_value, 0))) / 100
              else 0
            end;

  select coalesce(sum(quantity * unit_price), 0),
         coalesce(sum(quantity * unit_price * (least(discount, 100) / 100)), 0)
    into v_gross, v_item_discount
  from public.invoice_items
  where invoice_id = p_invoice_id;

  v_net_after_items := greatest(0, v_gross - v_item_discount);

  -- invoice-level discount
  if v_inv_type = 'percent' then
    v_invoice_discount := round(v_net_after_items * v_rate, 2);
  else
    v_invoice_discount := round(
      least(v_net_after_items, greatest(0, coalesce(v_inv_value, 0))), 2
    );
  end if;

  -- tax is charged on the post-item-discount base, further reduced by a
  -- percentage invoice-level discount
  select coalesce(sum(round(
           quantity * unit_price
           * (1 - least(discount, 100) / 100)
           * (1 - v_rate)
           * (tax / 100)
         , 2)), 0)
    into v_tax
  from public.invoice_items
  where invoice_id = p_invoice_id;

  v_discount_total := round(v_item_discount + v_invoice_discount, 2);

  v_total := round(
      v_net_after_items
    - v_invoice_discount
    + v_tax
    + greatest(0, coalesce(v_shipping, 0))
    + greatest(0, coalesce(v_fees, 0))
    + coalesce(v_adjust, 0)
  , 2);

  v_paid := least(greatest(0, coalesce(v_paid, 0)), v_total);
  v_due  := round(v_total - v_paid, 2);

  update public.invoices
     set subtotal       = round(v_gross, 2),
         discount_total = v_discount_total,
         tax_total      = v_tax,
         total          = v_total,
         amount_paid    = v_paid,
         amount_due     = v_due
   where id = p_invoice_id;
end;
$$;

-- keep totals fresh whenever items change -----------------------------------
create or replace function public.trg_items_recalc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_invoice_totals(coalesce(new.invoice_id, old.invoice_id));
  return null;
end;
$$;

drop trigger if exists invoice_items_recalc on public.invoice_items;
create trigger invoice_items_recalc
  after insert or update or delete on public.invoice_items
  for each row execute function public.trg_items_recalc();

-- recalc when the money-affecting invoice columns change ---------------------
-- AFTER (not BEFORE) so the new values are already visible when the totals are
-- re-derived. pg_trigger_depth() stops the nested UPDATE from looping.
create or replace function public.trg_invoice_recalc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if (new.discount_type is distinct from old.discount_type)
     or (new.discount_value is distinct from old.discount_value)
     or (new.shipping is distinct from old.shipping)
     or (new.fees is distinct from old.fees)
     or (new.adjustment is distinct from old.adjustment)
     or (new.amount_paid is distinct from old.amount_paid)
  then
    perform public.recalculate_invoice_totals(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists invoices_recalc on public.invoices;
create trigger invoices_recalc
  after update on public.invoices
  for each row execute function public.trg_invoice_recalc();

-- next_invoice_number --------------------------------------------------------
-- Atomically reserves the next number for a user. Returns the formatted value.
create or replace function public.reserve_invoice_number(
  p_user_id uuid,
  p_prefix  text default null,
  p_padding integer default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_pad    integer;
  v_num    integer;
  v_result text;
begin
  if p_user_id is null then
    raise exception 'user id required';
  end if;

  select coalesce(nullif(p_prefix, ''), invoice_prefix),
         coalesce(p_padding, number_padding),
         next_invoice_number
    into v_prefix, v_pad, v_num
    from public.business_settings
   where user_id = p_user_id
     for update;

  if not found then
    insert into public.business_settings (user_id) values (p_user_id)
    on conflict (user_id) do nothing;
    v_prefix := coalesce(nullif(p_prefix, ''), 'INV-');
    v_pad    := coalesce(p_padding, 6);
    v_num    := 1;
  end if;

  v_pad := least(greatest(coalesce(v_pad, 6), 0), 12);
  v_result := coalesce(v_prefix, '') || lpad(v_num::text, v_pad, '0');

  update public.business_settings
     set next_invoice_number = greatest(next_invoice_number, v_num + 1)
   where user_id = p_user_id;

  return v_result;
end;
$$;

-- sync_payment_status --------------------------------------------------------
-- Keeps invoice.payment_status consistent with amount_paid / amount_due / dates.
create or replace function public.sync_payment_status(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total  numeric(15,2);
  v_paid   numeric(15,2);
  v_due    numeric(15,2);
  v_status public.payment_status;
  v_cancel boolean;
begin
  select total, amount_paid, amount_due,
         (payment_status = 'cancelled' or status = 'cancelled')
    into v_total, v_paid, v_due, v_cancel
  from public.invoices where id = p_invoice_id;

  if not found then return; end if;

  if v_cancel then
    v_status := 'cancelled';
  elsif v_total <= 0 then
    v_status := 'paid';
  elsif v_paid <= 0 then
    v_status := case
      when exists (select 1 from public.invoices
                    where id = p_invoice_id
                      and due_date is not null and due_date < current_date)
        then 'overdue'::public.payment_status
      else 'unpaid'::public.payment_status
    end;
  elsif v_paid + 0.005 >= v_total then
    v_status := 'paid';
  else
    v_status := 'partially_paid';
  end if;

  update public.invoices
     set payment_status = v_status,
         status = case
           when v_status = 'paid' and status <> 'cancelled' then 'paid'::public.invoice_status
           when status in ('paid', 'cancelled') and v_status <> 'paid' then 'sent'::public.invoice_status
           else status
         end
   where id = p_invoice_id;
end;
$$;

-- record_payment -------------------------------------------------------------
-- Server-side entry point used by verified payment webhooks.
create or replace function public.record_payment(
  p_invoice_id  uuid,
  p_provider    public.payment_provider,
  p_amount      numeric(15,2),
  p_currency    text,
  p_session_id  text default null,
  p_payment_id  text default null,
  p_status      public.transaction_status default 'succeeded',
  p_is_test     boolean default true,
  p_raw_event   jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx_id uuid;
  v_user  uuid;
  v_due   numeric(15,2);
  v_next  numeric(15,2);
begin
  select user_id, amount_due into v_user, v_due
  from public.invoices where id = p_invoice_id;

  if v_user is null then
    raise exception 'invoice not found';
  end if;

  insert into public.payment_transactions
    (invoice_id, user_id, provider, provider_session_id, provider_payment_id,
     amount, currency, status, is_test, raw_event)
  values
    (p_invoice_id, v_user, p_provider, p_session_id, p_payment_id,
     greatest(0, coalesce(p_amount, 0)), coalesce(p_currency, 'USD'),
     p_status, coalesce(p_is_test, true), p_raw_event)
  on conflict (provider, provider_session_id, status)
    where provider_session_id is not null
    do update set updated_at = now()
    returning id into v_tx_id;

  if p_status = 'succeeded' then
    -- clamp overpayment to the outstanding balance
    v_next := least(greatest(0, coalesce(p_amount, 0)), greatest(v_due, 0));

    update public.invoices
       set amount_paid = round(amount_paid + v_next, 2),
           payment_status = 'pending',
           payment_provider = p_provider
     where id = p_invoice_id;

    perform public.recalculate_invoice_totals(p_invoice_id);
    perform public.sync_payment_status(p_invoice_id);
  end if;

  return v_tx_id;
end;
$$;

-- duplicate_invoice ----------------------------------------------------------
create or replace function public.duplicate_invoice(
  p_invoice_id uuid,
  p_new_number text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid;
  v_src     public.invoices%rowtype;
  v_new_id  uuid;
  v_number  text;
begin
  select * into v_src from public.invoices
   where id = p_invoice_id and user_id = auth.uid();

  if not found then
    raise exception 'invoice not found';
  end if;

  v_user := v_src.user_id;
  v_number := coalesce(
    nullif(p_new_number, ''),
    public.reserve_invoice_number(v_user)
  );

  insert into public.invoices (
    user_id, invoice_number, invoice_type,
    customer_id, customer_name, customer_company, customer_email, customer_phone,
    customer_address, customer_shipping, customer_tax_id,
    invoice_date, due_date, po_number, reference, currency, currency_symbol,
    payment_terms, status, payment_status,
    discount_type, discount_value, shipping, fees, adjustment,
    template, design_settings, notes, terms, footer_text, payment_instructions,
    payment_enabled, payment_provider
  )
  select
    v_user, v_number, v_src.invoice_type,
    v_src.customer_id, v_src.customer_name, v_src.customer_company, v_src.customer_email, v_src.customer_phone,
    v_src.customer_address, v_src.customer_shipping, v_src.customer_tax_id,
    current_date, current_date + 14, v_src.po_number, v_src.reference, v_src.currency, v_src.currency_symbol,
    v_src.payment_terms, 'draft', 'unpaid',
    v_src.discount_type, v_src.discount_value, v_src.shipping, v_src.fees, v_src.adjustment,
    v_src.template, v_src.design_settings, v_src.notes, v_src.terms, v_src.footer_text, v_src.payment_instructions,
    v_src.payment_enabled, v_src.payment_provider
  returning id into v_new_id;

  insert into public.invoice_items
    (invoice_id, user_id, name, description, quantity, unit_price, discount, tax, sort_order)
  select v_new_id, v_user, name, description, quantity, unit_price, discount, tax, sort_order
  from public.invoice_items
  where invoice_id = p_invoice_id;

  perform public.recalculate_invoice_totals(v_new_id);

  return v_new_id;
end;
$$;

-- get_public_invoice ---------------------------------------------------------
-- SECURITY DEFINER: lets an anonymous visitor read exactly the customer-facing
-- fields of a shared invoice. Never exposes user_id, internal flags or tokens
-- other than the one supplied.
create or replace function public.get_public_invoice(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
begin
  if p_token is null or length(p_token) < 16 then
    raise exception 'invalid token';
  end if;

  select jsonb_build_object(
    'invoiceNumber',  i.invoice_number,
    'type',           i.invoice_type,
    'status',         i.status,
    'paymentStatus',  i.payment_status,
    'invoiceDate',    i.invoice_date,
    'dueDate',        i.due_date,
    'poNumber',       i.po_number,
    'reference',      i.reference,
    'currency',       i.currency,
    'currencySymbol', i.currency_symbol,
    'paymentTerms',   i.payment_terms,
    'customer', jsonb_build_object(
      'name',    i.customer_name,
      'company', i.customer_company,
      'email',   i.customer_email,
      'phone',   i.customer_phone,
      'address', i.customer_address,
      'shipping', i.customer_shipping,
      'taxId',   i.customer_tax_id
    ),
    'totals', jsonb_build_object(
      'subtotal',   i.subtotal,
      'discount',   i.discount_total,
      'tax',        i.tax_total,
      'shipping',   i.shipping,
      'fees',       i.fees,
      'adjustment', i.adjustment,
      'total',      i.total,
      'amountPaid', i.amount_paid,
      'amountDue',  i.amount_due
    ),
    'discountType',  i.discount_type,
    'discountValue', i.discount_value,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name',        it.name,
        'description', it.description,
        'quantity',    it.quantity,
        'unitPrice',   it.unit_price,
        'discount',    it.discount,
        'tax',         it.tax,
        'lineTotal',   it.line_total
      ) order by it.sort_order), '[]'::jsonb)
      from public.invoice_items it
      where it.invoice_id = i.id
    ),
    'design',        i.design_settings,
    'template',      i.template,
    'notes',         i.notes,
    'terms',         i.terms,
    'footerText',    i.footer_text,
    'paymentInstructions', i.payment_instructions,
    'paymentEnabled', i.payment_enabled,
    'business', (
      select jsonb_build_object(
        'businessName',       b.business_name,
        'email',              b.email,
        'phone',              b.phone,
        'website',            b.website,
        'addressLine1',       b.address_line1,
        'addressLine2',       b.address_line2,
        'city',               b.city,
        'state',              b.state,
        'postalCode',         b.postal_code,
        'country',            b.country,
        'taxId',              b.tax_id,
        'registrationNumber', b.registration_number,
        'additionalInfo',     b.additional_info,
        'logoUrl',            b.logo_url,
        'logoPath',           b.logo_path
      )
      from public.business_settings b
      where b.user_id = i.user_id
    )
  )
  into v_row
  from public.invoices i
  where i.public_token = p_token
    and i.deleted_at is null;

  return v_row;
end;
$$;

revoke all on function public.get_public_invoice(text) from public;
grant execute on function public.get_public_invoice(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.business_settings   enable row level security;
alter table public.customers           enable row level security;
alter table public.invoices            enable row level security;
alter table public.invoice_items       enable row level security;
alter table public.invoice_templates   enable row level security;
alter table public.payment_transactions enable row level security;

-- profiles -------------------------------------------------------------------
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- business_settings ----------------------------------------------------------
drop policy if exists business_settings_select_own on public.business_settings;
create policy business_settings_select_own on public.business_settings
  for select using (user_id = auth.uid());

drop policy if exists business_settings_insert_own on public.business_settings;
create policy business_settings_insert_own on public.business_settings
  for insert with check (user_id = auth.uid());

drop policy if exists business_settings_update_own on public.business_settings;
create policy business_settings_update_own on public.business_settings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists business_settings_delete_own on public.business_settings;
create policy business_settings_delete_own on public.business_settings
  for delete using (user_id = auth.uid());

-- customers -------------------------------------------------------------------
drop policy if exists customers_select_own on public.customers;
create policy customers_select_own on public.customers
  for select using (user_id = auth.uid());

drop policy if exists customers_insert_own on public.customers;
create policy customers_insert_own on public.customers
  for insert with check (user_id = auth.uid());

drop policy if exists customers_update_own on public.customers;
create policy customers_update_own on public.customers
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists customers_delete_own on public.customers;
create policy customers_delete_own on public.customers
  for delete using (user_id = auth.uid());

-- invoices ---------------------------------------------------------------------
drop policy if exists invoices_select_own on public.invoices;
create policy invoices_select_own on public.invoices
  for select using (user_id = auth.uid());

drop policy if exists invoices_insert_own on public.invoices;
create policy invoices_insert_own on public.invoices
  for insert with check (user_id = auth.uid());

drop policy if exists invoices_update_own on public.invoices;
create policy invoices_update_own on public.invoices
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists invoices_delete_own on public.invoices;
create policy invoices_delete_own on public.invoices
  for delete using (user_id = auth.uid());

-- invoice_items ------------------------------------------------------------------
-- Ownership is checked against the parent invoice so a user can never attach
-- items to somebody else's invoice.
drop policy if exists invoice_items_select_own on public.invoice_items;
create policy invoice_items_select_own on public.invoice_items
  for select using (
    user_id = auth.uid()
    and exists (select 1 from public.invoices i
                 where i.id = invoice_id and i.user_id = auth.uid())
  );

drop policy if exists invoice_items_insert_own on public.invoice_items;
create policy invoice_items_insert_own on public.invoice_items
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.invoices i
                 where i.id = invoice_id and i.user_id = auth.uid())
  );

drop policy if exists invoice_items_update_own on public.invoice_items;
create policy invoice_items_update_own on public.invoice_items
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.invoices i
                 where i.id = invoice_id and i.user_id = auth.uid())
  );

drop policy if exists invoice_items_delete_own on public.invoice_items;
create policy invoice_items_delete_own on public.invoice_items
  for delete using (user_id = auth.uid());

-- invoice_templates ---------------------------------------------------------------
-- system templates readable by everyone; user templates private.
drop policy if exists templates_select on public.invoice_templates;
create policy templates_select on public.invoice_templates
  for select using (is_system = true or user_id = auth.uid());

drop policy if exists templates_insert_own on public.invoice_templates;
create policy templates_insert_own on public.invoice_templates
  for insert with check (user_id = auth.uid() and is_system = false);

drop policy if exists templates_update_own on public.invoice_templates;
create policy templates_update_own on public.invoice_templates
  for update using (user_id = auth.uid() and is_system = false)
  with check (user_id = auth.uid() and is_system = false);

drop policy if exists templates_delete_own on public.invoice_templates;
create policy templates_delete_own on public.invoice_templates
  for delete using (user_id = auth.uid() and is_system = false);

-- payment_transactions --------------------------------------------------------------
drop policy if exists transactions_select_own on public.payment_transactions;
create policy transactions_select_own on public.payment_transactions
  for select using (user_id = auth.uid());

-- No client insert/update/delete policies on payment_transactions:
-- only service-role server code (verified webhooks) may write them.

-- ---------------------------------------------------------------------------
-- 7. Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos',
  'logos',
  false,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists logos_select_own on storage.objects;
create policy logos_select_own on storage.objects
  for select using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists logos_insert_own on storage.objects;
create policy logos_insert_own on storage.objects
  for insert with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists logos_update_own on storage.objects;
create policy logos_update_own on storage.objects
  for update using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists logos_delete_own on storage.objects;
create policy logos_delete_own on storage.objects
  for delete using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- 8. Backfill for accounts that signed up BEFORE this migration existed
-- ---------------------------------------------------------------------------
-- The on_auth_user_created trigger only fires on INSERT, so anyone who
-- registered before the schema existed would be left without a profile or
-- business settings. Backfill them here. Idempotent.
insert into public.profiles (id, full_name)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'business_name', ''),
    split_part(coalesce(u.email, ''), '@', 1)
  )
from auth.users u
on conflict (id) do nothing;

insert into public.business_settings (user_id, business_name, email)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'business_name', ''),
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    split_part(coalesce(u.email, ''), '@', 1)
  ),
  u.email
from auth.users u
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 10. System invoice templates (read-only reference rows)
-- ---------------------------------------------------------------------------
insert into public.invoice_templates (user_id, slug, name, description, is_system, design_settings)
values
  (null, 'minimal',    'Minimal',    'Clean whitespace, no heavy borders.', true,
   '{"template":"minimal","accentStyle":"none","tableStyle":"borderless","density":"regular","divider":"thin"}'::jsonb),
  (null, 'modern',     'Modern',     'Accent bar, soft card header.', true,
   '{"template":"modern","accentStyle":"bar","tableStyle":"striped","density":"regular","divider":"soft"}'::jsonb),
  (null, 'corporate',  'Corporate',  'Ruled header block, formal tone.', true,
   '{"template":"corporate","accentStyle":"block","tableStyle":"lined","density":"regular","divider":"solid"}'::jsonb),
  (null, 'elegant',    'Elegant',    'Serif headings, generous spacing.', true,
   '{"template":"elegant","accentStyle":"hairline","tableStyle":"borderless","density":"airy","divider":"hairline"}'::jsonb),
  (null, 'compact',    'Compact',    'Tight rows for long item lists.', true,
   '{"template":"compact","accentStyle":"bar","tableStyle":"lined","density":"compact","divider":"thin"}'::jsonb),
  (null, 'bold',       'Bold',       'High-contrast blocks and large type.', true,
   '{"template":"bold","accentStyle":"block","tableStyle":"striped","density":"regular","divider":"none"}'::jsonb),
  (null, 'professional','Professional','Balanced default for everyday invoices.', true,
   '{"template":"professional","accentStyle":"bar","tableStyle":"lined","density":"regular","divider":"soft"}'::jsonb)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- done
-- ---------------------------------------------------------------------------
