import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SubscriptionComponent } from '../../components/subscription/subscription.component';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { PushNotificationService } from '../../services/push-notification.service';
import { Observable } from 'rxjs';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, FormsModule, MatSnackBarModule, SubscriptionComponent],
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
    user$: Observable<any>;
    sampleEmail: string = '';
    isLoadingSample: boolean = false;

    showNotificationPrompt = false;

    // Push notification toggle state
    isPushSubscribed = false;
    isCheckingPush = true;
    isTogglingPush = false;

    constructor(
        private authService: AuthService,
        private apiService: ApiService,
        private snackBar: MatSnackBar,
        private router: Router,
        private pushService: PushNotificationService
    ) {
        this.user$ = this.authService.user$;
    }

    async ngOnInit() {
        // Check push notification subscription status
        await this.checkPushSubscriptionStatus();

        // Show notification prompt only if not subscribed and permission is default
        if (!this.isPushSubscribed && 'Notification' in window && Notification.permission === 'default') {
            setTimeout(() => {
                this.showNotificationPrompt = true;
            }, 3000);
        }
    }

    /**
     * Check if push notifications are currently enabled
     */
    async checkPushSubscriptionStatus() {
        this.isCheckingPush = true;
        try {
            this.isPushSubscribed = await this.pushService.isSubscribed();
        } catch (err) {
            console.error('Error checking push subscription:', err);
            this.isPushSubscribed = false;
        }
        this.isCheckingPush = false;
    }

    /**
     * Toggle push notifications on/off
     */
    async togglePushNotifications() {
        if (this.isTogglingPush) return;

        this.isTogglingPush = true;

        try {
            if (this.isPushSubscribed) {
                // Unsubscribe
                const result = await this.pushService.unsubscribeFromNotifications();
                if (result.success) {
                    this.isPushSubscribed = false;
                    this.showSnackBar(result.message, 'success');
                } else {
                    this.showSnackBar(result.message, 'error');
                }
            } else {
                // Subscribe
                const result = await this.pushService.subscribeToNotifications();
                if (result.success) {
                    this.isPushSubscribed = true;
                    this.showNotificationPrompt = false;
                    this.showSnackBar(result.message, 'success');
                } else {
                    this.showSnackBar(result.message, 'error');
                }
            }
        } catch (err) {
            console.error('Error toggling push notifications:', err);
            this.showSnackBar('Something went wrong. Please try again.', 'error');
        }

        this.isTogglingPush = false;
    }

    async subscribeToPush() {
        try {
            const result = await this.pushService.subscribeToNotifications();
            this.showNotificationPrompt = false;

            if (result.success) {
                this.isPushSubscribed = true;
                this.showSnackBar(result.message, 'success');
            } else {
                this.showSnackBar(result.message, 'error');
            }
        } catch (err) {
            console.error('Error subscribing to push notifications:', err);
            this.showSnackBar('Failed to enable notifications. Please try again.', 'error');
            // Keep prompt visible so user can retry
            this.showNotificationPrompt = true;
        }
    }

    enableNotifications() {
        this.subscribeToPush();
    }

    dismissNotificationPrompt() {
        this.showNotificationPrompt = false;
    }

    scrollToSubscribe() {
        document.getElementById('subscribe')?.scrollIntoView({ behavior: 'smooth' });
    }

    goToRandomKural() {
        const randomId = Math.floor(Math.random() * 1330) + 1;
        this.router.navigate(['/kural', randomId]);
    }

    sendSampleEmail() {
        if (!this.sampleEmail || !this.validateEmail(this.sampleEmail)) {
            this.showSnackBar('Please enter a valid email address', 'error');
            return;
        }

        this.isLoadingSample = true;
        this.apiService.sendSampleEmail(this.sampleEmail).subscribe({
            next: () => {
                this.isLoadingSample = false;
                this.showSnackBar('Sample email sent! Check your inbox.', 'success');
                this.sampleEmail = '';
            },
            error: (err) => {
                this.isLoadingSample = false;
                const msg = err.error?.message || 'Failed to send sample email. Please try again later.';
                this.showSnackBar(msg, 'error');
            }
        });
    }

    private validateEmail(email: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    private showSnackBar(message: string, type: 'success' | 'error') {
        this.snackBar.open(message, 'Close', {
            duration: 5000,
            panelClass: type === 'success' ? ['snackbar-success'] : ['snackbar-error'],
            horizontalPosition: 'center',
            verticalPosition: 'bottom'
        });
    }
}
