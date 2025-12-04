import { Component } from '@angular/core';
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
export class HomeComponent {
    user$: Observable<any>;
    sampleEmail: string = '';
    isLoadingSample: boolean = false;

    showNotificationPrompt = false;

    constructor(
        private authService: AuthService,
        private apiService: ApiService,
        private snackBar: MatSnackBar,
        private router: Router,
        private pushService: PushNotificationService
    ) {
        this.user$ = this.authService.user$;
    }

    ngOnInit() {
        // Check if notifications are supported and permission is default
        if ('Notification' in window && Notification.permission === 'default') {
            // Delay prompt slightly to not overwhelm user immediately
            setTimeout(() => {
                this.showNotificationPrompt = true;
            }, 3000);
        }
    }

    async subscribeToPush() {
        const result = await this.pushService.subscribeToNotifications();
        this.showNotificationPrompt = false;

        if (result.success) {
            this.showSnackBar(result.message, 'success');
        } else {
            this.showSnackBar(result.message, 'error');
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
