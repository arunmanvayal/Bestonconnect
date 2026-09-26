import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { SETUP_SQL } from "@/lib/schema-sql";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "Database Setup — BusinessDesk" },
      { name: "description", content: "One-time database setup script for your Supabase project." },
      { property: "og:title", content: "Database Setup — BusinessDesk" },
      { property: "og:description", content: "One-time database setup script for your Supabase project." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SetupPage,
});

function SetupPage() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(SETUP_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppLayout>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Database Setup</h1>
          <p className="text-sm text-muted-foreground">One-time step to create the tables in your Supabase project</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. Open your Supabase dashboard and go to <strong className="text-foreground">SQL Editor → New query</strong>.</p>
            <p>2. Copy the script below and paste it into the editor.</p>
            <p>3. Click <strong className="text-foreground">Run</strong>. That's it — come back here and everything will work.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Setup script</CardTitle>
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? "Copied" : "Copy script"}
            </Button>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[480px] overflow-auto rounded-md bg-muted p-4 text-xs leading-relaxed text-foreground">
              {SETUP_SQL}
            </pre>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
