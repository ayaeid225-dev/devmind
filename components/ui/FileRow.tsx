"use client";

import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { Badge } from "./Badge";
import { cx } from "./cx";

export interface FileRowProps {
  fileName: ReactNode;
  path: ReactNode;
  typeLabel?: ReactNode;
  sizeLabel?: ReactNode;
  onClick?: () => void;
  className?: string;
}

/* Ported from app.js fileRowHtml(): icon + fr-path/fr-mod + gray/outline badges. */
export function FileRow({
  fileName,
  path,
  typeLabel = "File",
  sizeLabel,
  onClick,
  className,
}: FileRowProps) {
  return (
    <div className={cx("file-row", className)} onClick={onClick}>
      <span style={{ color: "var(--text-3)" }}>
        <Icon name="file" />
      </span>
      <span className="grow">
        <div className="fr-path">{fileName}</div>
        <div className="fr-mod">{path}</div>
      </span>
      <Badge variant="gray" small>
        {typeLabel}
      </Badge>
      {sizeLabel != null && (
        <Badge variant="outline" small>
          {sizeLabel}
        </Badge>
      )}
    </div>
  );
}
