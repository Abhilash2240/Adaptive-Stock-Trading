import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    timeoutRef.current = window.setTimeout(() => {
      setIsSubmitting(false);
      setMessage("Authentication service is not configured yet. Please connect the login endpoint.");
    }, 600);
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-gradient-to-br from-background via-background to-muted px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <Card className="shadow-lg">
          <CardHeader className="items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Sign in to access the trading control center.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  autoComplete="email"
                  id="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={email}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  autoComplete="current-password"
                  id="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  required
                  type="password"
                  value={password}
                />
              </div>
              <Button className="w-full" disabled={isSubmitting} type="submit">
                {isSubmitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>
            {message && (
              <Alert className="mt-4" variant="destructive">
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-2 text-sm text-muted-foreground">
            <div className="w-full text-center">
              <Button asChild className="px-0" variant="ghost">
                <Link href="/">Back to dashboard</Link>
              </Button>
            </div>
            <p className="text-center">
              Need an account? Contact your workspace admin to request access.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
