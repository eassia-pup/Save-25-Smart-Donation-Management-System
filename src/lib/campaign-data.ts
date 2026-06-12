import type { Campaign } from "@/lib/database.types"

// Mock campaign data matching the database schema structure.
// Once Supabase is seeded, these will be fetched via supabase.from("campaigns").select().
export const mockCampaigns: Campaign[] = [
  {
    id: "1",
    title: "Typhoon Yolanda Relief Fund",
    short_description:
      "Help families recover from the devastating typhoon. Your donation provides food, shelter, and essential supplies to affected communities.",
    full_description:
      "Typhoon Yolanda left thousands of families displaced, with homes destroyed and livelihoods shattered. This campaign aims to provide immediate relief in the form of food packs, clean drinking water, temporary shelters, and hygiene kits. Every peso donated goes directly to on-the-ground operations coordinated with local government units and accredited NGOs. Our target is to reach 5,000 families across the Visayas region within the next 60 days. We are also working on long-term rehabilitation plans including livelihood programs and school rebuilding. Together, we can help these communities rise again and rebuild stronger than before. All disbursements are audited and transparent reports are published monthly.",
    image_url: "/img/campaign-disaster-relief.png",
    category: "Disaster Relief",
    goal: 2000000,
    raised: 1250000,
    donor_count: 847,
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000).toISOString(),
    status: "active",
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "2",
    title: "Scholars of Hope: Education Fund",
    short_description:
      "Provide scholarships and school supplies to underprivileged students across Mindanao. Every child deserves access to quality education.",
    full_description:
      "Education is the most powerful weapon we can use to change the world. The Scholars of Hope program supports underprivileged students in remote barangays of Mindanao by providing full scholarships covering tuition, books, uniforms, and school supplies. We partner with local schools and community leaders to identify deserving students from families earning below the poverty threshold. This campaign also funds the construction of small community libraries and after-school tutoring programs staffed by volunteer teachers. Last year, we successfully supported 200 scholars — this year, our goal is to double that number. Your donation directly funds a child's future and helps break the cycle of poverty. Quarterly progress reports with student updates are shared with all donors.",
    image_url: "/img/campaign-education.png",
    category: "Education",
    goal: 1500000,
    raised: 780000,
    donor_count: 523,
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    status: "active",
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "3",
    title: "Community Medical Mission",
    short_description:
      "Free medical checkups, medicines, and health services for underserved communities in rural Philippines.",
    full_description:
      "Access to healthcare remains a challenge for many Filipinos, especially those in remote rural areas where the nearest hospital can be hours away. Our Community Medical Mission brings volunteer doctors, nurses, dentists, and pharmacists directly to underserved barangays. Each mission provides free consultations, basic laboratory tests, dental extractions, minor surgical procedures, and a full supply of prescription medicines. We also conduct health education seminars on nutrition, hygiene, and disease prevention. This campaign funds the transportation, medical supplies, equipment, and meals for our volunteer medical teams. We conduct missions twice a month, each serving an average of 300-500 patients. Your donation helps save lives and brings hope to communities that need it most.",
    image_url: "/img/campaign-medical.png",
    category: "Healthcare",
    goal: 800000,
    raised: 450000,
    donor_count: 312,
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: "active",
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "4",
    title: "Build a Home, Build a Dream",
    short_description:
      "Help us construct safe, durable homes for families living in makeshift shelters. Every family deserves a roof over their heads.",
    full_description:
      "Thousands of Filipino families live in makeshift shelters made of scrap wood, tin sheets, and tarpaulins — structures that offer little protection from storms and flooding. Our housing program constructs simple yet durable concrete homes using a community-based approach where future homeowners participate in the building process. Each home costs approximately ₱150,000 and includes basic sanitation facilities. We work closely with local government units for land allocation and building permits. Since our founding, we have built 85 homes across Luzon and the Visayas. This campaign aims to build 20 additional homes in the next 6 months. Donors receive photo updates throughout the construction process and are invited to turnover ceremonies. Your generosity builds more than a house — it builds a family's future.",
    image_url: "/img/campaign-housing.png",
    category: "Housing",
    goal: 3000000,
    raised: 2100000,
    donor_count: 1205,
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    status: "active",
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "5",
    title: "Feeding Program: Nourish the Future",
    short_description:
      "Daily nutritious meals for malnourished children and elderly in urban poor communities. No one should go hungry.",
    full_description:
      "Malnutrition remains one of the most pressing health issues facing Filipino children, particularly in urban poor communities. Our Nourish the Future feeding program provides daily nutritious meals to children aged 2-12 and senior citizens aged 60 and above in identified communities across Metro Manila and surrounding provinces. Each meal is carefully planned by a licensed nutritionist to ensure it meets the dietary needs of our beneficiaries. We operate 12 feeding centers staffed by community volunteers, serving an average of 1,500 meals per day. This campaign funds ingredients, cooking equipment, kitchen facilities, and volunteer training. We also conduct monthly nutritional assessments to track the health improvements of our beneficiaries. In our first year, we saw a 40% reduction in malnutrition rates among regular program participants.",
    image_url: "/img/campaign-feeding.png",
    category: "Feeding Program",
    goal: 1200000,
    raised: 920000,
    donor_count: 678,
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    status: "active",
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "6",
    title: "Green Philippines: Plant a Tree Today",
    short_description:
      "Join our reforestation and coastal cleanup drive. Help restore the Philippines' natural ecosystems for future generations.",
    full_description:
      "The Philippines has lost over 70% of its original forest cover due to illegal logging, mining, and agricultural expansion. Our Green Philippines initiative combines reforestation with coastal and river cleanup operations to restore the country's natural ecosystems. We plant native tree species such as narra, molave, and mangrove in deforested areas and eroding coastlines. Each tree planted costs approximately ₱50 including seedling, planting, and two years of maintenance. Our cleanup drives remove tons of plastic waste from rivers and coastlines monthly, preventing ocean pollution and protecting marine life. We partner with local communities, schools, and corporate volunteers, creating environmental awareness while providing livelihood opportunities for community tree caretakers. This campaign aims to plant 100,000 trees and conduct 24 major cleanup drives within the year.",
    image_url: "/img/campaign-environment.png",
    category: "Environment",
    goal: 500000,
    raised: 350000,
    donor_count: 1432,
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    status: "active",
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]
