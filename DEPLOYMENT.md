# Deployment & Hosting Guide

This guide covers how to deploy your accounting application for production use.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Deployment Options](#deployment-options)
4. [Security Checklist](#security-checklist)
5. [Database Backups](#database-backups)
6. [Monetization Setup](#monetization-setup)

---

## Prerequisites

### Required
- Node.js 18+ (LTS recommended)
- npm or yarn
- Domain name (for production)
- SSL certificate (Let's Encrypt is free)

### Recommended
- Reverse proxy (nginx, Caddy)
- Process manager (PM2, systemd)
- Monitoring (uptime, errors)

---

## Environment Configuration

### Backend (.env)

Create `backend/.env` with production values:

```env
# Server
PORT=4000
NODE_ENV=production

# SECURITY - CHANGE THESE!
JWT_SECRET=your-very-long-random-secret-at-least-32-characters
WEBHOOK_SECRET=another-random-secret-for-webhooks

# Database
DATABASE_PATH=./data/production.db

# Default org (for first user registration)
DEFAULT_ORG=your-company
DEFAULT_CURRENCY=USD

# Optional: External APIs
COINGECKO_API_KEY=your-api-key-if-needed
```

**Generate secure secrets:**
```bash
# JWT Secret (run this twice for two different secrets)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Frontend (.env)

Create `frontend/.env`:

```env
VITE_API_BASE_URL=https://api.yourdomain.com
```

---

## Deployment Options

### Option 1: VPS (DigitalOcean, Linode, Vultr)

**Best for:** Full control, cost-effective for small teams

**Cost:** ~$5-12/month

```bash
# 1. SSH into your server
ssh user@your-server

# 2. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Clone your repo
git clone https://github.com/yourrepo/accounting-app.git
cd accounting-app

# 4. Install dependencies
cd backend && npm install --production
cd ../frontend && npm install && npm run build

# 5. Install PM2 for process management
sudo npm install -g pm2

# 6. Start the backend
cd ../backend
pm2 start npm --name "accounting-api" -- start
pm2 save
pm2 startup

# 7. Set up nginx reverse proxy
sudo apt install nginx
```

**Nginx config (`/etc/nginx/sites-available/accounting`):**

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 443 ssl http2;
    server_name app.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/app.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.yourdomain.com/privkey.pem;

    root /var/www/accounting-frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**SSL with Certbot:**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com -d app.yourdomain.com
```

---

### Option 2: Docker Compose

**Best for:** Easy deployment, reproducible environments

Create `docker-compose.yml` in project root:

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - WEBHOOK_SECRET=${WEBHOOK_SECRET}
    volumes:
      - ./data:/app/data
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/nginx/certs
    depends_on:
      - backend
      - frontend
    restart: unless-stopped
```

**Backend Dockerfile (`backend/Dockerfile`):**

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
EXPOSE 4000
CMD ["npm", "start"]
```

**Frontend Dockerfile (`frontend/Dockerfile`):**

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Deploy:**
```bash
docker-compose up -d --build
```

---

### Option 3: Railway / Render / Fly.io

**Best for:** Quick deployment, managed infrastructure

**Cost:** Free tier available, ~$5-25/month for production

**Railway:**
1. Connect your GitHub repo
2. Add environment variables in dashboard
3. Deploy automatically on push

**Render:**
1. Create Web Service for backend
2. Create Static Site for frontend
3. Add environment variables

---

### Option 4: Self-hosted with Coolify

**Best for:** Teams who want control without complexity

[Coolify](https://coolify.io) is a self-hosted Heroku/Netlify alternative.

1. Install Coolify on your VPS
2. Connect your Git repository
3. Configure environment variables
4. Deploy with one click

---

## Security Checklist

### Must Do (Critical)

- [ ] **Change JWT_SECRET** - Use a cryptographically random 64+ character string
- [ ] **Enable HTTPS** - Never run without SSL in production
- [ ] **Set NODE_ENV=production** - Disables debug features
- [ ] **Use strong passwords** - Enforce minimum 8 characters
- [ ] **Backup database** - Set up automated backups

### Should Do (Recommended)

- [ ] **Rate limiting** - Prevent brute force attacks
- [ ] **CORS configuration** - Only allow your frontend domain
- [ ] **HTTP security headers** - Use helmet.js
- [ ] **Input validation** - Already using Zod, ensure coverage
- [ ] **Audit logging** - Already implemented, review regularly
- [ ] **Two-factor authentication** - MFA stub exists, implement TOTP

### Nice to Have

- [ ] **IP allowlisting** - For internal apps
- [ ] **VPN access** - For sensitive deployments
- [ ] **Penetration testing** - Annual security audit
- [ ] **SOC 2 compliance** - For enterprise clients

---

## Database Backups

### Automated SQLite Backups

Create `backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/backups/accounting"
DB_PATH="/app/data/production.db"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
sqlite3 $DB_PATH ".backup '$BACKUP_DIR/backup_$DATE.db'"

# Keep last 30 days
find $BACKUP_DIR -name "*.db" -mtime +30 -delete
```

**Add to cron:**
```bash
0 2 * * * /path/to/backup.sh
```

### Cloud Backup (S3/R2)

```bash
#!/bin/bash
# After local backup
aws s3 cp /backups/accounting/backup_$DATE.db s3://your-bucket/backups/
```

---

## Monetization Setup

### Option 1: Subscription Model (Stripe)

1. Create Stripe account
2. Set up Products and Prices:
   - **Starter:** $29/month - 3 users, basic features
   - **Professional:** $79/month - 10 users, all features
   - **Enterprise:** Custom - unlimited users, support

3. Integrate Stripe Checkout:

```typescript
// backend/src/routes/billing.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

router.post('/create-checkout', async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{
      price: req.body.priceId,
      quantity: 1,
    }],
    success_url: `${process.env.FRONTEND_URL}/billing/success`,
    cancel_url: `${process.env.FRONTEND_URL}/billing/cancel`,
  });
  res.json({ url: session.url });
});
```

### Option 2: Per-Seat Pricing

Track active users per organization and bill accordingly.

### Option 3: Feature-based Tiers

- Free: Manual entry only
- Pro: Crypto support, bank integrations
- Enterprise: Custom formulas, API access, audit reports

---

## Quick Start Commands

```bash
# Development
cd backend && npm run dev
cd frontend && npm run dev

# Production build
cd backend && npm run build
cd frontend && npm run build

# Start production
cd backend && npm start

# Docker
docker-compose up -d --build

# View logs
pm2 logs accounting-api
docker-compose logs -f
```

---

## Support

For issues:
1. Check the logs: `pm2 logs` or `docker-compose logs`
2. Verify environment variables
3. Ensure database file permissions
4. Check network/firewall rules

---

*Last updated: December 2024*



