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
};

export type ProgressInput = Pick<Progress, "charOffset" | "snippet">;

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
