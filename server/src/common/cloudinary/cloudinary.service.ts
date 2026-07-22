import { Inject, Injectable, Logger } from '@nestjs/common';
import type { UploadApiOptions, UploadApiResponse, v2 } from 'cloudinary';
import { Readable } from 'stream';
import { CLOUDINARY } from './cloudinary.constants';

export type CloudinaryImage = {
  url: string;
  publicId: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
};

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(@Inject(CLOUDINARY) private readonly client: typeof v2) {}

  async uploadBuffer(
    buffer: Buffer,
    folder: string,
    options: UploadApiOptions = {},
  ): Promise<CloudinaryImage> {
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = this.client.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          unique_filename: true,
          overwrite: false,
          ...options,
        },
        (error: any, uploaded: UploadApiResponse | undefined) => {
          if (error || !uploaded) {
            reject(error ?? new Error('Cloudinary did not return an upload result.'));
            return;
          }
          resolve(uploaded);
        },
      );
      Readable.from(buffer).pipe(stream);
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      format: result.format,
    };
  }

  async uploadDataUrl(dataUrl: string, folder: string): Promise<CloudinaryImage> {
    const result = await this.client.uploader.upload(dataUrl, {
      folder,
      resource_type: 'image',
      unique_filename: true,
      overwrite: false,
      quality: 'auto:good',
      fetch_format: 'auto',
    });
    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      format: result.format,
    };
  }

  async destroyByUrl(url?: string | null): Promise<void> {
    const publicId = this.publicIdFromUrl(url);
    if (!publicId) return;

    try {
      await this.client.uploader.destroy(publicId, {
        resource_type: 'image',
        invalidate: true,
      });
    } catch (error) {
      this.logger.warn(
        `Could not delete Cloudinary asset ${publicId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  publicIdFromUrl(url?: string | null): string | null {
    if (!url || !url.includes('res.cloudinary.com/')) return null;
    try {
      const pathname = new URL(url).pathname;
      const uploadMarker = '/upload/';
      const markerIndex = pathname.indexOf(uploadMarker);
      if (markerIndex < 0) return null;

      let assetPath = pathname.slice(markerIndex + uploadMarker.length);
      assetPath = assetPath.replace(/^v\d+\//, '');
      return decodeURIComponent(assetPath).replace(/\.[^/.]+$/, '');
    } catch {
      return null;
    }
  }
}

