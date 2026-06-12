const BASE_URL_V2 = "/api-paymongo/v2"

// Read the secret key strictly from the environment variables (no hardcoded fallback keys)
const SECRET_KEY = import.meta.env.VITE_PAYMONGO_SECRET_KEY

if (!SECRET_KEY) {
  console.warn(
    "PayMongo Secret Key is missing. Please set VITE_PAYMONGO_SECRET_KEY in your .env file and restart your dev server."
  )
}

// Base64 encode the secret key for PayMongo Basic Auth
const getAuthHeaders = () => {
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Basic ${btoa((SECRET_KEY || "") + ":")}`,
  }
}

async function handleResponse(response: Response) {
  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    const errorDetail = json?.errors?.[0]?.detail || `API request failed with status ${response.status}`
    throw new Error(errorDetail)
  }
  return json.data
}

function sanitizePhoneNumber(phone: string) {
  const digits = phone.replace(/\D/g, "")
  if (digits.startsWith("63")) {
    return `+${digits}`
  }
  if (digits.startsWith("09") && digits.length === 11) {
    return `+63${digits.substring(1)}`
  }
  return phone.trim()
}

/**
 * Creates a PayMongo Checkout Session (v2) and returns the session details.
 */
export async function createCheckoutSession(params: {
  amountInCentavos: number
  campaignTitle: string
  successUrl: string
  cancelUrl: string
  description: string
  email: string
  name: string
  phone: string
}) {
  const response = await fetch(`${BASE_URL_V2}/checkout_sessions`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [
            {
              name: `Donation to Campaign: ${params.campaignTitle}`,
              amount: params.amountInCentavos,
              currency: "PHP",
              quantity: 1,
            },
          ],
          payment_method_types: ["card", "gcash", "paymaya", "grab_pay"],
          success_url: params.successUrl,
          cancel_url: params.cancelUrl,
          description: params.description,
          billing: {
            email: params.email,
            name: params.name,
            phone: sanitizePhoneNumber(params.phone),
          },
        },
      },
    }),
  })
  return handleResponse(response)
}
