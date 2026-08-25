import Link from "next/link";
import { Button, Card, CardBody, Badge, Logo } from "@/components/ui";

export default function LandingPage() {
  return (
    <div className="lp" style={{ minHeight: "100vh", padding: "40px 24px" }}>
      <nav className="lp-nav" style={{ maxWidth: 1100, margin: "0 auto 40px" }}>
        <div className="row gap8 align-center">
          <Logo />
          <span className="sb-name" style={{ fontSize: 18, fontWeight: 600 }}>
            DevMind
          </span>
        </div>
        <div className="spacer" />
        <div className="row gap12">
          <Link href="/login">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link href="/signup">
            <Button variant="primary">Get Started</Button>
          </Link>
          <Link href="/app/overview">
            <Button variant="secondary">Open Workspace</Button>
          </Link>
        </div>
      </nav>

      <header
        className="lp-hero"
        style={{ maxWidth: 960, margin: "0 auto", textAlign: "center" }}
      >
        <div className="lp-eyebrow" style={{ justifyContent: "center" }}>
          <span className="dot" />
          Engineering Intelligence Platform
        </div>
        <h1 className="lp-h1" style={{ marginTop: 16 }}>
          Your Engineering Team&apos;s <span className="hl">Memory</span>.
        </h1>
        <p className="lp-sub" style={{ maxWidth: 640, margin: "16px auto 32px" }}>
          Understand complex codebases faster by turning scattered engineering
          knowledge into one intelligent workspace.
        </p>

        <div className="row gap16" style={{ justifyContent: "center" }}>
          <Link href="/app/overview">
            <Button variant="primary" size="xl">
              Go to Workspace
            </Button>
          </Link>
          <Link href="/repos">
            <Button variant="secondary" size="xl">
              Choose Repository
            </Button>
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: "48px auto 0" }}>
        <Card>
          <CardBody style={{ padding: 32 }}>
            <div className="row between align-center" style={{ marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 600 }}>
                  DevMind App Shell Ready
                </h2>
                <p className="t3 small" style={{ marginTop: 4 }}>
                  Step 3 routing &amp; shell migration complete.
                </p>
              </div>
              <Badge variant="lime">Step 3 Approved</Badge>
            </div>
            <div className="row wrap gap12" style={{ marginTop: 24 }}>
              <Link href="/app/overview">
                <Button variant="secondary" size="sm">
                  /app/overview
                </Button>
              </Link>
              <Link href="/app/map">
                <Button variant="secondary" size="sm">
                  /app/map
                </Button>
              </Link>
              <Link href="/app/modules">
                <Button variant="secondary" size="sm">
                  /app/modules
                </Button>
              </Link>
              <Link href="/app/files">
                <Button variant="secondary" size="sm">
                  /app/files
                </Button>
              </Link>
              <Link href="/app/learning">
                <Button variant="secondary" size="sm">
                  /app/learning
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
