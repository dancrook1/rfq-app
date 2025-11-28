# GitHub Setup Instructions

Your code has been committed locally. Follow these steps to push to GitHub:

## Step 1: Create GitHub Repository

1. Go to [github.com](https://github.com) and sign in
2. Click the **"+"** icon in the top right → **"New repository"**
3. Fill in:
   - **Repository name**: `rfq-app` (or your preferred name)
   - **Description**: "RFQ Management System for supplier quotations"
   - **Visibility**: Choose Public or Private
   - **DO NOT** check "Initialize with README" (we already have one)
4. Click **"Create repository"**

## Step 2: Connect and Push

After creating the repository, GitHub will show you commands. Use these:

```bash
# Add your GitHub repository as remote (replace YOUR_USERNAME and YOUR_REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push to GitHub
git push -u origin main
```

**Example:**
If your username is `johndoe` and repo name is `rfq-app`:
```bash
git remote add origin https://github.com/johndoe/rfq-app.git
git push -u origin main
```

## Step 3: Verify

1. Go to your GitHub repository page
2. You should see all your files
3. The commit message should be: "Initial commit: RFQ Management App with cPanel deployment support"

## Troubleshooting

### If you get "remote origin already exists":
```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
```

### If you need to authenticate:
- GitHub may ask for your username and password
- For password, use a **Personal Access Token** (not your GitHub password)
- Create one at: https://github.com/settings/tokens

### If push is rejected:
```bash
git pull origin main --allow-unrelated-histories
git push -u origin main
```

## Next Steps After Pushing

Once pushed to GitHub, you can:
- Deploy to cPanel using the repository
- Set up CI/CD pipelines
- Collaborate with team members
- Use GitHub Actions for automated deployments

