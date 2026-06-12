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
import { Loader2, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

export function FindAccountForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<"email" | "otp">("email")

  async function handleFindAccount(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    // 1. Verify if the email exists in profiles using RPC function to bypass unauthenticated RLS read restrictions
    const { data: emailExists, error: rpcError } = await supabase
      .rpc("check_email_exists", { email_to_check: email.trim() })

    if (rpcError) {
      toast.error("Error finding account", { description: rpcError.message })
      setLoading(false)
      return
    }

    if (!emailExists) {
      toast.error("Account not found", {
        description: "No account is associated with this email address.",
      })
      setLoading(false)
      return
    }

    // 2. Send OTP code
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
      },
    })

    if (otpError) {
      toast.error("Failed to send OTP", { description: otpError.message })
      setLoading(false)
      return
    }

    toast.success("OTP Code Sent", {
      description: "A 6-digit verification code has been sent to your email.",
    })
    setStep("otp")
    setLoading(false)
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    // 3. Verify OTP code
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp.trim(),
      type: "email",
    })

    if (verifyError) {
      toast.error("Verification failed", { description: verifyError.message })
      setLoading(false)
      return
    }

    toast.success("Account verified!", {
      description: "You have been signed in. Please set a new password.",
    })
    navigate("/reset-password")
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <div className="p-6 md:p-8">
            {step === "email" ? (
              <form onSubmit={handleFindAccount}>
                <FieldGroup>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <h1 className="text-2xl font-bold">Find your Account</h1>
                    <p className="text-balance text-muted-foreground">
                      Enter your email address to find your account and send a reset OTP code.
                    </p>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="find-email">Email Address</FieldLabel>
                    <Input
                      id="find-email"
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
                      Find Account & Send OTP
                    </Button>
                  </Field>
                  <FieldDescription className="text-center">
                    <Link
                      to="/login"
                      className="text-primary underline-offset-4 hover:underline inline-flex items-center gap-1"
                    >
                      <ArrowLeft className="size-3" /> Back to login
                    </Link>
                  </FieldDescription>
                </FieldGroup>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp}>
                <FieldGroup>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <h1 className="text-2xl font-bold">Verify OTP</h1>
                    <p className="text-balance text-muted-foreground">
                      Enter the 6-digit verification code sent to <span className="font-semibold">{email}</span>
                    </p>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="find-otp">OTP Code</FieldLabel>
                    <Input
                      id="find-otp"
                      type="text"
                      maxLength={6}
                      placeholder="123456"
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      disabled={loading}
                    />
                  </Field>
                  <Field>
                    <Button type="submit" disabled={loading}>
                      {loading && (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      )}
                      Verify Code
                    </Button>
                  </Field>
                  <FieldDescription className="text-center">
                    <button
                      type="button"
                      onClick={() => setStep("email")}
                      className="text-primary underline-offset-4 hover:underline inline-flex items-center gap-1"
                      disabled={loading}
                    >
                      Change email
                    </button>
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
