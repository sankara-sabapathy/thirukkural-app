import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { PwaInstallBannerComponent } from './components/pwa-install-banner/pwa-install-banner.component';
import { filter } from 'rxjs/operators';
import { SwPush } from '@angular/service-worker';
import { environment } from '../environments/environment';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, HeaderComponent, FooterComponent, PwaInstallBannerComponent],
    template: `
        <app-header></app-header>
        <main>
            <router-outlet></router-outlet>
        </main>
        <app-footer></app-footer>
        <app-pwa-install-banner></app-pwa-install-banner>

        <!-- Floating Telegram Invite -->
        <a [href]="telegramUrl" target="_blank" class="telegram-float" aria-label="Join our Telegram Channel">
            <svg class="telegram-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.664 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
        </a>
    `,
    styles: [`
        main {
            min-height: calc(100vh - 64px - 200px); /* Adjust based on header/footer height */
        }
        .telegram-float {
            position: fixed;
            width: 55px;
            height: 55px;
            bottom: 25px;
            right: 25px;
            background-color: #0088cc;
            color: #FFF;
            border-radius: 50px;
            text-align: center;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            z-index: 1000;
            display: flex;
            justify-content: center;
            align-items: center;
            transition: all 0.3s ease;
        }
        .telegram-float:hover {
            transform: scale(1.1);
            background-color: #0099e6;
            box-shadow: 0 6px 12px rgba(0,0,0,0.4);
        }
        .telegram-icon {
            width: 32px;
            height: 32px;
        }
    `]
})
export class AppComponent implements OnInit {
    title = 'frontend';
    telegramUrl = environment.telegramChannelUrl;

    constructor(
        private router: Router,
        private swPush: SwPush
    ) { }

    ngOnInit() {
        // Scroll to top on navigation
        this.router.events.pipe(
            filter(event => event instanceof NavigationEnd)
        ).subscribe(() => {
            window.scrollTo(0, 0);
        });

        // Handle push notification clicks
        this.setupNotificationClickHandler();
    }

    /**
     * Listen for push notification clicks and navigate to the relevant kural
     */
    private setupNotificationClickHandler() {
        if (!this.swPush.isEnabled) {
            return;
        }

        this.swPush.notificationClicks.subscribe(({ action, notification }) => {
            console.log('Notification clicked:', notification);

            // Extract kural ID from notification data
            const kuralId = notification.data?.kuralId || notification.data?.kural_id;

            if (kuralId) {
                // Navigate to the specific kural
                this.router.navigate(['/kural', kuralId]);
            } else {
                // If no kural ID, navigate to home
                this.router.navigate(['/']);
            }
        });
    }
}
