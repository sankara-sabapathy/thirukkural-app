import { Component, OnInit, NgZone, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { PaymentService } from '../../services/payment.service';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
    selector: 'app-pricing',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './pricing.component.html',
    styleUrls: ['./pricing.component.css']
})
export class PricingComponent implements OnInit {
    currency: 'INR' | 'USD' = 'INR';
    isLoggedIn = false;
    isLoading = false;
    enablePayments = environment.enablePayments;

    constructor(
        private paymentService: PaymentService,
        private authService: AuthService,
        private router: Router,
        private ngZone: NgZone,
        private destroyRef: DestroyRef // Injected for cleanup
    ) { }

    ngOnInit() {
        this.authService.isAuthenticated$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(auth => {
            this.isLoggedIn = auth;
            // If logged in, maybe fetch user pref for currency?
            // For now, default to INR or detect locally.
        });
    }

    toggleCurrency(curr: 'INR' | 'USD') {
        this.currency = curr;
    }

    async buyCredits(amount: number) {
        if (!this.isLoggedIn) {
            // Save intent for seamless flow
            const intent = { type: 'credits', amount, currency: this.currency };
            localStorage.setItem('paymentIntent', JSON.stringify(intent));
            this.authService.login();
            return;
        }

        this.isLoading = true;
        try {
            const order = await this.paymentService.createOrder(amount, this.currency);
            this.paymentService.openCheckout({
                key: environment.razorpay.keyId,
                amount: order.amount,
                currency: order.currency,
                order_id: order.id,
                name: 'Thirukkural Daily',
                description: 'Credit Pack',
                handler: async (response: any) => {
                    this.ngZone.run(async () => {
                        try {
                            await this.paymentService.verifyPayment(response);
                            this.isLoading = false;
                            this.router.navigate(['/profile'], { queryParams: { paymentSuccess: 'credits' } });
                        } catch (e) {
                            console.error('Verification failed', e);
                            alert('Payment verification failed.');
                            this.isLoading = false;
                        }
                    });
                },
                theme: {
                    color: '#1868db'
                },
                modal: {
                    ondismiss: () => {
                        this.ngZone.run(() => {
                            this.isLoading = false;
                        });
                    }
                }
            });
        } catch (e) {
            console.error(e);
            alert('Failed to initiate payment');
            this.isLoading = false;
        }
    }

    async subscribe(planType: 'monthly' | 'yearly') {
        if (!this.isLoggedIn) {
            // Save intent for seamless flow
            // Plan IDs need to be consistent. 
            // We'll resolve strict PlanID here to save in intent
            const planId = environment.razorpay.plans[this.currency][planType];

            const intent = { type: 'subscription', planId, planType, currency: this.currency };
            localStorage.setItem('paymentIntent', JSON.stringify(intent));
            this.authService.login();
            return;
        }

        this.isLoading = true;
        // Map planType + currency to Plan ID
        // Config logic duplicated here or fetched?
        // Hardcoding for MVP as per types.ts logic
        const planId = environment.razorpay.plans[this.currency][planType];

        // 1200 months = 100 years
        // 100 years = 100 years
        const total_count = planType === 'monthly' ? 1200 : 100;

        try {
            const sub = await this.paymentService.createSubscription(planId, total_count);
            this.paymentService.openCheckout({
                key: environment.razorpay.keyId,
                subscription_id: sub.id,
                name: 'Thirukkural Plus',
                description: `${planType} Subscription`,
                handler: async (response: any) => {
                    this.ngZone.run(async () => {
                        try {
                            await this.paymentService.verifyPayment(response);
                            this.isLoading = false;
                            this.router.navigate(['/profile'], { queryParams: { paymentSuccess: 'subscription' } });
                        } catch (e) {
                            console.error('Verification failed', e);
                            alert('Subscription verification failed.');
                            this.isLoading = false;
                        }
                    });
                },
                theme: { color: '#1868db' },
                modal: {
                    ondismiss: () => {
                        this.ngZone.run(() => {
                            this.isLoading = false;
                        });
                    }
                }
            });
        } catch (e) {
            console.error(e);
            alert('Failed to initiate subscription');
            this.isLoading = false;
        }
    }
}
