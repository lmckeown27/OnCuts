/**
 * Barber Profile Editor Component
 * 
 * Allows barbers to customize all information visible to consumers:
 * - Profile photo
 * - Bio/description
 * - Specialties
 * - Services & pricing
 * - Portfolio images
 * - Years of experience
 * - Availability settings
 * - Instant booking toggle
 */

import { useState, useEffect } from 'react';
import { Upload, X, Plus, Save, Image as ImageIcon, DollarSign, Clock, Star, Trash2 } from 'lucide-react';
import Button from './Button';
import Card from './Card';
import Loading from './Loading';
import toast from 'react-hot-toast';
import barberService from '../services/barber.service';
import type { Barber, Service, PortfolioImage } from '../types';

interface BarberProfileEditorProps {
  barberId: string;
}

export default function BarberProfileEditor({ barberId }: BarberProfileEditorProps) {
  const [barber, setBarber] = useState<Barber | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [bio, setBio] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [yearsExperience, setYearsExperience] = useState(0);
  const [instantBookEnabled, setInstantBookEnabled] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string>('');
  const [portfolio, setPortfolio] = useState<PortfolioImage[]>([]);
  
  // New service form
  const [newService, setNewService] = useState({
    name: '',
    description: '',
    price: 0,
    duration_minutes: 30,
  });

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
      setSpecialties(data.specialties || []);
      setServices(data.pricing || []);
      setYearsExperience(data.years_experience || 0);
      setInstantBookEnabled(data.instant_book_enabled || false);
      setProfilePhoto(data.profile_photo_url || '');
      setPortfolio(data.portfolio || []);
      
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
        specialties,
        pricing: services,
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

  const handleAddService = () => {
    if (!newService.name.trim()) {
      toast.error('Please enter a service name');
      return;
    }

    if (newService.price <= 0) {
      toast.error('Please enter a valid price');
      return;
    }

    const service: Service = {
      name: newService.name.trim(),
      description: newService.description.trim(),
      price: newService.price,
      duration_minutes: newService.duration_minutes,
    };

    setServices([...services, service]);
    setNewService({
      name: '',
      description: '',
      price: 0,
      duration_minutes: 30,
    });
  };

  const handleRemoveService = (index: number) => {
    setServices(services.filter((_, i) => i !== index));
  };

  const handleUpdateService = (index: number, field: keyof Service, value: any) => {
    const updatedServices = [...services];
    updatedServices[index] = {
      ...updatedServices[index],
      [field]: value,
    };
    setServices(updatedServices);
  };

  const handleUploadPortfolio = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      const fileArray = Array.from(files);
      
      // Validate file types
      const validFiles = fileArray.filter(file => 
        file.type.startsWith('image/')
      );

      if (validFiles.length !== fileArray.length) {
        toast.error('Only image files are allowed');
        return;
      }

      // Validate file sizes (max 5MB each)
      const oversizedFiles = validFiles.filter(file => file.size > 5 * 1024 * 1024);
      if (oversizedFiles.length > 0) {
        toast.error('Images must be less than 5MB each');
        return;
      }

      toast.info('Uploading images...');
      
      const uploadedImages = await barberService.uploadPortfolioImages(barberId, validFiles);
      setPortfolio([...portfolio, ...uploadedImages]);
      
      toast.success(`${uploadedImages.length} image(s) uploaded!`);
    } catch (error: any) {
      console.error('Failed to upload portfolio images:', error);
      toast.error('Failed to upload images');
    }
  };

  const handleDeletePortfolioImage = async (imageId: string) => {
    try {
      await barberService.deletePortfolioImage(imageId);
      setPortfolio(portfolio.filter(img => img.id !== imageId));
      toast.success('Image deleted');
    } catch (error: any) {
      console.error('Failed to delete image:', error);
      toast.error('Failed to delete image');
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
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
          maxLength={500}
        />
        <p className="text-xs text-gray-500 mt-2">{bio.length}/500 characters</p>
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
            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600"
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
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600"
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
              className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm flex items-center gap-2"
            >
              {specialty}
              <button
                onClick={() => handleRemoveSpecialty(specialty)}
                className="hover:text-indigo-600"
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

      {/* Services & Pricing */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">Services & Pricing</h3>
        <p className="text-sm text-gray-600 mb-4">Add the services you offer and their prices</p>

        {/* Existing Services */}
        <div className="space-y-3 mb-6">
          {services.map((service, index) => (
            <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Service Name</label>
                  <input
                    type="text"
                    value={service.name}
                    onChange={(e) => handleUpdateService(index, 'name', e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={service.description || ''}
                    onChange={(e) => handleUpdateService(index, 'description', e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Price ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={service.price}
                    onChange={(e) => handleUpdateService(index, 'price', parseFloat(e.target.value))}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Duration (min)</label>
                    <input
                      type="number"
                      min="15"
                      step="15"
                      value={service.duration_minutes || 30}
                      onChange={(e) => handleUpdateService(index, 'duration_minutes', parseInt(e.target.value))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                  </div>
                  <button
                    onClick={() => handleRemoveService(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {services.length === 0 && (
            <p className="text-sm text-gray-500">No services added yet</p>
          )}
        </div>

        {/* Add New Service */}
        <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg">
          <h4 className="font-medium text-sm mb-3">Add New Service</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
            <input
              type="text"
              value={newService.name}
              onChange={(e) => setNewService({ ...newService, name: e.target.value })}
              placeholder="Service name"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600"
            />
            <input
              type="text"
              value={newService.description}
              onChange={(e) => setNewService({ ...newService, description: e.target.value })}
              placeholder="Description (optional)"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={newService.price || ''}
              onChange={(e) => setNewService({ ...newService, price: parseFloat(e.target.value) || 0 })}
              placeholder="Price ($)"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600"
            />
            <input
              type="number"
              min="15"
              step="15"
              value={newService.duration_minutes}
              onChange={(e) => setNewService({ ...newService, duration_minutes: parseInt(e.target.value) || 30 })}
              placeholder="Duration (min)"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600"
            />
          </div>
          <Button onClick={handleAddService} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Service
          </Button>
        </div>
      </Card>

      {/* Portfolio */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">Portfolio</h3>
        <p className="text-sm text-gray-600 mb-4">Showcase your best work (max 12 images)</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {portfolio.map((image) => (
            <div key={image.id} className="relative group">
              <img
                src={image.url}
                alt="Portfolio"
                className="w-full h-48 object-cover rounded-lg"
              />
              <button
                onClick={() => handleDeletePortfolioImage(image.id)}
                className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {portfolio.length < 12 && (
            <label className="w-full h-48 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-indigo-600 hover:bg-indigo-50 transition-colors">
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
              <span className="text-sm text-gray-600">Upload Image</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleUploadPortfolio}
                className="hidden"
              />
            </label>
          )}
        </div>

        <p className="text-xs text-gray-500">
          {portfolio.length}/12 images uploaded. Max 5MB per image.
        </p>
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
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
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

