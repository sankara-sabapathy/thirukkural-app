import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Router, RouterModule } from '@angular/router';

@Component({
    selector: 'app-profile',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './profile.component.html',
    styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
    user: any = null;
    profile: any = null;
    loading = true;

    constructor(
        private apiService: ApiService,
        private authService: AuthService,
        private router: Router
    ) { }

    ngOnInit() {
        this.authService.user$.subscribe(user => {
            this.user = user;
            if (user) {
                this.fetchProfile();
            } else {
                this.loading = false;
                // Optional: Redirect to login or show "Please login"
                this.router.navigate(['/login']);
            }
        });
    }

    fetchProfile() {
        this.loading = true;
        this.apiService.getProfile().subscribe({
            next: (data) => {
                this.profile = data;
                this.loading = false;
            },
            error: (err) => {
                console.error('Failed to fetch profile', err);
                if (err.status === 504) {
                    alert('Server timeout. Please try again in 30 seconds (Cold Start).');
                } else {
                    alert('Failed to load profile. Please verify your internet connection.');
                }
                this.loading = false;
            }
        });
    }

    cancelSubscription() {
        // TODO: Implement cancel subscription (Requires backend endpoint DELETE or POST /cancel)
        // For now, mailto support
        window.location.href = "mailto:support@thirukkural.site?subject=Cancel Subscription";
    }
}
