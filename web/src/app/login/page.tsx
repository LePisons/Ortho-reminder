"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    console.log("handleSignIn called");

    try {
      console.log("Calling signIn...");
      const result = await signIn("credentials", {
        redirect: false, // We handle success/error manually
        email: email,
        password: password,
      });
      console.log("signIn result:", result);

      if (result?.error) {
        toast.error("Login Failed", {
          description: "Invalid email or password. Please try again.",
        });
        console.error("Login error:", result.error);
      } else if (result?.ok) {
        toast.success("Login successful!");
        console.log("Login successful, redirecting to /");
        router.push("/"); // Redirect to the main dashboard page
      }
    } catch (error) {
      toast.error("An unexpected error occurred.");
      console.error("Unexpected error during login:", error);
    } finally {
      setIsLoading(false);
      console.log("handleSignIn finished");
    }
  };

  return (
    <main className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold">OrthoReminder Login</h1>
          <p className="text-gray-500">Welcome back! Please sign in.</p>
        </div>
        <form onSubmit={handleSignIn} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Signing In..." : "Sign In"}
          </Button>
        </form>
        <p className="text-center text-sm text-gray-600">
          Don't have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-blue-600 hover:underline"
          >
            Sign Up
          </Link>
        </p>
      </div>
    </main>
  );
}
