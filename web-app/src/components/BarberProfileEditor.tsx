/**
 * Barber Profile Editor Component
 * 
 * Allows barbers to customize all information visible to consumers:
 * - Profile photo
 * - Bio/description
 * - Specialties
 * - Years of experience
 * - Availability settings
 * - Instant booking toggle
 */

import { useState, useEffect } from 'react';
import { Upload, X, Plus, Save, Image as ImageIcon } from 'lucide-react';
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
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [yearsExperience, setYearsExperience] = useState(0);
  const [instantBookEnabled, setInstantBookEnabled] = useState(false);
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
      setSpecialties(data.specialties || []);
      setYearsExperience(data.years_experience || 0);
      setInstantBookEnabled(data.instant_book_enabled || false);
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
        specialties,
        years_experience: yearsExperience,
        instant_book_enabled: instantBookEnabled,
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

  const handleAddSpecialty = () => {
    if (!newSpecialty.trim()) {
      toast.error('Please enter a specialty');
      return;
    }
    
    if (specialties.includes(newSpecialty.trim())) {
      toast.error('Specialty already exists');
      return;
    }

    setSpecialties([...specialties, newSpecialty.trim()]);
    setNewSpecialty('');
  };

  const handleRemoveSpecialty = (specialty: string) => {
    setSpecialties(specialties.filter(s => s !== specialty));
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

      {/* Years of Experience */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">Experience</h3>
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Years of Experience:</label>
          <input
            type="number"
            min="0"
            max="50"
            value={yearsExperience}
            onChange={(e) => setYearsExperience(parseInt(e.target.value) || 0)}
            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400"
          />
          <span className="text-sm text-gray-600">years</span>
        </div>
      </Card>

      {/* Specialties */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">Specialties</h3>
        <p className="text-sm text-gray-600 mb-4">Add your areas of expertise (e.g., Fades, Curly Hair, Beard Grooming)</p>
        
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newSpecialty}
            onChange={(e) => setNewSpecialty(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddSpecialty()}
            placeholder="e.g., Taper Fades"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400"
          />
          <Button onClick={handleAddSpecialty} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {specialties.map((specialty, index) => (
            <span
              key={index}
              className="px-3 py-1 bg-primary-100 text-primary-600 rounded-full text-sm flex items-center gap-2"
            >
              {specialty}
              <button
                onClick={() => handleRemoveSpecialty(specialty)}
                className="hover:text-primary-400"
              >
                <X className="w-4 h-4" />
              </button>
            </span>
          ))}
          {specialties.length === 0 && (
            <p className="text-sm text-gray-500">No specialties added yet</p>
          )}
        </div>
      </Card>

      {/* Booking Settings */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">Booking Settings</h3>
        
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="font-medium text-gray-900">Instant Booking</p>
            <p className="text-sm text-gray-600">Allow students to book immediately without approval</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={instantBookEnabled}
              onChange={(e) => setInstantBookEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-400"></div>
          </label>
        </div>
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

