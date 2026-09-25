import { NextRequest } from "next/server";
import { POST as webhookPost } from "@/app/api/webhooks/github/route";

export async function POST(req: NextRequest) {
  return webhookPost(req);
}
