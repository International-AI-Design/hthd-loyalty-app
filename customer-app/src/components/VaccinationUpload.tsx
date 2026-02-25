import { useState, useRef } from 'react';
import { dogProfileApi } from '../lib/api';

interface VaccinationUploadProps {
  dogId: string;
  vaccinationId: string;
  currentDocUrl: string | null;
  onUploadComplete: (url: string, publicId: string) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function VaccinationUpload({ dogId, vaccinationId, currentDocUrl, onUploadComplete }: VaccinationUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (fileInputRef.current) fileInputRef.current.value = '';

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('JPEG, PNG, or WebP only');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('Max 10MB');
      return;
    }

    setError(null);
    setIsUploading(true);

    const uploadResult = await dogProfileApi.uploadPhoto(file);
    if (uploadResult.error || !uploadResult.data) {
      setError(uploadResult.error || 'Upload failed');
      setIsUploading(false);
      return;
    }

    // Update vaccination record with document URL
    const updateResult = await dogProfileApi.updateVaccination(dogId, vaccinationId, {
      documentUrl: uploadResult.data.url,
      cloudinaryPublicId: uploadResult.data.publicId,
    });

    if (updateResult.error) {
      setError(updateResult.error);
      setIsUploading(false);
      return;
    }

    setIsUploading(false);
    onUploadComplete(uploadResult.data.url, uploadResult.data.publicId);
  };

  return (
    <div className="mt-2">
      {currentDocUrl ? (
        <div className="flex items-center gap-2">
          <a
            href={currentDocUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-brand-blue hover:underline min-h-[44px]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            View Document
          </a>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="text-xs text-gray-400 hover:text-brand-blue min-h-[44px] px-2"
          >
            Replace
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center gap-1.5 text-xs text-brand-blue hover:text-brand-blue/80
            transition-colors min-h-[44px] px-1"
        >
          {isUploading ? (
            <>
              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Upload document photo</span>
            </>
          )}
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {error && (
        <p className="text-xs text-brand-coral mt-1">{error}</p>
      )}
    </div>
  );
}
