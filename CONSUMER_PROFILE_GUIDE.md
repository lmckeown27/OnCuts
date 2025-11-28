# Consumer (Student) Profile Management Guide

## Overview
This guide shows students how to manage their CampusCuts profile, preferences, and account settings.

---

## 🎯 Accessing Your Profile

### **Step 1: Navigate to Student Dashboard**
```
http://localhost:3000
  ↓
Select "Consumer" role
  ↓
Click "My Profile" tab (top navigation)
```

### **Navigation:**
- **Find Barbers**: Discovery feed to browse and book barbers
- **My Profile**: Your personal profile and settings

---

## 📋 Profile Sections

Your profile is organized into **3 main sections**:

1. **Profile Info** - Personal details and bio
2. **Notifications** - Communication preferences
3. **Security** - Password and account management

---

## 1. 📸 Profile Info

### **Profile Photo**

**What It Is:**
- Your profile picture shown to barbers and in reviews

**How to Edit:**
```
My Profile → Profile Info → Upload Photo button
  ↓
Select image file (JPG, PNG)
  ↓
Max size: 5MB
  ↓
Preview appears immediately
  ↓
Click "Save Profile"
```

**Where It Appears:**
- Your bookings (barber sees your photo)
- Your reviews on barber profiles
- Communication with barbers

**Tips:**
- Use a clear, friendly photo
- Good lighting recommended
- Professional but approachable

---

### **Basic Information**

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| **First Name** | ✅ Yes | Your given name | Marcus |
| **Last Name** | ✅ Yes | Your surname | Johnson |
| **Username** | ❌ No | Display name for reviews | @marcusj |
| **Phone** | ❌ No | For booking updates | (555) 123-4567 |

**Visual Interface:**
```
┌────────────────────────────────────┐
│ Basic Information                  │
│                                    │
│ First Name *     Last Name *       │
│ [Marcus      ]   [Johnson      ]   │
│                                    │
│ Username         Phone Number      │
│ [@marcusj    ]   [(555) 123-4567]  │
│ For reviews      For booking alerts│
└────────────────────────────────────┘
```

**Field Details:**

**First Name & Last Name:**
- Required for bookings
- Shown to barbers when you book
- Cannot be empty

**Username:**
- Optional display name
- Used when you leave reviews
- Makes reviews more personal
- Example: Instead of "Marcus J.", shows "@marcusj"

**Phone Number:**
- Optional but recommended
- Used for booking reminders
- SMS notifications (if enabled)
- Barbers may contact for appointment details

---

### **Email Address (Read-Only)**

**What It Shows:**
```
┌────────────────────────────────────┐
│ Email Address                      │
│                                    │
│ 📧  marcus.johnson@calpoly.edu     │
│     Verified ✓                     │
│                                    │
│     [Cannot be changed]            │
└────────────────────────────────────┘
```

**Why It's Read-Only:**
- Your .edu email verifies you're a student
- Tied to your campus affiliation
- Used for account recovery
- Primary communication method

**If You Need to Change It:**
- Contact CampusCuts support
- Requires re-verification
- May require new account

---

### **About You (Bio)**

**What It Is:**
- Optional personal description
- Tell barbers about yourself
- Hair preferences, style preferences

**Character Limit:** 300 characters

**Example Bios:**
```
"Prefer clean fades and modern styles. Usually go for a 2 
on the sides, scissors on top. Always down to try something 
new if you have suggestions!"

"Looking for someone experienced with curly hair. Usually 
wear it natural but open to new styles."

"Student athlete - need quick, clean cuts that look good 
but low maintenance. Fades are my go-to."
```

**Where Barbers See It:**
- When you book an appointment
- In your booking request
- Helps them prepare for your service

**Tips:**
- Mention hair type/texture
- Include style preferences
- Note any special requests
- Keep it concise

---

## 2. 🔔 Notifications

### **Notification Preferences**

Control how and when CampusCuts contacts you.

| Setting | Default | Description |
|---------|---------|-------------|
| **Email Notifications** | ✅ ON | Booking updates via email |
| **Push Notifications** | ✅ ON | Device notifications |
| **Booking Reminders** | ✅ ON | Reminders before appointments |
| **Promotional Emails** | ❌ OFF | Deals and special offers |

---

### **Visual Interface:**

```
┌────────────────────────────────────────┐
│ Notification Preferences               │
│                                        │
│ Email Notifications            [ON  ] │
│ Receive booking updates via email     │
│                                        │
│ Push Notifications            [ON  ]  │
│ Get notified on your device           │
│                                        │
│ Booking Reminders             [ON  ]  │
│ Remind me before appointments         │
│                                        │
│ Promotional Emails            [OFF ]  │
│ Receive deals and special offers      │
└────────────────────────────────────────┘
```

---

### **Notification Types Explained:**

#### **Email Notifications**
**When You Receive Them:**
- Barber accepts/declines your booking
- Barber reschedules appointment
- Appointment is confirmed
- Service is completed
- Payment receipt

**Recommended:** ✅ Keep ON
- Important booking updates
- Confirmation records
- Payment receipts

---

#### **Push Notifications**
**When You Receive Them:**
- Real-time booking status changes
- Barber sends you a message
- Appointment starting soon
- Last-minute changes

**Recommended:** ✅ Keep ON
- Instant updates
- Time-sensitive information
- Better communication

---

#### **Booking Reminders**
**When You Receive Them:**
- 24 hours before appointment
- 1 hour before appointment
- Helps prevent no-shows

**Recommended:** ✅ Keep ON
- Never miss an appointment
- Time to reschedule if needed
- Courteous to barbers

---

#### **Promotional Emails**
**When You Receive Them:**
- New barbers join your campus
- Special platform promotions
- Seasonal deals
- Feature announcements

**Recommended:** Your choice
- ✅ ON if you want deals
- ❌ OFF if you prefer minimal emails

---

## 3. 🔒 Security

### **Change Password**

**How to Change:**
```
My Profile → Security → Change Password
  ↓
Enter current password
  ↓
Enter new password (8+ characters)
  ↓
Confirm new password (must match)
  ↓
Click "Change Password"
  ↓
Success! You're logged out and must log in again
```

**Password Requirements:**
- Minimum 8 characters
- Mix of letters and numbers recommended
- Avoid common passwords
- Don't reuse old passwords

**Visual Interface:**
```
┌────────────────────────────────────┐
│ Change Password                    │
│                                    │
│ Current Password                   │
│ [••••••••••••]                    │
│                                    │
│ New Password                       │
│ [••••••••••••]                    │
│ Minimum 8 characters               │
│                                    │
│ Confirm New Password               │
│ [••••••••••••]                    │
│                                    │
│        [Change Password]           │
└────────────────────────────────────┘
```

**When to Change:**
- Regularly (every 3-6 months)
- If you suspect account compromise
- After using public/shared computer
- If you've shared your password

---

### **Delete Account (Danger Zone)**

**⚠️ Warning:** This action is **permanent** and **cannot be undone**.

**What Gets Deleted:**
- Your profile
- All booking history
- All reviews you've written
- Saved preferences
- Account credentials

**What Happens:**
1. You click "Delete Account"
2. Confirm you want to delete
3. Enter your password
4. Account is permanently deleted
5. You're logged out
6. Cannot recover account

**Visual Interface:**
```
┌────────────────────────────────────┐
│ ⚠️ Danger Zone                     │
│                                    │
│ Delete Account                     │
│                                    │
│ Permanently delete your account    │
│ and all associated data. This      │
│ action cannot be undone.           │
│                                    │
│     [🗑️ Delete Account]            │
└────────────────────────────────────┘
```

**Before You Delete:**
- ✅ Export any data you want to keep
- ✅ Cancel any upcoming bookings
- ✅ Notify barbers of cancellations
- ✅ Consider just deactivating instead

---

## 💡 Best Practices

### **Profile Completeness**

**Recommended Profile Setup:**
```
✅ Profile photo uploaded
✅ First & last name filled
✅ Username set (for reviews)
✅ Phone number added
✅ Bio written (optional but helpful)
✅ Email verified
✅ Notifications configured
```

**Why Complete Your Profile:**
- Barbers trust complete profiles more
- Better communication
- Easier to reschedule if needed
- Professional appearance
- Better service

---

### **Privacy Tips**

**What Barbers See:**
- Your name (first & last)
- Your profile photo (if uploaded)
- Your username (if set)
- Your bio (if written)
- Your booking history with them

**What Barbers DON'T See:**
- Your email address
- Your phone number (unless you share)
- Your password
- Your bookings with other barbers
- Your notification preferences

---

### **Communication Preferences**

**Recommended Settings for Best Experience:**

| User Type | Email | Push | Reminders | Promo |
|-----------|-------|------|-----------|-------|
| **Frequent Booker** | ✅ ON | ✅ ON | ✅ ON | ✅ ON |
| **Occasional User** | ✅ ON | ✅ ON | ✅ ON | ❌ OFF |
| **Privacy-Focused** | ✅ ON | ❌ OFF | ✅ ON | ❌ OFF |

**Always Keep ON:**
- ✅ Booking Reminders (prevent no-shows)
- ✅ Email Notifications (important updates)

**Optional:**
- Push Notifications (convenience)
- Promotional Emails (personal preference)

---

## 📱 Mobile vs Desktop

**Profile editing works on all devices:**

### **Desktop (Laptop/Desktop Computer):**
- Full side-by-side layouts
- Larger form fields
- Easier photo upload
- More screen space

### **Mobile (Phone/Tablet):**
- Stacked layouts
- Touch-optimized
- Camera access for photos
- Works great on-the-go

**Recommended:**
- Initial setup: Desktop (easier photo upload)
- Quick edits: Mobile (anywhere, anytime)
- Password changes: Desktop (easier typing)

---

## 🔄 Saving Your Changes

### **How to Save:**

**Profile Info:**
```
Edit any fields
  ↓
Scroll to bottom
  ↓
Click "Save Profile" button
  ↓
Success notification appears
  ↓
Changes are saved
```

**Notifications:**
```
Toggle any switches
  ↓
Scroll to bottom
  ↓
Click "Save Preferences" button
  ↓
Success notification appears
```

**Security:**
```
Each security action has its own button:
- Change Password → saves immediately
- Delete Account → requires confirmation
```

---

## ❓ FAQ

### **Can I change my email address?**
No, your .edu email is permanent and tied to your campus verification. Contact support if you need to change it.

### **Do I need a username?**
No, it's optional. But it makes your reviews more personal (shows "@username" instead of "Student S.").

### **Will barbers see my phone number?**
Only if you share it with them directly in a booking or message. It's not publicly visible.

### **How do I turn off all notifications?**
Go to Notifications tab and toggle all switches to OFF. Note: You may miss important booking updates.

### **Can I use a nickname instead of my real name?**
Your legal name is required for bookings (verification purposes), but you can set a username for reviews.

### **What if I forget my password?**
Use the "Forgot Password" link on the login page. Reset link sent to your email.

### **Can I temporarily deactivate my account?**
Not yet - this feature is coming soon. For now, just log out and don't book.

### **How often should I update my profile?**
Update your photo yearly, keep phone/bio current, and change password every 3-6 months.

### **Can I see what barbers see when I book?**
Not currently, but your profile shows what's shared: name, photo, username, bio.

### **What happens to my reviews if I delete my account?**
They're deleted permanently along with your account.

---

## 🎯 Profile Optimization

### **For Best Booking Experience:**

1. **Complete Your Profile**
   - Add profile photo
   - Fill in all fields
   - Write helpful bio

2. **Set Communication Preferences**
   - Enable booking reminders
   - Enable email notifications
   - Add phone number

3. **Write a Helpful Bio**
   - Mention hair type
   - List style preferences
   - Note any special needs

4. **Keep Information Current**
   - Update phone if it changes
   - Refresh bio if preferences change
   - Update photo annually

5. **Use a Professional Username**
   - If you write reviews
   - Keep it appropriate
   - Makes reviews more credible

---

## 🚀 Getting Started Checklist

When you first set up your profile:

```
☑️ Upload profile photo
☑️ Verify first & last name correct
☑️ Choose a username (for reviews)
☑️ Add phone number (for reminders)
☑️ Write brief bio (hair preferences)
☑️ Verify email shown correctly
☑️ Configure notification preferences
☑️ Set strong password
☑️ Review all settings
☑️ Click "Save Profile"
```

**Time Required:** 5-10 minutes for complete setup

---

## 📞 Need Help?

**Issues with your profile:**
- Check that all required fields (marked with *) are filled
- Make sure image is under 5MB
- Try refreshing the page
- Clear browser cache

**Can't save changes:**
- Check internet connection
- Ensure you're logged in
- Try again in a few minutes
- Contact support if persists

**Security concerns:**
- Change password immediately if compromised
- Review recent bookings for suspicious activity
- Enable all notifications for awareness
- Contact support for account issues

---

**Your profile is your identity on CampusCuts. Keep it current, professional, and helpful for the best booking experience!**

---

Last Updated: November 28, 2024

