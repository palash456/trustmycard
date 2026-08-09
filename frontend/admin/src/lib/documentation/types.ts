import type { ReactNode } from "react";

export type DocSubsection = {
  id: string;
  title: string;
  content: ReactNode;
};

export type DocSection = {
  id: string;
  title: string;
  content: ReactNode;
  subsections?: DocSubsection[];
};

export type DocPage = {
  slug: string;
  title: string;
  description: string;
  keywords?: string[];
  sections: DocSection[];
};

export type DocNavItem = {
  slug: string;
  title: string;
  keywords?: string[];
};

export type DocNavGroup = {
  id: string;
  title: string;
  items: DocNavItem[];
};

export type DocSearchResult = {
  slug: string;
  title: string;
  group: string;
  match: "title" | "keyword" | "section";
  sectionTitle?: string;
  sectionId?: string;
};

export type TocEntry = {
  id: string;
  title: string;
  level: 2 | 3;
};
