// Categories interfaces

export interface ICategory {
  name: string;
  color: string;
  icon: string;
  dateAdded?: string;
  dateModified?: string;
}

export interface ICategoryData {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}
