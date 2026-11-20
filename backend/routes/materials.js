import { Router } from 'express';
import { downloadMaterial } from '../controllers/instructorController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.get('/:materialId', requireAuth, downloadMaterial);

export default router;
