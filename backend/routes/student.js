import { Router } from 'express';
import {
  completeLesson,
  enrollInCourse,
  getStudentCourse,
  listStudentCourses,
  submitExercise,
  submitQuizAttempt,
} from '../controllers/courseController.js';
import { requestCertificate } from '../controllers/certificateController.js';
import { submitContentReport } from '../controllers/adminController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

router.use(requireAuth, requireRole('student'));
router.get('/courses', listStudentCourses);
router.post('/courses/:courseId/enroll', enrollInCourse);
router.post('/courses/:courseId/certificate-requests', requestCertificate);
router.post('/reports', submitContentReport);
router.get('/courses/:courseId', getStudentCourse);
router.post('/lessons/:lessonId/complete', completeLesson);
router.post('/exercises/:exerciseId/submissions', submitExercise);
router.post('/quizzes/:quizId/attempts', submitQuizAttempt);

export default router;
