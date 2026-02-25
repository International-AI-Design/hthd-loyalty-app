import { Router, Request, Response } from 'express';
import { authenticateCustomer, AuthenticatedCustomerRequest } from '../../middleware/auth';
import { singleImageUpload } from './middleware';
import { uploadImage, deleteImage } from './cloudinary';
import { prisma } from '../../lib/prisma';

const router = Router();

router.use(authenticateCustomer);

// POST / — upload an image
router.post('/', singleImageUpload, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided' });
      return;
    }

    const result = await uploadImage(req.file.buffer);
    res.status(201).json(result);
  } catch (error: any) {
    if (error.message?.includes('Invalid file type')) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// DELETE /:publicId(*) — delete an upload (only if owned by customer)
router.delete('/:publicId(*)', async (req: Request, res: Response): Promise<void> => {
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
