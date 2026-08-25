import Link from "next/link";
import { PlaceholderScreen } from "@/components/shell";

export default function AnalyzePage() {
  return (
    <div style={{ maxWidth: 960, margin: "40px auto", padding: "0 24px" }}>
      <PlaceholderScreen
        title="Understanding Your Project"
        subtitle="Analyzing project structure, modules, dependencies, and architecture"
        badge="Analysis Engine"
      />
      <div style={{ marginTop: 24, textAlign: "center", display: "flex", gap: 12, justifyContent: "center" }}>
        <Link href="/app/overview" className="btn btn-primary">
          Complete Analysis &amp; Enter Workspace →
        </Link>
        <Link href="/analyze-failed" className="btn btn-secondary">
          Simulate Analysis Failure
        </Link>
      </div>
    </div>
  );
}
