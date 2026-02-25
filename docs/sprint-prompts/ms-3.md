# MS-3: Sprint A Frontend — Cloudinary, Dog Profile UI, Vaccination Upload

## Context
This is micro-sprint 3 of 8. MS-1 added the schema, MS-2 added the server upload module and extended dog profile endpoints.

**Prior sprints completed:** MS-1 (schema), MS-2 (server uploads + dog profile)

## Read First (for patterns)
- `customer-app/src/lib/api.ts` — API client pattern (lines 400-413: dogProfileApi)
- `customer-app/src/pages/DogProfilePage.tsx` — existing dog profile page
- `customer-app/src/pages/MyPetsPage.tsx` — pet list page
- `customer-app/src/App.tsx` — routing structure
- `SKILL.md` or `CLAUDE.md` — brand guidelines (Blue #62A2C3, Navy #1B365D, Playfair Display headings, Open Sans body)

## What to Do

### 1. Extend API Client

In `customer-app/src/lib/api.ts`, update `dogProfileApi`:
```typescript
// Add to existing dogProfileApi object:
uploadPhoto: (dogId: string, file: File) => {
  const formData = new FormData();
  formData.append('photo', file);
  // Can't use the standard api.post (which sets JSON content-type)
  // Use a custom fetch for multipart
  const token = localStorage.getItem('token');
  return fetch(`${API_BASE}/v2/uploads`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData,
  }).then(async (res) => {
    const json = await res.json();
    if (!res.ok) return { error: json.error || 'Upload failed' } as ApiResponse<any>;
    return { data: json } as ApiResponse<{ url: string; publicId: string }>;
  });
},
```

Also update the `Dog` interface to include new fields:
```typescript
export interface DogProfile {
  id: string;
  name: string;
  breed: string | null;
  birthDate: string | null;
  weight: number | null;
  temperament: string | null;
  careInstructions: string | null;
  isNeutered: boolean;
  photoUrl: string | null;
  socialNotes: string | null;
  sizeCategory: string | null;
  allergies: string | null;
  specialNeeds: string | null;
  emergencyVetName: string | null;
  emergencyVetPhone: string | null;
  lastGroomDate: string | null;
  vaccinations: VaccinationRecord[];
  medications: MedicationRecord[];
}

export interface VaccinationRecord {
  id: string;
  name: string;
  dateGiven: string;
  expiresAt: string | null;
  vetName: string | null;
  documentUrl: string | null;
  cloudinaryPublicId: string | null;
  verified: boolean;
  notes: string | null;
}

export interface MedicationRecord {
  id: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  instructions: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
}
```

### 2. Create Photo Upload Component

**`customer-app/src/components/PhotoUpload.tsx`**
- Props: `dogId: string`, `currentPhotoUrl: string | null`, `onUploadComplete: (url: string) => void`
- Shows current photo or a placeholder silhouette
- File input triggered by tapping the photo area
- Shows upload progress indicator
- On success: calls `dogProfileApi.uploadPhoto`, then `dogProfileApi.updateDog(dogId, { photoUrl: url })`, then `onUploadComplete`
- Accept: `image/jpeg, image/png, image/webp`
- Max file size client-side check: 10MB
- Style: rounded-lg border, min-h-[200px], brand colors

### 3. Create Vaccination Document Upload Component

**`customer-app/src/components/VaccinationUpload.tsx`**
- Props: `dogId: string`, `vaccinationId: string`, `currentDocUrl: string | null`, `onUploadComplete: (url: string, publicId: string) => void`
- Small upload button with camera/document icon
- On upload: calls upload API, then updates vaccination with `cloudinaryPublicId` and `documentUrl`
- Shows thumbnail preview of uploaded document
- Style: compact, fits inline in a vaccination card

### 4. Update Dog Profile Page

Update `customer-app/src/pages/DogProfilePage.tsx`:
- Add PhotoUpload component at top of profile
- Add sections for new fields:
  - **Health & Safety** card: allergies, specialNeeds, emergencyVetName, emergencyVetPhone
  - **Last Groom** display with date formatting
- Vaccination cards should show document upload option (VaccinationUpload component)
- Editable fields for the new Dog fields
- Mobile-first layout: single column, generous touch targets (min 44px)

### 5. Update My Pets Page

Update `customer-app/src/pages/MyPetsPage.tsx`:
- Show dog photo thumbnails in the pet list cards (if `photoUrl` exists)
- Fallback: show breed-appropriate placeholder or first-letter avatar

### 6. Add Route (if needed)

Verify `customer-app/src/App.tsx` already routes to DogProfilePage. If not, ensure the route exists.

## Design Requirements
- Use brand tokens: `brand-primary` (#62A2C3), `brand-sage`, `brand-navy` (#1B365D)
- Font: `font-heading` (Playfair Display) for section headings
- Touch targets: `min-h-[44px]` on all interactive elements
- Loading states for photo uploads (spinner or progress bar)
- Error states with retry option
- Empty states for dogs with no photo ("Add a photo of your pup!")
- Mobile-first responsive

## Build Gate
```bash
cd customer-app
npx tsc --noEmit   # Zero errors
npm run build       # Vite build succeeds
```

- [ ] TypeScript compiles
- [ ] Vite build succeeds
- [ ] New components follow existing Tailwind/brand patterns
- [ ] Photo upload has loading + error states
- [ ] All new fields displayed on dog profile page

## Git Commit
```bash
git add customer-app/
git commit -m "feat(customer): add photo upload and extended dog profile UI

Add PhotoUpload component with Cloudinary integration.
Add VaccinationUpload for vaccination document photos.
Update DogProfilePage with health/safety fields, photo upload.
Update MyPetsPage with photo thumbnails.
Extend API types for new Dog and Vaccination fields.

MS-3 of 8 micro-sprint rebuild."
```

## CHANGELOG Entry
```
### MS-3: Sprint A Frontend
- Dog profile now supports photo upload via Cloudinary
- Vaccination records can have uploaded document photos
- Dog profile shows allergies, special needs, emergency vet info
- Pet list cards show dog photo thumbnails
```

## Next Session
Proceed to MS-4 (Sprint B — Grooming pricing, full-stack).
