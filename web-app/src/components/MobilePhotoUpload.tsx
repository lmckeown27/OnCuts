/**
 * Mobile Photo Upload Component
 * 
 * Provides a mobile-friendly interface for uploading profile photos.
 * Uses the native file picker which on mobile devices shows options like:
 * - Photo Library
 * - Take Photo
 * - Choose File
 */

import { useRef } from 'react';
import { ImageIcon, Loader2 } from 'lucide-react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    await onPhotoSelected(file);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
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
          onClick={handleButtonClick}
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

      {/* Hidden File Input - triggers native picker with Photo Library, Take Photo, Choose File options */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}

