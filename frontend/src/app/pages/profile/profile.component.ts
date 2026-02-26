import { Component, OnInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { PaymentService } from '../../services/payment.service';
import { environment } from '../../../environments/environment';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
    selector: 'app-profile',
    standalone: true,
    imports: [CommonModule, RouterModule, MatSnackBarModule],
    templateUrl: './profile.component.html',
    styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
    user: any = null;
    profile: any = null;
    loading = true;
    enablePayments = environment.enablePayments;
    private pollTimers: ReturnType<typeof setTimeout>[] = [];

    constructor(
        private apiService: ApiService,
        private authService: AuthService,
        private paymentService: PaymentService,
        private router: Router,
        private route: ActivatedRoute,
        private snackBar: MatSnackBar,
        private destroyRef: DestroyRef
    ) {
        this.destroyRef.onDestroy(() => {
            this.pollTimers.forEach(id => clearTimeout(id));
        });
    }

    ngOnInit() {
        this.authService.user$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(user => {
            this.user = user;
            if (user) {
                this.loadProfile();
                this.checkPaymentSuccess();
                this.checkPaymentIntent();
            } else {
                this.loading = false;
                // Optional: Redirect to login or show "Please login"
                this.router.navigate(['/login']);
            }
        });
    }

    loadProfile() {
        this.fetchProfile();
    }

    checkPaymentSuccess() {
        this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
            if (params['paymentSuccess']) {
                const type = params['paymentSuccess'];
                const message = type === 'subscription'
                    ? 'Welcome to Thirukkural Plus! Your subscription is active.'
                    : 'Credits added successfully!';

                this.snackBar.open(message, 'Awesome', {
                    duration: 5000,
                    panelClass: ['snackbar-success'],
                    verticalPosition: 'top'
                });

                // Clear params
                this.router.navigate([], {
                    relativeTo: this.route,
                    queryParams: { paymentSuccess: null },
                    queryParamsHandling: 'merge'
                });
            }
        });
    }

    async checkPaymentIntent() {
        const intentStr = localStorage.getItem('paymentIntent');
        if (!intentStr) return;
        if (!this.enablePayments) {
            localStorage.removeItem('paymentIntent');
            return;
        }

        try {
            const intent = JSON.parse(intentStr);
            // Safe to remove now, or keep until success? 
            // Better to remove to avoid infinite loop on malformed data, 
            // but if valid parse, we process.
            localStorage.removeItem('paymentIntent');

            if (intent.type === 'credits') {
                const order = await this.paymentService.createOrder(intent.amount, intent.currency);
                this.openCheckout({
                    key: environment.razorpay.keyId,
                    amount: order.amount,
                    currency: order.currency,
                    order_id: order.id,
                    name: 'Thirukkural Daily',
                    description: 'Credit Pack (Resumed)',
                    theme: { color: '#1868db' }
                }, 'credits');
            } else if (intent.type === 'subscription') {
                if (!intent.planType) {
                    throw new Error('Missing planType in subscription checkout intent.');
                }
                const totalCount = this.paymentService.getSubscriptionCycleCount(intent.planType);
                const sub = await this.paymentService.createSubscription(intent.planId, intent.planType, totalCount);
                this.openCheckout({
                    key: environment.razorpay.keyId,
                    subscription_id: sub.id,
                    name: 'Thirukkural Plus',
                    description: `${intent.planType} Subscription (Resumed)`,
                    theme: { color: '#1868db' }
                }, 'subscription');
            }
        } catch (e) {
            console.error('Failed to resume payment or parse intent', e);
            localStorage.removeItem('paymentIntent'); // Ensure cleared on error
            this.snackBar.open('Failed to resume payment session.', 'Close', { duration: 5000 });
        }
    }

    openCheckout(options: any, type: string) {
        options.handler = async (response: any) => {
            try {
                const verifyRes = await this.paymentService.verifyPayment(response);
                this.snackBar.open(
                    type === 'subscription' ? 'Welcome to Plus!' : 'Credits added!',
                    'Awesome',
                    { duration: 5000, panelClass: ['snackbar-success'], verticalPosition: 'top' }
                );

                // CRITICAL RACE CONDITION FIX:
                // Instantly inject the authoritative backend DB state to skip the Webhook lag
                if (verifyRes && verifyRes.updatedUser) {
                    this.profile = { ...this.profile, ...verifyRes.updatedUser };
                }

                // Artificial failsafe delay: give DynamoDB and Webhooks time to settle
                // Poll the server recursively with a backoff strategy.
                const pollProfile = (attempt: number) => {
                    if (attempt > 4) return; // Give up after 4 attempts (1s, 2s, 3s, 4s)
                    const timerId = setTimeout(() => {
                        this.fetchProfile();
                        pollProfile(attempt + 1);
                    }, attempt * 1000);
                    this.pollTimers.push(timerId);
                };
                pollProfile(1);
            } catch (e) {
                console.error('Verification failed', e);
                alert('Payment verification failed.');
            }
        };

        this.paymentService.openCheckout(options);
    }

    fetchProfile() {
        this.loading = true;
        this.apiService.getProfile().subscribe({
            next: (data) => {
                this.profile = data;
                this.loading = false;
            },
            error: (err) => {
                console.error('Failed to fetch profile', err);
                if (err.status === 504) {
                    alert('Server timeout. Please try again in 30 seconds (Cold Start).');
                } else {
                    alert('Failed to load profile. Please verify your internet connection.');
                }
                this.loading = false;
            }
        });
    }

    async toggleDailyEmail() {
        if (!this.profile) return;

        const newStatus = !this.profile.receiveDailyEmail;
        // Optimistic update
        this.profile.receiveDailyEmail = newStatus;

        this.apiService.updateProfile({ receiveDailyEmail: newStatus }).subscribe({
            next: () => {
                this.snackBar.open(
                    newStatus ? "You're all set! Daily wisdom will be delivered." : "Daily emails paused.",
                    'OK',
                    { duration: 3000, panelClass: ['snackbar-success'], verticalPosition: 'top' }
                );
            },
            error: (err) => {
                // Revert on failure
                this.profile.receiveDailyEmail = !newStatus;
                console.error("Failed to update preference", err);
                this.snackBar.open("Failed to update preference.", 'Close', { duration: 3000 });
            }
        });
    }

    async cancelSubscription() {
        if (!confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of the billing period.')) {
            return;
        }

        try {
            await this.paymentService.cancelSubscription();

            // Success feedback
            this.snackBar.open('Subscription cancelled successfully.', 'OK', {
                duration: 5000,
                panelClass: ['snackbar-success'],
                verticalPosition: 'top'
            });

            // Refresh profile to show cancelled status
            this.fetchProfile();
        } catch (error) {
            console.error('Cancellation failed', error);
            this.snackBar.open('Failed to cancel subscription. Please try again or contact support.', 'Close', {
                duration: 5000,
                panelClass: ['snackbar-error'],
                verticalPosition: 'top'
            });
        }
    }
}
