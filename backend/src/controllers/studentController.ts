import type { Request, Response, NextFunction } from "express";
import { StudentService } from "../services/studentService.js";
import { sendSuccess, sendError } from "../utils/response.js";

const svc = new StudentService();

export const createStudent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const student = await svc.createStudent(req.body);
    sendSuccess(res, "Student created", student, 201);
  } catch (err) { next(err); }
};

export const getStudents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.getStudents(req.query as Record<string, string>);
    res.json({ success: true, data: result.students, pagination: result.pagination });
  } catch (err) { next(err); }
};

export const getStudentById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const student = await svc.getStudentById(req.params.id);
    sendSuccess(res, "Student fetched", student);
  } catch (err) { next(err); }
};

export const getStudentByLeadId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const student = await svc.getStudentByLeadId(req.params.leadId);
    sendSuccess(res, "Student fetched", student ?? null);
  } catch (err) { next(err); }
};

export const updateStudent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const student = await svc.updateStudent(req.params.id, req.body);
    sendSuccess(res, "Student updated", student);
  } catch (err) { next(err); }
};

export const deleteStudent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.deleteStudent(req.params.id);
    sendSuccess(res, "Student deleted", { deleted: result });
  } catch (err) { next(err); }
};
