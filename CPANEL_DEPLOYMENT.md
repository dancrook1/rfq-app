# cPanel Deployment Guide

This guide will help you deploy your RFQ Management App to a cPanel hosting environment.

## Prerequisites

- cPanel hosting account with Node.js support
- SSH access (recommended) or cPanel File Manager
- MySQL database (if switching from SQLite)

## Step 1: Prepare Your Project

### Option A: Keep SQLite (Simpler, but less scalable)
- SQLite works fine for smaller deployments
- No database migration needed
- Database file will be stored in your app directory

### Option B: Switch to MySQL (Recommended for production)
1. Create a MySQL database in cPanel
2. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "mysql"
     url      = env("DATABASE_URL")
   }
   ```
3. Update your `.env` file with the MySQL connection string:
   ```
   DATABASE_URL="mysql://username:password@localhost:3306/database_name"
   ```

## Step 2: Upload Files to cPanel

### Method 1: Using Git (Recommended)
1. Push your code to GitHub (see DEPLOYMENT.md)
2. In cPanel, go to "Git Version Control"
3. Clone your repository
4. Navigate to the cloned directory

### Method 2: Using File Manager
1. Create a folder in `public_html` (e.g., `rfq-app`)
2. Upload all project files via File Manager or FTP
3. **Exclude**: `node_modules`, `.next`, `dev.db` (upload these separately if needed)

## Step 3: Set Up Node.js App in cPanel

1. **Navigate to Node.js App**:
   - In cPanel, find "Node.js" or "Setup Node.js App"
   - Click "Create Application"

2. **Configure the Application**:
   - **Node.js Version**: Select 18.x or higher
   - **Application Mode**: Production
   - **Application Root**: `/home/username/rfq-app` (or your folder path)
   - **Application URL**: Choose your domain/subdomain
   - **Application Startup File**: `server.js` (we'll create this)
   - **Application Entry Point**: Leave blank or set to `server.js`

3. **Environment Variables**:
   Add these in the Node.js App settings:
   ```
   NODE_ENV=production
   PORT=3000
   DEAR_INVENTORY_ENCRYPTION_KEY=your-secure-encryption-key
   DATABASE_URL=file:./prisma/prod.db (for SQLite)
   ```
   Or for MySQL:
   ```
   DATABASE_URL=mysql://username:password@localhost:3306/database_name
   ```

## Step 4: Create Startup Script

Create a `server.js` file in your project root:

```javascript
const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = process.env.PORT || 3000

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  }).listen(port, (err) => {
    if (err) throw err
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})
```

## Step 5: Install Dependencies and Build

### Via SSH (Recommended):
```bash
cd ~/rfq-app  # or your app directory
npm install
npm run build
npx prisma generate
npx prisma db push  # or migrate for MySQL
```

### Via cPanel Terminal:
1. Open Terminal in cPanel
2. Navigate to your app directory
3. Run the same commands above

## Step 6: Start the Application

1. In cPanel Node.js App settings, click "Restart App"
2. The app should start on port 3000
3. Check the logs for any errors

## Step 7: Configure Apache (If Needed)

If your cPanel uses Apache and you need custom routing:

1. The `.htaccess` file is already included
2. Make sure mod_rewrite and mod_proxy are enabled
3. You may need to contact your host to enable these modules

## Step 8: Database Setup

### For SQLite:
- The database file will be created automatically
- Make sure the `prisma` folder has write permissions
- Database location: `prisma/prod.db`

### For MySQL:
1. Create database in cPanel MySQL section
2. Update `DATABASE_URL` environment variable
3. Run migrations:
   ```bash
   npx prisma migrate deploy
   ```

## Troubleshooting

### App Won't Start:
- Check Node.js version (needs 18+)
- Check logs in cPanel Node.js section
- Verify all environment variables are set
- Ensure port 3000 is available

### Database Errors:
- Check database connection string
- Verify database user has proper permissions
- For SQLite: Check file permissions on `prisma` folder

### Build Errors:
- Ensure all dependencies are installed
- Check Node.js version compatibility
- Review build logs for specific errors

### Routing Issues:
- Verify `.htaccess` is in the root directory
- Check Apache mod_rewrite is enabled
- Consider using subdomain instead of subdirectory

## Production Checklist

- [ ] Environment variables set in cPanel
- [ ] Database configured and migrated
- [ ] Application built successfully
- [ ] Node.js app started and running
- [ ] Test all major features
- [ ] Verify API endpoints work
- [ ] Check file permissions
- [ ] Set up SSL certificate (if needed)

## Maintenance

### Updating the App:
1. Pull latest changes from Git (or upload new files)
2. Run `npm install` to update dependencies
3. Run `npm run build` to rebuild
4. Restart the Node.js app in cPanel

### Database Backups:
- For SQLite: Backup `prisma/prod.db` file
- For MySQL: Use cPanel's backup tools or phpMyAdmin

## Support

If you encounter issues:
1. Check cPanel error logs
2. Check Node.js application logs
3. Verify all environment variables
4. Test locally first before deploying

