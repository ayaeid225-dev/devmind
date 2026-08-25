import Link from "next/link";
import { PlaceholderScreen } from "@/components/shell";

export default function AnalyzeFailedPage() {
  return (
    <div style={{ maxWidth: 960, margin: "40px auto", padding: "0 24px" }}>
      <PlaceholderScreen
        title="Analysis Failed"
        subtitle="Could not complete repository structure and dependency resolution"
        badge="Error State"
      />
      <div style={{ marginTop: 24, textAlign: "center" }}>
        <Link href="/analyze" className="btn btn-primary">
          Retry Analysis
        </Link>
      </div>
    </div>
  );
}
