import { Router } from 'express';
import {
  createCategory,
  deleteCategory,
  getOverview,
  listCertificates,
  listCourses,
  listReports,
  listUsers,
  updateCategory,
  updateCertificate,
  updateCourse,
  updateReport,
  updateUser,
} from '../controllers/adminController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));
router.get('/overview', getOverview);
router.get('/users', listUsers);
router.patch('/users/:userId', updateUser);
router.get('/courses', listCourses);
router.patch('/courses/:courseId', updateCourse);
router.post('/categories', createCategory);
router.patch('/categories/:categoryId', updateCategory);
router.delete('/categories/:categoryId', deleteCategory);
router.get('/certificates', listCertificates);
router.patch('/certificates/:certificateId', updateCertificate);
router.get('/reports', listReports);
router.patch('/reports/:reportId', updateReport);

export default router;
