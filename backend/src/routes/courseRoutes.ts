import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/permissions.js";
import {
  createCourse,
  getCourses,
  getAllCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  getFinanceItems,
  getLmsCourses,
} from "../controllers/courseController.js";

const router = Router();

router.use(authenticate);

// All courses (dropdown, no pagination)
router.get("/all", getAllCourses);

// The finance catalogue, for the mapping screen. Behind the same permission as
// editing a course, since that is what it is used to do.
router.get("/finance-items", checkPermission("leads", "edit"), getFinanceItems);
// The LMS's courses, for the same screen. Static, so before "/:id" — which
// would otherwise take "lms-courses" for a course id.
router.get("/lms-courses", checkPermission("leads", "edit"), getLmsCourses);

// Paginated list
router.get("/", getCourses);

// Single course
router.get("/:id", getCourseById);

// Create
router.post("/", checkPermission("leads", "create"), createCourse);

// Update
router.put("/:id", checkPermission("leads", "edit"), updateCourse);

// Delete
router.delete("/:id", checkPermission("leads", "delete"), deleteCourse);

export default router;
