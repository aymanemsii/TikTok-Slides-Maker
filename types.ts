
export type AspectRatio = '9:16' | '1:1' | '16:9';

export enum TemplateType {
  NONE = 'none',
  MINIMAL_DARK = 'minimal_dark'
}

export type TextLayerType = 'heading' | 'body' | 'subtext';

export interface SlideTextLayer {
  id: string;
  type: TextLayerType;
  content: string;
  fontSize?: number; // Override global font size
  fontFamily?: string; // Override global font family
}

export interface SlideData {
  id: string;
  image: string; // Base64 or Blob URL
  layers: SlideTextLayer[];
  template: string; // Changed from TemplateType to string to support custom presets
  settings: TextSettings;
  effects: ImageEffects;
}

export interface TextSettings {
  fontSize: number;
  fontFamily: string;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  shadow: boolean;
  shadowBlur: number; // 0 to 100
  shadowColor?: string;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  positionX: number; // 0 to 100
  positionY: number; // 0 to 100
  alignment: 'left' | 'center' | 'right';
  constrainToSlide?: boolean;
}

export interface ImageEffects {
  enabled: boolean;
  grayscale: boolean;
  brightness: number; // 0 to 200
  contrast: number; // 0 to 200
  imageOffset: number; // Horizontal pan: 0 to 100
  imageOffsetY: number; // Vertical pan: 0 to 100
}

export interface CSVColumnMapping {
  textColumn: string;
  headingColumn: string;
  startRow: number;
}