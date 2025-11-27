# Quick Fix for Build Error

## Error Message:
```
Error: ENOENT: no such file or directory, open '/home/beeeabe1/rfq.wired2fire.co.uk/.next/BUILD_ID'
```

## Solution:

The app needs to be **built** before it can start. Run these commands via SSH or cPanel Terminal:

```bash
cd ~/rfq.wired2fire.co.uk
npm run build
```

Then restart your Node.js app in cPanel.

## Full Setup Commands (if starting fresh):

```bash
# Navigate to your app directory
cd ~/rfq.wired2fire.co.uk

# Install dependencies (if not done)
npm install

# Generate Prisma client
npx prisma generate

# Build the Next.js application (REQUIRED!)
npm run build

# Set up database
npx prisma db push

# Now restart the app in cPanel Node.js settings
```

## Verify Build:

After building, check that these exist:
- `.next` folder
- `.next/BUILD_ID` file
- `.next/standalone` folder (if using standalone output)

## After Building:

1. Go to cPanel → Node.js App
2. Click "Restart App"
3. Check logs to verify it's running

