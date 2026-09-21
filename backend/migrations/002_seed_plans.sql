-- Demo seed data. Prices are IMPLEMENTATION-CHOICE placeholders (the PRD
-- never states plan prices — see ARCHITECTURE_DECISIONS.md table M) and
-- are meant to be edited by an admin before real evaluation, not treated
-- as a PRD requirement.

INSERT INTO plans (name, interval, price_minor, currency) VALUES
  ('Monthly', 'month', 49900, 'INR'),   -- ₹499.00/month (demo default)
  ('Yearly',  'year',  499900, 'INR');  -- ₹4,999.00/year (demo default, ~16% discount vs monthly)
