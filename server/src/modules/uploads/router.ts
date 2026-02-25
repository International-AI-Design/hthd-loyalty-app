import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticateCustomer, AuthenticatedCustomerRequest } from '../../middleware/auth';
import { singleImageUpload } from './middleware';
import { uploadImage, deleteImage } from './cloudinary';
import { prisma } from '../../lib/prisma';

const router = Router();

router.use(authenticateCustomer);

// Wrapper to catch multer errors (file type, size) as 400 responses
function handleMulterUpload(req: Request, res: Response, next: NextFunction): void {
  singleImageUpload(req, res, (err?: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    next();
  });
}

// POST / — upload an image
router.post('/', handleMulterUpload, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided' });
      return;
    }

    const result = await uploadImage(req.file.buffer);
    res.status(201).json(result);
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// DELETE /:publicId — delete an upload (only if owned by customer)
// Express 5 wildcard syntax captures path segments including slashes (e.g. hthd/abc123)
router.delete('/{*publicId}', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const rawId = req.params.publicId;
    const publicId = Array.isArray(rawId) ? rawId.join('/') : rawId;

    // Check if this publicId is associated with the customer's dog photo or vaccination
    const dog = await prisma.dog.findFirst({
      where: {
        customerId: customerReq.customer.id,
        photoUrl: { contains: publicId },
      },
    });

    const vaccination = await (prisma as any).vaccination.findFirst({
      where: {
        cloudinaryPublicId: publicId,
        dog: { customerId: customerReq.customer.id },
      },
    });

    if (!dog && !vaccination) {
      res.status(403).json({ error: 'You can only delete your own uploads' });
      return;
    }

    await deleteImage(publicId);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete upload error:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

export default router;
