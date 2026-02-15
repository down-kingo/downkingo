export interface TranscribeResult {
  text: string;
  segments: Segment[];
  language: string;
  duration: number;
}

export interface Segment {
  start: number;
  end: number;
  text: string;
}

export interface ModelInfo {
  name: string;
  size: number;
  path: string;
}

export interface AvailableModel {
  name: string;
  size: string;
  description: string;
}

export interface TranscribeRequest {
  filePath: string;
  model: string;
  language: string;
  outputFormat: string;
}
