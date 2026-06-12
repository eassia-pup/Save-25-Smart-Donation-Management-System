import { supabase } from "./supabase"
import type { DeliveryInsert, DeliveryCheckpointInsert } from "./database.types"

/**
 * Initiates the logistics process for a completed campaign.
 * This includes creating a delivery record and initial checkpoints.
 */
export async function initiateLogistics(campaignId: string) {
  try {
    // 1. Check if a delivery already exists for this campaign to avoid duplicates
    const { data: existingDelivery, error: checkError } = await supabase
      .from("deliveries")
      .select("id")
      .eq("campaign_id", campaignId)
      .maybeSingle()

    if (checkError) throw checkError

    if (existingDelivery) {
      console.log("Logistics already initiated for this campaign.")
      return { success: true, alreadyExists: true }
    }

    // 2. Fetch campaign details to get potential destination or items if needed
    // For now we use the campaignTitle and generic defaults
    
    // 3. Create the main delivery record
    const deliveryData: DeliveryInsert = {
      campaign_id: campaignId,
      status: "scheduled",
      assigned_personnel: "Pending Assignment",
      destination: "Main Relief Center", // Default destination
      estimated_delivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      progress: 0,
    }

    const { data: delivery, error: deliveryError } = await supabase
      .from("deliveries")
      .insert(deliveryData)
      .select()
      .single()

    if (deliveryError) throw deliveryError

    // 4. Create initial checkpoints
    const initialCheckpoints: DeliveryCheckpointInsert[] = [
      {
        delivery_id: delivery.id,
        name: "Inventory Sorted",
        status: "pending",
        checkpoint_time: null,
        order_index: 0,
      },
      {
        delivery_id: delivery.id,
        name: "Ready for Dispatch",
        status: "pending",
        checkpoint_time: null,
        order_index: 1,
      },
      {
        delivery_id: delivery.id,
        name: "In Transit",
        status: "pending",
        checkpoint_time: null,
        order_index: 2,
      },
      {
        delivery_id: delivery.id,
        name: "Delivered to Destination",
        status: "pending",
        checkpoint_time: null,
        order_index: 3,
      }
    ]

    const { error: checkpointError } = await supabase
      .from("delivery_checkpoints")
      .insert(initialCheckpoints)

    if (checkpointError) throw checkpointError

    return { success: true, deliveryId: delivery.id }
  } catch (error) {
    console.error("Error initiating logistics:", error)
    return { success: false, error }
  }
}
