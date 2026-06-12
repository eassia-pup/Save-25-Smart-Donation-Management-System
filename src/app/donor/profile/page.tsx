import * as React from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  Camera,
  Loader2,
  Save,
  KeyRound,
  Trash2,
  AlertTriangle,
  Edit,
  X,
  UserX,
} from "lucide-react"
import { toast } from "sonner"
import type { Profile } from "@/lib/database.types"
import { SidebarLayout } from "@/components/module/sidebar-layout"
import { PasswordInput } from "@/components/ui/password-input"

const formatContactNumber = (value: string) => {
  if (!value || value === "(+63)" || value === "(+63) " || value.trim() === "") {
    return ""
  }
  let digits = value.replace(/\D/g, "")
  if (digits.startsWith("63") && digits.length > 2) {
    digits = digits.substring(2)
  } else if (digits.startsWith("0") && digits.length > 1) {
    digits = digits.substring(1)
  } else if (digits === "63" || digits === "0") {
    digits = ""
  }
  digits = digits.substring(0, 10)
  if (digits.length === 0) return ""

  let formatted = "(+63) "
  if (digits.length > 0) formatted += digits.substring(0, 3)
  if (digits.length > 3) formatted += " " + digits.substring(3, 6)
  if (digits.length > 6) formatted += " " + digits.substring(6, 10)
  return formatted
}

export default function ProfilePage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Profile state
  const [profile, setProfile] = React.useState<Profile | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  // Edit mode state
  const [isEditing, setIsEditing] = React.useState(false)

  // Editable fields
  const [fullName, setFullName] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [addressUnit, setAddressUnit] = React.useState("")
  const [addressLine1, setAddressLine1] = React.useState("")
  const [addressLine2, setAddressLine2] = React.useState("")
  const [addressCity, setAddressCity] = React.useState("")
  const [addressState, setAddressState] = React.useState("")
  const [addressZip, setAddressZip] = React.useState("")
  const [addressCountry, setAddressCountry] = React.useState("")
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false)

  // Password change
  const [passwordDialogOpen, setPasswordDialogOpen] = React.useState(false)
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [changingPassword, setChangingPassword] = React.useState(false)

  // Delete account
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("")
  const [deletingAccount, setDeletingAccount] = React.useState(false)

  // Disable account
  const [disableDialogOpen, setDisableDialogOpen] = React.useState(false)
  const [disablingAccount, setDisablingAccount] = React.useState(false)

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Fetch profile on mount
  React.useEffect(() => {
    async function fetchProfile() {
      if (!user) return

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (error) {
        console.error("Error fetching profile:", error)
        toast.error("Failed to load profile")
      } else if (data) {
        setProfile(data as Profile)
        setFullName(data.full_name || "")
        setPhone(data.phone ? formatContactNumber(data.phone) : "")
        setAddressUnit(data.address_unit || "")
        setAddressLine1(data.address_line1 || "")
        setAddressLine2(data.address_line2 || "")
        setAddressCity(data.address_city || "")
        setAddressState(data.address_state || "")
        setAddressZip(data.address_zip || "")
        setAddressCountry(data.address_country || "")
        setAvatarUrl(data.avatar_url || null)
      }
      setLoading(false)
    }

    fetchProfile()
  }, [user])

  // Avatar upload handler
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return

    // Validate file
    if (!file.type.startsWith("image/")) {
      toast.error("Invalid file", { description: "Please select an image file." })
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File too large", { description: "Avatar must be under 2MB." })
      return
    }

    setUploadingAvatar(true)

    try {
      const fileExt = file.name.split(".").pop()
      const filePath = `${user.id}/avatar.${fileExt}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        // If bucket doesn't exist, show helpful message
        if (uploadError.message?.includes("not found") || uploadError.message?.includes("Bucket")) {
          toast.error("Storage not configured", {
            description: "Please create an 'avatars' bucket in Supabase Storage. Avatar will be saved as URL instead.",
          })
        } else {
          throw uploadError
        }
        return
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath)

      const publicUrl = urlData.publicUrl

      // Update profile with avatar URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id)

      if (updateError) throw updateError

      setAvatarUrl(publicUrl)
      toast.success("Avatar updated!")
    } catch (error) {
      console.error("Avatar upload error:", error)
      toast.error("Upload failed", {
        description: "Could not upload avatar. Please try again.",
      })
    } finally {
      setUploadingAvatar(false)
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // Save profile changes
  async function handleSaveProfile() {
    if (!user) return

    setSaving(true)

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          address_unit: addressUnit.trim() || null,
          address_line1: addressLine1.trim() || null,
          address_line2: addressLine2.trim() || null,
          address_city: addressCity.trim() || null,
          address_state: addressState.trim() || null,
          address_zip: addressZip.trim() || null,
          address_country: addressCountry.trim() || null,
        })
        .eq("id", user.id)

      if (error) throw error

      toast.success("Profile updated!", {
        description: "Your information has been saved successfully.",
      })
      setIsEditing(false)
    } catch (error) {
      console.error("Profile update error:", error)
      toast.error("Update failed", {
        description: (error as any)?.message || "Could not save your profile. Please try again.",
      })
    } finally {
      setSaving(false)
    }
  }

  function handleCancelEdit() {
    setIsEditing(false)
    // reset to original profile data
    if (profile) {
      setFullName(profile.full_name || "")
      setPhone(profile.phone ? formatContactNumber(profile.phone) : "")
      setAddressUnit(profile.address_unit || "")
      setAddressLine1(profile.address_line1 || "")
      setAddressLine2(profile.address_line2 || "")
      setAddressCity(profile.address_city || "")
      setAddressState(profile.address_state || "")
      setAddressZip(profile.address_zip || "")
      setAddressCountry(profile.address_country || "")
    }
  }

  // Change password
  async function handleChangePassword() {
    if (newPassword.length < 6) {
      toast.error("Password too short", {
        description: "Password must be at least 6 characters.",
      })
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match", {
        description: "Please make sure both passwords are the same.",
      })
      return
    }

    setChangingPassword(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error

      toast.success("Password updated!", {
        description: "Your password has been changed successfully.",
      })
      setPasswordDialogOpen(false)
      setNewPassword("")
      setConfirmPassword("")
    } catch (error) {
      console.error("Password change error:", error)
      toast.error("Password change failed", {
        description:
          error instanceof Error
            ? error.message
            : "Could not update password.",
      })
    } finally {
      setChangingPassword(false)
    }
  }

  // Delete account
  async function handleDeleteAccount() {
    if (deleteConfirmText !== "DELETE") {
      toast.error("Confirmation required", {
        description: 'Please type "DELETE" to confirm account deletion.',
      })
      return
    }

    setDeletingAccount(true)

    try {
      // Sign out the user (actual deletion requires admin/service role key)
      // For now, we disable the profile and sign out
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ full_name: "[Deleted User]", phone: null, avatar_url: null, address_unit: null, address_line1: null, address_line2: null, address_city: null, address_state: null, address_zip: null, address_country: null })
        .eq("id", user!.id)

      if (updateError) throw updateError

      await supabase.auth.signOut()

      toast.success("Account deleted", {
        description: "Your account has been removed. We're sorry to see you go.",
      })
      navigate("/login")
    } catch (error) {
      console.error("Account deletion error:", error)
      toast.error("Deletion failed", {
        description: "Could not delete your account. Please contact support.",
      })
    } finally {
      setDeletingAccount(false)
    }
  }

  // Disable account
  async function handleDisableAccount() {
    setDisablingAccount(true)
    try {
      await supabase.auth.signOut()
      toast.success("Account disabled", {
        description: "Your account is temporarily disabled. Log in again to restore access.",
      })
      navigate("/login")
    } catch (error) {
      console.error("Account disable error:", error)
      toast.error("Action failed", {
        description: "Could not disable account. Please try again.",
      })
    } finally {
      setDisablingAccount(false)
      setDisableDialogOpen(false)
    }
  }

  const displayName = fullName || user?.email?.split("@")[0] || "User"
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    )
  }

  const content = (
    <div className="flex min-h-svh flex-col bg-background">

      {/* Main Content */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          className="mb-6 gap-1.5"
          onClick={() => {
            if (isEditing) {
              handleCancelEdit()
            } else {
              navigate("/dashboard")
            }
          }}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Profile</h2>
            <p className="mt-1 text-muted-foreground">
              Manage your personal information and account settings.
            </p>
          </div>
          {!isEditing && (
            <Button onClick={() => setIsEditing(true)} className="gap-2">
              <Edit className="size-4" />
              Edit Profile
            </Button>
          )}
        </div>

        <div className="space-y-6">
          {/* Avatar Section */}
          <Card>
            <CardHeader>
              <CardTitle>Avatar</CardTitle>
              <CardDescription>
                Click the avatar to upload a new photo. Max 2MB.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-5">
                <div className="relative">
                  <Avatar size="lg" className="size-20">
                    {avatarUrl ? (
                      <AvatarImage src={avatarUrl} alt={displayName} />
                    ) : null}
                    <AvatarFallback className="bg-primary text-primary-foreground text-xl font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background transition-transform hover:scale-110 disabled:opacity-50"
                    >
                      {uploadingAvatar ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Camera className="size-3.5" />
                      )}
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </div>
                <div>
                  <p className="font-medium">{displayName}</p>
                  <p className="text-sm text-muted-foreground">
                    {user?.email}
                  </p>
                  {profile?.role && (
                    <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[0.7rem] font-semibold text-primary capitalize">
                      {profile.role}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing && (
                <div className="space-y-1.5">
                  <Label htmlFor="profile-email">Email</Label>
                  <Input
                    id="profile-email"
                    value={user?.email ?? ""}
                    disabled
                    className="opacity-60"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="profile-fullname">Full Name</Label>
                {isEditing ? (
                  <Input
                    id="profile-fullname"
                    placeholder="Juan Dela Cruz"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                ) : (
                  <p className="text-sm border border-transparent py-2 font-medium">{fullName || "Not provided"}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-phone">Contact Number</Label>
                {isEditing ? (
                  <Input
                    id="profile-phone"
                    placeholder="(+63) 9XX XXX XXXX"
                    value={phone}
                    onChange={(e) => setPhone(formatContactNumber(e.target.value))}
                  />
                ) : (
                  <p className="text-sm border border-transparent py-2 font-medium">{phone || "Not provided"}</p>
                )}
              </div>

              <div className="space-y-4 rounded-lg border border-border p-4 bg-muted/10">
                <h3 className="font-semibold text-sm">Address Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="profile-address-line1">Line 1 (Address/Unit/Street)</Label>
                    {isEditing ? (
                      <Input
                        id="profile-address-line1"
                        placeholder="House Number, Street Name, Subdivision/Village"
                        value={addressLine1}
                        onChange={(e) => setAddressLine1(e.target.value)}
                      />
                    ) : (
                      <p className="text-sm border border-transparent py-2 font-medium">{addressLine1 || "Not provided"}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-address-city">City</Label>
                    {isEditing ? (
                      <Input
                        id="profile-address-city"
                        placeholder="Manila"
                        value={addressCity}
                        onChange={(e) => setAddressCity(e.target.value)}
                      />
                    ) : (
                      <p className="text-sm border border-transparent py-2 font-medium">{addressCity || "Not provided"}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-address-state">State / Province</Label>
                    {isEditing ? (
                      <Input
                        id="profile-address-state"
                        placeholder="Metro Manila"
                        value={addressState}
                        onChange={(e) => setAddressState(e.target.value)}
                      />
                    ) : (
                      <p className="text-sm border border-transparent py-2 font-medium">{addressState || "Not provided"}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-address-zip">Zip / Postal Code</Label>
                    {isEditing ? (
                      <Input
                        id="profile-address-zip"
                        placeholder="1000"
                        value={addressZip}
                        onChange={(e) => setAddressZip(e.target.value)}
                      />
                    ) : (
                      <p className="text-sm border border-transparent py-2 font-medium">{addressZip || "Not provided"}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-address-country">Country</Label>
                    {isEditing ? (
                      <Input
                        id="profile-address-country"
                        placeholder="Philippines"
                        value={addressCountry}
                        onChange={(e) => setAddressCountry(e.target.value)}
                      />
                    ) : (
                      <p className="text-sm border border-transparent py-2 font-medium">{addressCountry || "Not provided"}</p>
                    )}
                  </div>
                </div>
              </div>

              {isEditing && (
                <div className="flex gap-3 pt-4">
                  <Button
                    id="save-profile-btn"
                    className="gap-2 flex-1 sm:flex-none"
                    onClick={handleSaveProfile}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 flex-1 sm:flex-none"
                    onClick={handleCancelEdit}
                    disabled={saving}
                  >
                    <X className="size-4" />
                    Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {isEditing && (
            <>
              {/* Security */}
              <Card>
                <CardHeader>
                  <CardTitle>Security</CardTitle>
                  <CardDescription>
                    Manage your password and account security.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    id="change-password-btn"
                    variant="outline"
                    className="w-full gap-2 sm:w-auto"
                    onClick={() => setPasswordDialogOpen(true)}
                  >
                    <KeyRound className="size-4" />
                    Update Password
                  </Button>
                </CardContent>
              </Card>

              {/* Privacy Settings */}
              <Card className="border-destructive/20">
                <CardHeader>
                  <CardTitle className="text-destructive">Privacy Settings</CardTitle>
                  <CardDescription>
                    Manage your account visibility and data.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="font-medium text-sm">Disable Account</h4>
                      <p className="text-sm text-muted-foreground">Temporarily disable your account. You can return by logging in again.</p>
                    </div>
                    <Button
                      variant="destructive"
                      className="gap-2 shrink-0 w-full sm:w-44"
                      onClick={() => setDisableDialogOpen(true)}
                    >
                      <UserX className="size-4" />
                      Disable Account
                    </Button>
                  </div>
                  
                  <div className="h-px bg-border my-2" />
                  
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="font-medium text-sm">Delete Account</h4>
                      <p className="text-sm text-muted-foreground">Permanently delete your account and all associated data. This cannot be undone.</p>
                    </div>
                    <Button
                      id="delete-account-btn"
                      className="gap-2 shrink-0 w-full sm:w-44 bg-red-600 text-white hover:bg-red-700"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="size-4" />
                      Delete Account
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>

      {/* Password Change Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-5 text-primary" />
              Update Password
            </DialogTitle>
            <DialogDescription>
              Enter your new password below. Must be at least 6 characters.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New Password</Label>
              <PasswordInput
                id="new-password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-new-password">Confirm New Password</Label>
              <PasswordInput
                id="confirm-new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPasswordDialogOpen(false)
                setNewPassword("")
                setConfirmPassword("")
              }}
            >
              Cancel
            </Button>
            <Button
              id="submit-password-btn"
              onClick={handleChangePassword}
              disabled={changingPassword}
              className="gap-2"
            >
              {changingPassword ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <KeyRound className="size-4" />
              )}
              {changingPassword ? "Updating..." : "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription>
              This action is <strong>permanent</strong> and cannot be undone. All
              your data, donations, and profile information will be removed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <p className="text-sm text-destructive">
                Type <strong>DELETE</strong> to confirm account deletion.
              </p>
            </div>
            <Input
              id="delete-confirm-input"
              placeholder='Type "DELETE" to confirm'
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setDeleteConfirmText("")
              }}
            >
              Cancel
            </Button>
            <Button
              id="confirm-delete-btn"
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deletingAccount || deleteConfirmText !== "DELETE"}
              className="gap-2"
            >
              {deletingAccount ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {deletingAccount ? "Deleting..." : "Delete Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable Account Dialog */}
      <Dialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="size-5 text-destructive" />
              Disable Account
            </DialogTitle>
            <DialogDescription>
              Disabling your account will log you out immediately. You can restore your account simply by logging back in.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setDisableDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisableAccount}
              disabled={disablingAccount}
              className="gap-2"
            >
              {disablingAccount ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UserX className="size-4" />
              )}
              {disablingAccount ? "Disabling..." : "Confirm & Log Out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )

  return <SidebarLayout>{content}</SidebarLayout>
}
