import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PushNotificationService } from '../../services/push-notification.service';
import { PwaService } from '../../services/pwa.service';
import { Observable } from 'rxjs';

@Component({
    selector: 'app-header',
    standalone: true,
    imports: [CommonModule, MatButtonModule, RouterModule],
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
    user$: Observable<any>;
    isMobileMenuOpen = false;
    showInstallButton$: Observable<boolean>;

    constructor(
        private authService: AuthService,
        private pushService: PushNotificationService,
        private pwaService: PwaService
    ) {
        this.user$ = this.authService.user$;
        this.showInstallButton$ = this.pwaService.showInstallBanner$;
    }

    installPwa() {
        this.pwaService.installPwa();
    }

    async subscribeToNotifications() {
        try {
            await this.pushService.subscribeToNotifications();
            alert('Successfully subscribed to daily wisdom!');
        } catch (error) {
            console.error('Subscription failed', error);
            alert('Failed to subscribe. Please try again.');
        }
    }

    login() {
        this.authService.login();
    }

    logout() {
        this.authService.logout();
    }

    toggleMobileMenu() {
        this.isMobileMenuOpen = !this.isMobileMenuOpen;
    }

    closeMobileMenu() {
        this.isMobileMenuOpen = false;
    }
}
