import { Router } from 'express';
import { getPublicCertificate } from '../controllers/certificateController.js';

const router = Router();

router.get('/:certificateCode', getPublicCertificate);

export default router;
