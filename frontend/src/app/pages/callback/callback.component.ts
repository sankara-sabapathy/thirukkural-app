import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { getCurrentUser } from 'aws-amplify/auth';

@Component({
    selector: 'app-callback',
    standalone: true,
    template: `
        <div class="callback-container">
            <div class="spinner"></div>
            <p>Completing sign in...</p>
        </div>
    `,
    styles: [`
        .callback-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: var(--background);
        }

        .spinner {
            width: 48px;
            height: 48px;
            border: 4px solid var(--surface);
            border-top-color: var(--primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        p {
            margin-top: 1rem;
            color: var(--text-secondary);
            font-size: 1rem;
        }
    `]
})
export class CallbackComponent implements OnInit {
    constructor(
        private authService: AuthService,
        private router: Router
    ) { }

    async ngOnInit() {
        // Wait for Amplify to process the OAuth callback
        // Retry up to 10 times with 500ms delay
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
            try {
                await getCurrentUser();
                // User is authenticated, update auth service
                await this.authService.checkUser();
                // Redirect to home
                this.router.navigate(['/']);
                return;
            } catch (error) {
                attempts++;
                if (attempts >= maxAttempts) {
                    console.error('Failed to authenticate after callback', error);
                    // Redirect anyway, let the app handle unauthenticated state
                    this.router.navigate(['/']);
                    return;
                }
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }
}
