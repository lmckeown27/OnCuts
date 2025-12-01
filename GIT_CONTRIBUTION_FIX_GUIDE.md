# 🔧 Git Contribution Fix Guide

**How to Fix GitHub Contributions Not Showing Up**

> **Common Problem:** You're committing code but your GitHub contribution graph stays empty.  
> **Root Cause:** Git email doesn't match your GitHub verified email.  
> **Solution:** Follow this guide to fix it!

---

## 📋 Table of Contents

1. [Quick Diagnosis](#quick-diagnosis)
2. [Fix for Future Commits](#fix-for-future-commits)
3. [Fix Past Commits](#fix-past-commits)
4. [Verification Steps](#verification-steps)
5. [Common Scenarios](#common-scenarios)
6. [Troubleshooting](#troubleshooting)

---

## 🔍 Quick Diagnosis

### **Step 1: Check Your Current Git Config**

```bash
# Check your Git email
git config user.email

# Check your Git name
git config user.name

# Check global config (applies to all repos)
git config --global user.email
git config --global user.name
```

### **Step 2: Check Your GitHub Verified Emails**

1. Go to: https://github.com/settings/emails
2. Note all **verified** email addresses
3. Your Git email **MUST** match one of these

### **Step 3: Check Recent Commit Author**

```bash
# View last commit's author
git log -1 --format='%an <%ae>'

# Should show:
# Your Name <your-verified-email@example.com>
```

**❌ Bad Examples:**
```
Your GitHub Username <your-email@example.com>
username <noreply@github.com>
user <user@localhost>
```

**✅ Good Example:**
```
Liam McKeown <liam.mckeown38415@gmail.com>
```

---

## ✅ Fix for Future Commits

### **Option A: Global Config (Recommended)**

Set your email **once for all repositories**:

```bash
# Replace with your actual GitHub verified email
git config --global user.email "your-verified-email@example.com"
git config --global user.name "Your Real Name"
```

**Verify it worked:**
```bash
git config --global --list | grep user
```

**Pros:**
- ✅ Set once, works everywhere
- ✅ Never have to think about it again
- ✅ All new repos automatically configured

**When to use:** Almost always (99% of cases)

### **Option B: Per-Repository Config**

Set email **only for current repository**:

```bash
cd /path/to/your/repo

# Set for this repo only
git config user.email "your-verified-email@example.com"
git config user.name "Your Real Name"
```

**Verify it worked:**
```bash
git config --list | grep user
```

**Pros:**
- ✅ Different emails for different projects
- ✅ Useful for work vs personal repos

**When to use:**
- Work projects (use work email)
- Personal projects (use personal email)
- Contributing to open source (use public email)

---

## 🔄 Fix Past Commits

### **Scenario 1: Fix ONLY the Most Recent Commit**

If you just made 1 commit with the wrong email:

```bash
# First, fix your config (if not done already)
git config user.email "your-verified-email@example.com"
git config user.name "Your Real Name"

# Amend the last commit with correct author
git commit --amend --reset-author --no-edit

# Force push to GitHub
git push --force origin main
```

**Note:** Use `--force` carefully. Only do this on branches you own.

---

### **Scenario 2: Fix ALL Past Commits (Entire History)**

If you've made many commits with the wrong email:

```bash
# 1. First, ensure your current config is correct
git config user.email "your-verified-email@example.com"
git config user.name "Your Real Name"

# 2. Rewrite entire Git history
git filter-branch -f --env-filter '
CORRECT_NAME="Your Real Name"
CORRECT_EMAIL="your-verified-email@example.com"

# Match your OLD incorrect email here
OLD_EMAIL="your-email@example.com"

if [ "$GIT_COMMITTER_EMAIL" = "$OLD_EMAIL" ]
then
    export GIT_COMMITTER_NAME="$CORRECT_NAME"
    export GIT_COMMITTER_EMAIL="$CORRECT_EMAIL"
fi
if [ "$GIT_AUTHOR_EMAIL" = "$OLD_EMAIL" ]
then
    export GIT_AUTHOR_NAME="$CORRECT_NAME"
    export GIT_AUTHOR_EMAIL="$CORRECT_EMAIL"
fi
' --tag-name-filter cat -- --branches --tags

# 3. Force push to GitHub
git push --force origin main
```

**⚠️ Warning:**
- This rewrites Git history (changes commit hashes)
- Only do this if you're the sole contributor
- Others will need to re-clone the repo

---

### **Scenario 3: Fix Specific Commit Range**

If you only want to fix commits from a certain point:

```bash
# Interactive rebase (last 10 commits)
git rebase -i HEAD~10

# In the editor, change 'pick' to 'edit' for commits to fix
# Save and close

# For each commit:
git commit --amend --reset-author --no-edit
git rebase --continue

# After all commits fixed:
git push --force origin main
```

---

### **Scenario 4: Multiple Wrong Emails (CampusCuts Case)**

If you used multiple wrong emails over time:

```bash
git filter-branch -f --env-filter '
CORRECT_NAME="Your Real Name"
CORRECT_EMAIL="your-verified-email@example.com"

# List ALL wrong emails you might have used
if [ "$GIT_COMMITTER_EMAIL" = "your-email@example.comlmckeown" ] || \
   [ "$GIT_COMMITTER_EMAIL" = "your-email@example.com" ] || \
   [ "$GIT_COMMITTER_EMAIL" = "user@localhost" ]
then
    export GIT_COMMITTER_NAME="$CORRECT_NAME"
    export GIT_COMMITTER_EMAIL="$CORRECT_EMAIL"
fi
if [ "$GIT_AUTHOR_EMAIL" = "your-email@example.comlmckeown" ] || \
   [ "$GIT_AUTHOR_EMAIL" = "your-email@example.com" ] || \
   [ "$GIT_AUTHOR_EMAIL" = "user@localhost" ]
then
    export GIT_AUTHOR_NAME="$CORRECT_NAME"
    export GIT_AUTHOR_EMAIL="$CORRECT_EMAIL"
fi
' --tag-name-filter cat -- --branches --tags

git push --force origin main
```

---

## ✅ Verification Steps

### **Step 1: Verify Local Config**

```bash
# Check current repo config
git config user.email
git config user.name

# Check global config
git config --global user.email
git config --global user.name

# View all config
git config --list
```

### **Step 2: Verify Recent Commits**

```bash
# View last 5 commits with author info
git log -5 --format='%h - %an <%ae> - %s'

# All should show your correct email
```

### **Step 3: Verify on GitHub**

**Wait 5-10 minutes**, then check:

1. **Commit History:**
   ```
   https://github.com/username/repo/commits/main
   ```
   Your profile picture should appear next to commits

2. **Contributors Graph:**
   ```
   https://github.com/username/repo/graphs/contributors
   ```
   You should appear in the list

3. **Your Profile:**
   ```
   https://github.com/username
   ```
   Contribution graph should show green squares

---

## 🎯 Common Scenarios

### **Scenario A: Brand New Project**

**Before first commit:**

```bash
# 1. Initialize repo
git init

# 2. Set config IMMEDIATELY
git config user.email "your-verified-email@example.com"
git config user.name "Your Real Name"

# 3. Verify
git config --list | grep user

# 4. Now commit normally
git add .
git commit -m "Initial commit"
git push origin main
```

### **Scenario B: Cloned Someone Else's Repo**

**After cloning:**

```bash
# 1. Clone
git clone https://github.com/someone/repo.git
cd repo

# 2. Check if global config is set
git config --global user.email

# If not set or wrong:
git config --global user.email "your-verified-email@example.com"
git config --global user.name "Your Real Name"

# 3. Make commits normally
```

### **Scenario C: Forked Repository**

**Same as Scenario B** - just ensure your config is correct before committing.

### **Scenario D: Work vs Personal Projects**

**Use different emails:**

```bash
# Personal projects (global default)
git config --global user.email "personal@gmail.com"

# Work project (override in that repo)
cd ~/work/company-project
git config user.email "you@company.com"
git config user.name "Your Name"
```

---

## 🐛 Troubleshooting

### **Problem: "I set my email but contributions still don't show"**

**Possible causes:**

1. **Email not verified on GitHub**
   ```
   Solution: Go to https://github.com/settings/emails
            Click "Resend verification email"
            Verify your email
   ```

2. **Waiting for GitHub to update**
   ```
   Solution: Wait 10-30 minutes
            GitHub's contribution graph updates periodically
   ```

3. **Private repository**
   ```
   Check: Is your repo private?
   Solution: Settings → General → Change visibility to Public
            OR: Settings → Profile → Show private contributions
   ```

4. **Commits before GitHub account created**
   ```
   Check: git log -1 --format='%ai'
   Solution: Only commits AFTER account creation count
   ```

5. **Fork contributions**
   ```
   Note: Commits to forks don't count unless merged to upstream
   Solution: Create pull request to original repo
   ```

### **Problem: "git push --force is rejected"**

**Error:**
```
! [rejected]        main -> main (non-fast-forward)
```

**Solutions:**

1. **Someone else pushed while you were rewriting:**
   ```bash
   git pull --rebase
   git push --force origin main
   ```

2. **Branch protection enabled:**
   ```
   Go to: Settings → Branches → Edit protection rules
   Temporarily disable, then re-enable after push
   ```

3. **Insufficient permissions:**
   ```
   Ensure you're the repo owner or have admin access
   ```

### **Problem: "I use GitHub Desktop / VS Code"**

**GitHub Desktop:**
```
1. Preferences/Options → Git
2. Set "Your Name" and "Your Email"
3. Restart GitHub Desktop
```

**VS Code:**
```
1. Open terminal in VS Code (Ctrl+`)
2. Run:
   git config user.email "your-email@example.com"
   git config user.name "Your Name"
3. Commits will now use correct email
```

---

## 📚 Reference Commands

### **View Config**

```bash
# Current repo
git config --list

# Global config
git config --global --list

# Specific value
git config user.email
git config --global user.email
```

### **Set Config**

```bash
# Current repo only
git config user.email "email@example.com"
git config user.name "Your Name"

# Global (all repos)
git config --global user.email "email@example.com"
git config --global user.name "Your Name"
```

### **Unset Config**

```bash
# Current repo
git config --unset user.email
git config --unset user.name

# Global
git config --global --unset user.email
git config --global --unset user.name
```

### **Check Recent Commits**

```bash
# Last 10 commits with author
git log -10 --format='%h - %an <%ae> - %s'

# All commits by email
git log --all --format='%ae' | sort -u

# Count commits per author
git shortlog -s -n -e
```

---

## 🎯 Quick Fix Checklist

Use this checklist when starting a new project:

```
□ 1. Check global config is set correctly
     git config --global user.email

□ 2. If not set, configure it now
     git config --global user.email "your-email@example.com"
     git config --global user.name "Your Name"

□ 3. Verify email matches GitHub
     Visit: https://github.com/settings/emails
     Confirm email is verified

□ 4. Make a test commit
     git commit --allow-empty -m "Test commit"

□ 5. Check commit author
     git log -1 --format='%an <%ae>'

□ 6. Push to GitHub
     git push origin main

□ 7. Wait 10 minutes, then check contributions
     https://github.com/username/repo/commits
```

---

## 💡 Best Practices

### **1. Set Global Config Once**

**Do this now if you haven't:**

```bash
git config --global user.email "liam.mckeown38415@gmail.com"
git config --global user.name "Liam McKeown"
```

This prevents the issue in all future projects.

### **2. Use GitHub's No-Reply Email (Optional)**

For maximum privacy:

```bash
# Find your no-reply email at: https://github.com/settings/emails
# Format: [USER_ID]+[USERNAME]@users.noreply.github.com

git config --global user.email "121582920+lmckeown27@users.noreply.github.com"
```

**Benefits:**
- ✅ Contributions still count
- ✅ Real email hidden from public
- ✅ No spam to your inbox

**Enable in GitHub settings:**
- ☑️ Keep my email addresses private
- ☑️ Block command line pushes that expose my email

### **3. Verify Before First Push**

**Always check before pushing a new repo:**

```bash
# Create test commit
git commit --allow-empty -m "Test"

# Verify author
git log -1 --format='%an <%ae>'

# If wrong, fix it now (not later!)
git commit --amend --reset-author --no-edit
```

### **4. Add to Your Workflow**

**Create a Git setup script** (`~/git-setup.sh`):

```bash
#!/bin/bash

echo "Setting up Git configuration..."

read -p "Enter your email: " EMAIL
read -p "Enter your name: " NAME

git config --global user.email "$EMAIL"
git config --global user.name "$NAME"

echo ""
echo "✅ Git configured!"
echo "Email: $(git config --global user.email)"
echo "Name: $(git config --global user.name)"
```

Run once on new machines:
```bash
chmod +x ~/git-setup.sh
~/git-setup.sh
```

---

## 🔄 Common Scenarios & Solutions

### **Case 1: "I just cloned a repo and want to contribute"**

```bash
cd cloned-repo

# Check if global config is set
git config --global user.email

# If empty or wrong:
git config --global user.email "your-email@example.com"
git config --global user.name "Your Name"

# Make changes and commit
git add .
git commit -m "Your changes"

# Verify author before pushing
git log -1 --format='%an <%ae>'

# Push
git push origin main
```

---

### **Case 2: "I made 5 commits with wrong email"**

```bash
# Fix your config first
git config user.email "correct-email@example.com"

# Rebase last 5 commits
git rebase -i HEAD~5

# In editor, change 'pick' to 'edit' for all 5
# Save and close

# For each commit, Git will pause:
git commit --amend --reset-author --no-edit
git rebase --continue

# After all 5 are fixed:
git push --force origin main
```

---

### **Case 3: "I have 100+ commits to fix"**

```bash
# Use filter-branch to rewrite all
git filter-branch -f --env-filter '
CORRECT_EMAIL="your-verified-email@example.com"
CORRECT_NAME="Your Real Name"
OLD_EMAIL="wrong-email@example.com"

if [ "$GIT_COMMITTER_EMAIL" = "$OLD_EMAIL" ]
then
    export GIT_COMMITTER_NAME="$CORRECT_NAME"
    export GIT_COMMITTER_EMAIL="$CORRECT_EMAIL"
fi
if [ "$GIT_AUTHOR_EMAIL" = "$OLD_EMAIL" ]
then
    export GIT_AUTHOR_NAME="$CORRECT_NAME"
    export GIT_AUTHOR_EMAIL="$CORRECT_EMAIL"
fi
' --tag-name-filter cat -- --branches --tags

# Force push
git push --force origin main
```

**Important:** Replace `OLD_EMAIL` with whatever wrong email you used.

---

### **Case 4: "Multiple collaborators - can't force push"**

**If others are working on the repo, DON'T rewrite history.**

Instead, going forward:

```bash
# 1. Fix your config
git config user.email "correct-email@example.com"

# 2. Make new commits with correct email
git add .
git commit -m "Fix: Update feature"

# 3. Normal push (no --force)
git push origin main

# Old commits will keep wrong email
# But new commits will count correctly
```

---

### **Case 5: "Using GitHub Desktop"**

```
1. Open GitHub Desktop
2. Preferences (⌘+,) / Options
3. Click "Git" tab
4. Set "Name" and "Email"
5. Click "Save"
6. Make new commit
7. Push to GitHub
```

**To fix past commits from GitHub Desktop:**
- Open terminal in repo folder
- Follow "Fix Past Commits" section above

---

## 🔐 Special Cases

### **Using SSH vs HTTPS**

**Doesn't matter!** SSH/HTTPS only affects authentication, not commit attribution.

Contributions are based on **commit email**, not how you push.

### **Organization Repos**

**If contributing to company/org repo:**

```bash
cd ~/work/company-repo

# Use work email for this repo
git config user.email "you@company.com"
git config user.name "Your Name"

# Don't set --global if you want personal email elsewhere
```

### **Multiple GitHub Accounts**

**Personal and work accounts:**

```bash
# ~/.gitconfig
[user]
    email = personal@gmail.com
    name = Your Name

[includeIf "gitdir:~/work/"]
    path = ~/work/.gitconfig-work

# ~/work/.gitconfig-work
[user]
    email = you@company.com
```

**Automatically uses work email for anything in `~/work/` folder!**

---

## 📊 Verification Checklist

After fixing, verify everything works:

### **1. Local Verification**

```bash
# Config is correct
✓ git config user.email shows verified email
✓ git config user.name shows real name

# Recent commits have correct author
✓ git log -5 --format='%an <%ae>' shows correct email

# No uncommitted changes
✓ git status shows "nothing to commit"
```

### **2. GitHub Verification**

```bash
# Push to GitHub
✓ git push origin main succeeds

# Check GitHub (after 10 min)
✓ https://github.com/username/repo/commits shows your avatar
✓ https://github.com/username/repo/graphs/contributors shows you
✓ https://github.com/username shows green squares
```

---

## 🚀 Quick Fix Script

Save this as `~/fix-git-contributions.sh`:

```bash
#!/bin/bash

echo "🔧 Git Contribution Fix Script"
echo "================================"
echo ""

# Get verified email
echo "1. Go to: https://github.com/settings/emails"
echo "2. Copy one of your VERIFIED emails"
echo ""
read -p "Enter your GitHub verified email: " EMAIL
read -p "Enter your full name: " NAME

echo ""
echo "Setting global Git config..."
git config --global user.email "$EMAIL"
git config --global user.name "$NAME"

echo ""
echo "✅ Global config set!"
echo "Email: $(git config --global user.email)"
echo "Name: $(git config --global user.name)"

echo ""
read -p "Do you want to fix the current repo's commit history? (y/n): " FIX_HISTORY

if [ "$FIX_HISTORY" = "y" ]; then
    read -p "Enter your OLD incorrect email: " OLD_EMAIL
    
    echo ""
    echo "⚠️  WARNING: This will rewrite Git history!"
    echo "Only proceed if you're the sole contributor."
    read -p "Continue? (yes/no): " CONFIRM
    
    if [ "$CONFIRM" = "yes" ]; then
        echo ""
        echo "Rewriting history..."
        
        git filter-branch -f --env-filter "
        CORRECT_NAME='$NAME'
        CORRECT_EMAIL='$EMAIL'
        OLD_EMAIL='$OLD_EMAIL'

        if [ \"\$GIT_COMMITTER_EMAIL\" = \"\$OLD_EMAIL\" ]
        then
            export GIT_COMMITTER_NAME=\"\$CORRECT_NAME\"
            export GIT_COMMITTER_EMAIL=\"\$CORRECT_EMAIL\"
        fi
        if [ \"\$GIT_AUTHOR_EMAIL\" = \"\$OLD_EMAIL\" ]
        then
            export GIT_AUTHOR_NAME=\"\$CORRECT_NAME\"
            export GIT_AUTHOR_EMAIL=\"\$CORRECT_EMAIL\"
        fi
        " --tag-name-filter cat -- --branches --tags
        
        echo ""
        echo "✅ History rewritten!"
        echo ""
        read -p "Push to GitHub with --force? (yes/no): " PUSH
        
        if [ "$PUSH" = "yes" ]; then
            git push --force origin main
            echo ""
            echo "🎉 Done! Check GitHub in 10 minutes."
        fi
    fi
fi

echo ""
echo "🎯 All future commits will use:"
echo "   Email: $EMAIL"
echo "   Name: $NAME"
```

**Usage:**
```bash
chmod +x ~/fix-git-contributions.sh
cd /path/to/repo
~/fix-git-contributions.sh
```

---

## 📖 Additional Resources

### **Official Git Docs:**
- Git Config: https://git-scm.com/docs/git-config
- Filter Branch: https://git-scm.com/docs/git-filter-branch
- GitHub Contributions: https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/managing-contribution-settings-on-your-profile/why-are-my-contributions-not-showing-up-on-my-profile

### **GitHub Email Settings:**
- Manage Emails: https://github.com/settings/emails
- Notification Settings: https://github.com/settings/notifications

### **Troubleshooting:**
- GitHub Contribution Help: https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/managing-contribution-settings-on-your-profile/troubleshooting-commits-on-your-timeline

---

## ✅ Summary

### **Prevention (Do This Once):**

```bash
# Set global config NOW
git config --global user.email "liam.mckeown38415@gmail.com"
git config --global user.name "Liam McKeown"
```

### **Quick Fix (New Repo):**

```bash
# Check before first commit
git config user.email

# If wrong or empty:
git config user.email "correct-email@example.com"
git config user.name "Your Name"
```

### **Emergency Fix (Already Committed):**

```bash
# Fix last commit
git commit --amend --reset-author --no-edit
git push --force origin main

# Fix all commits
# (Use filter-branch script above)
```

---

## 🎉 You're Fixed!

**For CampusCuts:**
- ✅ All 131 commits fixed with correct email
- ✅ Global config set for future projects
- ✅ Contributions will now show on GitHub

**For future projects:**
- ✅ Global config already set
- ✅ No action needed
- ✅ Just code and commit normally!

**Remember:** Always verify your Git config before committing to a new project!

