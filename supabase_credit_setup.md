# Supabase Credit System Setup & Implementation Plan

This document outlines the architecture for the credit system and provides the exact SQL you need to run in Supabase.

## 🏗️ Implementation Plan

1. **Database Setup (SQL):** We will create a `profiles` table to store user credits. We will also create a "Database Trigger" that automatically gives every new user 3 free credits the moment they sign up.
2. **Security (RLS):** We will lock down the `profiles` table so that users can *read* their balance, but they are physically blocked from *manually editing* their own balance.
3. **Frontend Updates (Next Steps):**
    *   Add a "Credits: X" badge to the UI.
    *   Before triggering a webhook, check if the user has > 0 credits.
    *   If they have 0 credits, showing an "Upgrade Required" message and disable the button.
    *   If the webhook succeeds, subtract 1 credit on the frontend (or ideally via a secure Supabase RPC function, which we will set up).

---

## 🛠️ Step 1: Run this SQL in Supabase

1. Go to your **Supabase Dashboard** -> **SQL Editor**.
2. Click **New Query**.
3. Paste the entire block of code below and click **Run**.

```sql
-- 1. Create a secure 'profiles' table to hold credits
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text not null,
  credits integer default 3 not null,
  plan_type text default 'free' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Turn on Row Level Security (RLS) to prevent cheating
alter table public.profiles enable row level security;

-- 3. Policy: Users can only READ their own profile
create policy "Users can view their own profile"
  on public.profiles for select
  using ( auth.uid() = id );

-- 4. Policy: Users CANNOT update their own credits directly!
-- (We intentionally do NOT create an UPDATE policy for regular users here.
-- Only the secure backend or specific database functions can update credits.)

-- 5. Create a function that runs automatically when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, credits)
  values (new.id, new.email, 3); -- Gives 3 free credits on signup
  return new;
end;
$$ language plpgsql security definer;

-- 6. Attach that function to the auth.users table as a trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. Secure Function to safely deduct 1 credit
-- Since users can't UPDATE directly, we give them a secure function to call that only subtracts 1 at a time.
create or replace function deduct_credit()
returns boolean as $$
declare
  current_credits integer;
begin
  -- Get current credits
  select credits into current_credits from public.profiles where id = auth.uid();
  
  -- Check if they have enough
  if current_credits > 0 then
    -- Deduct 1 credit
    update public.profiles set credits = credits - 1 where id = auth.uid();
    return true;
  else
    return false;
  end if;
end;
$$ language plpgsql security definer;
```

### What happens after you run this?
1. The `profiles` table instantly exists.
2. From now on, any time a *new* user signs up, Supabase automatically gives them 3 credits.
3. We created a secure `deduct_credit()` function. This prevents users from manually hacking their balance; they can only ask the database to deduct *exactly 1 credit* for a valid transaction.

Once you run this code and get the "Success" message, let me know, and I'll update the `index.html` code to show the Credit Badge and enforce the rules!
