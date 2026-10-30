# Deploy Sprout to Vercel

Production is live at **https://sprout-classroom.vercel.app**, in Vercel project **lansii/sprout-classroom**. The required production environment variables have been configured, including the server-only secret.

The project is configured to host the React website and Express API together.
`vercel.json` builds `dist/`, and `api/index.js` exports Express as a Vercel Node
function. The function does not start a separate listening server. API requests
stay under `/api`; other website paths open the React app.

## Publish from this folder

Run these commands from `sprout-classroom`, where `vercel.json` is located:

```powershell
npx vercel login
npx vercel link
```

Choose your Vercel account and create a project named `sprout-classroom` (or select
the intended existing project). Use the Vite framework, `npm run build` for the
build command, `dist` for the output directory, and Node.js 22.

In the Vercel project's **Settings > Environment Variables**, add these values
from your local `.env` for Production. Include Preview too if you use previews.

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Your public publishable key |
| `VITE_SUPABASE_URL` | The same project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The same public publishable key |
| `SUPABASE_SECRET_KEY` | Server-only Supabase secret key; mark Sensitive |
| `ADMIN_EMAIL` | `lpdcabe@gmail.com` |

Legacy anon/service-role key names are also supported by the application. Keep
`VITE_API_URL` unset: the website calls its own `/api`. `PORT` and `HOST` are local
development settings and do not need to be added to Vercel. Never prefix a secret
key with `VITE_`; those variables are embedded in the public website build.

Then publish:

```powershell
npx vercel --prod
```

The CLI prints the deployed URL. Set `CLIENT_ORIGIN` to that exact HTTPS origin
if external browsers or a separate frontend will call the API. Add any custom
domain to this comma-separated setting as well. Redeploy after changing
environment variables; frontend variables are read at build time.

## Supabase settings

The existing Supabase database and admin account are reused. If not already
applied, run `supabase/schema.sql` for a new database, or the admin migration for
an existing one. Keep public registration disabled.

In Supabase **Authentication > URL Configuration**, set the Site URL to the
production HTTPS URL and add that URL to the redirect allowlist. Retain local
development URLs if needed. Add custom domains when you start using them.

## Verify after deployment

1. Open the homepage on desktop and mobile.
2. Open `/api/health`; expect `{"ok":true,"configured":true}`.
3. Double-tap the landing-page heart and sign into administration.
4. Confirm the teacher list loads. Sign in as an approved teacher and confirm
   their saved classrooms load.
5. Refresh the page and verify the session restores. Sign out and confirm the
   landing page returns.

The `.vercelignore` file excludes local credentials, `.env` files, tests, and
development artifacts from CLI source uploads. Vercel stores production secrets
in project environment settings. Classroom records continue to live in Supabase.

The account creation throttle is held in process memory. On Vercel it applies
per warm function instance; configure Vercel Firewall rate limits if a shared,
durable request limit is needed. Authorization and account-approval checks run
on every API request regardless of the throttle.

References: [Vite deployment](https://vercel.com/docs/frameworks/frontend/vite),
[Node.js functions](https://vercel.com/docs/functions/runtimes/node-js), and
[Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json).
