export interface Course {
  _id: string;
  name: string;
  description?: string;
  amount: number;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface CourseFilters {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}
