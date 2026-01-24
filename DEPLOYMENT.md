# HTHD Deployment Guide

## Quick Reference

| Service | Subdomain | Platform |
|---------|-----------|----------|
| API Backend | `hthd-api.internationalaidesign.com` | Railway |
| Customer App | `hthd.internationalaidesign.com` | Vercel |
| Admin App | `hthd-admin.internationalaidesign.com` | Vercel |

---

## Step 1: Railway Setup (Backend + Database)

### 1.1 Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub → Select `International-AI-Design` account
3. This links your repositories automatically

### 1.2 Create New Project
1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose `International-AI-Design/hthd-loyalty-app`

### 1.3 Add PostgreSQL Database
1. In your project dashboard, click **"New"** → **"Database"** → **"PostgreSQL"**
2. Railway provisions it automatically
3. Click the database service → **"Variables"** tab
4. Copy the `DATABASE_URL` value (starts with `postgresql://...`)

### 1.4 Configure Backend Service
1. Click **"New"** → **"GitHub Repo"** → select `hthd-loyalty-app` again
2. Go to **Settings** → **General**:
   - **Root Directory:** `server`
   - Railway will auto-detect the `railway.toml` config

### 1.5 Set Environment Variables
In the backend service's **Variables** tab, add these (click "New Variable" for each):

```
DATABASE_URL         = ${Postgres.DATABASE_URL}
JWT_SECRET           = [Generate: openssl rand -base64 32]
JWT_EXPIRES_IN       = 7d
PORT                 = 3001
NODE_ENV             = production
GINGR_API_KEY        = [From .env file]
GINGR_SUBDOMAIN      = happytailhappydogllc
RESEND_API_KEY       = [From .env file]
EMAIL_FROM           = Happy Tail Happy Dog <noreply@happytailhappydog.com>
CUSTOMER_APP_URL     = https://hthd.internationalaidesign.com
ADMIN_APP_URL        = https://hthd-admin.internationalaidesign.com
```

**Pro tip:** For DATABASE_URL, you can use Railway's variable reference: `${Postgres.DATABASE_URL}`

### 1.6 Add Custom Domain
1. Go to **Settings** → **Networking** → **Custom Domain**
2. Enter: `hthd-api.internationalaidesign.com`
3. Railway shows the CNAME target (e.g., `something.up.railway.app`)
4. **Write down this CNAME value** - you'll need it for Namecheap

---

## Step 2: Vercel Setup (Frontend Apps)

### 2.1 Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub → Select `International-AI-Design` account

### 2.2 Deploy Customer App
1. Click **"Add New..."** → **"Project"**
2. Import `International-AI-Design/hthd-loyalty-app`
3. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `customer-app`
   - Leave build settings as-is (vercel.json handles it)
4. Add Environment Variable:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://hthd-api.internationalaidesign.com/api`
5. Click **Deploy**

### 2.3 Add Custom Domain (Customer App)
1. After deployment, go to **Project Settings** → **Domains**
2. Add: `hthd.internationalaidesign.com`
3. Vercel shows: `cname.vercel-dns.com` (standard for all Vercel projects)

### 2.4 Deploy Admin App
1. Click **"Add New..."** → **"Project"** (new project, not reimport)
2. Import same repo: `International-AI-Design/hthd-loyalty-app`
3. **Important:** Give it a different project name (e.g., `hthd-admin`)
4. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `admin-app`
5. Add Environment Variable:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://hthd-api.internationalaidesign.com/api`
6. Click **Deploy**

### 2.5 Add Custom Domain (Admin App)
1. Go to **Project Settings** → **Domains**
2. Add: `hthd-admin.internationalaidesign.com`

---

## Step 3: Namecheap DNS Configuration

### 3.1 Access DNS Settings
1. Log in to [namecheap.com](https://namecheap.com)
2. Go to **Domain List** → click **Manage** next to `internationalaidesign.com`
3. Click the **"Advanced DNS"** tab

### 3.2 Add CNAME Records
Add these three records (click "Add New Record"):

| Type  | Host       | Value                      | TTL  |
|-------|------------|----------------------------|------|
| CNAME | hthd-api   | `[Your Railway CNAME]`     | Automatic |
| CNAME | hthd       | cname.vercel-dns.com       | Automatic |
| CNAME | hthd-admin | cname.vercel-dns.com       | Automatic |

**Note:** For "Host", enter only the subdomain (e.g., `hthd-api`), not the full domain.

### 3.3 DNS Propagation
- Usually takes 5-30 minutes
- Can take up to 48 hours in rare cases

---

## Step 4: Verification

### 4.1 Test Backend Health
```bash
curl https://hthd-api.internationalaidesign.com/api/health
```
Expected: `{"status":"ok","message":"Happy Tail Happy Dog API is running"}`

### 4.2 Test Customer App
Open in browser: `https://hthd.internationalaidesign.com`
- Should see the login/claim account page

### 4.3 Test Admin App
Open in browser: `https://hthd-admin.internationalaidesign.com`
- Should see the staff login page

### 4.4 Test Full Flow
1. Go to admin app, log in with staff credentials
2. Go to customer app, try claiming an account
3. Verify email is received (check Resend dashboard if needed)

---

## Troubleshooting

### CORS Errors
If you see CORS errors in browser console:
- Verify `CUSTOMER_APP_URL` and `ADMIN_APP_URL` match exactly (including `https://`)
- Redeploy the Railway service after changing env vars

### Database Connection Issues
- Check Railway logs for connection errors
- Verify `DATABASE_URL` is set correctly (use variable reference)

### Build Failures
- Check Railway/Vercel build logs
- Ensure `npm install` runs successfully
- Prisma requires `prisma generate` before build

### SSL Certificate Errors
- Wait for certificate provisioning (can take 10-15 minutes)
- Both Railway and Vercel handle SSL automatically

---

## Future: Migration to happytailhappydog.com

When DNS access to the permanent domain is available:

1. **Add new domains** in Railway and Vercel (keep old ones active)
2. **Configure DNS** at the new registrar:
   - `api.happytailhappydog.com` → Railway CNAME
   - `app.happytailhappydog.com` → cname.vercel-dns.com
   - `admin.happytailhappydog.com` → cname.vercel-dns.com
3. **Update environment variables:**
   - Railway: `CUSTOMER_APP_URL`, `ADMIN_APP_URL`
   - Vercel: `VITE_API_URL` on both apps
4. **Test everything** on new domains
5. **Remove old subdomains** after confirming everything works

---

## Monthly Costs

| Service | Cost |
|---------|------|
| Railway (Hobby plan) | ~$5 + usage |
| Vercel (Free tier) | $0 |
| Resend (Free tier) | $0 |
| Namecheap domain | ~$1/month |
| **Total** | **~$6-10/month** |
