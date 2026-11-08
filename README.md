# Kingdom Spirit Technology — website package

**Start with `START-HERE-KST-BACKEND.md`.** It walks through Supabase, Cloudflare Pages, Workers AI, and Paystack setup in order.

## What is included
- Public KST homepage and service, company, enquiry, account, admin, and checkout pages.
- Shared midnight-black and champagne-gold design system.
- Small floating circular `KST` chatbot launcher and Cloudflare Workers AI chat endpoint.
- Supabase customer authentication, protected portal data, enquiries, contact messages, and published FAQ support.
- Cloudflare Pages Functions for server-side enquiries and Paystack invoice payments.
- Supabase SQL scripts, Cloudflare configuration, local-development templates, and deployment guides.

## Important before deployment
- The existing KST Supabase Project URL and Publishable key are retained in `config.js`. These are public browser values.
- Add `SUPABASE_SECRET_KEY`, `PAYSTACK_SECRET_KEY`, and `PAYSTACK_WEBHOOK_SECRET` to Cloudflare as encrypted secrets. Never paste them into browser files or Git.
- Deploy using Cloudflare Pages Git integration or `wrangler pages deploy` so the `functions/` backend routes are included. A static-only asset upload is not enough for this full-stack version.
- Use Paystack test credentials first. Live payment processing is not enabled by this ZIP alone; external account settings and end-to-end testing are still required.

See `START-HERE-KST-BACKEND.md` for the guided setup.

CHATBOT DISPLAY NOTE
- The circular KST launcher is loaded by js/chatbot.js and styled by css/chatbot.css.
- The script uses a site-root path derived from its own location, so the website can be previewed from inside an extracted parent folder.
- On the homepage, keep the extracted website folder as the local server root when possible; open the site at its folder URL.
- The AI reply endpoint still requires the Cloudflare Pages Function and Workers AI binding named AI to be deployed.
