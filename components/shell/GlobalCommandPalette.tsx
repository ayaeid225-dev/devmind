"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { CommandPalette } from "@/components/ui";
import {
  buildDefaultPaletteGroups,
  buildPaletteGroupsFromSearchResults,
  type SearchPaletteItem,
  type RepoContext,
} from "@/lib/palette-groups";
import { useShell } from "@/lib/shell-context";

export function GlobalCommandPalette() {
  const router = useRouter();
  const { activeRepoId, activeRepo, paletteOpen, closePalette } = useShell();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchPaletteItem[]>([]);
  const [emptyState, setEmptyState] = useState<{ title: string; sub: string } | undefined>(undefined);

  // Debounce user keystrokes
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 200);
    return () => clearTimeout(handler);
  }, [query]);

  // Reset query and results when palette closes or opens
  useEffect(() => {
    if (!paletteOpen) {
      setQuery("");
      setDebouncedQuery("");
      setResults([]);
      setLoading(false);
      setEmptyState(undefined);
    }
  }, [paletteOpen]);

  const currentRepoId = activeRepoId || activeRepo.name;

  const repoContext: RepoContext = useMemo(() => {
    return {
      id: activeRepoId,
      name: activeRepo.name,
      owner: activeRepo.owner,
      defaultBranch: activeRepo.branch,
    };
  }, [activeRepoId, activeRepo]);

  // Perform semantic search whenever debouncedQuery changes
  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setEmptyState(undefined);
      return;
    }

    if (!currentRepoId) {
      setResults([]);
      setLoading(false);
      setEmptyState({
        title: "No repository selected",
        sub: "Please select an active repository to search.",
      });
      return;
    }

    let isSubscribed = true;
    setLoading(true);

    async function executeSearch() {
      try {
        const res = await fetch(
          `/api/search?repoId=${encodeURIComponent(currentRepoId)}&q=${encodeURIComponent(trimmed)}`
        );
        const data = await res.json();

        if (!isSubscribed) return;

        if (!res.ok || !data.success) {
          setResults([]);
          setEmptyState({
            title: "Search failed",
            sub: data.error || "An error occurred while searching this repository.",
          });
          return;
        }

        if (data.data?.indexed === false) {
          setResults([]);
          setEmptyState({
            title: "This repository has not been indexed yet.",
            sub: "Sync the repository before searching.",
          });
          return;
        }

        const items: SearchPaletteItem[] = Array.isArray(data.data?.results) ? data.data.results : [];
        setResults(items);

        if (items.length === 0) {
          setEmptyState({
            title: "No relevant results found.",
            sub: "Try a different question or search term.",
          });
        } else {
          setEmptyState(undefined);
        }
      } catch (err) {
        if (!isSubscribed) return;
        setResults([]);
        setEmptyState({
          title: "Search connection error",
          sub: "Unable to reach search service. Please try again.",
        });
      } finally {
        if (isSubscribed) setLoading(false);
      }
    }

    executeSearch();

    return () => {
      isSubscribed = false;
    };
  }, [debouncedQuery, currentRepoId]);

  const navigateTo = (href: string) => {
    closePalette();
    router.push(href);
  };

  const groups = useMemo(() => {
    if (debouncedQuery.trim().length > 0) {
      return buildPaletteGroupsFromSearchResults(results, debouncedQuery, repoContext, navigateTo);
    }
    return buildDefaultPaletteGroups(repoContext, navigateTo);
  }, [debouncedQuery, results, repoContext]);

  return (
    <CommandPalette
      open={paletteOpen}
      onClose={closePalette}
      groups={groups}
      loading={loading}
      onQueryChange={setQuery}
      emptyState={emptyState}
      placeholder={`Search ${activeRepo.name} files, code, modules, docs…`}
      remoteMode={true}
    />
  );
}
