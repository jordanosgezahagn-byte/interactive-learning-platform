import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { Router } from 'express';
import {
  createCourse,
  createExercise,
  createLesson,
  createMaterial,
  createModule,
  createQuiz,
  createQuestion,
  createStarterCourses,
  deleteCourse,
  deleteQuiz,
  deleteQuestion,
  deleteLesson,
  deleteModule,
  deleteExercise,
  deleteMaterial,
  ensureOwnedLesson,
  getCourse,
  gradeExerciseSubmission,
  listCourseEnrollments,
  listCourses,
  listStudentSubmissions,
  reviewCertificateRequest,
  updateCourse,
  updateCourseStatus,
  updateExercise,
  updateLesson,
  updateModule,
  updateQuiz,
  updateQuestion,
} from '../controllers/instructorController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();
const uploadDirectory = fileURLToPath(new URL('../uploads/', import.meta.url));
mkdirSync(uploadDirectory, { recursive: true });

const allowedTypes = new Map([
  ['.pdf', ['application/pdf']],
  ['.txt', ['text/plain']],
  ['.md', ['text/markdown', 'text/plain']],
  ['.zip', ['application/zip', 'application/x-zip-compressed', 'application/octet-stream']],
  ['.png', ['image/png']],
  ['.jpg', ['image/jpeg']],
  ['.jpeg', ['image/jpeg']],
]);
const upload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => callback(null, uploadDirectory),
    filename: (_request, file, callback) => {
      const extension = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
      callback(null, `${randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    const extension = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
    const mimeTypes = allowedTypes.get(extension);
    if (!mimeTypes || !mimeTypes.includes(file.mimetype)) {
      callback(new Error('Upload a PDF, text, Markdown, ZIP, PNG, or JPEG file.'));
      return;
    }
    callback(null, true);
  },
});

function handleMaterialUpload(request, response, next) {
  upload.single('material')(request, response, (error) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      response.status(413).json({ error: 'Learning materials must be 10 MB or smaller.' });
      return;
    }
    response.status(400).json({ error: error.message || 'The learning material could not be uploaded.' });
  });
}

router.use(requireAuth, requireRole('instructor'));
router.get('/courses', listCourses);
router.post('/courses', createCourse);
router.post('/starter-courses', createStarterCourses);
router.get('/courses/:courseId', getCourse);
router.patch('/courses/:courseId', updateCourse);
router.patch('/courses/:courseId/status', updateCourseStatus);
router.delete('/courses/:courseId', deleteCourse);
router.post('/courses/:courseId/modules', createModule);
router.patch('/modules/:moduleId', updateModule);
router.delete('/modules/:moduleId', deleteModule);
router.get('/courses/:courseId/students/:studentId/submissions', listStudentSubmissions);
router.patch('/exercise-submissions/:submissionId', gradeExerciseSubmission);
router.get('/courses/:courseId/students', listCourseEnrollments);
router.patch('/certificates/:certificateId', reviewCertificateRequest);
router.post('/courses/:courseId/quizzes', createQuiz);
router.patch('/quizzes/:quizId', updateQuiz);
router.delete('/quizzes/:quizId', deleteQuiz);
router.post('/quizzes/:quizId/questions', createQuestion);
router.patch('/questions/:questionId', updateQuestion);
router.delete('/questions/:questionId', deleteQuestion);
router.post('/modules/:moduleId/lessons', createLesson);
router.patch('/lessons/:lessonId', updateLesson);
router.delete('/lessons/:lessonId', deleteLesson);
router.post('/lessons/:lessonId/exercises', createExercise);
router.patch('/exercises/:exerciseId', updateExercise);
router.delete('/exercises/:exerciseId', deleteExercise);
router.post('/lessons/:lessonId/materials', ensureOwnedLesson, handleMaterialUpload, createMaterial);
router.delete('/materials/:materialId', deleteMaterial);

export default router;
