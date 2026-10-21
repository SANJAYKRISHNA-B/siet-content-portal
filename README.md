# SIET Website Content Manager

A responsive Next.js portal for SIET coordinators to submit website copy, images, videos, and documents. Administrators can review submissions, copy approved text, download private media, and request corrections.

## Requirements

- Node.js 20 or newer (`.nvmrc` is included)
- npm
- A Supabase project
- A GitHub account and repository for source control
- A Vercel account for deployment

## 1. Supabase setup

1. Create a project at [Supabase](https://supabase.com/dashboard).
2. Open **SQL Editor → New query**.
3. Copy and run the complete [`supabase/schema.sql`](supabase/schema.sql) file. The script is idempotent and can be rerun after updates.
4. Confirm that `public.profiles` and `public.submissions` appear in **Table Editor**.
5. Confirm that **Storage → Buckets** contains a private `content-files` bucket.
6. In **Authentication → Providers → Email**, enable email/password authentication. Decide whether users must confirm their email before sign-in.
7. In **Authentication → URL Configuration**, use `http://localhost:3000` as the local Site URL and add `http://localhost:3000/**` as a redirect URL. After deployment, use the production Vercel URL and add `https://YOUR-VERCEL-DOMAIN/**`.
8. Open **Project Settings → API** and copy only the project URL and publishable key.

The browser must never receive a Supabase secret key or service-role key. RLS protects all database and Storage access.

### Security model

- New Auth users receive a `member` profile through a database trigger.
- Members can read their own profile, create submissions for themselves, read only their own submissions, upload into their own Storage folder, and access only their own files.
- Members cannot change their role or assigned unit through the browser.
- Administrators can read all profiles and submissions, review submissions, and access submitted files.
- Anonymous users cannot read portal records or list stored files.
- The Storage bucket is private. The app creates five-minute signed URLs for previews and downloads.

### Create the first administrator

1. Sign up through the portal with the approved administrator email.
2. Confirm the email if confirmation is enabled.
3. In Supabase SQL Editor, run this after replacing the email:

```sql
update public.profiles p
set role = 'admin', unit = 'Institutional Administration'
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('admin@your-institution.edu');
```

4. Sign out and sign in again. The portal should display the Administrator role.

## 2. Environment variables

```bash
cp .env.example .env.local
```

Set these values in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_ENABLE_DEMO_MODE=false
```

`NEXT_PUBLIC_` values are included in browser JavaScript. The Supabase publishable key is designed for this use and depends on RLS. Never put a secret key, service-role key, database password, GitHub token, or Vercel token in any `NEXT_PUBLIC_` variable.

`.env.local`, `.env`, and `.vercel` are ignored by Git. Before committing, check:

```bash
git status --short
git grep -nE 'service_role|sb_secret|SUPABASE_SECRET|DATABASE_URL'
```

Demo accounts are disabled by default. Set `NEXT_PUBLIC_ENABLE_DEMO_MODE=true` only for a local preview; the credentials shown by the UI are public demo credentials and must not be used as production accounts.

## 3. Local installation and checks

```bash
nvm use
npm install
npm run verify:supabase
npm run check
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Individual checks:

```bash
npm run lint
npm run typecheck
npm run build
```

`npm run verify:supabase` reads `.env.local` without printing credentials. It verifies Auth availability, the `submissions` table, anonymous RLS behavior, and private Storage behavior.

### Manual permission test

Create two ordinary member accounts and one administrator account, then verify:

1. Member A can sign in, submit text, and upload an allowed image/document.
2. Member A can see and open only their own submissions and files.
3. Member B cannot see Member A's submission or signed file.
4. A member cannot mark a submission Approved or change their profile role.
5. The administrator can see both members' submissions, copy text, download files, approve items, and request corrections.
6. Unsupported file types and selections exceeding 10 files, 50 MB per file, or 100 MB total are rejected.
7. Sign-out clears the authenticated UI and protected data.

Live sign-in and cross-user permission testing requires real test users in your Supabase project. Do not share their passwords in source control.

## 4. GitHub preparation

If this directory is not already a repository:

```bash
git init
git add .
git commit -m "Prepare SIET content portal for deployment"
git branch -M main
git remote add origin https://github.com/YOUR_ORG/YOUR_REPOSITORY.git
git push -u origin main
```

Review `git status` and the staged diff before committing. The included GitHub Actions workflow runs lint, TypeScript, and the production build with Node.js 20. It does not require Supabase credentials.

## 5. Vercel deployment

1. Sign in to [Vercel](https://vercel.com/) and select **Add New → Project**.
2. Import the GitHub repository.
3. Keep Framework Preset set to **Next.js** and the root directory set to the repository root.
4. Add these variables under **Settings → Environment Variables** for Production and Preview:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_ENABLE_DEMO_MODE=false`
5. Deploy and wait for the build to complete.
6. Copy the verified production URL into Supabase **Authentication → URL Configuration**.
7. Redeploy if environment values changed, then repeat the manual permission test against production.

Do not mark a deployment complete until Vercel shows **Ready**, the production URL loads, and live member/admin tests pass.

## Upload limits

- Maximum 10 files per submission
- Maximum 50 MB per file, enforced by the browser and Storage bucket
- Maximum 100 MB combined per submission, enforced by the browser
- Images: JPEG, PNG, WebP, GIF
- Video: MP4, WebM
- Documents: PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX

## Account access required to finish external setup

- **Supabase:** project URL and publishable key for local/Vercel variables; dashboard access to run the schema, configure Auth URLs, create test users, and promote the administrator.
- **GitHub:** access to create or select the destination repository and push the code.
- **Vercel:** access to import the repository, configure environment variables, deploy, and inspect deployment logs.

No service-role key, database password, GitHub personal access token, or Vercel token should be sent through the app or committed to this repository.
