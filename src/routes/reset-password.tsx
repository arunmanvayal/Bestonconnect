import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { useSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/company";
import { CredentialsForm } from "@/components/CredentialsForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Login — BusinessDesk" },
      { name: "description", content: "Set a new username and password for your BusinessDesk owner account." },
      { property: "og:title", content: "Reset Login — BusinessDesk" },
      { property: "og:description", content: "Set a new username and password for your BusinessDesk owner account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const sb = useSupabase();
  const session = useSession();
  const navigate = useNavigate();
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground"><KeyRound className="h-5 w-5" /></div>
          <CardTitle>Set new username & password</CardTitle>
        </CardHeader>
        <CardContent>
          {!sb || session === undefined ? <p className="text-sm text-muted-foreground">Checking your reset link…</p>
            : !session ? <p className="text-sm text-muted-foreground">This reset link is invalid or expired. Request a new one from the sign-in screen.</p>
            : <CredentialsForm userId={session.user.id} requireCurrent={false} onDone={() => navigate({ to: "/" })} />}
        </CardContent>
      </Card>
    </div>
  );
}
