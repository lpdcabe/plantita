# Supabase and Express setup

1. In your Supabase project, open **SQL Editor**, paste `supabase/schema.sql`, and run the whole file. It creates the three tables, ownership policies, and atomic point-award functions.
2. In **Project Settings → API**, copy the project URL and a **publishable key** (or legacy **anon** key). Classroom requests use this public key; administrator provisioning additionally requires a server-only Supabase secret key.
3. Copy `.env.example` to `.env`. Set both `SUPABASE_URL` and `VITE_SUPABASE_URL` to the project URL, and both `SUPABASE_ANON_KEY` and `VITE_SUPABASE_ANON_KEY` to the public key. The names `SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_PUBLISHABLE_KEY` are also supported by the API.
4. In Supabase **Authentication → Providers**, enable Email. In **Authentication → URL Configuration**, set the Site URL and allowed redirects to your deployed frontend origin (and `http://localhost:5173` for development). Disable public signups. The administrator creates confirmed teacher accounts and shares credentials privately.
5. Run the root development script. Vite proxies `/api` to Express on the configured PORT (3002 in the local .env). `GET /api/health` reports whether server configuration is present. A successful authenticated classroom load verifies the database schema and access policies.

Each teacher can own multiple classrooms. Rerun the current supabase/schema.sql to upgrade an existing installation; it preserves classroom data. New classrooms start empty. The public landing page requires teacher sign-in before any classroom access. New accounts start with no classrooms; demo access has been removed. Requests use the teacher's Supabase access token; Express verifies it with Supabase Auth and queries using that same identity. Row-level security prevents one teacher from accessing another teacher's classroom. Column-level grants prevent direct writes to point totals or point history. The two narrowly scoped award functions verify the caller's ownership and mutate points atomically. Student deletion also deletes that student's point history. Supabase Realtime is not required.

For production, run the frontend build and then start Express. Express serves `dist/` and `/api` from one origin. Set `HOST=0.0.0.0` in your hosting environment when required. If serving frontend and backend on different origins, set `VITE_API_URL` at frontend build time and add the frontend's exact origin to the server's comma-separated `CLIENT_ORIGIN`. Restart/rebuild after changing environment variables. Do not put a service-role key in any `VITE_` variable.

## Account access

Apply `supabase/migrations/20261030_admin_accounts.sql` to existing installations (the complete schema includes it). Set `ADMIN_EMAIL` and `SUPABASE_SECRET_KEY` in the server environment. `npm run setup:admin` enables the verified owner account, or creates one with a locally supplied password. No unauthenticated bootstrap endpoint exists.

The API reads the user from Supabase on every request. Only the configured verified owner email can manage accounts; user-editable metadata never grants permissions. Teachers require server-managed `sprout_role=teacher` and `sprout_status=active` app metadata. Pending or paused accounts receive 403. Database policies read the same metadata directly, and the award functions explicitly check it. A deferred account-creation trigger blocks direct public signup; also disable public signups in Supabase settings.

The privileged Supabase client is initialized only inside administrator account routes. Classroom routes continue to query with the teacher JWT and ownership policies. Changing a teacher status updates app metadata without removing any data.

## API contract

All routes except `/api/health` require `Authorization: Bearer <Supabase access token>`. Send `X-Classroom-Id: <classroom UUID>` to select the classroom for reads and mutations. Ownership is checked by both the API and database. Without a selection, reads use the first owned classroom; point awards require an explicit selection when the teacher owns multiple classes.

| Method | Route | Result |
| --- | --- | --- |
| GET | `/api/health` | `{ ok, configured }` |
| GET | `/api/account` | Verified approved account identity and `canManageAccounts` |
| GET | `/api/admin/users?page=1&perPage=20` | Owner only; safe account fields, page and hasMore |
| POST | `/api/admin/users` | Owner only; `{name,email,password}` creates an approved teacher; 10 requests per minute |
| PATCH | `/api/admin/users/:id` | Owner only; `{name?,status?,password?}` with active/inactive and 12-128 character passwords; owner cannot be changed here |
| GET | `/api/classroom` | `{ classroom, students, activities }`; classroom is `null` before creation |
| GET | `/api/classrooms` | Lists the signed-in teacher's classrooms |
| POST | `/api/classrooms` | Creates a new empty classroom; accepts `name`, `goal`, `theme`, `decorations` |
| POST | `/api/classroom` | Legacy create route; new clients use `/api/classrooms` |
| PATCH | `/api/classroom` | Updates supplied classroom fields |
| POST | `/api/students` | Creates a zero-point student from `{ name, plant }` |
| POST | `/api/students/batch` | Creates 1–40 students from `{ students: [{ name, plant }] }` in one atomic insert; returns the created student array |
| PATCH | `/api/students/:id` | Updates a student's name or plant |
| DELETE | `/api/students/:id` | Deletes student and history; HTTP 204 |
| POST | `/api/awards` | Accepts `{ studentIds: [ids] \| "all", points, reason }`; returns full state |
| DELETE | `/api/awards/:id` | Reverses one activity and returns full state |

Award amounts are integers from 1 to 100. The database validates all selected students before applying a batch atomically. A failed batch changes nothing. Batch roster additions validate every student before a single database insert, so an invalid later name cannot leave earlier students partially added. Recent activity includes the latest 500 awards. Error responses are `{ error: string }`.

Run `node --test server/app.test.js` to check API authentication, validation, ownership scoping, and award dispatch with a mocked database. These tests do not replace applying and verifying the SQL against your Supabase project.

Supabase references: [server-only account creation](https://supabase.com/docs/reference/javascript/auth-admin-createuser) and [signup configuration](https://supabase.com/docs/guides/auth/general-configuration).
