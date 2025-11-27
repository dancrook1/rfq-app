# Deployment Guide

## Pushing to GitHub

### 1. Initialize Git Repository (if not already done)
```bash
git init
```

### 2. Add All Files
```bash
git add .
```

### 3. Create Initial Commit
```bash
git commit -m "Initial commit: RFQ Management App"
```

### 4. Create GitHub Repository
1. Go to [GitHub.com](https://github.com) and sign in
2. Click the "+" icon in the top right → "New repository"
3. Name your repository (e.g., "rfq-app")
4. Choose public or private
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

### 5. Connect Local Repository to GitHub
```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
```

Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your actual GitHub username and repository name.

### 6. Push to GitHub
```bash
git branch -M main
git push -u origin main
```

## Deploying to Production

### Option 1: Vercel (Recommended for Next.js)

1. **Push your code to GitHub** (follow steps above)

2. **Deploy to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Sign in with your GitHub account
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js settings

3. **Configure Environment Variables:**
   - In Vercel project settings, go to "Environment Variables"
   - Add: `DEAR_INVENTORY_ENCRYPTION_KEY` (use a secure random string)
   - Add any other environment variables you need

4. **Database Setup:**
   - For production, you'll need a PostgreSQL database (Vercel Postgres, Supabase, or Railway)
   - Update `prisma/schema.prisma` datasource to use PostgreSQL
   - Run migrations: `npx prisma migrate deploy`

### Option 2: Other Hosting Options

- **Railway**: Good for full-stack apps with database
- **Render**: Supports Next.js and databases
- **DigitalOcean App Platform**: Full control with database options
- **AWS/Google Cloud/Azure**: Enterprise solutions

## Important Notes

### Before Deploying:

1. **Environment Variables:**
   - Never commit `.env` files (already in .gitignore)
   - Set up environment variables in your hosting platform
   - Required: `DEAR_INVENTORY_ENCRYPTION_KEY`

2. **Database:**
   - SQLite (dev.db) is fine for development
   - For production, use PostgreSQL or another production database
   - Update `prisma/schema.prisma` datasource URL

3. **Build Command:**
   - Vercel automatically runs `npm run build`
   - Make sure all dependencies are in `package.json`

4. **API Keys:**
   - Dear Inventory API credentials should be set in environment variables
   - Never commit API keys to GitHub

## Quick Deploy Commands

```bash
# Initialize and push to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main

# Then deploy to Vercel via their website or CLI:
npm i -g vercel
vercel
```

