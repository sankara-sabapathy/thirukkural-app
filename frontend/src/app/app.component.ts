import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { PwaInstallBannerComponent } from './components/pwa-install-banner/pwa-install-banner.component';
import { filter } from 'rxjs/operators';

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

    constructor(private router: Router) { }

    ngOnInit() {
        this.router.events.pipe(
            filter(event => event instanceof NavigationEnd)
        ).subscribe(() => {
            window.scrollTo(0, 0);
        });
    }
}
