export interface OptimizeImageOptions {
  maxSide?: number;
  quality?: number;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
}

export const optimizeImageFile = (
  file: File,
  {
    maxSide = 640,
    quality = 0.82,
    mimeType = 'image/jpeg',
  }: OptimizeImageOptions = {},
) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * ratio));
        const height = Math.max(1, Math.round(image.height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('No pudimos preparar la imagen.'));
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL(mimeType, quality));
      };

      image.onerror = () => reject(new Error('La imagen seleccionada no es valida.'));
      image.src = typeof reader.result === 'string' ? reader.result : '';
    };

    reader.onerror = () => reject(new Error('No pudimos leer la imagen seleccionada.'));
    reader.readAsDataURL(file);
  });
