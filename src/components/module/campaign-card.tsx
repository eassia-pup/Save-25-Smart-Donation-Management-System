import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Heart, Clock, Users } from "lucide-react"
import type { Campaign } from "@/lib/database.types"

type CampaignCardProps = {
  campaign: Campaign
  onViewDetails: (campaign: Campaign) => void
}

export function CampaignCard({ campaign, onViewDetails }: CampaignCardProps) {
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
    <Card
      id={`campaign-card-${campaign.id}`}
      className="group cursor-pointer overflow-hidden border-0 bg-card/80 shadow-md ring-1 ring-foreground/5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:ring-primary/20"
      onClick={() => onViewDetails(campaign)}
    >
      {/* Card Image */}
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        <img
          src={campaign.image_url ?? ""}
          alt={campaign.title}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        <span className="absolute top-3 left-3 rounded-full bg-primary/90 px-2.5 py-0.5 text-[0.7rem] font-semibold tracking-wide text-primary-foreground uppercase backdrop-blur-sm">
          {campaign.category}
        </span>
      </div>

      <CardContent className="flex flex-col gap-3 p-4 pt-3">
        {/* Card Title */}
        <h3
          id={`campaign-title-${campaign.id}`}
          className="line-clamp-1 text-base font-semibold leading-snug tracking-tight"
        >
          {campaign.title}
        </h3>

        {/* Card Detail (truncated) */}
        <p className="line-clamp-2 text-[0.82rem] leading-relaxed text-muted-foreground">
          {campaign.short_description}
        </p>

        {/* Amount vs Goal Progress Bar */}
        <div className="space-y-1.5">
          <Progress value={progressPercent} className="h-2" />
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-primary">
              {formatCurrency(campaign.raised)}
            </span>
            <span className="text-muted-foreground">
              of {formatCurrency(campaign.goal)}
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 border-t pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="size-3.5" />
            {campaign.donor_count.toLocaleString()} donors
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" />
            {new Date(campaign.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {new Date(campaign.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        </div>

        {/* Donate Now Button */}
        <Button
          id={`donate-btn-${campaign.id}`}
          className="mt-1 w-full gap-2"
          size="lg"
          onClick={(e) => {
            e.stopPropagation()
            onViewDetails(campaign)
          }}
        >
          <Heart className="size-4" />
          Donate Now
        </Button>
      </CardContent>
    </Card>
  )
}
