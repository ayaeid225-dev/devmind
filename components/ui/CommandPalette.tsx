"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "./Icon";

export interface PaletteItem {
  id: string;
  icon: IconName;
  name: string;
  sub: string;
  cat: string;
  /** Extra invisible match terms (e.g. lessons keyed on "learning course lesson path"). */
  keywords?: string;
  onSelect: () => void;
}

export interface PaletteGroup {
  label: string;
  items: readonly PaletteItem[];
  /** Cap applied before display, at rest state too (prototype slices files 4 / docs 4 / ADRs 3 / devs 4). */
  max?: number;
  /** "query" hides the group until something is typed (Ask DevMind suggestions). */
  when?: "always" | "query";
}

export interface CommandPaletteProps {
  groups: readonly PaletteGroup[];
  open: boolean;
  onClose: () => void;
  onOpen?: () => void;
  hotkey?: boolean;
}

interface Row {
  group: string;
  item: PaletteItem;
  index: number;
}

/*
 * Ported from ui.js command palette (#palette-root): backdrop + .palette
 * with input row, grouped results (.pal-item) and footer hints.
 * Filtering is a case-insensitive substring match on name/sub/keywords (empty
 * query matches everything); group `max` caps apply at rest state too and
 * `when: "query"` hides a group until something is typed. ArrowUp/Down
 * navigate, Enter selects, Escape closes, Ctrl/Cmd+K toggles when `hotkey`
 * is enabled.
 */
export function CommandPalette({
  groups,
  open,
  onClose,
  onOpen,
  hotkey = true,
}: CommandPaletteProps) {
  useEffect(() => {
    if (!hotkey) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) onClose();
        else onOpen?.();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hotkey, open, onClose, onOpen]);

  // Fresh mount per open resets query/selection (mirrors U.openPalette).
  if (!open) return null;
  return <PaletteContent groups={groups} onClose={onClose} />;
}

function PaletteContent({
  groups,
  onClose,
}: Pick<CommandPaletteProps, "groups" | "onClose">) {
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, []);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .filter((g) => g.when !== "query" || q.length > 0)
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (it) =>
            !q ||
            it.name.toLowerCase().includes(q) ||
            it.sub.toLowerCase().includes(q) ||
            (it.keywords?.toLowerCase().includes(q) ?? false)
        ),
      }))
      .map((g) =>
        g.max != null ? { ...g, items: g.items.slice(0, g.max) } : g
      )
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    filteredGroups.forEach((g) => {
      g.items.forEach((item) => {
        out.push({ group: g.label, item, index: out.length });
      });
    });
    return out;
  }, [filteredGroups]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSel((s) => Math.min(rows.length - 1, s + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSel((s) => Math.max(0, s - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const row = rows[sel];
        if (row) {
          onClose();
          row.item.onSelect();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [rows, sel, onClose]);

  useEffect(() => {
    bodyRef.current
      ?.querySelector(".pal-item.sel")
      ?.scrollIntoView({ block: "nearest" });
  }, [sel, rows]);

  return (
    <div id="palette-root" className="open">
      <div className="pal-backdrop" />
      <div className="palette">
        <div className="pal-input-row">
          <Icon name="search" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSel(0);
            }}
            placeholder="Search files, modules, docs, developers, actions…"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="kbd">ESC</span>
        </div>
        <div className="pal-body" ref={bodyRef}>
          {rows.length === 0 ? (
            <div className="state" style={{ padding: "36px" }}>
              <span className="st-ic">
                <Icon name="search" />
              </span>
              <div className="st-title">No results</div>
              <div className="st-sub">
                Nothing matches &quot;{query.trim()}&quot; in this project.
              </div>
            </div>
          ) : (
            rows.map(({ group, item, index }) => (
              <Fragment key={`${index}-${item.id}`}>
                {(index === 0 || rows[index - 1].group !== group) && (
                  <div className="pal-group-label">{group}</div>
                )}
                <div
                  className={"pal-item" + (index === sel ? " sel" : "")}
                  onMouseEnter={() => setSel(index)}
                  onClick={() => {
                    onClose();
                    item.onSelect();
                  }}
                >
                  <span className="p-ic">
                    <Icon name={item.icon} />
                  </span>
                  <span className="grow">
                    <div className="p-name">{item.name}</div>
                    <div className="p-path">{item.sub}</div>
                  </span>
                  <span className="p-cat">{item.cat}</span>
                </div>
              </Fragment>
            ))
          )}
        </div>
        <div className="pal-foot">
          <div className="row">
            <span className="row gap8">
              <Icon name="arrowUpRight" size="sm" /> Select
            </span>
            <span className="row gap8">
              <Icon name="chevronDown" size="sm" /> Navigate
            </span>
            <span className="row gap8">
              <Icon name="close" size="sm" /> Dismiss
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
