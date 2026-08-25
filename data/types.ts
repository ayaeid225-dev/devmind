import type { IconName } from "@/components/ui";

export interface Repo {
  name: string;
  owner: string;
  branch?: string;
  branches?: string[];
  lang?: string;
  updated?: string;
  contributors?: number;
  files?: number;
  modules?: number;
  deps?: number;
  private?: boolean;
  desc?: string;
  tooLarge?: boolean;
}

export type ModuleType = "core" | "api" | "db" | "ext";

export type KeyFunction = [string, string];

export interface ModuleFixture {
  id: string;
  name: string;
  type: ModuleType;
  files: number;
  x: number;
  y: number;
  desc: string;
  keyFns: KeyFunction[];
  deps: string[];
  dependents: string[];
  related: string[];
  ai: string;
}

export type GraphEdge = [string, string];

export interface WorldDimensions {
  w: number;
  h: number;
}

export interface HeroModule {
  id: string;
  name: string;
  type: ModuleType;
  x: number;
  y: number;
  files: number;
}

export interface CodeSnippet {
  lines: string[];
  hl: number[];
}

export interface FileFixture {
  path: string;
  module: string;
  type: string;
  note: string;
  code: CodeSnippet;
}

export interface FileListItem {
  path: string;
  module: string;
  kind: string;
  size: string;
  updated: string;
}

export interface DocCategory {
  id: string;
  name: string;
  icon: IconName;
  count: number;
  updated: string;
  coverage: number;
}

export type DocSection =
  | { t: "h2"; text: string }
  | { t: "p"; text: string }
  | { t: "flow"; items: string[] }
  | { t: "list"; items: string[] }
  | { t: "modules"; ids: string[] }
  | { t: "evidence"; files: string[] }
  | { t: "decisions"; ids: string[] }
  | { t: "endpoint"; method: string; path: string; desc: string }
  | { t: "code"; code: string; lang?: string };

export interface DocItem {
  id: string;
  title: string;
  category: string;
  author: string;
  updated: string;
  status: "current" | "review" | "outdated";
  coverage: number;
  modules: string[];
  relFiles: string[];
  relDecisions: string[];
  owner: string;
  tags: string[];
  summary: string;
  match?: { status: string; note: string };
  outdated?: { changed: string; lastDocUpdate: string; changeFiles: string[] };
  sections: DocSection[];
}

export interface ADR {
  id: string;
  title: string;
  status: string;
  date: string;
  module: string;
  author: string;
  summary: string;
  linkedDocs: string[];
  linkedFiles: string[];
}

export interface TeamSkill {
  area: string;
  coverage: number;
}

export type DeveloperRadarItem = [string, number];

export interface Developer {
  id: string;
  name: string;
  role: string;
  color: string;
  strongAreas: string[];
  developingAreas: string[];
  modules: string[];
  contributions: string[];
  recent: string;
  coverage: number;
  radar: DeveloperRadarItem[];
  focus: string[];
  learning: string[];
  knowledge: string[];
  activity: string;
  blurb: string;
}

export interface TeamKnowledge {
  dev: string;
  color: string;
  links: [string, string][];
}

export interface Concentration {
  module: string;
  level: "high" | "medium" | "low";
  devs: number;
  title: string;
  cover: string;
  insight: string;
  evidence: string;
  actions: string[];
}

export interface Recommendation {
  title: string;
  why: string;
  evidence: string;
  action: string;
  module: string | null;
}

export interface ActivityItem {
  icon: IconName;
  text: string;
  by: string;
  when: string;
  cat: string;
}

export interface DesignToken {
  token: string;
  value: string;
  used: string;
  file: string;
  note: string;
}

export interface ScreenLink {
  screen: string;
  file: string;
  match: "match" | "diff";
  diff?: string;
}

export interface KnowledgeItem {
  type: "adr" | "doc" | "fact";
  title: string;
  by: string;
  when: string;
  target: string;
}

export interface QAItem {
  q: string;
  a: string;
  evidence: string[];
  conf: number;
  modules: string[];
}

export interface InternalDependency {
  from: string;
  to: string;
  kind: string;
}

export interface ExternalDependency {
  name: string;
  ver: string;
  type: "db" | "ext";
  purpose: string;
  status: string;
}

export interface Commit {
  hash: string;
  msg: string;
  who: string;
  when: string;
}

export type LessonSection =
  | { t: "p"; text: string }
  | { t: "list"; items: string[] }
  | { t: "code"; code: string; lang?: string }
  | { t: "callout"; text: string; kind?: string }
  | { t: "evidence"; files: string[] }
  | { t: "modules"; ids: string[] }
  | { t: "check"; q: string; options: string[]; answer: number };

export interface Lesson {
  id: string;
  title: string;
  mins: number;
  sections: LessonSection[];
}

export interface PathStep {
  id: string;
  title: string;
  module: string | null;
  mins: number;
  why: string;
  rel: string[];
  lessons: Lesson[];
}
