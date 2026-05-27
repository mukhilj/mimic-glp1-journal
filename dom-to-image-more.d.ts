// Type declarations for dom-to-image-more
declare module 'dom-to-image-more' {
  export function toBlob(
    node: HTMLElement,
    options?: {
      quality?: number;
      bgcolor?: string;
      width?: number;
      height?: number;
      style?: any;
      filter?: (node: HTMLElement) => boolean;
      cacheBust?: boolean;
    }
  ): Promise<Blob>;

  export function toPng(
    node: HTMLElement,
    options?: any
  ): Promise<string>;

  export function toJpeg(
    node: HTMLElement,
    options?: any
  ): Promise<string>;

  export function toSvg(
    node: HTMLElement,
    options?: any
  ): Promise<string>;

  export function toPixelData(
    node: HTMLElement,
    options?: any
  ): Promise<Uint8ClampedArray>;
}