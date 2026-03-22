import { Component, OnInit, OnDestroy, DestroyRef, Inject, PLATFORM_ID } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SubscriptionComponent } from '../../components/subscription/subscription.component';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { PushNotificationService } from '../../services/push-notification.service';
import { Observable, firstValueFrom } from 'rxjs';

interface HomeWidgetPreview {
    id: string;
    widgetId: string;
    title: string;
    summary: string;
    description: string;
    frameClass: string;
    minHeight: number;
    height: number;
    src: SafeResourceUrl;
}

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, FormsModule, MatSnackBarModule, SubscriptionComponent],
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
    user$: Observable<any>;
    sampleEmail: string = '';
    isLoadingSample: boolean = false;
    readonly widgetPreviews: HomeWidgetPreview[];
    activeWidgetPreviewId: string = 'banner';

    showNotificationPrompt = false;

    // Push notification toggle state
    isPushSubscribed = false;
    isCheckingPush = true;
    isTogglingPush = false;
    private readonly isBrowser: boolean;
    private readonly previewMessageHandler = (event: MessageEvent) => this.updateWidgetPreviewHeight(event);

    constructor(
        private authService: AuthService,
        private apiService: ApiService,
        private snackBar: MatSnackBar,
        private router: Router,
        private pushService: PushNotificationService,
        private sanitizer: DomSanitizer,
        private destroyRef: DestroyRef,
        @Inject(PLATFORM_ID) platformId: Object
    ) {
        this.user$ = this.authService.user$;
        this.isBrowser = isPlatformBrowser(platformId);
        this.widgetPreviews = [
            this.createWidgetPreview(
                'banner',
                'home-preview-banner',
                'Top Banner',
                'Best for headers and wide editorial sections.',
                'A horizontal embed for homepages, hubs, and magazine-style headers.',
                'widget-showcase-banner',
                'mode=random&layout=banner&language=bilingual&meaning=translation&align=center&showRefresh=false',
                340
            ),
            this.createWidgetPreview(
                'square',
                'home-preview-square',
                'Square Card',
                'Best for card grids and visual modules.',
                'A square module for grids, sidebars, and card-based layouts.',
                'widget-showcase-square',
                'mode=random&layout=square&language=english&meaning=explanation&accent=%230f766e&showTags=false&showRefresh=false',
                520
            ),
            this.createWidgetPreview(
                'compact',
                'home-preview-compact',
                'Compact Rail',
                'Best for sidebars, rails, and tighter content areas.',
                'A tighter version for article rails and footer areas.',
                'widget-showcase-compact',
                'mode=random&layout=compact&language=bilingual&meaning=explanation&showTags=false&showRefresh=false',
                410
            )
        ];

        if (this.isBrowser) {
            window.addEventListener('message', this.previewMessageHandler);
        }
    }

    async ngOnInit() {
        // Strict Navigation: If logged in, redirect to dashboard
        this.authService.user$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(user => {
            if (user) {
                this.router.navigate(['/profile']);
            }
        });

        // Check push notification subscription status
        if (this.isBrowser) {
            await this.checkPushSubscriptionStatus();
        } else {
            this.isCheckingPush = false;
        }

        // Show notification prompt only if not subscribed and permission is default
        if (this.isBrowser && !this.isPushSubscribed && 'Notification' in window && Notification.permission === 'default') {
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

    async onStartJourney() {
        const user = await firstValueFrom(this.authService.user$);
        if (user) {
            // Logged in -> Go to Dashboard
            this.router.navigate(['/profile']);
        } else {
            // Logged out -> Login (which will redirect back to home/dashboard ideally)
            this.authService.login();
        }
    }

    scrollToSubscribe() {
        this.onStartJourney();
    }

    ngOnDestroy(): void {
        if (this.isBrowser) {
            window.removeEventListener('message', this.previewMessageHandler);
        }
    }

    goToWidgetDocs() {
        this.router.navigate(['/widgets/daily-kural']);
    }

    setActiveWidgetPreview(id: string) {
        if (this.widgetPreviews.some(preview => preview.id === id)) {
            this.activeWidgetPreviewId = id;
        }
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

    get activeWidgetPreview(): HomeWidgetPreview {
        return this.widgetPreviews.find(preview => preview.id === this.activeWidgetPreviewId) ?? this.widgetPreviews[0];
    }

    private createWidgetPreview(
        id: string,
        widgetId: string,
        title: string,
        summary: string,
        description: string,
        frameClass: string,
        query: string,
        minHeight: number
    ): HomeWidgetPreview {
        return {
            id,
            widgetId,
            title,
            summary,
            description,
            frameClass,
            minHeight,
            height: minHeight,
            src: this.trustWidgetPreview(`/widgets/daily-kural-frame.html?widgetId=${widgetId}&${query}`)
        };
    }

    private trustWidgetPreview(url: string): SafeResourceUrl {
        return this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }

    private updateWidgetPreviewHeight(event: MessageEvent): void {
        if (!this.isBrowser || (event.origin !== window.location.origin && event.origin !== 'null')) {
            return;
        }

        const data = event.data as { source?: string; widgetId?: string; height?: number } | null;
        if (!data || data.source !== 'thirukkural-widget' || typeof data.widgetId !== 'string' || typeof data.height !== 'number') {
            return;
        }

        const preview = this.widgetPreviews.find((item) => item.widgetId === data.widgetId);
        if (!preview) {
            return;
        }

        preview.height = Math.max(preview.minHeight, Math.ceil(data.height));
    }
}
