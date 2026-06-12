import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { cn, hashPassword } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field"
import { PasswordInput } from "@/components/ui/password-input"
import { Loader2, CheckCircle2, Check, Info } from "lucide-react"
import { toast } from "sonner"

export function ResetPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    setPasswordError(null)
    setConfirmError(null)

    if (!isPasswordValid) {
      setPasswordError("Password does not meet all requirements.")
      return
    }

    if (password !== confirmPassword) {
      setPasswordError("Passwords don't match")
      setConfirmError("Passwords don't match")
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      toast.error("Failed to reset password", { description: error.message })
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const hashed = await hashPassword(password)
      await supabase.from("profiles").update({ hashed_password: hashed }).eq("id", user.id)
    }

    toast.success("Password updated!", {
      description: "Your password has been reset successfully.",
    })
    setSuccess(true)
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          {success ? (
            <div className="flex flex-col items-center justify-center gap-4 p-6 text-center md:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold">Password Reset Successful</h1>
                <p className="text-muted-foreground">
                  You have successfully reset your password, you may go back to login page
                </p>
              </div>
              <Button className="w-full" onClick={() => navigate("/login")}>
                Return to Login
              </Button>
            </div>
          ) : (
            <form className="p-6 md:p-8" onSubmit={handleSubmit}>
              <FieldGroup>
                <div className="flex flex-col items-center gap-2 text-center">
                  <h1 className="text-2xl font-bold">Reset your password</h1>
                  <p className="text-balance text-muted-foreground">
                    Enter your new password below
                  </p>
                </div>
                <Field data-invalid={!!passwordError}>
                  <FieldLabel htmlFor="reset-password">New Password</FieldLabel>
                  <PasswordInput
                    id="reset-password"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (passwordError) setPasswordError(null)
                    }}
                    disabled={loading}
                    aria-invalid={!!passwordError}
                  />
                </Field>
                <Field data-invalid={!!confirmError}>
                  <FieldLabel htmlFor="reset-confirm-password">
                    Confirm New Password
                  </FieldLabel>
                  <PasswordInput
                    id="reset-confirm-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      if (confirmError) setConfirmError(null)
                    }}
                    disabled={loading}
                    aria-invalid={!!confirmError}
                  />
                </Field>

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
                <Field>
                  <Button type="submit" disabled={loading}>
                    {loading && (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    )}
                    Reset Password
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          )}
          <div className="relative hidden md:block">
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
