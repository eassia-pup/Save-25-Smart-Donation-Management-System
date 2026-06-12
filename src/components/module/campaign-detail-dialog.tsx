import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Heart, Clock, Users, TrendingUp } from "lucide-react"
import type { Campaign } from "@/lib/database.types"

type CampaignDetailDialogProps = {
  campaign: Campaign | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDonateNow: (campaign: Campaign) => void
}

export function CampaignDetailDialog({
  campaign,
  open,
  onOpenChange,
  onDonateNow,
}: CampaignDetailDialogProps) {
  if (!campaign) return null

  const progressPercent = Math.min(
    (campaign.raised / campaign.goal) * 100,
    100
  )

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        id="campaign-detail-dialog"
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl p-0 gap-0 flex flex-col"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{campaign.title}</DialogTitle>
          <DialogDescription>Campaign details and donation</DialogDescription>
        </DialogHeader>

        {/* Campaign Image */}
        <div className="relative aspect-[16/9] overflow-hidden rounded-t-xl">
          <img
            src={campaign.image_url ?? ""}
            alt={campaign.title}
            className="size-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          {/* Integrated Progress Bar at the bottom of image */}
          <div className="absolute bottom-0 left-0 w-full px-5 pb-5">
            <div className="mb-3">
              <span className="rounded-full bg-primary/90 px-3 py-1 text-[10px] font-bold tracking-wider text-primary-foreground uppercase backdrop-blur-md">
                {campaign.category}
              </span>
            </div>
            <h2 className="mb-3 text-2xl font-bold leading-tight text-white drop-shadow-lg sm:text-3xl">
              {campaign.title}
            </h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/90">
                <span>{Math.round(progressPercent)}% Funded</span>
                <span>{formatCurrency(campaign.raised)} / {formatCurrency(campaign.goal)}</span>
              </div>
              <Progress value={progressPercent} className="h-1.5 border-none bg-white/20 shadow-sm" />
            </div>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="p-8 pt-10 space-y-5  relative z-10">
          {/* Stats Row */}
          <div className="mt-2 grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center rounded-xl bg-primary/5 p-4 ring-1 ring-primary/10 transition-colors hover:bg-primary/10">
              <Users className="mb-1.5 size-5 text-primary" />
              <span className="text-xl font-black text-primary">
                {campaign.donor_count.toLocaleString()}
              </span>
              <span className="text-[0.6rem] font-bold uppercase tracking-tighter text-muted-foreground">Donors</span>
            </div>
            <div className="flex flex-col items-center justify-center text-center rounded-xl bg-primary/5 p-4 ring-1 ring-primary/10 transition-colors hover:bg-primary/10">
              <Clock className="mb-1.5 size-5 text-primary" />
              <span className="text-sm font-black text-primary leading-tight">
                {new Date(campaign.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {new Date(campaign.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
              <span className="text-[0.6rem] font-bold uppercase tracking-tighter text-muted-foreground mt-1">
                Duration
              </span>
            </div>
            <div className="flex flex-col items-center rounded-xl bg-primary/5 p-4 ring-1 ring-primary/10 transition-colors hover:bg-primary/10">
              <TrendingUp className="mb-1.5 size-5 text-primary" />
              <span className="text-xl font-black text-primary">
                {Math.round(progressPercent)}%
              </span>
              <span className="text-[0.6rem] font-bold uppercase tracking-tighter text-muted-foreground">Funded</span>
            </div>
          </div>

          {/* Full Description */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">About this Campaign</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {campaign.full_description}
            </p>
          </div>

          {/* Donate Now Button */}
          <Button
            id="detail-donate-btn"
            className="w-full gap-2 font-bold"
            size="lg"
            onClick={() => onDonateNow(campaign)}
          >
            <Heart className="size-4" />
            Donate Now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
