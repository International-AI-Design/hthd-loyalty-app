# Session Archive: Deployment Attempt
**Date:** 2026-01-23

## Summary
Attempted to deploy HTHD loyalty app to Railway (backend) + Vercel (frontends). Hit issues with Railway's monorepo detection and build configuration. Deleted Railway project to start fresh.

## What Was Accomplished

### Code Changes (Committed & Pushed)
- `server/railway.toml` - Railway build/deploy config
- `customer-app/vercel.json` - Vercel SPA routing + security headers
- `admin-app/vercel.json` - Vercel SPA routing + security headers
- `DEPLOYMENT.md` - Step-by-step deployment guide

### Generated Secrets (SAVE THESE)
```
JWT_SECRET = gj60B1dxSQ6wAZOlDKiEg6BkREt9TtVQokis2blsnoQ=
```

## Current State
- **GitHub repo:** Up to date with deployment configs
- **Railway:** Project deleted, account exists at railway.app (linked to International-AI-Design GitHub)
- **Vercel:** Account not yet created
- **Namecheap DNS:** No changes made yet

## Resume Instructions

### Option A: Retry Railway
1. Create new Railway project
2. Add PostgreSQL database FIRST
3. Then add GitHub repo with root directory `server`
4. Add environment variables
5. If build issues persist, may need to add a Dockerfile

### Option B: Try Render.com Instead
Similar to Railway but sometimes friendlier with monorepos:
1. Create account at render.com
2. New Web Service → Connect GitHub
3. Set root directory to `server`
4. Render auto-detects Node.js

### Environment Variables Needed (Backend)
```
DATABASE_URL         = [from database service]
JWT_SECRET           = gj60B1dxSQ6wAZOlDKiEg6BkREt9TtVQokis2blsnoQ=
JWT_EXPIRES_IN       = 7d
PORT                 = 3001
NODE_ENV             = production
GINGR_API_KEY        = dce3b064ad55c8bde4e1f24f31bc885a
GINGR_SUBDOMAIN      = happytailhappydogllc
RESEND_API_KEY       = re_7wt5nTF4_GgeDNRtHSWR7Hx4RMC4VY595
EMAIL_FROM           = Happy Tail Happy Dog <noreply@happytailhappydog.com>
CUSTOMER_APP_URL     = https://hthd.internationalaidesign.com
ADMIN_APP_URL        = https://hthd-admin.internationalaidesign.com
```

### Domain Strategy
**Temporary (internationalaidesign.com):**
- `hthd-api.internationalaidesign.com` → Backend API
- `hthd.internationalaidesign.com` → Customer app
- `hthd-admin.internationalaidesign.com` → Admin app

**Permanent (later):**
- `api.happytailhappydog.com`
- `app.happytailhappydog.com`
- `admin.happytailhappydog.com`

## Issues Encountered
1. Railway auto-deployed before configuration was complete
2. Root directory setting wasn't obvious in UI
3. Build failed with "Error creating build plan with Railpack"
4. Then "script start.sh not found"
5. Then "failed to exec pid1: No such file or directory"

Root cause likely: Railway's auto-detection struggling with the monorepo structure. May need explicit Dockerfile or different platform.

## Files Reference
- Full deployment guide: `DEPLOYMENT.md` at project root
- Railway config: `server/railway.toml`
- Vercel configs: `customer-app/vercel.json`, `admin-app/vercel.json`
