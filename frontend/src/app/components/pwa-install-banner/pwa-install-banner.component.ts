import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PwaService } from '../../services/pwa.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-pwa-install-banner',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <div class="install-banner" *ngIf="showBanner$ | async">
      <div class="banner-content">
        <span class="banner-text">Install Thirukkural for a better experience!</span>
        <div class="banner-actions">
          <button mat-flat-button color="primary" (click)="install()">Install</button>
          <button mat-icon-button (click)="dismiss()">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .install-banner {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      width: 90%;
      max-width: 600px;
      background: rgba(26, 26, 26, 0.95);
      backdrop-filter: blur(10px);
      color: white;
      padding: 16px 24px;
      z-index: 1000;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .banner-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }
    .banner-text {
        font-weight: 500;
        font-size: 1.1rem;
    }
    .banner-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    @keyframes slideUp {
      from { transform: translate(-50%, 100%); opacity: 0; }
      to { transform: translate(-50%, 0); opacity: 1; }
    }
    @media (max-width: 600px) {
      .install-banner {
        bottom: 0;
        width: 100%;
        max-width: 100%;
        border-radius: 16px 16px 0 0;
        padding: 20px;
      }
      .banner-content {
        flex-direction: column;
        text-align: center;
      }
      .banner-actions {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class PwaInstallBannerComponent {
  showBanner$: Observable<boolean>;

  constructor(private pwaService: PwaService) {
    this.showBanner$ = this.pwaService.showInstallBanner$;
  }

  install() {
    this.pwaService.installPwa();
  }

  dismiss() {
    this.pwaService.dismissBanner();
  }
}
