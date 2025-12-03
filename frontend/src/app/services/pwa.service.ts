import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class PwaService {
    private deferredPrompt: any;
    showInstallBanner$ = new BehaviorSubject<boolean>(false);

    constructor() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallBanner$.next(true);
        });
    }

    async installPwa() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                this.showInstallBanner$.next(false);
            }
            this.deferredPrompt = null;
        }
    }

    dismissBanner() {
        this.showInstallBanner$.next(false);
    }
}
