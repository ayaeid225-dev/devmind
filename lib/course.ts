"use client";

import { useSyncExternalStore } from "react";
import { PATH } from "@/data/fixtures";

/*
 * Course completion state, ported from DM.STORE.course (done: [], current:
 * 'ov-architecture'). A module-level store + useSyncExternalStore keeps the
 * sidebar badge, topbar bell and lesson screens in sync without a provider.
 */

let done: readonly string[] = [];
let current = "ov-architecture";
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function snapshotDone(): string {
  return done.join(",");
}

export function useCourseDone(): readonly string[] {
  const joined = useSyncExternalStore(subscribe, snapshotDone, snapshotDone);
  return joined.length ? joined.split(",") : [];
}

export function useCurrentLesson(): string {
  return useSyncExternalStore(subscribe, () => current, () => current);
}

export function setCurrentLesson(id: string) {
  if (current === id) return;
  current = id;
  emit();
}

export function isLessonDone(doneIds: readonly string[], id: string): boolean {
  return doneIds.includes(id);
}

export function markLessonComplete(lessonId: string) {
  if (done.includes(lessonId)) return;
  done = [...done, lessonId];
  emit();
}

export interface CourseStats {
  done: number;
  total: number;
  pct: number;
}

/* app.js courseStats(): counts completed lessons across all PATH steps */
export function courseStats(doneIds: readonly string[]): CourseStats {
  const total = PATH.reduce((n, st) => n + st.lessons.length, 0);
  const ids = new Set(doneIds);
  const doneCount = PATH.reduce(
    (n, st) => n + st.lessons.filter((l) => ids.has(l.id)).length,
    0
  );
  return {
    done: doneCount,
    total,
    pct: total ? Math.round((doneCount / total) * 100) : 0,
  };
}

/** Flattened [step, lesson] pairs in course order. */
export function courseFlat(): { stepId: string; lessonId: string }[] {
  return PATH.flatMap((st) =>
    st.lessons.map((l) => ({ stepId: st.id, lessonId: l.id }))
  );
}
