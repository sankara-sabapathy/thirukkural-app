import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class PwaService {
    private deferredPrompt: any;
    showInstallBanner$ = new BehaviorSubject<boolean>(false);
    private readonly isBrowser: boolean;

    constructor(@Inject(PLATFORM_ID) platformId: Object) {
        this.isBrowser = isPlatformBrowser(platformId);

        if (!this.isBrowser) {
            return;
        }

        // Check if already installed
        if (this.isStandalone()) {
            console.log('App is already installed (standalone mode)');
            return;
        }

        // Listen for beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('beforeinstallprompt event fired');
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallBanner$.next(true);
        });

        // Listen for app installed event
        window.addEventListener('appinstalled', () => {
            console.log('PWA was installed');
            this.showInstallBanner$.next(false);
            this.deferredPrompt = null;
        });
    }

    /**
     * Check if the app is running in standalone mode (installed)
     */
    isStandalone(): boolean {
        if (!this.isBrowser) {
            return false;
        }

        return window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true;
    }

    /**
     * Check if the browser supports PWA installation
     */
    canInstall(): boolean {
        return this.deferredPrompt !== null && this.deferredPrompt !== undefined;
    }

    /**
     * Check if the app is running on iOS (Safari)
     * iOS doesn't support beforeinstallprompt, users must use "Add to Home Screen"
     */
    isIOS(): boolean {
        if (!this.isBrowser) {
            return false;
        }

        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    }

    /**
     * Trigger the native install prompt
     */
    async installPwa(): Promise<boolean> {
        if (!this.isBrowser) {
            return false;
        }

        if (!this.deferredPrompt) {
            console.warn('No install prompt available');
            return false;
        }

        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
            this.showInstallBanner$.next(false);
        } else {
            console.log('User dismissed the install prompt');
        }

        this.deferredPrompt = null;
        return outcome === 'accepted';
    }

    dismissBanner() {
        this.showInstallBanner$.next(false);
    }

    /**
     * Get installation instructions for iOS
     */
    getIOSInstallInstructions(): string {
        return 'To install this app:\n\n' +
            '1. Tap the Share button (square with arrow)\n' +
            '2. Scroll down and tap "Add to Home Screen"\n' +
            '3. Tap "Add" in the top right corner';
    }
}
