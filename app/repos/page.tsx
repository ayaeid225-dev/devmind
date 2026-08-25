import Link from "next/link";
import { PlaceholderScreen } from "@/components/shell";

export default function ReposPage() {
  return (
    <div style={{ maxWidth: 960, margin: "40px auto", padding: "0 24px" }}>
      <PlaceholderScreen
        title="Choose a Repository"
        subtitle="Select which project repository you want to analyze and explore"
        badge="Repository Selection"
      />
      <div style={{ marginTop: 24, textAlign: "center" }}>
        <Link href="/analyze" className="btn btn-primary">
          Analyze Selected Repository →
        </Link>
      </div>
    </div>
  );
}
