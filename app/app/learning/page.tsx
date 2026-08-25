"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, Badge, Button } from "@/components/ui";
import { PATH } from "@/data/fixtures";
import {
  courseFlat,
  courseStats,
  useCourseDone,
} from "@/lib/course";

export default function LearningPage() {
  const router = useRouter();
  const completedLessons = useCourseDone();

  const stats = courseStats(completedLessons);
  const flat = courseFlat();

  // Find next uncompleted lesson pair
  let targetPair = flat.find((f) => !completedLessons.includes(f.lessonId));
  if (!targetPair && flat.length > 0) {
    targetPair = flat[0];
  }

  const targetStep = targetPair
    ? PATH.find((p) => p.id === targetPair!.stepId)
    : null;
  const targetLesson = targetStep && targetPair
    ? targetStep.lessons.find((l) => l.id === targetPair!.lessonId)
    : null;

  const isComplete = stats.done === stats.total && stats.total > 0;
  const isStarted = stats.done > 0;

  const btnLabel = !isStarted
    ? "Start the course"
    : isComplete
    ? "Review lessons"
    : "Continue learning";

  const handleContinue = () => {
    if (targetPair) {
      router.push(`/app/learning/lesson/${targetPair.stepId}/${targetPair.lessonId}`);
    }
  };

  return (
    <div className="fade-up">
      {/* Page Header */}
      <div className="page-head">
        <h1 className="page-title">Course: understand clinic-management</h1>
        <p className="page-sub">
          A guided, text-based onboarding course built from the intelligence map.
          Complete each lesson to track your progress.
        </p>
      </div>

      {/* Course Progress Card */}
      <div className="card card-pad mb24">
        <div className="row between align-center">
          <div>
            <b style={{ fontSize: 14 }}>
              {stats.done} of {stats.total} lessons completed
            </b>
            <div className="t3 small mt8">
              {targetStep && targetLesson && !isComplete ? (
                <>
                  Up next:{" "}
                  <b className="t2">
                    {targetStep.title} — {targetLesson.title}
                  </b>
                </>
              ) : isComplete ? (
                "Course complete — great work. You understand this codebase."
              ) : (
                ""
              )}
            </div>
          </div>
          <Button variant="primary" id="course-continue" onClick={handleContinue}>
            {btnLabel} <Icon name="arrowRight" className="ic-sm" />
          </Button>
        </div>

        <div className="progress mt16">
          <span style={{ transform: `scaleX(${stats.pct / 100})` }} />
        </div>
      </div>

      {/* Course Steps Curriculum */}
      <div className="course-steps">
        {PATH.map((p, si) => {
          const stepDone = p.lessons.every((l) =>
            completedLessons.includes(l.id)
          );
          const doneCount = p.lessons.filter((l) =>
            completedLessons.includes(l.id)
          ).length;
          const stepPct = p.lessons.length
            ? Math.round((doneCount / p.lessons.length) * 100)
            : 0;

          return (
            <div key={p.id} className={`card course-step ${stepDone ? "done" : ""}`}>
              <div className="course-step-head">
                <span className="ps-num">
                  {stepDone ? <Icon name="check" /> : `0${si + 1}`}
                </span>
                <div className="grow">
                  <div className="row gap8 align-center">
                    <span className="ps-title">{p.title}</span>
                    <Badge variant="gray" small>
                      {p.lessons.length} lessons • ~{p.mins} min
                    </Badge>
                    {stepDone && (
                      <Badge variant="success" small dot>
                        Completed
                      </Badge>
                    )}
                  </div>
                  <p className="ps-why">{p.why}</p>
                  <div className="step-progress">
                    <span style={{ width: `${stepPct}%` }} />
                  </div>
                </div>
              </div>

              <div className="course-lessons">
                {p.lessons.map((l, li) => {
                  const isLessonDone = completedLessons.includes(l.id);
                  const isTarget = targetPair?.lessonId === l.id;
                  const statusCls = isLessonDone
                    ? "done"
                    : isTarget
                    ? "cur"
                    : "up";

                  return (
                    <Link
                      key={l.id}
                      href={`/app/learning/lesson/${p.id}/${l.id}`}
                      className={`course-lesson ${statusCls}`}
                      style={{ textDecoration: "none" }}
                    >
                      <span className="cl-ic">
                        <Icon
                          name={
                            isLessonDone
                              ? "checkCircle"
                              : isTarget
                              ? "play"
                              : "clock"
                          }
                        />
                      </span>
                      <span className="grow">
                        <b className="cl-title">{l.title}</b>
                        <span className="cl-meta">
                          {si + 1}.{li + 1} • ~{l.mins} min
                          {isTarget ? " • In progress" : ""}
                        </span>
                      </span>
                      <span className="cl-go">
                        {isLessonDone ? "Review" : "Start"}{" "}
                        <Icon name="arrowRight" className="ic-sm" />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
