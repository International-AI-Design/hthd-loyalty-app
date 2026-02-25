# MS-2: Sprint A Server — Uploads + Dog Profile Enhancements

## Session Protocol
> **One micro-sprint per session.** Each session: execute this sprint only, pass build gates, commit, push, then shut down. Do NOT start the next sprint in the same session. Fresh context prevents compaction disasters.
>
> **Startup:** Ensure Docker Postgres (`happy-tail-postgres`) is running on port 5432 — tests need it.
>
> **Shutdown sequence:** After push succeeds → update CHANGELOG.md with MS-2 entry → archive session to `archive/sessions/YYYY-MM-DD_HH-MM_session.md` → update memory files → verify all logs written → confirm ready to exit.

## Context
This is micro-sprint 2 of 8. MS-1 added the schema (new Dog fields, Vaccination cloudinaryPublicId, and 8 new tables). The Prisma client is regenerated and TypeScript compiles.

**Prior sprints completed:** MS-1 (schema + migration) — commit `c0392bf`

## Read First (for patterns)
- `server/src/modules/dog-profile/types.ts` — Zod schema pattern
- `server/src/modules/dog-profile/service.ts` — Service class pattern with DogProfileError
- `server/src/modules/dog-profile/router.ts` — Router pattern with authenticateCustomer
- `server/src/index.ts` — Route mounting pattern (lines 1-140)
- `server/package.json` — current dependencies

## What to Do

### 1. Install Cloudinary SDK

```bash
cd server && npm install cloudinary multer @types/multer
```

### 2. Create Upload Module: `server/src/modules/uploads/`

**`server/src/modules/uploads/cloudinary.ts`**
- Import and configure `cloudinary.v2` from env vars: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- Export an `uploadImage` function:
  - Takes `buffer: Buffer`, `folder: string` (default `'hthd'`), optional `publicId: string`
  - Calls `cloudinary.uploader.upload_stream` with: `folder`, `resource_type: 'image'`, `transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' }]`
  - Returns `{ url: string, publicId: string }`
- Export a `deleteImage` function:
  - Takes `publicId: string`
  - Calls `cloudinary.uploader.destroy(publicId)`
- Export a `getSignedUrl` function:
  - Takes `publicId: string`, optional `transformation` object
  - Returns a signed Cloudinary URL with `sign_url: true`

**`server/src/modules/uploads/middleware.ts`**
- Configure multer with memory storage
- Export `singleImageUpload` middleware: `multer({ storage: memoryStorage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter })` accepting `image/jpeg`, `image/png`, `image/webp`
- Field name: `'photo'`

**`server/src/modules/uploads/router.ts`**
- POST `/` — authenticated customer upload
  - Uses `singleImageUpload` middleware, then `uploadImage`
  - Returns `{ url, publicId }`
- DELETE `/:publicId` — delete an upload (for replacing photos)
  - Only allow deletion of images the customer owns (check against dog.photoUrl or vaccination.cloudinaryPublicId)

### 3. Update Dog Profile Module

**`server/src/modules/dog-profile/types.ts`** — Add to `DogProfileUpdateSchema`:
```typescript
allergies: z.string().optional(),
specialNeeds: z.string().optional(),
emergencyVetName: z.string().optional(),
emergencyVetPhone: z.string().optional(),
lastGroomDate: z.string().optional(),
```

**`server/src/modules/dog-profile/types.ts`** — Add to `VaccinationCreateSchema`:
```typescript
cloudinaryPublicId: z.string().optional(),
```

Also add `cloudinaryPublicId` to `VaccinationUpdateSchema` (it extends `VaccinationCreateSchema.partial()` so this is automatic).

**`server/src/modules/dog-profile/service.ts`** — Update:
- `getDogProfile` — include the new Dog fields in the response
- `updateDogProfile` — handle the new fields (they should pass through since Prisma accepts them)
- `addVaccination` — include `cloudinaryPublicId` in the create data
- `updateVaccination` — include `cloudinaryPublicId` in the update data

### 4. Mount Upload Routes

In `server/src/index.ts`, add:
```typescript
import v2UploadsRoutes from './modules/uploads/router';
// Mount after other v2 routes:
app.use('/api/v2/uploads', v2UploadsRoutes);
```

### 5. Add `.env.example` entries

Add to `server/.env.example` (if it exists, or note it):
```
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

**Do NOT put real Cloudinary credentials in any committed file.**

## Build Gate
```bash
cd server
npx tsc --noEmit          # Zero errors
npm run build 2>&1 | tail  # If build script exists
```

- [ ] `npx tsc --noEmit` passes
- [ ] All new files follow existing patterns (Zod types, service class, error class, router)
- [ ] Upload module uses env vars (no hardcoded secrets)
- [ ] Dog profile types updated with new fields

## Git Commit
```bash
git add server/src/modules/uploads/ server/src/modules/dog-profile/ server/src/index.ts server/package.json server/package-lock.json
git commit -m "feat(server): add upload module and extend dog profile fields

Add Cloudinary upload module (upload, delete, signed URL).
Extend DogProfileUpdateSchema with allergies, specialNeeds, emergencyVet fields.
Add cloudinaryPublicId to VaccinationCreateSchema.
Mount upload routes at /api/v2/uploads.

MS-2 of 8 micro-sprint rebuild."
```

## CHANGELOG Entry
```
### MS-2: Sprint A Server
- Added Cloudinary upload module with image optimization
- Extended dog profile API with allergies, special needs, emergency vet fields
- Vaccination records now support Cloudinary document uploads
- New endpoint: POST /api/v2/uploads for image uploads
```

## Next Session
Proceed to MS-3 (Sprint A Frontend — Cloudinary widget, dog profile UI, vaccination upload).
