import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CreditCard,
  Banknote,
  PackageOpen,
  ShieldCheck,
  Clock,
  ArrowRight,
  CheckCircle2,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import type { Campaign } from "@/lib/database.types"
import {
  StepIndicator,
  PaymentOverview,
} from "@/components/module/payment-steps"
import {
  createCheckoutSession,
} from "@/lib/paymongo"

type DonationType = "credit-card" | "debit-card" | "in-kind"

type DonationPaymentFormProps = {
  campaign: Campaign | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const COOLDOWN_SECONDS = 30

const INKIND_TYPE_MAP: Record<string, string> = {
  "Relief Goods": "relief_goods",
  "New Clothes": "new_clothes",
  Medicine: "medicine",
  "Essential Goods": "essential_goods",
}

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

export function DonationPaymentForm({
  campaign,
  open,
  onOpenChange,
}: DonationPaymentFormProps) {
  const { user } = useAuth()

  // Step state
  const [step, setStep] = React.useState<1 | 2 | 3 | 4>(1)

  const [donationType, setDonationType] =
    React.useState<DonationType>("credit-card")
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({})
  const [cooldownRemaining, setCooldownRemaining] = React.useState(0)
  const lastSubmitRef = React.useRef<number>(0)
  const cooldownTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(
    null
  )

  // Card form state (only fields captured before redirecting)
  const [cardName, setCardName] = React.useState("")
  const [cardContact, setCardContact] = React.useState("")
  const [cardAmount, setCardAmount] = React.useState("")

  // In-kind form state
  const [inkindName, setInkindName] = React.useState("")
  const [inkindType, setInkindType] = React.useState("")
  const [inkindAmount, setInkindAmount] = React.useState("")
  const [inkindContact, setInkindContact] = React.useState("")
  const [inkindStreet, setInkindStreet] = React.useState("")
  const [inkindBarangay, setInkindBarangay] = React.useState("")
  const [inkindCity, setInkindCity] = React.useState("")
  const [inkindProvince, setInkindProvince] = React.useState("")
  const [inkindZip, setInkindZip] = React.useState("")
  const [raCompliance, setRaCompliance] = React.useState(false)

  // PayMongo payment state
  const [isProcessing, setIsProcessing] = React.useState(false)

  // Clean up timers on unmount
  React.useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current)
    }
  }, [])

  // Reset form on dialog close
  React.useEffect(() => {
    if (!open) {
      setStep(1)
      setDonationType("credit-card")
      setFormErrors({})
      setCardName("")
      setCardContact("")
      setCardAmount("")
      setInkindName("")
      setInkindType("")
      setInkindAmount("")
      setInkindContact("")
      setInkindStreet("")
      setInkindBarangay("")
      setInkindCity("")
      setInkindProvince("")
      setInkindZip("")
      setRaCompliance(false)
      setIsProcessing(false)
    }
  }, [open])

  // Listen for PayMongo Hosted Checkout Redirect query parameters
  React.useEffect(() => {
    if (!campaign) return

    const params = new URLSearchParams(window.location.search)
    const paymentStatus = params.get("payment")
    if (paymentStatus === "success") {
      const campaignId = params.get("campaign_id")
      const amountStr = params.get("amount")
      const donorName = params.get("donor_name")
      const contact = params.get("contact")
      const method = params.get("method") || "credit_card"

      if (campaignId && amountStr) {
        // Set form states for success screen
        setCardAmount(amountStr)
        setCardName(donorName || "Anonymous Donor")
        setCardContact(contact || "")
        setDonationType(method === "debit_card" ? "debit-card" : "credit-card")
        setStep(4)

        if (user) {
          const amount = parseFloat(amountStr)
          setIsProcessing(true)
          
          // Immediately clear URL parameters from address bar to prevent duplicate entries on reload
          const newUrl = window.location.pathname
          window.history.replaceState({}, document.title, newUrl)
          
          // Save donation record to database
          ;(async () => {
            try {
              const { error: dbError } = await supabase.from("donations").insert({
                campaign_id: campaignId,
                donor_id: user.id,
                amount: amount,
                method: method,
                cardholder_name: donorName || "Anonymous Donor",
                card_last_four: "4345", // Standard PayMongo Visa mock last 4
                billing_address: "Paid via PayMongo Hosted Checkout Page",
                contact_number: contact || "",
              })
              if (dbError) throw dbError
            } catch (err) {
              console.error("Database insert error:", err)
              toast.error("Failed to record donation. Please contact support.")
            } finally {
              setIsProcessing(false)
            }
          })()
        }
      }
    } else if (paymentStatus === "cancelled") {
      const newUrl = window.location.pathname
      window.history.replaceState({}, document.title, newUrl)
      toast.error("Donation cancelled", {
        description: "You cancelled the payment transaction.",
      })
    }
  }, [user, campaign])

  // Check remaining cooldown when dialog opens
  React.useEffect(() => {
    if (open && lastSubmitRef.current > 0) {
      const elapsed = Math.floor((Date.now() - lastSubmitRef.current) / 1000)
      const remaining = Math.max(COOLDOWN_SECONDS - elapsed, 0)
      if (remaining > 0) {
        setCooldownRemaining(remaining)
        startCooldownTimer(remaining)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function startCooldownTimer(seconds: number) {
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current)
    setCooldownRemaining(seconds)
    cooldownTimerRef.current = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) {
            clearInterval(cooldownTimerRef.current)
            cooldownTimerRef.current = null
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }





  function validateCardForm(): Record<string, string> {
    const errors: Record<string, string> = {}
    if (!cardName.trim()) errors.cardName = "Please enter your full name."
    if (!cardContact.trim()) errors.cardContact = "Please enter your contact number."
    
    const parsedAmount = parseFloat(cardAmount)
    if (!cardAmount.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      errors.cardAmount = "Please enter a valid donation amount."
    } else if (campaign && parsedAmount > campaign.goal) {
      errors.cardAmount = `Amount cannot exceed the campaign goal (₱${campaign.goal.toLocaleString()}).`
    }
    
    return errors
  }

  function validateInkindForm(): Record<string, string> {
    const errors: Record<string, string> = {}
    if (!inkindName.trim()) errors.inkindName = "Please enter your name."
    if (!inkindType) errors.inkindType = "Please select the type of in-kind donation."
    if (!inkindStreet.trim()) errors.inkindStreet = "Please enter Address/Unit/Street."
    if (!inkindBarangay.trim()) errors.inkindBarangay = "Please enter Barangay."
    if (!inkindCity.trim()) errors.inkindCity = "Please enter City/Municipality."
    if (!inkindProvince.trim()) errors.inkindProvince = "Please enter Province."
    if (!inkindZip.trim()) errors.inkindZip = "Please enter Zip Code."
    if (!inkindContact.trim()) errors.inkindContact = "Please enter your contact number."
    if (!inkindAmount.trim())
      errors.inkindAmount = "Please enter the amount of your in-kind donation."
    if (inkindType === "New Clothes" && !raCompliance)
      errors.raCompliance = "You must comply with RA No. 4653 to proceed."
    return errors
  }

  // Step 1 → Step 2
  function handleContinueToReview() {
    if (!user) {
      toast.error("Authentication required", {
        description: "Please log in to make a donation.",
      })
      return
    }
    const errors =
      donationType === "in-kind" ? validateInkindForm() : validateCardForm()
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setFormErrors({})
    setStep(2)
  }



  // Handle direct submission of in-kind donations (no payment gateway needed)
  async function handleInKindSubmit() {
    if (!user || !campaign) return
    setIsProcessing(true)
    try {
      const { error: dbError } = await supabase
        .from("inkind_donations")
        .insert({
          campaign_id: campaign.id,
          donor_id: user.id,
          donor_name: inkindName.trim(),
          inkind_type: INKIND_TYPE_MAP[inkindType] || "relief_goods",
          amount_description: inkindAmount.trim(),
          contact_number: inkindContact.trim(),
          address: `${inkindStreet.trim()}, ${inkindBarangay.trim()}, ${inkindCity.trim()}, ${inkindProvince.trim()}, ${inkindZip.trim()}`,
          ra_4653_compliance: raCompliance,
        })
      if (dbError) throw dbError

      const categoryMap: Record<string, string> = {
        "relief_goods": "food",
        "new_clothes": "clothing",
        "medicine": "medical",
        "essential_goods": "others"
      }
      const dbType = INKIND_TYPE_MAP[inkindType] || "relief_goods"
      
      const { error: invError } = await supabase
        .from("inventory")
        .insert({
          item_name: inkindType, 
          category: categoryMap[dbType] || "others",
          quantity: inkindAmount.trim(),
          campaign_id: campaign.id,
          donor_id: user.id,
          donor_name: inkindName.trim(),
          status: "in_stock"
        })
      if (invError) {
        console.error("Inventory sync error:", invError)
      }

      lastSubmitRef.current = Date.now()
      startCooldownTimer(COOLDOWN_SECONDS)
      setStep(4)
    } catch (err) {
      console.error("In-kind submission error:", err)
      toast.error("Submission Failed", {
        description: err instanceof Error ? err.message : "Please try again.",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle PayMongo card payment initialization via Hosted Checkout Redirect (Paraan B)
  async function handleCardPayment() {
    if (!user || !campaign) return
    setIsProcessing(true)
    try {
      const parsedAmount = parseFloat(cardAmount)
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Please enter a valid donation amount.")
      }
      const amountInCentavos = Math.round(parsedAmount * 100)

      const origin = window.location.origin
      const path = window.location.pathname
      const redirectBase = `${origin}${path}`

      const method = donationType === "credit-card" ? "credit_card" : "debit_card"
      const successUrl = `${redirectBase}?payment=success&campaign_id=${campaign.id}&amount=${parsedAmount}&donor_name=${encodeURIComponent(cardName.trim())}&contact=${encodeURIComponent(cardContact.trim())}&method=${method}`
      const cancelUrl = `${redirectBase}?payment=cancelled`

      // Create Checkout Session
      const sessionData = await createCheckoutSession({
        amountInCentavos,
        campaignTitle: campaign.title,
        successUrl,
        cancelUrl,
        description: `Donation to Campaign: ${campaign.title}`,
        email: user.email || "",
        name: cardName.trim(),
        phone: cardContact.trim(),
      })

      const checkoutUrl = sessionData.attributes.checkout_url
      if (!checkoutUrl) {
        throw new Error("No checkout URL returned from PayMongo.")
      }

      // Redirect the user to the PayMongo hosted checkout page
      window.location.href = checkoutUrl
    } catch (err) {
      console.error("PayMongo Checkout redirect failed:", err)
      toast.error("Checkout Initialization Failed", {
        description: err instanceof Error ? err.message : "An error occurred. Please try again.",
      })
      setIsProcessing(false)
    }
  }

  // Handle proceeding from Step 2
  async function handleProceedPayment() {
    if (donationType === "in-kind") {
      await handleInKindSubmit()
    } else {
      await handleCardPayment()
    }
  }

  if (!campaign) return null

  const isCooldownActive = cooldownRemaining > 0

  const stepTitles = {
    1: `Donate to ${campaign.title}`,
    2: "Payment Overview",
    3: "Payment Authentication",
    4: "Donation Successful!",
  } as const
  const stepDescriptions = {
    1: "Choose your donation type and fill in the required information.",
    2: "Please review your donation details before proceeding.",
    3: "Authenticate your card payment securely via PayMongo.",
    4: "Your payment has been successfully confirmed.",
  } as const

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        id="donation-payment-dialog"
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 4 ? (
              <CheckCircle2 className="size-5 text-green-500" />
            ) : (
              <ShieldCheck className="size-5 text-primary" />
            )}
            {stepTitles[step]}
          </DialogTitle>
          <DialogDescription>{stepDescriptions[step]}</DialogDescription>
        </DialogHeader>

        {step !== 4 && <StepIndicator current={step as 1 | 2 | 3} />}

        {/* ── STEP 1: Payment Form ── */}
        {step === 1 && (
          <div className="space-y-5 animate-in fade-in-0 slide-in-from-left-4 duration-300">
            {/* Donation Type Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">
                Select Donation Type
              </Label>
              <RadioGroup
                id="donation-type-selector"
                value={donationType}
                onValueChange={(value) =>
                  setDonationType(value as DonationType)
                }
                className="grid grid-cols-3 gap-2"
              >
                <div>
                  <RadioGroupItem
                    value="credit-card"
                    id="type-credit"
                    className="sr-only"
                  />
                  <Label
                    htmlFor="type-credit"
                    className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 p-3 text-center transition-all h-20 ${
                      donationType === "credit-card"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-muted hover:border-foreground/20"
                    }`}
                  >
                    <CreditCard className="size-5" />
                    <span className="text-xs font-medium">Credit Card</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem
                    value="debit-card"
                    id="type-debit"
                    className="sr-only"
                  />
                  <Label
                    htmlFor="type-debit"
                    className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 p-3 text-center transition-all h-20 ${
                      donationType === "debit-card"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-muted hover:border-foreground/20"
                    }`}
                  >
                    <Banknote className="size-5" />
                    <span className="text-xs font-medium">Debit Card</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem
                    value="in-kind"
                    id="type-inkind"
                    className="sr-only"
                  />
                  <Label
                    htmlFor="type-inkind"
                    className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 p-3 text-center transition-all h-20 ${
                      donationType === "in-kind"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-muted hover:border-foreground/20"
                    }`}
                  >
                    <PackageOpen className="size-5" />
                    <span className="text-xs font-medium">In-kind</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Credit / Debit Card Form */}
            {(donationType === "credit-card" ||
              donationType === "debit-card") && (
              <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                <div className="space-y-1.5">
                  <Label htmlFor="card-name" className={formErrors.cardName ? "text-red-500" : ""}>Donor Full Name</Label>
                  <Input
                    id="card-name"
                    placeholder="Juan Dela Cruz"
                    value={cardName}
                    onChange={(e) => {
                      setCardName(e.target.value)
                      if (formErrors.cardName) setFormErrors(prev => ({...prev, cardName: ""}))
                    }}
                    className={formErrors.cardName ? "border-red-500 focus-visible:ring-red-500" : ""}
                    disabled={isProcessing}
                  />
                  {formErrors.cardName && <p className="text-xs text-red-500">{formErrors.cardName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="card-contact" className={formErrors.cardContact ? "text-red-500" : ""}>Contact Number</Label>
                  <Input
                    id="card-contact"
                    placeholder="(+63) 9XX XXX XXXX"
                    value={cardContact}
                    onChange={(e) => {
                      const formatted = formatContactNumber(e.target.value)
                      setCardContact(formatted)
                      if (formErrors.cardContact) setFormErrors(prev => ({...prev, cardContact: ""}))
                    }}
                    className={formErrors.cardContact ? "border-red-500 focus-visible:ring-red-500" : ""}
                    disabled={isProcessing}
                  />
                  {formErrors.cardContact && <p className="text-xs text-red-500">{formErrors.cardContact}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="card-amount" className={formErrors.cardAmount ? "text-red-500" : ""}>Donation Amount (₱)</Label>
                  <Input
                    id="card-amount"
                    placeholder="500"
                    value={cardAmount}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === "" || /^\d*\.?\d*$/.test(val)) {
                        const numericVal = parseFloat(val)
                        if (campaign && numericVal > campaign.goal) {
                          setCardAmount(campaign.goal.toString())
                        } else {
                          setCardAmount(val)
                        }
                        if (formErrors.cardAmount) setFormErrors(prev => ({...prev, cardAmount: ""}))
                      }
                    }}
                    className={formErrors.cardAmount ? "border-red-500 focus-visible:ring-red-500" : ""}
                    inputMode="decimal"
                    disabled={isProcessing}
                  />
                  {formErrors.cardAmount && <p className="text-xs text-red-500">{formErrors.cardAmount}</p>}
                </div>
              </div>
            )}

            {/* In-kind Donation Form */}
            {donationType === "in-kind" && (
              <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                <div className="space-y-1.5">
                  <Label htmlFor="inkind-name" className={formErrors.inkindName ? "text-red-500" : ""}>Name of Company/Organization</Label>
                  <Input
                    id="inkind-name"
                    placeholder="Juan Dela Cruz"
                    value={inkindName}
                    onChange={(e) => {
                      setInkindName(e.target.value)
                      if (formErrors.inkindName) setFormErrors(prev => ({...prev, inkindName: ""}))
                    }}
                    className={formErrors.inkindName ? "border-red-500 focus-visible:ring-red-500" : ""}
                    disabled={isProcessing}
                  />
                  {formErrors.inkindName && <p className="text-xs text-red-500">{formErrors.inkindName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inkind-type" className={formErrors.inkindType ? "text-red-500" : ""}>Type of In-kind Donation</Label>
                  <Select
                    value={inkindType}
                    onValueChange={(val) => {
                      setInkindType(val)
                      if (val !== "New Clothes") setRaCompliance(false)
                      if (formErrors.inkindType) setFormErrors(prev => ({...prev, inkindType: ""}))
                    }}
                    disabled={isProcessing}
                  >
                    <SelectTrigger id="inkind-type" className={`w-full ${formErrors.inkindType ? "border-red-500 focus:ring-red-500" : ""}`}>
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Relief Goods">Relief Goods</SelectItem>
                      <SelectItem value="New Clothes">New Clothes</SelectItem>
                      <SelectItem value="Medicine">Medicine</SelectItem>
                      <SelectItem value="Essential Goods">
                        Essential Goods
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {formErrors.inkindType && <p className="text-xs text-red-500">{formErrors.inkindType}</p>}
                </div>
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Address</h4>
                  <div className="space-y-1.5">
                    <Label htmlFor="inkind-street" className={formErrors.inkindStreet ? "text-red-500" : ""}>Line 1 (Address/Unit/Street)</Label>
                    <Input
                      id="inkind-street"
                      placeholder="House Number, Street Name, Subdivision/Village"
                      value={inkindStreet}
                      onChange={(e) => {
                        setInkindStreet(e.target.value)
                        if (formErrors.inkindStreet) setFormErrors(prev => ({...prev, inkindStreet: ""}))
                      }}
                      className={formErrors.inkindStreet ? "border-red-500 focus-visible:ring-red-500" : ""}
                      disabled={isProcessing}
                    />
                    {formErrors.inkindStreet && <p className="text-xs text-red-500">{formErrors.inkindStreet}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="inkind-barangay" className={formErrors.inkindBarangay ? "text-red-500" : ""}>Barangay</Label>
                      <Input
                        id="inkind-barangay"
                        placeholder="Barangay Name"
                        value={inkindBarangay}
                        onChange={(e) => {
                          setInkindBarangay(e.target.value)
                          if (formErrors.inkindBarangay) setFormErrors(prev => ({...prev, inkindBarangay: ""}))
                        }}
                        className={formErrors.inkindBarangay ? "border-red-500 focus-visible:ring-red-500" : ""}
                        disabled={isProcessing}
                      />
                      {formErrors.inkindBarangay && <p className="text-xs text-red-500">{formErrors.inkindBarangay}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="inkind-city" className={formErrors.inkindCity ? "text-red-500" : ""}>City/Municipality</Label>
                      <Input
                        id="inkind-city"
                        placeholder="City Name"
                        value={inkindCity}
                        onChange={(e) => {
                          setInkindCity(e.target.value)
                          if (formErrors.inkindCity) setFormErrors(prev => ({...prev, inkindCity: ""}))
                        }}
                        className={formErrors.inkindCity ? "border-red-500 focus-visible:ring-red-500" : ""}
                        disabled={isProcessing}
                      />
                      {formErrors.inkindCity && <p className="text-xs text-red-500">{formErrors.inkindCity}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="inkind-province" className={formErrors.inkindProvince ? "text-red-500" : ""}>Province</Label>
                      <Input
                        id="inkind-province"
                        placeholder="Province"
                        value={inkindProvince}
                        onChange={(e) => {
                          setInkindProvince(e.target.value)
                          if (formErrors.inkindProvince) setFormErrors(prev => ({...prev, inkindProvince: ""}))
                        }}
                        className={formErrors.inkindProvince ? "border-red-500 focus-visible:ring-red-500" : ""}
                        disabled={isProcessing}
                      />
                      {formErrors.inkindProvince && <p className="text-xs text-red-500">{formErrors.inkindProvince}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="inkind-zip" className={formErrors.inkindZip ? "text-red-500" : ""}>Zip Code</Label>
                      <Input
                        id="inkind-zip"
                        placeholder="Zip Code"
                        value={inkindZip}
                        onChange={(e) => {
                          setInkindZip(e.target.value)
                          if (formErrors.inkindZip) setFormErrors(prev => ({...prev, inkindZip: ""}))
                        }}
                        className={formErrors.inkindZip ? "border-red-500 focus-visible:ring-red-500" : ""}
                        disabled={isProcessing}
                      />
                      {formErrors.inkindZip && <p className="text-xs text-red-500">{formErrors.inkindZip}</p>}
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inkind-contact" className={formErrors.inkindContact ? "text-red-500" : ""}>Contact Number</Label>
                  <Input
                    id="inkind-contact"
                    placeholder="(+63) 9XX XXX XXXX"
                    value={inkindContact}
                    onChange={(e) => {
                      const formatted = formatContactNumber(e.target.value)
                      setInkindContact(formatted)
                      if (formErrors.inkindContact) setFormErrors(prev => ({...prev, inkindContact: ""}))
                    }}
                    className={formErrors.inkindContact ? "border-red-500 focus-visible:ring-red-500" : ""}
                    disabled={isProcessing}
                  />
                  {formErrors.inkindContact && <p className="text-xs text-red-500">{formErrors.inkindContact}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inkind-amount" className={formErrors.inkindAmount ? "text-red-500" : ""}>
                    Amount of In-kind Donation
                  </Label>
                  <Input
                    id="inkind-amount"
                    placeholder="e.g., 50"
                    value={inkindAmount}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "")
                      setInkindAmount(val)
                      if (formErrors.inkindAmount) setFormErrors(prev => ({...prev, inkindAmount: ""}))
                    }}
                    className={formErrors.inkindAmount ? "border-red-500 focus-visible:ring-red-500" : ""}
                    inputMode="numeric"
                    disabled={isProcessing}
                  />
                  {formErrors.inkindAmount && <p className="text-xs text-red-500">{formErrors.inkindAmount}</p>}
                </div>
                {inkindType === "New Clothes" && (
                  <div className={`flex items-start gap-2.5 rounded-lg border bg-muted/30 p-3 animate-in fade-in slide-in-from-top-1 duration-200 ${formErrors.raCompliance ? 'border-red-500 bg-red-500/5' : ''}`}>
                    <Checkbox
                      id="ra-compliance"
                      checked={raCompliance}
                      onCheckedChange={(checked) => {
                        setRaCompliance(checked === true)
                        if (formErrors.raCompliance) setFormErrors(prev => ({...prev, raCompliance: ""}))
                      }}
                      disabled={isProcessing}
                      className={`mt-0.5 ${formErrors.raCompliance ? 'border-red-500 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500' : ''}`}
                    />
                    <div className="space-y-1">
                      <Label
                        htmlFor="ra-compliance"
                        className={`text-xs leading-relaxed font-normal ${formErrors.raCompliance ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}
                      >
                        I hereby comply with{" "}
                        <span className="font-semibold text-foreground">
                          Republic Act No. 4653 (RA NO. 4653)
                        </span>{" "}
                        and certify that all information provided is true and
                        correct.
                      </Label>
                      {formErrors.raCompliance && <p className="text-xs text-red-500 font-medium">{formErrors.raCompliance}</p>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Continue Button */}
            <Button
              id="payment-continue-btn"
              type="button"
              className="w-full gap-2"
              size="lg"
              disabled={isCooldownActive}
              onClick={handleContinueToReview}
            >
              {isCooldownActive ? (
                <>
                  <Clock className="size-4" />
                  Please wait ({cooldownRemaining}s)
                </>
              ) : (
                <>
                  <ArrowRight className="size-4" />
                  Proceed Payment
                </>
              )}
            </Button>

            {isCooldownActive && (
              <p className="text-center text-xs text-muted-foreground">
                To prevent duplicate submissions, please wait{" "}
                {cooldownRemaining} seconds before submitting again.
              </p>
            )}
          </div>
        )}

        {/* ── STEP 2: Payment Overview ── */}
        {step === 2 && (
          <PaymentOverview
            campaign={campaign}
            donationType={donationType}
            cardName={cardName}
            cardContact={cardContact}
            cardAmount={cardAmount}
            inkindName={inkindName}
            inkindType={inkindType}
            inkindAmount={inkindAmount}
            inkindContact={inkindContact}
            inkindAddress={`${inkindStreet}, ${inkindBarangay}, ${inkindCity}, ${inkindProvince}, ${inkindZip}`}
            onBack={() => setStep(1)}
            onProceed={handleProceedPayment}
            isProcessing={isProcessing}
          />
        )}



        {/* ── STEP 4: Success Confirmation ── */}
        {step === 4 && (
          <div className="flex flex-col items-center justify-center space-y-6 pt-8 pb-0 animate-in fade-in-0 zoom-in-95 duration-300">
            {isProcessing ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="size-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground font-medium">
                  Recording your donation...
                </p>
              </div>
            ) : (
              <>
                <div className="flex size-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                  <CheckCircle2 className="size-10 text-green-600 dark:text-green-500" />
                </div>
                <div className="space-y-2 text-center">
                  <h3 className="text-2xl font-bold tracking-tight text-foreground">
                    Payment Confirmed
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    {donationType === "in-kind"
                      ? `Thank you, ${inkindName}! Your ${inkindType} donation for "${campaign.title}" has been recorded.`
                      : `₱${parseFloat(cardAmount || "0").toLocaleString()} donated via ${
                          donationType === "credit-card"
                            ? "Credit Card"
                            : "Debit Card"
                        }. Thank you, ${cardName}!`}
                  </p>
                </div>
                <div className="w-full">
                  <Button
                    className="w-full font-medium"
                    size="lg"
                    onClick={() => onOpenChange(false)}
                  >
                    Return to Browse Campaigns
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
