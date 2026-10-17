export type Book = {
  id: string;
  title: string;
  filename: string;
  size: number;
  createdAt: number;
  pathname: string;
  url: string;
};

export type Progress = {
  charOffset: number;
  snippet: string;
  updatedAt: number;
  deviceId: string;
};

export type PublicBook = {
  id: string;
  title: string;
  filename: string;
  size: number;
  createdAt: number;
  progress: Progress | null;
};

export type NovelContent = {
  styles: string;
  body: string;
};
