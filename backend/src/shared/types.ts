export interface UserProfile {
    userId: string;
    email: string;
    // Preferences
    receiveDailyEmail: boolean;
    // Payment & Credits
    credits: number; // Supports decimals
    region: 'IN' | 'ROW';
    currency: 'INR' | 'USD';
    // Subscription
    subscriptionStatus: 'active' | 'created' | 'authenticated' | 'past_due' | 'paused' | 'cancelled' | 'completed' | 'expired' | 'inactive';
    subscriptionPlan?: 'monthly' | 'yearly';
    subscriptionId?: string; // Razorpay Sub ID
    razorpayCustomerId?: string;
    nextBillingAt?: number; // Unix timestamp
    subscriptionExpiry?: string; // ISO Date
    // Meta
    createdAt: string;
    updatedAt?: string;
}

export interface RazorpayOrderRequest {
    amount: number; // In smallest currency unit (paise/cents) OR main unit handled by backend?
    // Usually frontend sends main unit or plan ID.
    // Let's expect amount in main unit (INR/USD) for credit packs
    amountMain: number;
    currency: 'INR' | 'USD';
    receipt?: string;
}

export interface RazorpaySubscriptionRequest {
    planId: string; // Internal Plan ID ('monthly-inr', 'yearly-usd', etc.)
}

export const PRICING_CONFIG = {
    IN: {
        currency: 'INR',
        creditCost: 1.0, // 1 Credit = 1 INR
        plans: {
            monthly: { amount: 15, razorpayPlanId: 'plan_monthly_inr' }, // Replace with real ID via Env/SSM 
            yearly: { amount: 150, razorpayPlanId: 'plan_yearly_inr' }
        }
    },
    ROW: {
        currency: 'USD',
        creditCost: 0.02, // Derived? No, plan says $1 = 50 credits -> $0.02 per credit.
        plans: {
            monthly: { amount: 0.99, razorpayPlanId: 'plan_monthly_usd' },
            yearly: { amount: 9.99, razorpayPlanId: 'plan_yearly_usd' }
        }
    }
};
