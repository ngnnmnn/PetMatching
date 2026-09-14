import type { Prisma } from '@prisma/client';

type NumericInput = number | string | null;

export interface ManagerProductVariantInput {
  name: string;
  sellingPrice?: NumericInput;
  salePrice?: NumericInput;
  importPrice?: NumericInput;
  stock?: NumericInput;
  imageUrl?: string | null;
  isActive?: boolean;
}

export interface CreateManagerProductInput {
  name: string;
  category: string;
  targetSpecies?: string;
  description?: string | null;
  imageUrl?: string | null;
  images?: string[];
  specifications?: Prisma.InputJsonValue | null;
  sellingPrice: NumericInput;
  importPrice?: NumericInput;
  salePrice?: NumericInput;
  brand?: string | null;
  stock?: NumericInput;
  isActive?: boolean;
  isFeatured?: boolean;
  variants?: ManagerProductVariantInput[];
}

export type UpdateManagerProductInput = Partial<CreateManagerProductInput>;
