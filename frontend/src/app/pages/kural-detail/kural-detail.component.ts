import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { KuralService, Kural } from '../../services/kural.service';
import { switchMap, map, tap, catchError, distinctUntilChanged, shareReplay } from 'rxjs/operators';
import { Observable, of, merge } from 'rxjs';

@Component({
    selector: 'app-kural-detail',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatButtonModule,
        MatIconModule,
        MatCardModule,
        MatProgressSpinnerModule,
        MatSnackBarModule
    ],
    templateUrl: './kural-detail.component.html',
    styleUrls: ['./kural-detail.component.scss']
})
export class KuralDetailComponent implements OnInit {
    kural$: Observable<Kural | undefined> = of(undefined);
    loading = true;
    currentNumber = 1;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private kuralService: KuralService,
        private snackBar: MatSnackBar,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        // Create an observable that immediately emits the snapshot value, then listens to paramMap changes
        const initialValue$ = of(this.route.snapshot.paramMap);
        const paramMap$ = merge(initialValue$, this.route.paramMap);
        
        this.kural$ = paramMap$.pipe(
            map(params => {
                const id = params.get('id');
                return id ? parseInt(id, 10) : 1;
            }),
            distinctUntilChanged(), // Prevent duplicate emissions with the same ID
            switchMap(id => {
                this.currentNumber = id;
                // Only update loading if it needs to change, and defer the change
                const wasLoading = this.loading;
                if (!wasLoading) {
                    Promise.resolve().then(() => {
                        this.loading = true;
                        this.cdr.markForCheck();
                    });
                }
                return this.kuralService.getKural(id).pipe(
                    tap(() => {
                        // Defer setting loading to false
                        Promise.resolve().then(() => {
                            this.loading = false;
                            this.cdr.markForCheck();
                        });
                    }),
                    catchError(error => {
                        console.error('Error fetching kural:', error);
                        Promise.resolve().then(() => {
                            this.loading = false;
                            this.cdr.markForCheck();
                        });
                        return of(undefined);
                    })
                );
            }),
            shareReplay(1) // Share the result to prevent multiple subscriptions from triggering multiple HTTP requests
        );
    }

    previousKural(): void {
        if (this.currentNumber > 1) {
            this.router.navigate(['/kural', this.currentNumber - 1]);
        }
    }

    nextKural(): void {
        if (this.currentNumber < 1330) {
            this.router.navigate(['/kural', this.currentNumber + 1]);
        }
    }

    copyToClipboard(kural: Kural): void {
        let text = `Thirukkural ${kural.number}\n\n`;
        text += `${kural.line1}\n${kural.line2}\n\n`;
        text += `Category: ${kural.pal_tr} › ${kural.iyal_tr} › ${kural.adikaram_tr}\n\n`;
        text += `Translation:\n${kural.translation}\n\n`;
        if (kural.explanation) {
            text += `Explanation:\n${kural.explanation}\n\n`;
        }
        if (kural.couplet) {
            text += `Couplet:\n${kural.couplet}\n`;
        }
        navigator.clipboard.writeText(text).then(() => {
            this.snackBar.open('Copied to clipboard!', 'Close', { duration: 2000 });
        });
    }

    shareKural(kural: Kural): void {
        if (navigator.share) {
            navigator.share({
                title: `Thirukkural ${kural.number}`,
                text: `${kural.line1}\n${kural.line2}\n\n${kural.translation}`,
                url: window.location.href
            }).catch(err => console.error('Error sharing:', err));
        } else {
            this.copyToClipboard(kural);
        }
    }
}
