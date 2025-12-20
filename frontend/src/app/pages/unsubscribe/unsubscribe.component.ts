import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
    selector: 'app-unsubscribe',
    standalone: true,
    imports: [CommonModule, FormsModule, MatSnackBarModule],
    templateUrl: './unsubscribe.component.html',
    styleUrls: ['./unsubscribe.component.scss']
})
export class UnsubscribeComponent implements OnInit {
    token: string | null = null;
    feedback: string = '';
    isSubmitting = false;
    isSuccess = false;
    isError = false;
    errorMessage = '';

    constructor(
        private route: ActivatedRoute,
        private apiService: ApiService,
        private router: Router,
        private snackBar: MatSnackBar
    ) { }

    ngOnInit() {
        this.route.queryParams.subscribe(params => {
            this.token = params['token'];
            if (!this.token) {
                this.isError = true;
                this.errorMessage = 'Invalid link. No token provided.';
            }
        });
    }

    confirmUnsubscribe() {
        if (!this.token) return;

        this.isSubmitting = true;
        this.apiService.unsubscribe(this.token, this.feedback).subscribe({
            next: () => {
                this.isSubmitting = false;
                this.isSuccess = true;
            },
            error: (err) => {
                this.isSubmitting = false;
                this.isError = true;
                this.errorMessage = err.error?.message || 'Failed to unsubscribe. The link may be expired or invalid.';
                console.error('Unsubscribe error:', err);
            }
        });
    }

    goHome() {
        this.router.navigate(['/']);
    }
}
