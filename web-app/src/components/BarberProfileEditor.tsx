/**
 * Barber Profile Editor Component
 * 
 * Allows barbers to customize all information visible to consumers:
 * - Profile photo
 * - Bio/description
 * - Availability settings
 * - Instant booking toggle
 */

import { useState, useEffect } from 'react';
import { Upload, Save, Image as ImageIcon } from 'lucide-react';
import Button from './Button';
import Card from './Card';
import Loading from './Loading';
import toast from 'react-hot-toast';
import barberService from '../services/barber.service';
import type { Barber } from '../types';

interface BarberProfileEditorProps {
  barberId: string;
}

export default function BarberProfileEditor({ barberId }: BarberProfileEditorProps) {
  const [barber, setBarber] = useState<Barber | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [bio, setBio] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string>('');

  useEffect(() => {
    loadBarberProfile();
  }, [barberId]);

  const loadBarberProfile = async () => {
    try {
      setIsLoading(true);
      const data = await barberService.getBarberById(barberId);
      setBarber(data);
      
      // Populate form fields
      setBio(data.bio || '');
      setInstagramHandle(data.instagram_handle || '');
      setProfilePhoto(data.profile_photo_url || '');
      
      setIsLoading(false);
    } catch (error: any) {
      console.error('Failed to load barber profile:', error);
      toast.error('Failed to load profile');
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);

      const updateData: Partial<Barber> = {
        bio,
        instagram_handle: instagramHandle,
      };

      await barberService.updateBarberProfile(barberId, updateData);
      
      toast.success('Profile updated successfully!');
      await loadBarberProfile();
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
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
          <h2 className="text-2xl font-bold text-gray-900">Edit Your Profile</h2>
          <p className="text-gray-600 mt-1">Customize how students see your barber profile</p>
        </div>
        <Button onClick={handleSaveProfile} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Profile'}
        </Button>
      </div>

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
            <p className="text-sm text-gray-600 mb-2">Upload a professional profile photo</p>
            <Button variant="secondary" size="sm">
              <Upload className="w-4 h-4 mr-2" />
              Upload Photo
            </Button>
            <p className="text-xs text-gray-500 mt-2">Max size: 5MB. Formats: JPG, PNG</p>
          </div>
        </div>
      </Card>

      {/* Bio */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">Bio</h3>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell students about yourself, your style, and what makes you unique..."
          rows={5}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
          maxLength={500}
        />
        <p className="text-xs text-gray-500 mt-2">{bio.length}/500 characters</p>
      </Card>

      {/* Instagram Handle (Optional) */}
      <Card>
        <h3 className="text-lg font-semibold mb-2">Instagram</h3>
        <p className="text-sm text-gray-600 mb-4">Link your Instagram to showcase your work (optional)</p>
        <div className="flex items-center gap-2">
          <span className="text-gray-600">@</span>
          <input
            type="text"
            value={instagramHandle}
            onChange={(e) => setInstagramHandle(e.target.value.replace('@', ''))}
            placeholder="yourusername"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
            maxLength={30}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">Your Instagram handle without the @</p>
      </Card>

      {/* Save Button (Bottom) */}
      <div className="flex justify-end">
        <Button onClick={handleSaveProfile} disabled={isSaving} size="lg">
          <Save className="w-5 h-5 mr-2" />
          {isSaving ? 'Saving Changes...' : 'Save All Changes'}
        </Button>
      </div>
    </div>
  );
}

