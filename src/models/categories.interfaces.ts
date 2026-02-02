// Categories interfaces

export interface ICategory {
  categoryId: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  status: string;
  dateAdded?: string;
  dateDeleted?: string;
}

export interface ICategoryData {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}
