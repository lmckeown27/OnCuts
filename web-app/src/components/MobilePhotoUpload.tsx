/**
 * Mobile Photo Upload Component
 * 
 * Provides a mobile-friendly interface for uploading profile photos.
 * On mobile devices, explicitly offers two options:
 * 1. Take a photo with the camera
 * 2. Choose from the photo gallery
 * 
 * Uses native HTML5 capture attribute for camera access.
 */

import { useState, useRef } from 'react';
import { Camera, ImageIcon, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface MobilePhotoUploadProps {
  currentPhotoUrl?: string;
  onPhotoSelected: (file: File) => Promise<void>;
  isUploading?: boolean;
  maxSizeMB?: number;
  className?: string;
}

export default function MobilePhotoUpload({
  currentPhotoUrl,
  onPhotoSelected,
  isUploading = false,
  maxSizeMB = 5,
  className = '',
}: MobilePhotoUploadProps) {
  const [showOptions, setShowOptions] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const validateAndUpload = async (file: File | undefined) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate specific formats
    const allowedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowedFormats.includes(file.type.toLowerCase())) {
      toast.error('Only JPG, PNG, WebP, and HEIC images are allowed');
      return;
    }

    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`Image must be less than ${maxSizeMB}MB`);
      return;
    }

    setShowOptions(false);
    await onPhotoSelected(file);
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleGalleryClick = () => {
    galleryInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    validateAndUpload(file);
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  return (
    <div className={className}>
      {/* Current Profile Picture Display */}
      <div className="flex flex-col items-center">
        <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 mb-4">
          {currentPhotoUrl ? (
            <img
              src={currentPhotoUrl}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-12 h-12 text-gray-400" />
            </div>
          )}
        </div>

        {/* Change Profile Picture Button */}
        <button
          onClick={() => setShowOptions(true)}
          disabled={isUploading}
          className="px-4 py-2 bg-primary-50 text-primary-600 rounded-lg font-medium hover:bg-primary-100 active:scale-95 transition-all"
        >
          {isUploading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Uploading...
            </span>
          ) : (
            'Change Profile Picture'
          )}
        </button>
        <p className="text-xs text-gray-500 mt-2">Max size: {maxSizeMB}MB</p>
      </div>

      {/* Hidden File Inputs */}
      {/* Camera Input - uses capture attribute for direct camera access */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleFileChange}
        className="hidden"
      />
      
      {/* Gallery Input - no capture attribute to show gallery */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Options Bottom Sheet */}
      {showOptions && (
        <div
          className="fixed inset-0 min-h-[100dvh] bg-black/50 z-50 animate-fade-in"
          onClick={() => setShowOptions(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 animate-slide-up safe-area-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle Bar */}
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />

            {/* Title */}
            <h3 className="text-xl font-bold text-gray-900 text-center mb-6">
              Change Profile Picture
            </h3>

            {/* Options */}
            <div className="space-y-3">
              {/* Take Photo Option */}
              <button
                onClick={handleCameraClick}
                className="w-full flex items-center gap-4 p-4 bg-primary-50 hover:bg-primary-100 rounded-xl transition-colors active:scale-98"
              >
                <div className="w-12 h-12 bg-primary-500 rounded-full flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900">Take Photo</p>
                  <p className="text-sm text-gray-600">Use your camera to take a new photo</p>
                </div>
              </button>

              {/* Choose from Gallery Option */}
              <button
                onClick={handleGalleryClick}
                className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors active:scale-98"
              >
                <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900">Choose from Gallery</p>
                  <p className="text-sm text-gray-600">Select an existing photo from your device</p>
                </div>
              </button>
            </div>

            {/* Cancel Button */}
            <button
              onClick={() => setShowOptions(false)}
              className="w-full mt-6 py-4 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

