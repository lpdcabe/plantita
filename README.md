# plantita

# Sprout — a classroom garden

A plant-themed classroom motivation app built with **React 19, Express 5, Supabase, and Tailwind CSS 4**. Each student has a plant that grows when a teacher awards points for homework, kindness, teamwork, and extra effort.

## Start the app

Use Node.js 22.12+ or 24 LTS. In this folder:

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. Vite serves React; Express uses `PORT` from `.env` (currently 3002 locally) and handles `/api`. Vite reads the same setting for its proxy. The supplied local `.env` already contains this project's Supabase URL and public publishable key. Classroom requests use the public key and the signed-in teacher token. Account administration additionally needs a server-only secret key.

## Open your cloud classroom

1. Run the current `supabase/schema.sql` in the Supabase SQL Editor. **Existing installations must rerun it for multiple classrooms.** This removes the one-class-per-teacher constraint and updates the point functions without deleting existing students or points.
2. Enable the Email provider and disable public signups in Supabase Authentication. Add `http://127.0.0.1:5173` and your production origin to the allowed authentication redirect URLs, and set the appropriate Site URL.
3. The public landing page opens first. Click **Sign in** with an account created or approved by the administrator. Public account registration is removed.
4. Click **Create your first class**, enter a name, and add your students. Additional classes can be created from the classroom dropdown. Every new class starts empty.

Use the same header to switch between classes. Each class has its own roster, points, theme, and goal, stored in Supabase under its teacher's account. Switching classes never copies or resets another class's students. The last selected classroom is remembered on this device.

If your database is already set up, run `supabase/migrations/20261027_add_plant_varieties.sql` in the SQL Editor to allow hibiscus, rose, marigold, and bonsai. The full `schema.sql` includes this update too. Existing plants and points are preserved.

Sign into the same teacher account on another device to see the same garden. Connected gardens refresh every 15 seconds and when the browser regains focus. Awards update immediately on the device making them. Sign out from your profile at the bottom of the sidebar to return to the landing page.

My Garden, Students, and Growth Board require a teacher sign-in. Demo access has been removed; old browser demo data is not loaded or copied into an account. The public landing page has an illustrative plant preview, which does not save points or provide classroom access. No student email addresses or student accounts are required.

## Administrator accounts

The sole administrator is **lpdcabe@gmail.com**. On the landing page, double-tap or double-click the heart above **Every child grows at their own pace** to open the administrator sign-in. Keyboard users can focus the heart and press Enter or Space. A successful administrator sign-in opens **Administration** automatically. The heart does not grant permissions; the server still verifies the account. Only this verified email can create, approve, rename, pause, or restore teacher accounts. Teachers cannot create accounts or open administration.

For an existing installation, run [the admin migration](supabase/migrations/20261030_admin_accounts.sql) once in Supabase SQL Editor. A fresh installation uses the complete schema. Both preserve existing users and classroom records; existing teachers must be approved from **Administration**. Disable public signups in Supabase Authentication too, so the auth service returns a clear registration-disabled message.

Set `ADMIN_EMAIL` and `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) in the server environment. Never expose the secret with a `VITE_` prefix. The owner email is also stored in the private SQL settings row; update both together if ownership changes.

For initial owner setup, run `npm run setup:admin`. A verified existing account is promoted without changing its password. If no account exists, the terminal prompts for a hidden 12-128 character password. This operator script has no public HTTP endpoint.

Open **My account > Change password** to update your own password with your current password and a matching confirmation. In **Administration > Edit teacher > Change password**, the owner can optionally reset a teacher password; leaving it collapsed preserves the existing password. Passwords must contain 12-128 characters and are never returned by the account API.

**Create teacher** accepts a name, email, and password, with a secure password generator. Save the password before submitting, then share the credentials privately. Sprout does not email credentials or display them again. Accounts start with an empty classroom list. Pausing access keeps all classroom data; the API checks current approval on every request, and database policies check live account metadata to block direct database access too.

## What you can do

- Give each student a sunflower, daisy, tulip, monstera, cactus, lavender, strawberry, hibiscus, rose, marigold, or bonsai tree. Choose a variety when adding a student or editing their plant.
- Growth stages stop at **Super bloom (180 points)**, after Little seed, New sprout, Growing strong, and In bloom. Further points still earn decorations; plant branching stops at Super bloom.
- Earn automatic decorations: garden sign (100), ribbon (180), sky-blue pot (300), golden pot and ladybug (500), enchanted pot and fireflies (800). Rewards come from saved points and appear on every device without another database migration.
- Choose **Play with plants** in My Garden for wiggles, smiles, and butterfly visits without awarding points. Toggle Play mode off to resume individual watering. Water everyone remains an explicit points action.
- Crossing the shared class goal with a successful award triggers a short rainbow, butterfly, and firefly celebration. Opening an already-completed class does not replay it.
- Printable cards gain earned stage badges, new borders, and the same decorated plants as the garden.
- Find plants by student name or variety, filter by growth stage, and move through garden pages.
- Enjoy responsive plant motion and watering celebrations for the students who receive points.
- Plants grow gradually for about five seconds after an award. Further watering continues from the visible size; earned stems and leaves unfold without previewing a future plant. Reloading keeps the size earned by the saved points. Reduced-motion settings show the final growth immediately.
- In My Garden, choose a reason and points in the watering toolbar, then tap a plant to pour water directly. Water everyone applies the same award to the whole class, including plants on other pages. Quick repeat taps are blocked while watering, and failed saves never play a success animation.
- Award 1–100 points to a student or the whole class, with preset or custom reasons.
- Add several students at once, rename students, change their plants, or remove them.
- In Students, tap a plant's **View & print card** area to open a botanical keepsake with their current plant, name, points, growth stage, and classroom. Choose Meadow, Sunset, or Moonlight, then **Print card**. Only the 70 × 98 mm card prints; use 100% scale and disable the browser's print headers/footers. Choose Save as PDF in the print window for a digital copy. Printing does not award or change points.
- Track a shared class goal and individual growth.
- Switch between sunny day, golden hour, and moonlight scenes.
- Show/hide student names and project the garden in full-screen.
- Keep plants readable on phones and large displays with pages sized automatically to the available space.
- Export garden data from Settings as JSON.

Plants never wilt or lose points for missed work. Removing a student permanently removes that student's point history. Point totals include all awards. The classroom interface focuses on the garden, students, and growth board.

## Configuration

For a new checkout, copy `.env.example` to `.env`. Configure:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_public_publishable_key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_public_publishable_key
ADMIN_EMAIL=lpdcabe@gmail.com
SUPABASE_SECRET_KEY=your_server_only_secret_key
PORT=3002
CLIENT_ORIGIN=http://127.0.0.1:5173,http://localhost:5173
```

Legacy `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` names also work. Never put secret, service-role, database, or JWT signing keys into `VITE_` variables. `.env` files are ignored by Git. The browser receives only the public project URL and publishable key.

Express validates the Supabase session and account approval on each request and queries with the teacher's identity. Row-level security isolates classrooms; column grants block direct changes to point totals. The SQL functions validate ownership and award/undo points atomically. See [backend details](README-backend.md) for the API contract.

## Tests

```sh
npm test
npm run test:e2e
npm run build
```

Unit/API tests cover growth milestones, award/undo behavior, request validation, authentication, and ownership scoping with a mocked database. Browser tests exercise the public landing page and authenticated classrooms using intercepted authentication and API requests, including persistence and mobile layouts. They do not create Supabase users or send emails.

Browser tests use installed Google Chrome on Windows. Elsewhere, run `npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an installed Chromium browser. The browser-test runner starts and stops its own development server. Keep port 5173 free when running these tests. Cloud UI tests intercept authentication and API responses; these test account transitions and saving behavior without accessing real student records or sending emails.

## Deploy to Vercel

See [the Vercel deployment guide](DEPLOY-VERCEL.md). The configuration hosts the Vite website and Express API on one Vercel project, with the database and account management in your existing Supabase project.

## Deploy to a Node host

```sh
npm ci
npm run build
npm start
```

Express serves the compiled React app and API from the same origin. Supply environment variables through your host, set `HOST=0.0.0.0`, set `PORT` as required by the host, and set `CLIENT_ORIGIN` to the exact deployed origin. Add the deployed origin to Supabase Auth URL configuration. Set the `VITE_` values before building.

Production is deployed on Vercel at https://sprout-classroom.vercel.app. The same code can also run on a Node.js host. For separate frontend and backend hosting, set `VITE_API_URL` to the backend origin at build time and allow the frontend origin in `CLIENT_ORIGIN`.

## Source layout

```text
src/App.jsx                 Authenticated navigation, page layout, and dialogs
src/components/views/AdminView.jsx  Administrator account management
server/accounts.js          Owner-only account provisioning
scripts/setup-admin.mjs     Private administrator bootstrap
src/styles.css              Tailwind import and responsive garden styling
src/components/Plant.jsx    SVG plant artwork and growth stages
src/components/views/       Garden, student roster, and growth board
src/components/             Scenery, accessible dialogs, authentication
src/lib/hooks.js            Classroom state and protected cloud updates
src/lib/                    Plant model, API and Supabase client
server/                     Express API, validation, tests
supabase/schema.sql         Tables, policies, grants and point functions
tests/                      Browser interaction tests
```
