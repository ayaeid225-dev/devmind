"use client";

import React, { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, Badge, Button, useToast } from "@/components/ui";
import { PATH, FILES, MODULES } from "@/data/fixtures";
import type { LessonSection } from "@/data/types";
import {
  courseFlat,
  courseStats,
  markLessonComplete,
  useCourseDone,
} from "@/lib/course";

function getFileByKey(key: string) {
  return FILES[key];
}

function getModuleById(id: string) {
  return MODULES.find((m) => m.id === id);
}

function parseRichText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(<b key={match.index}>{token.slice(2, -2)}</b>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(<code key={match.index}>{token.slice(1, -1)}</code>);
    }
    lastIdx = match.index + token.length;
  }
  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }
  return parts;
}

// Interactive Quiz Component
function KnowledgeCheckQuiz({
  sec,
}: {
  sec: Extract<LessonSection, { t: "check" }>;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const handleSelectOption = (idx: number) => {
    if (isLocked) return;
    setSelectedIdx(idx);
    setIsLocked(true);
  };

  const handleRetry = () => {
    setSelectedIdx(null);
    setIsLocked(false);
  };

  const isCorrect = selectedIdx === sec.answer;

  return (
    <div className="ls-check">
      <div className="ls-check-head">
        <span className="ls-check-ic">
          <Icon name="brain" className="ic-sm" />
        </span>
        <b>Knowledge check</b>
      </div>
      <p className="ls-check-q">{sec.q}</p>
      <div className="ls-check-opts">
        {sec.options.map((opt, i) => {
          let optCls = "ls-check-opt";
          if (isLocked) {
            optCls += " locked";
            if (i === sec.answer) {
              optCls += " right";
            } else if (i === selectedIdx && !isCorrect) {
              optCls += " wrong";
            }
          }

          return (
            <button
              key={i}
              type="button"
              className={optCls}
              onClick={() => handleSelectOption(i)}
            >
              <span className="lso-key">{String.fromCharCode(65 + i)}</span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>

      {isLocked && (
        <div className="ls-check-fb">
          {isCorrect ? (
            <span className="check-fb-ok">
              <Icon name="checkCircle" className="ic-sm" /> Correct — well done.
            </span>
          ) : (
            <div>
              <span className="check-fb-no">
                <Icon name="alert" className="ic-sm" /> Not quite. Review the
                section above and try again.
              </span>
              <div className="mt8">
                <Button variant="secondary" size="sm" onClick={handleRetry}>
                  Retry
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LessonPlayerPage({
  params,
}: {
  params: Promise<{ step: string; id: string }>;
}) {
  const { step: stepId, id: lessonId } = use(params);
  const router = useRouter();
  const toast = useToast();

  const completedLessons = useCourseDone();

  const flat = courseFlat();
  const currentIdx = flat.findIndex(
    (f) => f.stepId === stepId && f.lessonId === lessonId
  );

  const step = PATH.find((p) => p.id === stepId);
  const lesson = step ? step.lessons.find((l) => l.id === lessonId) : undefined;

  const [openStepId, setOpenStepId] = useState<string>(stepId);

  if (!step || !lesson) {
    return (
      <div className="fade-up">
        <div className="page-head">
          <h1 className="page-title">Lesson Not Found</h1>
          <p className="page-sub">
            No lesson matches step &quot;{stepId}&quot; and lesson &quot;{lessonId}&quot;.
          </p>
        </div>
        <div className="mt24">
          <Link href="/app/learning">
            <Button variant="primary">
              <Icon name="arrowLeft" className="ic-sm" /> Back to Course Overview
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const stepIdx = PATH.findIndex((p) => p.id === step.id);
  const isDone = completedLessons.includes(lesson.id);
  const stats = courseStats(completedLessons);

  const prevPair = currentIdx > 0 ? flat[currentIdx - 1] : null;
  const nextPair = currentIdx !== -1 && currentIdx < flat.length - 1 ? flat[currentIdx + 1] : null;

  const prevStep = prevPair ? PATH.find((p) => p.id === prevPair.stepId) : null;
  const prevLesson = prevStep && prevPair ? prevStep.lessons.find((l) => l.id === prevPair.lessonId) : null;

  const nextStep = nextPair ? PATH.find((p) => p.id === nextPair.stepId) : null;
  const nextLesson = nextStep && nextPair ? nextStep.lessons.find((l) => l.id === nextPair.lessonId) : null;

  const handleMarkComplete = () => {
    markLessonComplete(lesson.id);
    toast("Lesson marked complete", "success");
  };

  const handleNextLesson = () => {
    markLessonComplete(lesson.id);
    if (nextPair) {
      router.push(
        `/app/learning/lesson/${nextPair.stepId}/${nextPair.lessonId}`
      );
    } else {
      router.push("/app/learning");
    }
  };

  return (
    <div className="fade-up course-player">
      {/* TOC Sidebar */}
      <div className="course-side">
        <div className="course-side-top">
          <div className="row gap8 align-center">
            <span className="sb-logo" style={{ width: 26, height: 26 }}>
              <Icon name="learning" className="ic-lg" />
            </span>
            <b style={{ fontSize: 13 }}>Course</b>
          </div>
          <div className="t3 tiny mt8" style={{ lineHeight: 1.5 }}>
            Guided onboarding for
            <br />
            <b className="t2">clinic-management</b>
          </div>
          <Link href="/app/learning" style={{ textDecoration: "none" }}>
            <Button
              variant="ghost"
              size="sm"
              className="mt16"
              style={{ width: "100%", justifyContent: "flex-start" }}
            >
              <Icon name="overview" className="ic-sm" /> All steps
            </Button>
          </Link>
        </div>

        {/* TOC Steps Accordion */}
        <div className="lt-toc">
          {PATH.map((p, si) => {
            const isOpen = openStepId === p.id;
            const stDone = p.lessons.every((l) =>
              completedLessons.includes(l.id)
            );

            return (
              <div
                key={p.id}
                className={`lt-step ${isOpen ? "open" : ""}`}
              >
                <div
                  className="lt-step-head"
                  onClick={() => setOpenStepId(isOpen ? "" : p.id)}
                  style={{ cursor: "pointer" }}
                >
                  <span className="lt-num">
                    {stDone ? <Icon name="check" className="ic-sm" /> : `0${si + 1}`}
                  </span>
                  <span className="lt-name">{p.title}</span>
                  <span className="lt-chev">
                    <Icon name="chevronDown" className="ic-sm" />
                  </span>
                </div>

                <div className="lt-lessons">
                  {p.lessons.map((l) => {
                    const isLessonDone = completedLessons.includes(l.id);
                    const isActive = l.id === lessonId;

                    return (
                      <Link
                        key={l.id}
                        href={`/app/learning/lesson/${p.id}/${l.id}`}
                        className={`lt-lesson ${isActive ? "active" : ""} ${
                          isLessonDone ? "done" : ""
                        }`}
                        style={{ textDecoration: "none" }}
                      >
                        <span className="lt-li-ic">
                          <Icon
                            name={isLessonDone ? "checkCircle" : "file"}
                            className="ic-sm"
                          />
                        </span>
                        <span className="grow">{l.title}</span>
                        <span className="lt-li-min">{l.mins}m</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="course-side-foot">
          {stats.done} / {stats.total} lessons done
        </div>
      </div>

      {/* Main Lesson Body */}
      <div className="course-body">
        {/* Lesson Header */}
        <div className="course-head">
          <div className="row gap8 mb8 align-center">
            <Badge variant="gray" small>
              Step {stepIdx + 1} of {PATH.length}
            </Badge>
            <Badge variant="outline" small>
              <Icon name="clock" className="ic-sm" /> ~{lesson.mins} min
            </Badge>
            {isDone ? (
              <Badge variant="success" small>
                <Icon name="checkCircle" className="ic-sm" /> Completed
              </Badge>
            ) : (
              <Badge variant="lime" small>
                <Icon name="play" className="ic-sm" /> In progress
              </Badge>
            )}
          </div>

          <h1 className="page-title" style={{ fontSize: 26 }}>
            {lesson.title}
          </h1>
          <p className="page-sub">{step.title}</p>
        </div>

        {/* Lesson Content Sections */}
        <div className="course-content">
          {(lesson.sections as LessonSection[]).map((s, idx) => {
            if (s.t === "p") {
              return (
                <p key={idx} className="ls-p">
                  {parseRichText(s.text)}
                </p>
              );
            }

            if (s.t === "list") {
              return (
                <ul key={idx} className="ls-list">
                  {s.items.map((it: string, itemIdx: number) => (
                    <li key={itemIdx}>{parseRichText(it)}</li>
                  ))}
                </ul>
              );
            }

            if (s.t === "callout") {
              return (
                <div key={idx} className="ls-callout">
                  <span className="ls-callout-ic">
                    <Icon
                      name={s.kind === "lime" ? "spark" : "info"}
                      className="ic-sm"
                    />
                  </span>
                  <div>{parseRichText(s.text)}</div>
                </div>
              );
            }

            if (s.t === "code") {
              return (
                <div key={idx} className="ls-code">
                  <div className="ls-code-head">
                    <span className="dots">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span className="cv-file">{s.lang || "dart"}</span>
                  </div>
                  <pre className="ls-code-pre">
                    <code>{s.code}</code>
                  </pre>
                </div>
              );
            }

            if (s.t === "evidence") {
              return (
                <div key={idx} className="ls-ev">
                  <div className="ls-ev-label">
                    <Icon name="file" className="ic-sm" /> Referenced files
                  </div>
                  <div className="ev-chips">
                    {s.files.map((fileId: string) => {
                      const f = getFileByKey(fileId);
                      if (!f) return null;
                      const fileName = f.path.split("/").pop() || f.path;
                      return (
                        <Link
                          key={fileId}
                          href={`/app/evidence/${fileId}`}
                          className="ev-chip"
                          style={{ textDecoration: "none" }}
                        >
                          <Icon name="file" className="ic-sm" /> {fileName}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            }

            if (s.t === "modules") {
              return (
                <div key={idx} className="ls-ev">
                  <div className="ls-ev-label">
                    <Icon name="modules" className="ic-sm" /> Related modules
                  </div>
                  <div className="ls-mod-row">
                    {s.ids.map((modId: string) => {
                      const m = getModuleById(modId);
                      if (!m) return null;
                      return (
                        <Link
                          key={modId}
                          href={`/app/modules/${modId}`}
                          className="ls-mod"
                          style={{ textDecoration: "none" }}
                        >
                          <Icon name="modules" className="ic-sm" /> {m.name}{" "}
                          <Icon name="arrowUpRight" className="ic-sm" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            }

            if (s.t === "check") {
              return <KnowledgeCheckQuiz key={idx} sec={s} />;
            }

            return null;
          })}

          {/* Lesson End Card */}
          <div className="ls-end">
            <div className="ls-end-line" />
            <div className="row between align-center">
              <div>
                <b style={{ fontSize: 13 }}>Lesson complete?</b>
                <div className="t3 tiny mt4">
                  {nextStep && nextLesson
                    ? `Up next: ${nextStep.title} — ${nextLesson.title}`
                    : "You finished the course!"}
                </div>
              </div>
              <Button
                variant={isDone ? "ghost" : "primary"}
                id="lesson-complete"
                onClick={handleMarkComplete}
              >
                {isDone ? (
                  <>
                    <Icon name="checkCircle" className="ic-sm" /> Completed
                  </>
                ) : (
                  <>
                    <Icon name="check" className="ic-sm" /> Mark complete
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="course-nav">
          <div>
            {prevStep && prevLesson && (
              <>
                <div className="t3 tiny mb4">Previous</div>
                <Link
                  href={`/app/learning/lesson/${prevStep.id}/${prevLesson.id}`}
                >
                  <Button variant="secondary" size="sm">
                    <Icon name="arrowLeft" className="ic-sm" />{" "}
                    {prevStep.title} — {prevLesson.title}
                  </Button>
                </Link>
              </>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            {nextStep && nextLesson ? (
              <>
                <div className="t3 tiny mb4">Next lesson</div>
                <Button
                  variant="primary"
                  size="sm"
                  id="lesson-next"
                  onClick={handleNextLesson}
                >
                  {nextStep.title} — {nextLesson.title}{" "}
                  <Icon name="arrowRight" className="ic-sm" />
                </Button>
              </>
            ) : (
              <Link href="/app/learning">
                <Button variant="primary" size="sm">
                  Back to course overview
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
