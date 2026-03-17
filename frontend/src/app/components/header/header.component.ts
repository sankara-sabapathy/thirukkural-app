import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgOptimizedImage } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PushNotificationService } from '../../services/push-notification.service';
import { PwaService } from '../../services/pwa.service';
import { ThemeService } from '../../services/theme.service';
import { Observable, firstValueFrom } from 'rxjs';

@Component({
    selector: 'app-header',
    standalone: true,
    imports: [CommonModule, NgOptimizedImage, MatButtonModule, MatSnackBarModule, RouterModule],
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
    user$: Observable<any>;
    isMobileMenuOpen = false;
    showInstallButton$: Observable<boolean>;
    isDarkMode$: Observable<boolean>;

    constructor(
        private authService: AuthService,
        private pushService: PushNotificationService,
        private pwaService: PwaService,
        private themeService: ThemeService,
        private snackBar: MatSnackBar,
        private router: Router
    ) {
        this.user$ = this.authService.user$;
        this.showInstallButton$ = this.pwaService.showInstallBanner$;
        this.isDarkMode$ = this.themeService.isDarkMode$;
    }

    onLogoClick() {
        this.router.navigate(['/']);
    }

    installPwa() {
        this.pwaService.installPwa();
    }

    toggleTheme() {
        this.themeService.toggleTheme();
    }

    async subscribeToNotifications() {
        const result = await this.pushService.subscribeToNotifications();
        this.showSnackBar(result.message, result.success ? 'success' : 'error');
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

    private showSnackBar(message: string, type: 'success' | 'error') {
        this.snackBar.open(message, 'Close', {
            duration: 5000,
            panelClass: type === 'success' ? ['snackbar-success'] : ['snackbar-error'],
            horizontalPosition: 'center',
            verticalPosition: 'bottom'
        });
    }
}
