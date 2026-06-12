import { useState } from "react"
import { Link } from "react-router-dom"
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
import { Loader2, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      toast.error("Failed to send reset email", { description: error.message })
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
    toast.success("Check your email", {
      description: "We've sent you a password reset link.",
    })
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <div className="p-6 md:p-8">
            {sent ? (
              <FieldGroup>
                <div className="flex flex-col items-center gap-2 text-center">
                  <h1 className="text-2xl font-bold">Check your email</h1>
                  <p className="text-balance text-muted-foreground">
                    We sent a password reset link to{" "}
                    <span className="font-medium text-foreground">{email}</span>
                  </p>
                </div>
                <FieldDescription className="text-center">
                  Didn&apos;t receive it?{" "}
                  <button
                    type="button"
                    onClick={() => setSent(false)}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Try again
                  </button>
                </FieldDescription>
                <Field>
                  <Link to="/login">
                    <Button variant="outline" className="w-full">
                      <ArrowLeft className="mr-2 size-4" />
                      Back to login
                    </Button>
                  </Link>
                </Field>
              </FieldGroup>
            ) : (
              <form onSubmit={handleSubmit}>
                <FieldGroup>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <h1 className="text-2xl font-bold">Forgot password?</h1>
                    <p className="text-balance text-muted-foreground">
                      Enter your email and we&apos;ll send you a reset link
                    </p>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="forgot-email">Email</FieldLabel>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="Enter Email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                    />
                  </Field>
                  <Field>
                    <Button type="submit" disabled={loading}>
                      {loading && (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      )}
                      Send reset link
                    </Button>
                  </Field>
                  <FieldDescription className="text-center">
                    Remember your password?{" "}
                    <Link
                      to="/login"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      Back to login
                    </Link>
                  </FieldDescription>
                </FieldGroup>
              </form>
            )}
          </div>
          <div className="relative hidden bg-muted md:block">
            <img
              src="/img/SAVE25-00-01.jpg"
              alt="Image"
              className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
