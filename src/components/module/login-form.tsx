import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      const attemptsStr = sessionStorage.getItem("failed_login_attempts") || "0"
      const newAttempts = parseInt(attemptsStr, 10) + 1
      sessionStorage.setItem("failed_login_attempts", newAttempts.toString())

      if (newAttempts >= 5) {
        sessionStorage.removeItem("failed_login_attempts")
        toast.error("Too many failed attempts", {
          description: "Incorrect credentials entered 5 times. Redirecting to Find your Account page...",
        })
        navigate("/find-account")
        setLoading(false)
        return
      }

      toast.error("Login failed", {
        description: `${error.message} (Attempt ${newAttempts}/5)`,
      })
      setLoading(false)
      return
    }

    sessionStorage.removeItem("failed_login_attempts")
    toast.success("Welcome back!", {
      description: "You have been signed in successfully.",
    })
    navigate("/dashboard")
  }

  async function handleOAuthLogin(provider: "google" | "github") {
    setOauthLoading(provider)

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        queryParams:
          provider === "google" ? { prompt: "select_account" } : undefined,
      },
    })

    if (error) {
      toast.error("OAuth login failed", {
        description: error.message,
      })
      setOauthLoading(null)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-8" onSubmit={handleSubmit}>
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">Welcome back</h1>
                <p className="text-balance text-muted-foreground">
                  Login to your Save 25 Smart Donation Management System account
                </p>
              </div>
              <Field>
                <FieldLabel htmlFor="login-email">Email</FieldLabel>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="Email Address"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="login-password">Password</FieldLabel>
                  <Link
                    to="/forgot-password"
                    className="ml-auto text-sm underline-offset-2 hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <PasswordInput
                  id="login-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </Field>
              <Field>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Login
                </Button>
              </Field>
              <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                <span className="relative z-10 bg-card px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
              <div className="flex flex-col gap-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={loading || oauthLoading !== null}
                  onClick={() => handleOAuthLogin("google")}
                >
                  {oauthLoading === "google" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      className="size-4"
                    >
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                  )}
                  <span className="sr-only">Login with </span>Google
                </Button>
              </div>
              <FieldDescription className="text-center">
                Don&apos;t have an account?{" "}
                <Link
                  to="/signup"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Sign up
                </Link>
              </FieldDescription>
            </FieldGroup>
          </form>
          <div className="relative hidden md:block">
            <img
              src="/img/SAVE25-00-01.jpg"
              alt="Image"
              className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
            />
          </div>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}
