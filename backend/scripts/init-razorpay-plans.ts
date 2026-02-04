import Razorpay from 'razorpay';


// Configuration
const STAGE = process.env.STAGE || 'dev';
const PLANS = [
    {
        period: 'monthly',
        interval: 1,
        item: {
            name: 'Thirukkural Plus (Monthly INR)',
            amount: 1500, // ₹15.00
            currency: 'INR',
            description: 'Unlimited access + Daily Emails'
        },
        notes: { type: 'monthly_inr' }
    },
    {
        period: 'yearly',
        interval: 1,
        item: {
            name: 'Thirukkural Plus (Yearly INR)',
            amount: 15000, // ₹150.00
            currency: 'INR',
            description: 'Unlimited access (2 months free)'
        },
        notes: { type: 'yearly_inr' }
    },
    {
        period: 'monthly',
        interval: 1,
        item: {
            name: 'Thirukkural Plus (Monthly USD)',
            amount: 99, // $0.99
            currency: 'USD',
            description: 'Unlimited access + Daily Emails'
        },
        notes: { type: 'monthly_usd' }
    },
    {
        period: 'yearly',
        interval: 1,
        item: {
            name: 'Thirukkural Plus (Yearly USD)',
            amount: 999, // $9.99
            currency: 'USD',
            description: 'Unlimited access (2 months free)'
        },
        notes: { type: 'yearly_usd' }
    }
];

async function main() {
    console.log('Using Razorpay Credentials from Environment...');
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret) {
        throw new Error('Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.');
    }

    const razorpay = new Razorpay({ key_id, key_secret });

    console.log('Creating/Verifying Plans...');
    // Razorpay doesn't have a "get by note" easily, so for this script we will just CREATE them.
    // In a real idempotent script, you might store the generated ID in SSM to avoid duplicates,
    // or list all plans and check if one matches the name.

    const results: Record<string, string> = {};

    for (const planDef of PLANS) {
        console.log(`Creating ${planDef.item.name}...`);
        try {
            const plan = await razorpay.plans.create({
                period: planDef.period as any,
                interval: planDef.interval,
                item: {
                    name: planDef.item.name,
                    amount: planDef.item.amount,
                    currency: planDef.item.currency,
                    description: planDef.item.description
                },
                notes: planDef.notes
            });
            console.log(`✅ Created: ${plan.id}`);
            results[planDef.notes.type] = plan.id;
        } catch (e: any) {
            console.error(`❌ Failed to create ${planDef.item.name}:`, e.message);
        }
    }

    console.log('\n\n=== RESULTS ===');
    console.log(JSON.stringify(results, null, 2));
}

main();
