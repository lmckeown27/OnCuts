/**
 * Consumer Profile Editor Component
 * 
 * Allows students to customize their profile information:
 * - Profile photo
 * - Name (first, last)
 * - Username
 * - Bio/About
 * - Phone number
 * - Campus (read-only, set during registration)
 * - Notification preferences
 * - Privacy settings
 */

import { useState, useEffect } from 'react';
import { Upload, Save, Mail, Phone, User as UserIcon, Bell, Lock, Trash2, Image as ImageIcon } from 'lucide-react';
import Button from './Button';
import Card from './Card';
import Loading from './Loading';
import toast from 'react-hot-toast';
import userService from '../services/user.service';
import type { User } from '../types';

interface ConsumerProfileEditorProps {
  userId: string;
}

export default function ConsumerProfileEditor({ userId }: ConsumerProfileEditorProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'profile' | 'notifications' | 'security'>('profile');
  
  // Profile form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  
  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [bookingReminders, setBookingReminders] = useState(true);
  const [promotionalEmails, setPromotionalEmails] = useState(false);

  // Security
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    loadUserProfile();
    loadNotificationPreferences();
  }, [userId]);

  const loadUserProfile = async () => {
    try {
      setIsLoading(true);
      const data = await userService.getUserProfile(userId);
      setUser(data);
      
      // Populate form fields
      setFirstName(data.first_name || '');
      setLastName(data.last_name || '');
      setUsername(data.username || '');
      setBio(data.bio || '');
      setPhone(data.phone || '');
      setProfilePhoto(data.profile_picture_url || '');
      
      setIsLoading(false);
    } catch (error: any) {
      console.error('Failed to load user profile:', error);
      toast.error('Failed to load profile');
      setIsLoading(false);
    }
  };

  const loadNotificationPreferences = async () => {
    try {
      const prefs = await userService.getNotificationPreferences(userId);
      setEmailNotifications(prefs.email_notifications);
      setPushNotifications(prefs.push_notifications);
      setBookingReminders(prefs.booking_reminders);
      setPromotionalEmails(prefs.promotional_emails);
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);

      const updateData = {
        first_name: firstName,
        last_name: lastName,
        username,
        bio,
        phone,
      };

      await userService.updateUserProfile(userId, updateData);
      
      toast.success('Profile updated successfully!');
      await loadUserProfile();
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    try {
      setIsSaving(true);

      await userService.updateNotificationPreferences(userId, {
        email_notifications: emailNotifications,
        push_notifications: pushNotifications,
        booking_reminders: bookingReminders,
        promotional_emails: promotionalEmails,
      });
      
      toast.success('Notification preferences updated!');
    } catch (error: any) {
      console.error('Failed to update notifications:', error);
      toast.error('Failed to update preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    try {
      setIsSaving(true);
      await userService.changePassword(userId, currentPassword, newPassword);
      
      toast.success('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Failed to change password:', error);
      toast.error(error.response?.data?.error || 'Failed to change password');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    try {
      toast.info('Uploading photo...');
      const result = await userService.uploadProfilePhoto(userId, file);
      setProfilePhoto(result.url);
      
      // Update user profile with new photo URL
      await userService.updateUserProfile(userId, { profile_picture_url: result.url });
      
      toast.success('Profile photo updated!');
      await loadUserProfile();
    } catch (error: any) {
      console.error('Failed to upload photo:', error);
      toast.error('Failed to upload photo');
    }
  };

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Your Profile</h2>
          <p className="text-gray-600 mt-1">Manage your personal information and preferences</p>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveSection('profile')}
            className={`pb-3 px-2 border-b-2 font-medium text-sm transition-colors ${
              activeSection === 'profile'
                ? 'border-primary-400 text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <UserIcon className="w-4 h-4 inline mr-2" />
            Profile Info
          </button>
          <button
            onClick={() => setActiveSection('notifications')}
            className={`pb-3 px-2 border-b-2 font-medium text-sm transition-colors ${
              activeSection === 'notifications'
                ? 'border-primary-400 text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Bell className="w-4 h-4 inline mr-2" />
            Notifications
          </button>
          <button
            onClick={() => setActiveSection('security')}
            className={`pb-3 px-2 border-b-2 font-medium text-sm transition-colors ${
              activeSection === 'security'
                ? 'border-primary-400 text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Lock className="w-4 h-4 inline mr-2" />
            Security
          </button>
        </div>
      </div>

      {/* Profile Info Section */}
      {activeSection === 'profile' && (
        <div className="space-y-6">
          {/* Profile Photo */}
          <Card>
            <h3 className="text-lg font-semibold mb-4">Profile Photo</h3>
            <div className="flex items-center gap-6">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                {profilePhoto ? (
                  <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-12 h-12 text-gray-400" />
                )}
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Upload a profile photo</p>
                <label className="cursor-pointer">
                  <Button variant="secondary" size="sm" as="span">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Photo
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadPhoto}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-gray-500 mt-2">Max size: 5MB. Formats: JPG, PNG</p>
              </div>
            </div>
          </Card>

          {/* Basic Info */}
          <Card>
            <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="@username"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Optional - For reviews and comments</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">For booking updates and reminders</p>
              </div>
            </div>
          </Card>

          {/* Email (Read-only) */}
          <Card>
            <h3 className="text-lg font-semibold mb-4">Email Address</h3>
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">{user?.email}</p>
                <p className="text-sm text-gray-500">Verified {user?.is_verified ? '✓' : '✗'}</p>
              </div>
              <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
                Cannot be changed
              </span>
            </div>
          </Card>

          {/* Bio */}
          <Card>
            <h3 className="text-lg font-semibold mb-4">About You</h3>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell barbers about yourself (optional)..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
              maxLength={300}
            />
            <p className="text-xs text-gray-500 mt-2">{bio.length}/300 characters</p>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={isSaving} size="lg">
              <Save className="w-5 h-5 mr-2" />
              {isSaving ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
        </div>
      )}

      {/* Notifications Section */}
      {activeSection === 'notifications' && (
        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold mb-4">Notification Preferences</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Email Notifications</p>
                  <p className="text-sm text-gray-600">Receive booking updates via email</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-400"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Push Notifications</p>
                  <p className="text-sm text-gray-600">Get notified on your device</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pushNotifications}
                    onChange={(e) => setPushNotifications(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-400"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Booking Reminders</p>
                  <p className="text-sm text-gray-600">Remind me before appointments</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bookingReminders}
                    onChange={(e) => setBookingReminders(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-400"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Promotional Emails</p>
                  <p className="text-sm text-gray-600">Receive deals and special offers</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={promotionalEmails}
                    onChange={(e) => setPromotionalEmails(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-400"></div>
                </label>
              </div>
            </div>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSaveNotifications} disabled={isSaving} size="lg">
              <Save className="w-5 h-5 mr-2" />
              {isSaving ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </div>
      )}

      {/* Security Section */}
      {activeSection === 'security' && (
        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold mb-4">Change Password</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleChangePassword} disabled={isSaving}>
                  <Lock className="w-4 h-4 mr-2" />
                  Change Password
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold mb-4 text-red-600">Danger Zone</h3>
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="font-medium text-gray-900 mb-2">Delete Account</p>
              <p className="text-sm text-gray-600 mb-4">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <Button variant="secondary" size="sm" className="bg-red-600 text-white hover:bg-red-700">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Account
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

