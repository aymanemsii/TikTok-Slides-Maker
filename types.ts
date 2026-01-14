
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
  customName?: string;
  fontSize?: number;
  fontFamily?: string;
  width?: number; // Width as percentage of slide (0-100)
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  selected?: boolean;
  alignment?: 'left' | 'center' | 'right';
  lineHeight?: number;
  letterSpacing?: number;
  stroke?: boolean;
  strokeColor?: string;
  strokeWidth?: number;
  uppercase?: boolean;
}

export interface SlideData {
  id: string;
  image: string;
  layers: SlideTextLayer[];
  template: string;
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
  shadowBlur: number;
  shadowOpacity: number;
  shadowColor?: string;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  positionX: number; // Global baseline (fallback)
  positionY: number; // Global baseline (fallback)
  alignment: 'left' | 'center' | 'right';
  constrainToSlide?: boolean;
}

export interface ImageEffects {
  enabled: boolean;
  grayscale: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  imageOffset: number;
  imageOffsetY: number;
}

export interface CSVColumnMapping {
  textColumn: string;
  headingColumn: string;
  startRow: number;
}