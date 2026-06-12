import { useState, useEffect, useRef } from "react"
import { useNavigate, Link } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { cn, hashPassword } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { Loader2, ArrowLeft, Mail, RefreshCw, Check, Info } from "lucide-react"
import { toast } from "sonner"

const RESEND_COOLDOWN = 60

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2>(1)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [otpValue, setOtpValue] = useState("")
  
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)
  
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const passwordRequirements = {
    length: password.length >= 8 && password.length <= 32,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[@$!%*?&#^()_\-+=]/.test(password),
  }

  const strengthScore = Object.values(passwordRequirements).filter(Boolean).length
  const isPasswordValid = strengthScore === 5

  const getStrengthInfo = () => {
    if (password.length === 0) return { label: "", color: "bg-border", width: "0%" }
    if (strengthScore <= 2) return { label: "Weak", color: "bg-destructive", width: "33%" }
    if (strengthScore <= 4) return { label: "Medium", color: "bg-orange-500", width: "66%" }
    return { label: "Strong", color: "bg-emerald-500", width: "100%" }
  }

  const strength = getStrengthInfo()

  useEffect(() => {
    return () => {
      if (resendTimerRef.current) clearInterval(resendTimerRef.current)
    }
  }, [])

  function startResendTimer() {
    if (resendTimerRef.current) clearInterval(resendTimerRef.current)
    setResendCooldown(RESEND_COOLDOWN)
    resendTimerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (resendTimerRef.current) clearInterval(resendTimerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  async function handleInitialSubmit(e: React.FormEvent) {
    e.preventDefault()

    setEmailError(null)
    setPasswordError(null)
    setConfirmError(null)

    // Basic email validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Please enter a valid email address.")
      return
    }

    if (!isPasswordValid) {
      setPasswordError("Password does not meet all requirements.")
      return
    }

    if (password !== confirmPassword) {
      setConfirmError("Passwords don't match")
      return
    }

    setLoading(true)

    try {
      const hashed = await hashPassword(password)
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            hashed_password: hashed,
          },
        },
      })

      if (error) {
        toast.error("Signup failed", {
          description: error.message,
        })
        return
      }

      toast.success("Verification code sent!", {
        description: `Please check your email at ${email}`,
      })
      setStep(2)
      startResendTimer()
    } catch (err) {
      toast.error("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (otpValue.length !== 6) return

    setVerifying(true)
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpValue,
        type: "signup",
      })

      if (error) {
        toast.error("Verification failed", {
          description: error.message || "Invalid or expired code.",
        })
        return
      }

      toast.success("Account verified!", {
        description: "Welcome to Save 25 Smart Donation Management System.",
      })
      navigate("/dashboard")
    } catch (err) {
      toast.error("Verification failed. Please try again.")
    } finally {
      setVerifying(false)
    }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0) return
    
    setLoading(true)
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email,
      })

      if (error) {
        toast.error("Failed to resend code", {
          description: error.message,
        })
        return
      }

      toast.success("New code sent!", {
        description: `Check your email at ${email}`,
      })
      startResendTimer()
      setOtpValue("")
    } catch (err) {
      toast.error("Failed to resend code")
    } finally {
      setLoading(false)
    }
  }

  async function handleOAuthSignup(provider: "google" | "github") {
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
      toast.error("OAuth signup failed", {
        description: error.message,
      })
      setOauthLoading(null)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0 shadow-xl ring-1 ring-border/50">
        <CardContent className="grid p-0 md:grid-cols-2">
          
          {/* Form Side */}
          <div className="relative overflow-hidden p-6 md:p-8">
            {step === 1 ? (
              <form className="animate-in fade-in-0 slide-in-from-left-4 duration-500" onSubmit={handleInitialSubmit}>
                <FieldGroup>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <h1 className="text-2xl font-semibold">Create your account</h1>
                    <p className="text-sm text-balance text-muted-foreground">
                      Join our community and start making a difference today.
                    </p>
                  </div>
                  <Field data-invalid={!!emailError}>
                    <FieldLabel htmlFor="signup-email">Email</FieldLabel>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="Enter Email Address"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (emailError) setEmailError(null)
                      }}
                      disabled={loading}
                      className="h-11"
                      aria-invalid={!!emailError}
                    />
                    {emailError && <FieldError>{emailError}</FieldError>}
                  </Field>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field data-invalid={!!passwordError}>
                        <FieldLabel htmlFor="signup-password">Password</FieldLabel>
                        <PasswordInput
                          id="signup-password"
                          required
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value)
                            if (passwordError) setPasswordError(null)
                          }}
                          disabled={loading}
                          className="h-11"
                          aria-invalid={!!passwordError}
                        />
                      </Field>
                      <Field data-invalid={!!confirmError}>
                        <FieldLabel htmlFor="signup-confirm-password">
                          Confirm
                        </FieldLabel>
                        <Input
                          id="signup-confirm-password"
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value)
                            if (confirmError) setConfirmError(null)
                          }}
                          disabled={loading}
                          className="h-11"
                          aria-invalid={!!confirmError}
                        />
                      </Field>
                    </div>

                    {/* Password Strength Meter */}
                    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Password Strength
                        </span>
                        <span className={cn("text-xs font-bold uppercase", 
                          strengthScore <= 2 ? "text-destructive" : 
                          strengthScore <= 4 ? "text-orange-500" : "text-emerald-500"
                        )}>
                          {strength.label}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                        <div 
                          className={cn("h-full transition-all duration-500 ease-out", strength.color)} 
                          style={{ width: strength.width }}
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-y-1.5 pt-1 sm:grid-cols-2">
                        <RequirementItem met={passwordRequirements.length} label="8-32 characters" />
                        <RequirementItem met={passwordRequirements.uppercase} label="Uppercase letter" />
                        <RequirementItem met={passwordRequirements.lowercase} label="Lowercase letter" />
                        <RequirementItem met={passwordRequirements.number} label="Number" />
                        <RequirementItem met={passwordRequirements.special} label="Special symbol" />
                      </div>
                    </div>

                    {(passwordError || confirmError) && (
                      <div className="space-y-1">
                        {passwordError && <FieldError>{passwordError}</FieldError>}
                        {confirmError && <FieldError>{confirmError}</FieldError>}
                      </div>
                    )}
                  </div>
                  <Field className="pt-2">
                    <Button type="submit" disabled={loading} className="h-8 w-full shadow-lg shadow-primary/20">
                      {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                      Sign Up
                    </Button>
                  </Field>
                  
                  <div className="relative text-center text-xs after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                    <span className="relative z-10 bg-card px-3 font-bold text-muted-foreground uppercase tracking-widest">
                      Or
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 w-full border-2 font-semibold"
                      disabled={loading || oauthLoading !== null}
                      onClick={() => handleOAuthSignup("google")}
                    >
                      {oauthLoading === "google" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="mr-2 size-4">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                      )}
                      Google
                    </Button>
                  </div>
                  
                  <FieldDescription className="text-center font-medium">
                    Already have an account?{" "}
                    <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                      Sign in
                    </Link>
                  </FieldDescription>
                </FieldGroup>
              </form>
            ) : (
              <div className="flex flex-col items-center gap-6 py-4 animate-in fade-in-0 slide-in-from-right-4 duration-500">
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Mail className="size-7" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">Check your email</h2>
                  <p className="max-w-[280px] text-sm text-muted-foreground">
                    We&apos;ve sent a 6-digit verification code to <span className="font-bold text-foreground">{email}</span>
                  </p>
                </div>

                <InputOTP
                  maxLength={6}
                  value={otpValue}
                  onChange={setOtpValue}
                  disabled={verifying}
                  className="gap-2"
                >
                  <InputOTPGroup className="gap-2">
                    <InputOTPSlot index={0} className="size-11 rounded-lg border-2 text-lg font-bold sm:size-12" />
                    <InputOTPSlot index={1} className="size-11 rounded-lg border-2 text-lg font-bold sm:size-12" />
                    <InputOTPSlot index={2} className="size-11 rounded-lg border-2 text-lg font-bold sm:size-12" />
                    <InputOTPSlot index={3} className="size-11 rounded-lg border-2 text-lg font-bold sm:size-12" />
                    <InputOTPSlot index={4} className="size-11 rounded-lg border-2 text-lg font-bold sm:size-12" />
                    <InputOTPSlot index={5} className="size-11 rounded-lg border-2 text-lg font-bold sm:size-12" />
                  </InputOTPGroup>
                </InputOTP>

                <div className="flex w-full flex-col gap-3">
                  <Button 
                    onClick={() => handleVerifyOtp()} 
                    disabled={verifying || otpValue.length !== 6}
                    className="h-11 w-full font-bold shadow-lg shadow-primary/20"
                  >
                    {verifying && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Verify Account
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground"
                    disabled={resendCooldown > 0 || loading}
                    onClick={handleResendOtp}
                  >
                    <RefreshCw className={cn("size-3", loading && "animate-spin")} />
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                  </Button>
                </div>

                <Button
                  variant="link"
                  className="h-auto p-0 text-xs font-semibold text-muted-foreground decoration-primary/30 hover:text-foreground"
                  onClick={() => setStep(1)}
                  disabled={verifying}
                >
                  <ArrowLeft className="mr-1.5 size-3" /> Use a different email
                </Button>
              </div>
            )}
          </div>

          {/* Image Side */}
          <div className="relative hidden md:block">
            <img
              src="/img/SAVE25-00-01.jpg"
              alt="Image"
              className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
            />
            <div className="absolute bottom-8 left-8 right-8">
            </div>
          </div>
        </CardContent>
      </Card>
      
      <p className="px-6 text-center text-[10px] leading-relaxed text-muted-foreground uppercase tracking-wider">
        By continuing, you agree to our <a href="#" className="font-bold underline underline-offset-2">Terms</a> and <a href="#" className="font-bold underline underline-offset-2">Privacy</a>.
      </p>
    </div>
  )
}

function RequirementItem({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {met ? (
        <div className="flex size-3.5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
          <Check className="size-2.5 stroke-[3]" />
        </div>
      ) : (
        <div className="flex size-3.5 items-center justify-center rounded-full bg-muted text-muted-foreground/50">
          <Info className="size-2.5" />
        </div>
      )}
      <span className={cn(
        "text-[10px] font-medium leading-none transition-colors",
        met ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
      )}>
        {label}
      </span>
    </div>
  )
}
