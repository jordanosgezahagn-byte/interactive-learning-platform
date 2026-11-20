import { Router } from 'express';
import { getPublishedCourse, listPublishedCourses } from '../controllers/courseController.js';

const router = Router();

router.get('/', listPublishedCourses);
router.get('/:courseId', getPublishedCourse);

export default router;
