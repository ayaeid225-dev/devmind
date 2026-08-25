"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { CommandPalette } from "@/components/ui";
import { buildPaletteGroups } from "@/lib/palette-groups";
import { useShell } from "@/lib/shell-context";

export function GlobalCommandPalette() {
  const router = useRouter();
  const { paletteOpen, closePalette } = useShell();

  const groups = useMemo(() => {
    return buildPaletteGroups((href: string) => {
      closePalette();
      router.push(href);
    });
  }, [router, closePalette]);

  return (
    <CommandPalette
      open={paletteOpen}
      onClose={closePalette}
      groups={groups}
    />
  );
}
