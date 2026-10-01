-- Local-only: exercises the money functions, RLS isolation, public tokens and
-- webhook idempotency against the shimmed Postgres.
-- Not part of the application. See scripts/test-db.md.
set client_min_messages = warning;

drop table if exists public.tmp_results;
create table public.tmp_results (label text, got numeric, expected numeric);

-- non-superuser role so RLS is actually enforced (superusers bypass it)
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user nologin;
  end if;
  grant usage on schema public to app_user;
  grant select, insert, update, delete on all tables in schema public to app_user;
  grant usage, select on all sequences in schema public to app_user;
end;
$$;

do $$
declare
  v_user  uuid := '11111111-1111-1111-1111-111111111111';
  v_user2 uuid := '22222222-2222-2222-2222-222222222222';
  v_inv   uuid;
  r       record;
  n1 text; n2 text; n3 text;
  v_json  jsonb;
begin
  ------------------------------------------------------------------ account
  truncate auth.users cascade;
  -- Simulate an account that registered BEFORE the migration existed: the
  -- on_auth_user_created trigger is dropped below, so nothing creates its rows.
  drop trigger if exists on_auth_user_created on auth.users;
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_user, 'a@example.com', '{"full_name":"A","business_name":"A Ltd"}'),
         (v_user2, 'b@example.com', '{"full_name":"B"}');

  insert into public.tmp_results
  select 'pre-migration account gets no rows yet', count(*)::numeric, 0
  from public.profiles where id in (v_user, v_user2);

  -- now run the backfill section of the migration on its own
  insert into public.profiles (id, full_name)
  select u.id,
         coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''),
                  nullif(u.raw_user_meta_data ->> 'business_name', ''),
                  split_part(coalesce(u.email, ''), '@', 1))
  from auth.users u
  on conflict (id) do nothing;

  insert into public.business_settings (user_id, business_name, email)
  select u.id,
         coalesce(nullif(u.raw_user_meta_data ->> 'business_name', ''),
                  nullif(u.raw_user_meta_data ->> 'full_name', ''),
                  split_part(coalesce(u.email, ''), '@', 1)),
         u.email
  from auth.users u
  on conflict (user_id) do nothing;

  insert into public.tmp_results
  select 'backfill creates profiles', count(*)::numeric, 2
  from public.profiles where id in (v_user, v_user2);

  insert into public.tmp_results
  select 'backfill creates business_settings', count(*)::numeric, 2
  from public.business_settings where user_id in (v_user, v_user2);

  insert into public.tmp_results
  select 'backfill copies the business name', count(*)::numeric, 1
  from public.business_settings where user_id = v_user and business_name = 'A Ltd';

  -- restore the trigger and confirm it still works for new signups
  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
  insert into auth.users (id, email, raw_user_meta_data)
  values ('33333333-3333-3333-3333-333333333333', 'c@example.com', '{"full_name":"C"}');
  insert into public.tmp_results
  select 'new signups still get a profile', count(*)::numeric, 1
  from public.profiles where id = '33333333-3333-3333-3333-333333333333';
  insert into public.tmp_results
  select 'new signups still get business settings', count(*)::numeric, 1
  from public.business_settings where user_id = '33333333-3333-3333-3333-333333333333';

  delete from auth.users where id = '33333333-3333-3333-3333-333333333333';

  insert into public.tmp_results
  select 'handle_new_user -> profiles', count(*)::numeric, 2
  from public.profiles where id in (v_user, v_user2);

  insert into public.tmp_results
  select 'handle_new_user -> business_settings', count(*)::numeric, 2
  from public.business_settings where user_id in (v_user, v_user2);

  insert into public.invoices (user_id, invoice_number, invoice_date, currency, invoice_type)
  values (v_user, 'INV-000001', current_date, 'USD', 'standard') returning id into v_inv;
  insert into public.invoice_items (invoice_id, user_id, name, quantity, unit_price, discount, tax, sort_order)
  values (v_inv, v_user, 'AI Pro', 2, 20, 0, 5, 0);

  ---------------------------------------------- case 1: tax, no discounts
  select * into r from public.invoices where id = v_inv;
  insert into public.tmp_results values ('case1 subtotal', r.subtotal, 40);
  insert into public.tmp_results values ('case1 tax', r.tax_total, 2);
  insert into public.tmp_results values ('case1 total', r.total, 42);
  insert into public.tmp_results values ('case1 due', r.amount_due, 42);

  ------------------------------- case 2: item % + invoice fixed + shipping
  update public.invoice_items
     set quantity = 1, unit_price = 100, discount = 10, tax = 0
   where invoice_id = v_inv;
  update public.invoices
     set discount_type = 'fixed', discount_value = 5, shipping = 5, amount_paid = 50
   where id = v_inv;
  select * into r from public.invoices where id = v_inv;
  insert into public.tmp_results values ('case2 subtotal', r.subtotal, 100);
  insert into public.tmp_results values ('case2 combined discount', r.discount_total, 15);
  insert into public.tmp_results values ('case2 total', r.total, 90);
  insert into public.tmp_results values ('case2 due', r.amount_due, 40);

  ------------------------------- case 3: percent discount also cuts the tax
  update public.invoice_items set discount = 0, tax = 10 where invoice_id = v_inv;
  update public.invoices
     set discount_type = 'percent', discount_value = 50, shipping = 0, amount_paid = 0
   where id = v_inv;
  select * into r from public.invoices where id = v_inv;
  insert into public.tmp_results values ('case3 percent discount scales tax', r.total, 55);

  ------------------------------- case 4: float trap
  update public.invoice_items set quantity = 3, unit_price = 0.1, tax = 0 where invoice_id = v_inv;
  update public.invoices set discount_value = 0 where id = v_inv;
  select * into r from public.invoices where id = v_inv;
  insert into public.tmp_results values ('case4 float trap 3 x 0.1', r.subtotal, 0.30);

  ------------------------------- case 5: overpayment clamping
  update public.invoice_items set quantity = 1, unit_price = 10, discount = 0 where invoice_id = v_inv;
  update public.invoices set amount_paid = 9999 where id = v_inv;
  select * into r from public.invoices where id = v_inv;
  insert into public.tmp_results values ('case5 overpayment clamped', r.amount_paid, 10);
  insert into public.tmp_results values ('case5 due never negative', r.amount_due, 0);

  ------------------------------- case 6: empty invoice
  insert into public.invoices (user_id, invoice_number, invoice_date, currency)
  values (v_user, 'INV-EMPTY', current_date, 'USD') returning id into v_inv;
  select * into r from public.invoices where id = v_inv;
  insert into public.tmp_results values ('empty invoice total', r.total, 0);
  insert into public.tmp_results values ('empty invoice due', r.amount_due, 0);
  delete from public.invoices where id = v_inv;

  ------------------------------- case 7: large quantities
  insert into public.invoices (user_id, invoice_number, invoice_date, currency)
  values (v_user, 'INV-BIG', current_date, 'USD') returning id into v_inv;
  insert into public.invoice_items (invoice_id, user_id, name, quantity, unit_price, tax, sort_order)
  values (v_inv, v_user, 'Bulk', 999999, 9999.99, 17.5, 0);
  select * into r from public.invoices where id = v_inv;
  insert into public.tmp_results values ('case7 large quantity total', r.total, 11749976500.01);
  delete from public.invoices where id = v_inv;

  ------------------------------------------------------------------ numbering
  n1 := public.reserve_invoice_number(v_user);
  n2 := public.reserve_invoice_number(v_user);
  n3 := public.reserve_invoice_number(v_user);
  insert into public.tmp_results
  values ('reserve_invoice_number sequence',
          case when n1 = 'INV-000001' and n2 = 'INV-000002' and n3 = 'INV-000003' then 1 else 0 end, 1);

  ------------------------------------------------------------------ duplicate
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  select id into v_inv from public.invoices where invoice_number = 'INV-000001';
  update public.invoices set status = 'paid', amount_paid = 10 where id = v_inv;
  perform public.duplicate_invoice(v_inv);
  insert into public.tmp_results
  select 'duplicate_invoice: new number + reset totals', count(*)::numeric, 1
  from public.invoices
  where user_id = v_user and invoice_number <> 'INV-000001'
    and status = 'draft' and amount_paid = 0 and invoice_type = 'standard';

  ------------------------------------------------------------------ public token
  insert into public.tmp_results
  select 'public_token is 48 hex chars', count(*)::numeric, 1
  from public.invoices where id = v_inv and public_token ~ '^[0-9a-f]{48}$';

  v_json := public.get_public_invoice((select public_token from public.invoices where id = v_inv));
  insert into public.tmp_results
  values ('get_public_invoice hides internal fields',
          case when not (v_json ? 'user_id') and not (v_json ? 'id') then 1 else 0 end, 1);
  insert into public.tmp_results
  values ('get_public_invoice exposes customer-facing fields',
          case when (v_json ? 'items') and (v_json ? 'totals') and (v_json ? 'business') then 1 else 0 end, 1);

  ------------------------------------------------------------------ payments
  update public.invoice_items set quantity = 1, unit_price = 42, discount = 0, tax = 0 where invoice_id = v_inv;
  update public.invoices set discount_type = 'percent', discount_value = 0, amount_paid = 0 where id = v_inv;
  perform public.recalculate_invoice_totals(v_inv);
  perform public.record_payment(v_inv, 'stripe', 42, 'USD', 'cs_test_1', 'pi_1', 'succeeded', true, '{"a":1}'::jsonb);
  select * into r from public.invoices where id = v_inv;
  insert into public.tmp_results values ('webhook marks paid',
    case when r.payment_status = 'paid' then 1 else 0 end, 1);
  insert into public.tmp_results values ('amount_paid after webhook', r.amount_paid, 42);
  insert into public.tmp_results values ('amount_due after webhook', r.amount_due, 0);

  perform public.record_payment(v_inv, 'stripe', 42, 'USD', 'cs_test_1', 'pi_1', 'succeeded', true, '{"a":1}'::jsonb);
  select * into r from public.invoices where id = v_inv;
  insert into public.tmp_results values ('duplicate webhook ignored', r.amount_paid, 42);
  insert into public.tmp_results
  select 'duplicate webhook wrote no extra row', count(*)::numeric, 1
  from public.payment_transactions where invoice_id = v_inv;

  insert into public.tmp_results
  select 'test payment is flagged is_test', count(*)::numeric, 1
  from public.payment_transactions where invoice_id = v_inv and is_test;

  ------------------------------------------------------------------ RLS
  -- switch to a non-superuser so row level security is actually enforced
  set local role app_user;
  perform set_config('request.jwt.claim.sub', v_user2::text, true);

  insert into public.tmp_results
  select 'RLS: other user cannot read the invoice', count(*)::numeric, 0
  from public.invoices where id = v_inv;

  insert into public.tmp_results
  select 'RLS: other user cannot list someone else''s invoices', count(*)::numeric, 0
  from public.invoices where user_id = v_user;

  insert into public.tmp_results
  select 'RLS: other user cannot see other customers', count(*)::numeric, 0
  from public.customers where user_id = v_user;

  perform set_config('request.jwt.claim.sub', v_user::text, true);
  insert into public.tmp_results
  select 'RLS: owner can read their own invoice', count(*)::numeric, 1
  from public.invoices where id = v_inv;

  reset role;
  perform set_config('request.jwt.claim.sub', v_user2::text, true);
end;
$$;

\echo ''
\echo '================= results ================='
select case when got = expected then 'PASS' else 'FAIL' end as result,
       label, got, expected
from public.tmp_results
order by (got = expected), label;

\echo '================= summary ================='
select count(*) filter (where got = expected) as passed,
       count(*) filter (where got <> expected) as failed
from public.tmp_results;
