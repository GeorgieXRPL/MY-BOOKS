# Deployment & Hosting Guide

This guide covers how to deploy your accounting application using the **Simple Stack**:

| Service | Purpose | Cost |
|---------|---------|------|
| **Supabase** | PostgreSQL Database | Free tier (500MB) |
| **Render** | Backend Hosting | Free tier / ~$7/mo |
| **Vercel** | Frontend Hosting | Free tier |
| **Cloudflare R2** | File Storage (OCR) | Free tier (10GB) |
| **Upstash** | Redis Cache | Free tier (10K/day) |

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Phase 1: Database Setup (Supabase)](#phase-1-database-setup-supabase)
3. [Phase 2: Backend Deployment (Render)](#phase-2-backend-deployment-render)
4. [Phase 3: Frontend Deployment (Vercel)](#phase-3-frontend-deployment-vercel)
5. [Phase 4: Connect Frontend to Backend](#phase-4-connect-frontend-to-backend)
6. [Phase 5: Optional Services](#phase-5-optional-services)
7. [Testing Your Deployment](#testing-your-deployment)
8. [Environment Variables Reference](#environment-variables-reference)
9. [Troubleshooting](#troubleshooting)
10. [Security Checklist](#security-checklist)
11. [Local Development](#local-development)

---

## Quick Start

If you already have accounts set up, here's the TL;DR:

```bash
# Generate secrets (run twice)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Render Environment Variables:**
```env
DATABASE_URL=postgresql://postgres.xxx:[PASSWORD]@aws-0-xx.pooler.supabase.com:5432/postgres
NODE_ENV=production
JWT_SECRET=<64-char-secret>
WEBHOOK_SECRET=<another-secret>
ALLOWED_ORIGINS=https://your-app.vercel.app
```

**Vercel Environment Variable:**
```env
VITE_API_BASE_URL=https://your-app.onrender.com
```

---

## Phase 1: Database Setup (Supabase)

### Step 1.1: Create Supabase Account

1. Go to [supabase.com](https://supabase.com)
2. Click **"Start your project"**
3. Sign up with GitHub (recommended) or email

### Step 1.2: Create a New Project

1. Click **"New Project"**
2. Fill in:
   - **Name:** `reporting-software`
   - **Database Password:** Click "Generate" → **SAVE THIS PASSWORD!**
   - **Region:** Choose closest to your users (e.g., US East, EU West)
3. Click **"Create new project"**
4. Wait 1-2 minutes for setup

### Step 1.3: Get Your Connection String

**Method A: Via Connect Button (Easiest)**
1. In your project dashboard, click the **"Connect"** button (top right)
2. Select **"URI"** tab
3. Copy the connection string
4. Replace `[YOUR-PASSWORD]` with the password you saved

**Method B: Via Project Settings**
1. Click the **⚙️ Settings** icon (bottom of left sidebar)
2. Click **"Database"** in the menu
3. Scroll to **"Connection string"** section
4. Select the **"URI"** tab
5. Copy and replace `[YOUR-PASSWORD]`

**Your connection string looks like:**
```
postgresql://postgres.abcdefghij:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

**⚠️ Important:** 
- Use the **pooler** connection (6543) for production
- Save this string securely - you'll need it for Render

### Step 1.4: Forgot Your Password?

1. Go to **Settings** → **Database**
2. Click **"Reset database password"**
3. Generate and save the new password
4. Update your connection string

---

## Phase 2: Backend Deployment (Render)

### Step 2.1: Create Render Account

1. Go to [render.com](https://render.com)
2. Click **"Get Started for Free"**
3. Sign up with GitHub (recommended for auto-deploy)

### Step 2.2: Create a New Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Select the repository containing your reporting software

### Step 2.3: Configure Build Settings

| Setting | Value |
|---------|-------|
| **Name** | `reporting-api` (or your preference) |
| **Region** | Same as Supabase (e.g., Ohio, Frankfurt) |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | Free (or Starter $7/mo for production) |

### Step 2.4: Add Environment Variables

Click **"Advanced"** → **"Add Environment Variable"**

**Required Variables:**

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `DATABASE_URL` | `postgresql://postgres.xxx:[PASSWORD]@...` (from Supabase) |
| `JWT_SECRET` | Generate with command below |
| `WEBHOOK_SECRET` | Generate with command below |
| `PRICE_PROVIDER` | `coingecko` |
| `DEFAULT_CURRENCY` | `USD` |

**Generate Secrets:**
```bash
# Run this twice - once for JWT_SECRET, once for WEBHOOK_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Step 2.5: Deploy

1. Click **"Create Web Service"**
2. Wait for build (3-5 minutes first time)
3. Once deployed, you'll get a URL like:
   ```
   https://reporting-api-xxxx.onrender.com
   ```
4. **Save this URL!** You'll need it for the frontend.

### Step 2.6: Verify Backend is Running

Visit: `https://your-app.onrender.com/health`

You should see:
```json
{"status":"ok","timestamp":"2024-12-18T..."}
```

---

## Phase 3: Frontend Deployment (Vercel)

### Step 3.1: Create Vercel Account

1. Go to [vercel.com](https://vercel.com)
2. Click **"Sign Up"**
3. Sign up with GitHub

### Step 3.2: Import Your Project

1. Click **"Add New..."** → **"Project"**
2. Import your GitHub repository
3. Click **"Import"**

### Step 3.3: Configure Build Settings

| Setting | Value |
|---------|-------|
| **Framework Preset** | `Vite` |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

### Step 3.4: Add Environment Variable

Expand **"Environment Variables"** and add:

| Key | Value |
|-----|-------|
| `VITE_API_BASE_URL` | `https://your-app.onrender.com` |

**⚠️ No trailing slash!** ✅ `https://api.com` ❌ `https://api.com/`

### Step 3.5: Deploy

1. Click **"Deploy"**
2. Wait 1-2 minutes
3. Get your frontend URL:
   ```
   https://your-app.vercel.app
   ```

---

## Phase 4: Connect Frontend to Backend

### Step 4.1: Update CORS on Render

Go back to Render → your service → **Environment**

Add or update:
```
ALLOWED_ORIGINS=https://your-app.vercel.app
```

Multiple origins (include localhost for development):
```
ALLOWED_ORIGINS=https://your-app.vercel.app,http://localhost:5173
```

Render will auto-redeploy.

### Step 4.2: Test the Connection

1. Go to your Vercel frontend URL
2. You should see the login page
3. Try registering a new account
4. If successful, check Supabase → Table Editor → `users` table

---

## Phase 5: Optional Services

These unlock additional features. Add them as needed.

### 5A: OpenAI (OCR + AI Chatbot)

**Required for:** Invoice scanning, AI assistant

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up / Log in
3. Go to **API Keys** → **Create new secret key**
4. Add to Render:
   ```
   OPENAI_API_KEY=sk-proj-...
   ```

### 5B: Alchemy (EVM Blockchain Data)

**Required for:** Ethereum, Polygon, Arbitrum TX auto-population

1. Go to [alchemy.com](https://www.alchemy.com)
2. Sign up → Create App (Ethereum Mainnet)
3. Copy API key
4. Add to Render:
   ```
   ALCHEMY_API_KEY=your-key
   ```

### 5C: Helius (Solana Data)

**Required for:** Solana TX auto-population

1. Go to [helius.dev](https://www.helius.dev)
2. Sign up → Get API key
3. Add to Render:
   ```
   HELIUS_API_KEY=your-key
   ```

### 5D: Cloudflare R2 (File Storage)

**Required for:** Storing uploaded invoice images

1. Go to [cloudflare.com](https://cloudflare.com) → Sign up
2. Dashboard → **R2** → **Create bucket**
3. Name: `reporting-uploads`
4. **R2** → **Manage R2 API Tokens** → **Create API token**
5. Permissions: Object Read & Write
6. Add to Render:
   ```
   R2_ACCOUNT_ID=your-account-id
   R2_ACCESS_KEY_ID=your-access-key
   R2_SECRET_ACCESS_KEY=your-secret-key
   R2_BUCKET_NAME=reporting-uploads
   ```

### 5E: Upstash Redis (Caching)

**Required for:** Report caching, improved performance

1. Go to [upstash.com](https://upstash.com) → Sign up
2. Create a new Redis database
3. Choose region near your Render deployment
4. Copy REST URL and Token
5. Add to Render:
   ```
   UPSTASH_REDIS_URL=https://xxx.upstash.io
   UPSTASH_REDIS_TOKEN=your-token
   ```

---

## Testing Your Deployment

### Health Checks

| Endpoint | Expected Response |
|----------|-------------------|
| `GET /health` | `{"status":"ok"}` |
| `GET /invoices/ocr/status` | `{"configured":true/false}` |
| `GET /chat/status` | `{"available":true/false}` |

### Functional Tests

1. **Register a new user** - Check user appears in Supabase
2. **Create an account** - Go to Ledger → Add Account
3. **Create a journal entry** - Go to Journals → Create Entry
4. **Run a report** - Go to Reports → Balance Sheet
5. **Test blockchain lookup** (if configured) - Ingestion → Paste TX hash

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Blank page | Frontend can't reach API | Check `VITE_API_BASE_URL` |
| 401 errors | CORS blocking | Add frontend URL to `ALLOWED_ORIGINS` |
| 500 errors | Database issue | Check `DATABASE_URL` in Render logs |
| Tables missing | Migration didn't run | Check Render deploy logs for errors |

---

## Environment Variables Reference

### Backend (Render)

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | ✅ | Set to `production` |
| `PORT` | ✅ | `4000` |
| `DATABASE_URL` | ✅ | Supabase PostgreSQL URI |
| `JWT_SECRET` | ✅ | 64+ character random string |
| `WEBHOOK_SECRET` | ✅ | Random string for webhook signing |
| `ALLOWED_ORIGINS` | ✅ | Frontend URLs (comma-separated) |
| `PRICE_PROVIDER` | | `coingecko` (default) |
| `DEFAULT_CURRENCY` | | `USD` (default) |
| `OPENAI_API_KEY` | | For OCR and AI chatbot |
| `ALCHEMY_API_KEY` | | For EVM blockchain data |
| `HELIUS_API_KEY` | | For Solana data |
| `R2_ACCOUNT_ID` | | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | | R2 access key |
| `R2_SECRET_ACCESS_KEY` | | R2 secret key |
| `R2_BUCKET_NAME` | | R2 bucket name |
| `UPSTASH_REDIS_URL` | | Redis URL for caching |
| `UPSTASH_REDIS_TOKEN` | | Redis auth token |
| `ADMIN_IP_ALLOWLIST` | | IPs allowed to access /admin |

### Frontend (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_BASE_URL` | ✅ | Backend URL (no trailing slash) |

---

## Troubleshooting

### "502 Bad Gateway" on Render

1. Go to Render Dashboard → Your Service → **Logs**
2. Look for error messages
3. Common causes:
   - Wrong `DATABASE_URL`
   - Missing required env vars
   - Build failed

### "Failed to fetch" in Browser Console

1. Open browser DevTools → Network tab
2. Check if requests are going to correct URL
3. Verify `VITE_API_BASE_URL` is set in Vercel
4. Redeploy frontend after changing env vars

### Database Tables Not Created

1. Check Render logs for migration output
2. Look for "Running migrations..." message
3. If missing, the app may have failed to start
4. Verify `DATABASE_URL` format is correct

### CORS Errors

Error: `Access to fetch at 'X' from origin 'Y' has been blocked by CORS`

1. Add your frontend URL to `ALLOWED_ORIGINS` on Render
2. Include the full URL with `https://`
3. No trailing slash
4. Wait for Render to redeploy

### Render Free Tier Spin-Down

Free tier services sleep after 15 minutes of inactivity.

- First request after sleep takes ~30 seconds
- Consider upgrading to Starter ($7/mo) for always-on
- Or use a service like [UptimeRobot](https://uptimerobot.com) to ping every 14 minutes

---

## Security Checklist

### Must Do (Before Going Live)

- [ ] Generate unique `JWT_SECRET` (64+ characters)
- [ ] Generate unique `WEBHOOK_SECRET`
- [ ] Set `NODE_ENV=production`
- [ ] Configure `ALLOWED_ORIGINS` (only your domains)
- [ ] Use HTTPS (automatic on Render/Vercel)
- [ ] Create strong admin password

### Should Do (Recommended)

- [ ] Set up `ADMIN_IP_ALLOWLIST` for admin panel
- [ ] Configure API keys for programmatic access
- [ ] Enable Redis caching for performance
- [ ] Set up monitoring (Render has built-in metrics)
- [ ] Review audit logs regularly

### Nice to Have

- [ ] Custom domain for frontend
- [ ] Custom domain for API
- [ ] Implement MFA for admin users
- [ ] Set up database backups (Supabase Pro)

---

## Local Development

### Backend

```bash
cd backend

# Create environment file
cp ENV_EXAMPLE.txt .env

# Edit .env - leave DATABASE_URL empty for SQLite
nano .env

# Install and run
npm install
npm run dev
```

### Frontend

```bash
cd frontend

# Create environment file
echo "VITE_API_BASE_URL=http://localhost:4000" > .env

# Install and run
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Infrastructure Summary

After setup, your infrastructure looks like:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Vercel      │────▶│     Render      │────▶│    Supabase     │
│   (Frontend)    │     │   (Backend)     │     │  (PostgreSQL)   │
│  your-app.      │     │  your-api.      │     │                 │
│  vercel.app     │     │  onrender.com   │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │ OpenAI   │ │ Alchemy  │ │ Upstash  │
              │ (AI/OCR) │ │ (Crypto) │ │ (Cache)  │
              └──────────┘ └──────────┘ └──────────┘
```

---

## Support

For issues:
1. Check Render logs: Dashboard → Service → Logs
2. Check Vercel logs: Dashboard → Project → Deployments → View Logs
3. Check Supabase: Dashboard → Logs
4. Verify all environment variables are set correctly

---

*Last updated: December 2024*
