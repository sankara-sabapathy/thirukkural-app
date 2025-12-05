import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { PwaInstallBannerComponent } from './components/pwa-install-banner/pwa-install-banner.component';
import { filter } from 'rxjs/operators';
import { SwPush } from '@angular/service-worker';

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
    `,
    styles: [`
        main {
            min-height: calc(100vh - 64px - 200px); /* Adjust based on header/footer height */
        }
    `]
})
export class AppComponent implements OnInit {
    title = 'frontend';

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
