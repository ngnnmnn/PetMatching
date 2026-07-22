declare module 'multer' {
  export function memoryStorage(): unknown;

  export function diskStorage(options: {
    destination: (
      req: unknown,
      file: { originalname: string; mimetype: string },
      callback: (error: Error | null, destination: string) => void,
    ) => void;
    filename: (
      req: unknown,
      file: { originalname: string; mimetype: string },
      callback: (error: Error | null, filename: string) => void,
    ) => void;
  }): unknown;
}
