-- Monetary amounts are integer kopecks, never floating point.
CREATE TABLE billing_orders (
 id uuid PRIMARY KEY, user_id uuid REFERENCES account_users(id) ON DELETE SET NULL,
 period text NOT NULL CHECK(period IN ('month','year')),
 amount_kopecks bigint NOT NULL CHECK(amount_kopecks>0),
 currency text NOT NULL DEFAULT 'RUB' CHECK(currency='RUB'),
 provider text NOT NULL, provider_payment_id text,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','failed','refunded')),
 created_at timestamptz NOT NULL DEFAULT now(), paid_at timestamptz, entitlement_until timestamptz,
 UNIQUE(provider,provider_payment_id)
);
CREATE INDEX billing_orders_created_idx ON billing_orders(created_at DESC);
CREATE INDEX billing_orders_user_idx ON billing_orders(user_id);
CREATE TABLE finance_entries (
 id uuid PRIMARY KEY, transaction_date date NOT NULL, category text NOT NULL CHECK(category IN
 ('amvera_expense','amvera_topup','other_expense','other_income','refund','payment_fee','tax')),
 amount_kopecks bigint NOT NULL CHECK(amount_kopecks>0),
 description text NOT NULL CHECK(length(description) BETWEEN 1 AND 500),
 created_by uuid REFERENCES account_users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX finance_entries_date_idx ON finance_entries(transaction_date DESC);
CREATE TABLE finance_amvera_balances (
 id uuid PRIMARY KEY, balance_kopecks bigint NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES account_users(id) ON DELETE SET NULL
);
CREATE INDEX finance_amvera_latest_idx ON finance_amvera_balances(recorded_at DESC);
CREATE TABLE billing_grant_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id uuid REFERENCES account_users(id) ON DELETE SET NULL,
 granted_by uuid REFERENCES account_users(id) ON DELETE SET NULL, plan text NOT NULL CHECK(plan IN ('free','pro')),
 until_at timestamptz, happened_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION billing_audit_grant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.subscription_plan IS DISTINCT FROM OLD.subscription_plan OR NEW.subscription_until IS DISTINCT FROM OLD.subscription_until THEN
 INSERT INTO billing_grant_events(user_id,granted_by,plan,until_at)
 VALUES(NEW.id,NEW.subscription_granted_by,NEW.subscription_plan,NEW.subscription_until);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER billing_audit_grant AFTER UPDATE OF subscription_plan,subscription_until ON account_users
 FOR EACH ROW EXECUTE FUNCTION billing_audit_grant();
