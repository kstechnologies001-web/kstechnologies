KINGDOM SPIRIT TECHNOLOGY — DEPLOYMENT SUMMARY

PLATFORM
Cloudflare Pages with Pages Functions.

CLOUDFLARE BUILD SETTINGS
- Framework preset: None
- Build command: exit 0
- Build output directory: .
- Root directory: repository root
- Use Git integration so the functions/ directory is deployed with the site.

IMPORTANT ROUTES
- POST /api/enquiries — stores guest and signed-in enquiries in Supabase.
- POST /api/paystack/initialize — validates a customer's invoice and starts a Paystack transaction.
- POST /api/paystack/webhook — verifies the current timestamped Paystack-Signature (or legacy x-paystack-signature during migration) and invoice total, then marks the invoice paid.
- GET /api/paystack/verify — verifies a payment when Paystack returns the browser to the website.

KEYS
Browser: config.js requires SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY placeholders to be replaced.
Cloudflare runtime: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, PAYSTACK_SECRET_KEY and PAYSTACK_WEBHOOK_SECRET. Store all three secret-key values as encrypted Cloudflare secrets. PAYSTACK_CALLBACK_URL is optional.

DATABASE
Run supabase/schema.sql in Supabase SQL Editor. Use the updated CLOUDFLARE-DEPLOYMENT.md for administrator setup, Auth redirect URLs, webhook URL and testing instructions.

SERVICE REQUEST AND CHECKOUT
Public service forms save a request and redirect to checkout/checkout.html. A quotation/invoice must be approved before the customer is charged because service forms do not specify a fixed service price. Registered customers pay invoices in the client dashboard; the Pay now action opens the secure checkout page.

SECURITY
Never publish Supabase Secret or Paystack Secret keys in config.js, source code, Git or any browser-visible file. Keep RLS enabled. Use Paystack test mode before live payments.


DEPLOYMENT REPAIR NOTE (7 November 2026)
This package places all website files directly at the repository root and uses URL-safe folder names such as account/, pages/, services/, enquiries/, legal/, checkout/ and admin/. Confirm that index.html, js/, functions/ and these page folders are at the top level of the GitHub repository. Do not upload the ZIP itself or place the entire project inside an extra parent folder.
