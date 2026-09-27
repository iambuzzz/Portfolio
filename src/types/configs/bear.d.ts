export interface BearMdData {
  id: string;
  title: string;
  /** Remote/public markdown URL, or inline `content`. */
  file?: string;
  content?: string;
  icon: string;
  excerpt: string;
  link?: string;
}

export interface BearData {
  id: string;
  title: string;
  icon: string;
  md: BearMdData[];
}
