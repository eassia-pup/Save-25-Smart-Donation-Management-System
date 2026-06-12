import * as React from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  CreditCard,
  Banknote,
  PackageOpen,
} from "lucide-react"
import type { Campaign } from "@/lib/database.types"

/* ─── Step Indicator ─── */
const STEP_LABELS = ["Payment", "Review", "Verify"]

export function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-center gap-1 pb-2">
      {STEP_LABELS.map((label, i) => {
        const step = (i + 1) as 1 | 2 | 3
        const done = step < current
        const active = step === current
        return (
          <React.Fragment key={label}>
            {i > 0 && (
              <div
                className={`h-0.5 w-8 rounded transition-colors duration-300 ${
                  done ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex size-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? <CheckCircle2 className="size-4" /> : step}
              </div>
              <span
                className={`text-[10px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                {label}
              </span>
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}

/* ─── Payment Overview (Step 2) ─── */
type OverviewProps = {
  campaign: Campaign
  donationType: "credit-card" | "debit-card" | "in-kind"
  cardName: string
  cardContact: string
  cardAmount: string
  inkindName: string
  inkindType: string
  inkindAmount: string
  inkindContact: string
  inkindAddress: string
  onBack: () => void
  onProceed: () => void
  isProcessing: boolean
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  )
}

export function PaymentOverview(props: OverviewProps) {
  const isCard =
    props.donationType === "credit-card" || props.donationType === "debit-card"
  const typeIcon = isCard ? (
    props.donationType === "credit-card" ? (
      <CreditCard className="size-4" />
    ) : (
      <Banknote className="size-4" />
    )
  ) : (
    <PackageOpen className="size-4" />
  )
  const typeLabel = isCard
    ? props.donationType === "credit-card"
      ? "Credit Card"
      : "Debit Card"
    : "In-kind Donation"

  return (
    <div className="space-y-4 animate-in fade-in-0 slide-in-from-right-4 duration-300">
      <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          {typeIcon}
          {typeLabel}
        </div>
        <Separator />
        <Row label="Campaign" value={props.campaign.title} />
        <Separator />
        {isCard ? (
          <>
            <Row label="Donor Name" value={props.cardName} />
            <Separator />
            <Row label="Contact" value={props.cardContact} />
            <Separator />
            <div className="mt-2 flex items-center justify-between rounded-lg bg-primary/10 p-3">
              <span className="text-sm font-semibold">Total Amount</span>
              <span className="text-lg font-bold text-primary">
                ₱{parseFloat(props.cardAmount).toLocaleString()}
              </span>
            </div>
          </>
        ) : (
          <>
            <Row label="Donor Name" value={props.inkindName} />
            <Separator />
            <Row label="Donation Type" value={props.inkindType} />
            <Separator />
            <Row label="Quantity" value={props.inkindAmount} />
            <Separator />
            <Row label="Contact" value={props.inkindContact} />
            <Separator />
            <Row label="Address" value={props.inkindAddress} />
          </>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1 gap-1.5"
          onClick={props.onBack}
          disabled={props.isProcessing}
        >
          <ArrowLeft className="size-3.5" /> Back
        </Button>
        <Button
          type="button"
          className="flex-1 gap-1.5"
          onClick={props.onProceed}
          disabled={props.isProcessing}
        >
          {props.isProcessing ? (
            <>
              <Loader2 className="size-3.5 animate-spin" /> Processing...
            </>
          ) : isCard ? (
            <>
              <ShieldCheck className="size-3.5" /> Pay with PayMongo
            </>
          ) : (
            <>
              <ShieldCheck className="size-3.5" /> Confirm & Submit
            </>
          )}
        </Button>
      </div>
    </div>
  )
}


