# KST website — start here

This is the updated Kingdom Spirit Technology website. It uses **Cloudflare Pages + Pages Functions** for hosting/backend routes and **Supabase** for authentication and database storage. Paystack handles hosted invoice payments. The existing Supabase Project URL and Publishable key are already present in `config.js`; do not replace them unless you are deliberately changing projects.

## 1. What already exists in the files

- Public business website and service pages.
- Customer sign-up, login, password recovery and client dashboard.
- Admin login/dashboard for managing customer records, enquiries, projects and invoices.
- Contact form saves to `public.contact_messages` in Supabase.
- Chatbot reads only published `public.faq_entries` rows and sends questions to Cloudflare `POST /api/chat`.
- Quote, consultation and project-brief forms submit to Cloudflare `POST /api/enquiries` and are saved to `public.enquiries`.
- Invoice checkout asks Supabase for the signed-in customer's invoice and starts Paystack payment through server-side Cloudflare Functions.

The website is not merely a static mock-up. However, the private Cloudflare settings and external account configuration below must be completed before every backend feature works online.

## 2. Set up the Supabase database

1. Open your Supabase project: `ffilvqjqcjvghburbhxu.supabase.co`.
2. Open **SQL Editor**.
3. If the customer portal tables (`profiles`, `enquiries`, `projects`, `invoices`, `notifications`, `support_tickets`, `project_files`, `project_milestones`) have not already been created, run the complete `supabase/schema.sql` file.
4. Run `supabase/website-table-permissions.sql`. It safely creates the two website tables if missing and applies the access rules:
   - `contact_messages`: anonymous and signed-in visitors can INSERT a message, but cannot read messages through the public website.
   - `faq_entries`: visitors can SELECT published FAQ rows only (`is_published = true`).
5. Open **Table Editor**. Add FAQ rows to `faq_entries`; enter a question and answer, then set `is_published` to `true` when the answer is ready for the chatbot.
6. In **Authentication → URL Configuration**, set the Site URL to your Cloudflare Pages domain and add the production and custom domains to Redirect URLs, including the wildcard path, for example `https://YOUR-SITE.pages.dev/**`.
7. Confirm Email sign-up is enabled. Keep email confirmation enabled unless you intentionally choose another account-verification policy.

## 3. Connect Cloudflare Pages to the website repository

**Important:** this project contains Cloudflare Pages Functions in `functions/`. A static-only drag-and-drop upload will not deploy those server routes. Use Git integration or the Wrangler Pages deploy command.

1. Extract this ZIP. The repository root must directly contain `index.html`, `config.js`, `functions/`, `js/`, `supabase/`, `wrangler.toml` and `package.json`.
2. Put the contents of this extracted project into a GitHub repository (do not add an extra nested folder around the website files).
3. In Cloudflare Dashboard, open **Workers & Pages → Create application → Pages → Connect to Git** and select the repository.
4. Use Framework preset **None**, build command `exit 0`, build output directory `.`, and repository root `/`.
5. Deploy and confirm the `*.pages.dev` homepage opens.

## 4. Add Cloudflare variables and encrypted secrets

Open your Pages project → **Settings → Variables and Secrets**. Add these in the Production environment. Add Preview equivalents only if you intentionally want preview deployments to use the backend.

| Name | Where to get it | Cloudflare storage |
|---|---|---|
| `SUPABASE_URL` | Supabase Project URL | Variable |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase API keys | Variable |
| `SUPABASE_SECRET_KEY` | Supabase API keys; use a server-side Secret key (`sb_secret_...`) | **Encrypted secret** |
| `PAYSTACK_SECRET_KEY` | Paystack Dashboard; start with test API secret (`sk_test_...`) | **Encrypted secret** |
| `PAYSTACK_WEBHOOK_SECRET` | Paystack Developers → API configuration; webhook signing secret (`whsec_...`) | **Encrypted secret** |
| `PAYSTACK_CALLBACK_URL` | Optional: your site's full `/payment-success.html` URL | Variable |

The first two values are public configuration. `SUPABASE_SECRET_KEY`, `PAYSTACK_SECRET_KEY` and `PAYSTACK_WEBHOOK_SECRET` are private and must never be put in `config.js`, HTML, browser JavaScript, GitHub or chat. Do not use the Publishable key as `SUPABASE_SECRET_KEY`. After saving settings, create a new deployment so the Functions receive the variables.

## 5. Enable the chatbot AI binding

The chatbot UI is the small circular **KST** launcher. Its server route is `POST /api/chat` and it uses Cloudflare Workers AI. In the Pages project settings, find **Functions / Workers AI bindings** (Cloudflare may label this under Bindings), add a binding named exactly `AI`, attach the Workers AI service, save, and redeploy. `wrangler.toml` already declares `AI` for Wrangler deployments. No AI key belongs in browser code.

## 6. Enable Paystack test payments

1. Add your Paystack **test API secret key** to Cloudflare as encrypted `PAYSTACK_SECRET_KEY`.
2. In Paystack Dashboard → Developers → API configuration, copy the webhook signing secret (`whsec_...`) and add it to Cloudflare as encrypted `PAYSTACK_WEBHOOK_SECRET`. The website verifies the current timestamped `Paystack-Signature` header and retains legacy header compatibility during migration.
3. In Paystack webhook settings, use `https://YOUR-SITE.pages.dev/api/paystack/webhook` (replace with your real Pages/custom domain).
4. Keep checkout invoice-first: a visitor's enquiry is not a purchase and does not create a charge. First agree the scope and cost, then create an invoice for a registered customer in the admin dashboard.
5. Test with Paystack test credentials and confirm the webhook/return verification changes only the matching invoice to `paid`.
6. Do not use live Paystack credentials until the test flow is successful and your business/payment setup is approved.

## 7. Create your admin account

1. Open your live website and register the email address you will use as the administrator.
2. Confirm the email if confirmation is enabled, then sign in once so Supabase creates the profile row.
3. In Supabase SQL Editor, replace the placeholder email below with the email you registered and run:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users
  where lower(email) = lower('YOUR_ADMIN_EMAIL@example.com')
);
```

4. Sign out and sign back in, then open `/admin/admin-dashboard.html`.

## 8. How the two website tables work

**Contact form → `contact_messages`:** the browser uses the Supabase Publishable key to insert `full_name`, `email` and `message`. RLS permits INSERT only. The public website does not have permission to list or read submitted messages.

**Chatbot knowledge → `faq_entries`:** the chatbot requests `question` and `answer` only where `is_published=true`. It sends the relevant published FAQ snippets to `/api/chat`; the AI uses them as reference information. Keep unpublished or draft FAQ rows hidden.

The wider portal uses separate protected tables such as `profiles`, `enquiries`, `projects` and `invoices`. The quote/project forms are saved by Cloudflare Pages Functions using the server-side Supabase Secret key, not by exposing that key in the browser.

## 9. Local testing

1. Install Node.js 20 or later.
2. In the project root, run `npm install`.
3. Copy `.dev.vars.example` to `.dev.vars`, then fill it with test values. `.dev.vars` is ignored by Git and must never be uploaded.
4. Run `npm run dev` and open the local address printed by Wrangler.
5. Before going live, test registration, email confirmation, login, password reset, contact submission, guest enquiry submission, chatbot answer, admin invoice creation, customer invoice visibility, Paystack test payment, failed payment and webhook verification.

## 10. Important safety rules

- Never share `SUPABASE_SECRET_KEY`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`, email OTPs, passwords or payment PINs.
- Never paste a service-role/secret key into `config.js`.
- Keep RLS enabled. Do not solve permission errors by disabling RLS or granting public SELECT on `contact_messages`.
- Do not charge an enquiry's proposed budget. Payment must match an approved invoice.
- Review privacy, terms, refund/cancellation and service-delivery policy wording against how KST actually operates before launch.

For reference, consult the official [Cloudflare Pages Functions bindings guide](https://developers.cloudflare.com/pages/functions/bindings/), [Supabase API keys guide](https://supabase.com/docs/guides/getting-started/api-keys), and [Paystack webhook guide](https://paystack.com/docs/payments/webhooks/). The webhook function supports the current timestamped Paystack-Signature header and legacy x-paystack-signature during migration.

CHATBOT DISPLAY NOTE
- The circular KST launcher is loaded by js/chatbot.js and styled by css/chatbot.css.
- The script uses a site-root path derived from its own location, so the website can be previewed from inside an extracted parent folder.
- On the homepage, keep the extracted website folder as the local server root when possible; open the site at its folder URL.
- The AI reply endpoint still requires the Cloudflare Pages Function and Workers AI binding named AI to be deployed.
