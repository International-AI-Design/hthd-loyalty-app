import { useState, useRef } from 'react';
import { dogProfileApi } from '../lib/api';

interface PhotoUploadProps {
  dogId: string;
  currentPhotoUrl: string | null;
  onUploadComplete: (url: string) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function PhotoUpload({ dogId, currentPhotoUrl, onUploadComplete }: PhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Client-side validation
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Please select a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('Image must be under 10MB.');
      return;
    }

    setError(null);
    setPreviewUrl(URL.createObjectURL(file));
    setIsUploading(true);

    // Upload to Cloudinary via server
    const uploadResult = await dogProfileApi.uploadPhoto(file);
    if (uploadResult.error || !uploadResult.data) {
      setError(uploadResult.error || 'Upload failed');
      setPreviewUrl(null);
      setIsUploading(false);
      return;
    }

    // Update dog profile with new photo URL
    const updateResult = await dogProfileApi.updateDog(dogId, { photoUrl: uploadResult.data.url });
    if (updateResult.error) {
      setError(updateResult.error);
      setPreviewUrl(null);
      setIsUploading(false);
      return;
    }

    setIsUploading(false);
    setPreviewUrl(null);
    onUploadComplete(uploadResult.data.url);
  };

  const displayUrl = previewUrl || currentPhotoUrl;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="relative w-full min-h-[200px] rounded-2xl border-2 border-dashed border-brand-sand
          bg-brand-cream overflow-hidden group hover:border-brand-blue/40 transition-colors
          focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2"
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt="Dog photo"
            className={`w-full h-[200px] object-cover ${isUploading ? 'opacity-50' : ''}`}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-[200px] text-brand-forest-muted">
            <svg className="w-12 h-12 mb-2 text-brand-blue/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm font-medium">Add a photo of your pup!</p>
            <p className="text-xs mt-1">Tap to upload</p>
          </div>
        )}

        {/* Upload overlay */}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <div className="flex flex-col items-center">
              <svg className="animate-spin h-8 w-8 text-brand-blue" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-sm font-medium text-brand-navy mt-2">Uploading...</p>
            </div>
          </div>
        )}

        {/* Change photo hint on hover */}
        {displayUrl && !isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
            <span className="text-white font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity">
              Change Photo
            </span>
          </div>
        )}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {error && (
        <div className="mt-2 flex items-center gap-2 text-sm text-brand-coral">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-brand-blue font-medium hover:underline ml-1"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
