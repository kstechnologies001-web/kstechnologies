# Kingdom Spirit Technology — Cloudflare Pages Deployment

This project is prepared for **Cloudflare Pages with Pages Functions**. The website is plain HTML/CSS/JavaScript; no framework build is required. The `functions/` directory contains the backend routes used by enquiries, Paystack initialization, Paystack webhook verification and payment verification.

## 1. What changed in this Cloudflare version

- Added Cloudflare Pages Functions under `functions/api/`:
  - `POST /api/enquiries` saves guest and signed-in service requests to Supabase.
  - `POST /api/paystack/initialize` checks the signed-in customer's invoice and initializes Paystack securely.
  - `POST /api/paystack/webhook` verifies Paystack's HMAC signature and marks matching invoices paid only after the amount and currency match.
  - `GET /api/paystack/verify?reference=...` verifies the Paystack transaction after the customer returns to the site.
- Added a checkout page. A service request is submitted first and then opens checkout. Because service forms do not set a fixed sale price, this flow records the request and explains that an approved quotation/invoice must be created before a payment amount is charged. Customers pay approved invoices from the checkout page or their dashboard.
- Changed customer login/registration to a dark-gold theme.
- Added an AI-powered customer-support chat widget across the website, backed by Cloudflare Workers AI through a Pages Function at `POST /api/chat`. The chatbot has KST service/contact guidance and is instructed not to invent prices or claim to process orders/payments.
- Retained the existing KST Supabase Project URL and Publishable key in `config.js`; only public values are present in browser code. Supabase Secret and Paystack secret/webhook keys remain server-side Cloudflare Secrets.

## 2. Publish through Cloudflare Pages (recommended: Git integration)

Cloudflare Pages Functions must be deployed with the project. Do not use a plain static-assets drag-and-drop upload for this full-stack version.

1. Create a GitHub repository and upload the **contents** of this folder. The repository root must contain `index.html`, `config.js`, `functions/`, `supabase/` and `wrangler.toml`.
2. Sign in at <https://dash.cloudflare.com/>.
3. Open **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
4. Select the GitHub repository and production branch (normally `main`).
5. Set the build configuration:
   - Framework preset: **None**
   - Build command: `exit 0`
   - Build output directory: `.`
   - Root directory: `/` (repository root)
6. Save and deploy. Cloudflare should provide a `*.pages.dev` address. Test that the home page loads before moving on to account and payment setup.

The site is static HTML plus Pages Functions; no bundling/build step is needed. `wrangler.toml` also records the Pages output directory and compatibility date.

### Enable the customer-support chatbot

The site includes a floating **Chat with us** widget on its HTML pages. Its backend uses Cloudflare Workers AI, so you do not need to paste an AI provider API key into browser code.

- The `functions/api/chat.js` route accepts the recent conversation and calls the `@cf/meta/llama-3.1-8b-instruct` model through the Cloudflare AI binding.
- `wrangler.toml` declares the binding as `AI` for Wrangler deployments.
- For a Pages project connected through Git, open **Workers & Pages → your Pages project → Settings → Production → Bindings → Add → Workers AI** (the environment selector and labels can vary slightly). Set the variable name to exactly `AI`, save, and redeploy. Cloudflare documents this binding path and the `wrangler pages dev --ai AI` local flag in its [Pages Functions bindings guide](https://developers.cloudflare.com/pages/functions/bindings/).
- Redeploy after adding the binding. Test by opening the live site and asking what services KST offers.
- If the binding is missing, the widget will display a helpful message directing visitors to the published email/WhatsApp contact. AI responses can be imperfect; the bot is not allowed to quote unapproved prices or access private account records. Be aware that local development with a Workers AI binding still calls Cloudflare and can incur usage charges.


## 3. Configure Supabase

1. Create or open your Supabase project at <https://supabase.com/dashboard>.
2. Open **SQL Editor** and run the complete `supabase/schema.sql` file included with this website. The updated schema permits a guest enquiry to have a `NULL` `client_id`; signed-in enquiries are linked to their customer profile.
3. In Supabase **Project Settings → API**, copy the Project URL, Publishable key and Secret key.
4. The current KST Project URL and Publishable key are already present in the root `config.js`. Keep those values. Only change them if you intentionally move the website to a different Supabase project. Never place the Secret key in this browser file.
5. In Supabase **Authentication → URL Configuration**, set the Site URL to your Cloudflare Pages domain, for example `https://YOUR-PROJECT.pages.dev`. Add the same domain and your custom domain (if used) to the Redirect URLs, including the wildcard path `https://YOUR-PROJECT.pages.dev/**`.
6. In **Authentication → Providers → Email**, enable email sign-up and configure email confirmation to suit your launch policy. Keep confirmation enabled for better account security unless you have a deliberate reason not to.

### Add Cloudflare Pages variables and secrets

In Cloudflare, open **Workers & Pages → your Pages project → Settings → Variables and Secrets**. Add the following for the **Production** environment. Add the equivalent values to **Preview** only if you want preview deployments to connect to a separate/test backend.

| Name | Value source | Storage |
|---|---|---|
| `SUPABASE_URL` | Supabase Project URL | Variable |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase Publishable key | Variable |
| `SUPABASE_SECRET_KEY` | Supabase Secret key (`sb_secret_...`) | **Encrypted secret** |
| `PAYSTACK_SECRET_KEY` | Paystack test API secret key first (`sk_test_...`) | **Encrypted secret** |
| `PAYSTACK_WEBHOOK_SECRET` | Paystack webhook signing secret (`whsec_...`) | **Encrypted secret** |
| `PAYSTACK_CALLBACK_URL` | Optional full URL ending `/payment-success.html` | Variable |

Do not put `SUPABASE_SECRET_KEY`, `PAYSTACK_SECRET_KEY` or `PAYSTACK_WEBHOOK_SECRET` in `config.js`, HTML, JavaScript, Git or any public file. Save the variables and trigger a new deployment so the Functions receive the settings.

## 4. Configure Paystack (when ready to accept test payments)

1. Create or open your Paystack account at <https://dashboard.paystack.com/>.
2. Add the Paystack **test API secret key** to Cloudflare as encrypted `PAYSTACK_SECRET_KEY`. This key is used to initialize and verify payment transactions.
3. In Paystack Dashboard → Developers → API configuration, create/copy the webhook signing secret (`whsec_...`) and add it to Cloudflare as encrypted `PAYSTACK_WEBHOOK_SECRET`. The webhook route validates the current timestamped `Paystack-Signature` header. It also accepts the legacy `x-paystack-signature` during migration when the older header is still sent. Do not use a live key until the entire payment flow has been tested and the business is approved for live transactions.
4. In Paystack's webhook settings, set the webhook URL to:
   `https://YOUR-PROJECT.pages.dev/api/paystack/webhook`
5. Leave `PAYSTACK_CALLBACK_URL` unset to use the site's `/payment-success.html` page automatically, or set it to the full URL for that page.
6. Redeploy after changing Cloudflare variables/secrets.

The website uses Paystack's hosted checkout. It does not need a Paystack public key in browser code. The Paystack secret key is used only inside Cloudflare Pages Functions.

## 5. How requests and checkout work

1. A visitor submits Contact, Request a Quote, Project Brief or Consultation.
2. `POST /api/enquiries` validates the fields and saves the enquiry to Supabase. If the visitor is signed in, the request is attached to their profile. Guests can submit without creating an account.
3. The visitor is redirected to **checkout/checkout.html** with a request reference. The checkout page confirms receipt and explains that no payment is taken until scope and price are approved.
4. An administrator reviews the request and agrees a price with the customer. The admin creates the project/invoice from the Administrator Dashboard for a registered customer.
5. The customer signs in, opens **Invoices & Payments**, and selects **Pay now**. The checkout page loads the invoice for that account and sends the customer to Paystack's hosted checkout.
6. The Paystack webhook and return-page verification both check the transaction against the stored invoice amount/currency before setting the invoice to paid.

**Pricing note:** The current website's service forms collect project descriptions and budget ranges; they do not contain a confirmed fixed price. The checkout therefore does not guess a charge based on the customer's stated budget. An approved invoice is required before payment. Guest enquiries can be received and reviewed; to pay through the secure account invoice flow, the customer should create an account and the administrator should create an invoice for that account after confirming the project details.

## 6. Create the administrator account

1. Open the public website and register the administrator email account.
2. Confirm the email if Supabase email confirmation is enabled, then sign in once.
3. In Supabase SQL Editor, run the following statement using the administrator's actual email:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users
  where lower(email) = lower('YOUR_ADMIN_EMAIL@example.com')
);
```

4. Sign out and sign back in, then open `admin/admin-dashboard.html`.
5. Only a profile whose `role` is `admin` can access the administration dashboard.

## 7. Local development

1. Install Node.js 20 or later.
2. In the project folder, run `npm install`.
3. Copy `.dev.vars.example` to `.dev.vars` and replace the placeholder values with test credentials. `.dev.vars` is ignored by Git.
4. Run `npm run dev` and open the local URL printed by Wrangler (normally `http://localhost:8788`).

Never commit `.dev.vars` or real secrets. `npm run deploy` is available for Wrangler CLI deployment after you have logged in with `npx wrangler login` and created the Pages project. Git integration is the recommended deployment route for this version.

## 8. Pre-launch test checklist

- [ ] Home page, service pages, policies and contact page load.
- [ ] Register, email confirmation, login, logout and password reset work.
- [ ] Guest service request creates a Supabase enquiry and opens checkout.
- [ ] Signed-in service request is visible to the customer and administrator.
- [ ] Admin dashboard can update enquiry status and create projects/invoices.
- [ ] Customer dashboard shows only that customer's own projects, requests, invoices and files.
- [ ] Checkout refuses access to invoices belonging to another customer.
- [ ] Paystack test checkout opens from a pending invoice.
- [ ] A successful test payment marks the exact matching invoice paid.
- [ ] A failed, cancelled or amount-mismatched payment does not mark an invoice paid.
- [ ] Paystack webhook is configured to the Cloudflare `/api/paystack/webhook` URL.

## 9. Important key placeholders

- Public browser values: `config.js` (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`).
- Cloudflare runtime values: `.env.example` (reference only).
- Local-only values: `.dev.vars.example` (copy to ignored `.dev.vars`).
- Production private values must be added as encrypted Cloudflare Secrets: `SUPABASE_SECRET_KEY`, `PAYSTACK_SECRET_KEY` and `PAYSTACK_WEBHOOK_SECRET`.

The website package cannot create your Cloudflare, Supabase or Paystack accounts, issue credentials, deploy itself, or verify live payment settings. Those steps require access to your accounts.


DEPLOYMENT REPAIR NOTE (7 November 2026)
This package places all website files directly at the repository root and uses URL-safe folder names such as account/, pages/, services/, enquiries/, legal/, checkout/ and admin/. Confirm that index.html, js/, functions/ and these page folders are at the top level of the GitHub repository. Do not upload the ZIP itself or place the entire project inside an extra parent folder.
