import type { StarData } from "../particles/star";
import type { SparkData } from "../particles/spark";
export interface RendererConfig {
 stageW: number;
 stageH: number;
 dpr: number;
 scaleFactor: number;
 longExposure: boolean;
 debug: boolean;
}
export interface DirtyRect {
  x: number
  y: number
  w: number
  h: number
}

export interface RendererData {
  stars: Record<string, StarData[]>;
  sparks: Record<string, SparkData[]>;
  burstFlashes: {
    x: number;
    y: number;
    radius: number;
  }[];
  starColors: string[];
  sparkColors: string[];
  invisibleKey: string;
  speed: number;
  longExposure: boolean;
  debugLines: string[];
  skyColor: { r: number; g: number; b: number };
  dirtyRect: DirtyRect | null;
}
export interface Renderer {
 canvas: HTMLCanvasElement;
 init(container: HTMLElement): boolean;
 resize(width: number, height: number, stageW: number, stageH: number, dpr: number): void;
 setScaleFactor(scale: number): void;
 render(data: RendererData): void;
 destroy(): void;
}
