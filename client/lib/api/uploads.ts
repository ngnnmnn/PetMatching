import api from '@/lib/axios';

export type UploadPurpose =
  | 'pet-avatar'
  | 'pet-gallery'
  | 'vaccine-document'
  | 'pedigree-document'
  | 'product'
  | 'spa-result'
  | 'review';

export type UploadedImage = {
  url: string;
  publicId: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
};

export async function uploadImages(
  files: File[],
  purpose: UploadPurpose,
): Promise<UploadedImage[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  formData.append('purpose', purpose);

  const response = await api.post<{ images: UploadedImage[] }>(
    '/uploads/images',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return response.data.images;
}

