import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
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
import { Title, Meta } from '@angular/platform-browser';
import html2canvas from 'html2canvas';

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
    isSharing = false;

    @ViewChild('captureArea') captureArea!: ElementRef;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private kuralService: KuralService,
        private snackBar: MatSnackBar,
        private cdr: ChangeDetectorRef,
        private titleService: Title,
        private metaService: Meta
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
                    tap((kural) => {
                        // Defer setting loading to false
                        Promise.resolve().then(() => {
                            this.loading = false;
                            this.cdr.markForCheck();
                        });
                        if (kural) {
                            this.updateMetaTags(kural);
                        }
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

    updateMetaTags(kural: Kural): void {
        const title = `Thirukkural #${kural.number} - ${kural.translation.substring(0, 50)}...`;
        this.titleService.setTitle(title);

        const description = `${kural.line1} ${kural.line2} - ${kural.translation}`;

        this.metaService.updateTag({ property: 'og:title', content: `Thirukkural #${kural.number}` });
        this.metaService.updateTag({ property: 'og:description', content: description });
        this.metaService.updateTag({ property: 'og:url', content: window.location.href });
        // Ensure we have a valid image URL. If none, keep default or use a specific dynamic generator if available
        // this.metaService.updateTag({ property: 'og:image', content: '...' }); 
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

        const expl = this.getBestExplanation(kural);
        if (expl) {
            text += `Explanation (${expl.author}):\n${expl.text}\n\n`;
        }

        text += `Read more: ${window.location.href}`;

        navigator.clipboard.writeText(text).then(() => {
            this.snackBar.open('Copied to clipboard!', 'Close', { duration: 2000 });
        });
    }

    getBestExplanation(kural: Kural): { author: string, text: string } | null {
        if (kural.mu_varatha && kural.mu_varatha.length > 1) {
            return { author: kural.mu_varatha[0], text: kural.mu_varatha[1] };
        }
        if (kural.mu_karu && kural.mu_karu.length > 1) {
            return { author: kural.mu_karu[0], text: kural.mu_karu[1] };
        }
        if (kural.salaman && kural.salaman.length > 1) {
            return { author: kural.salaman[0], text: kural.salaman[1] };
        }
        // Fallback to strict properties if array is not available/valid
        if (kural.explanation) {
            return { author: 'Explanation', text: kural.explanation };
        }
        return null;
    }

    async captureAndShare(kural: Kural): Promise<void> {
        if (!this.captureArea || this.isSharing) return;

        this.isSharing = true;
        this.snackBar.open('Preparing share...', undefined, { duration: 2000 });

        try {
            // Wait a moment for any DOM updates and ensure hidden element is rendered
            await new Promise(resolve => setTimeout(resolve, 100));

            const canvas = await html2canvas(this.captureArea.nativeElement, {
                useCORS: true,
                scale: 3, // HD Quality
                backgroundColor: '#ffffff',
                logging: false,
                width: 1080, // Force width to 1080px
                windowWidth: 1080
            });

            canvas.toBlob(async (blob) => {
                if (!blob) {
                    this.snackBar.open('Failed to generate image', 'Close', { duration: 3000 });
                    this.isSharing = false;
                    return;
                }

                const file = new File([blob], `thirukkural-${this.currentNumber}.png`, { type: 'image/png' });
                const shareData = {
                    files: [file],
                    title: `Thirukkural #${this.currentNumber}`,
                    text: `Thirukkural #${this.currentNumber}\n\n${window.location.href}`
                };

                if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                    try {
                        await navigator.share(shareData);
                        this.isSharing = false;
                    } catch (error: any) {
                        if (error.name !== 'AbortError') {
                            console.error('Error sharing file:', error);
                            // Fallback to text share if file share fails but valid error
                            this.shareTextOnly();
                        }
                        this.isSharing = false;
                    }
                } else {
                    // Fallback for desktop or unsupported browsers: Download image + Copy text
                    this.downloadImage(blob);
                    this.copyToClipboard(kural);
                    this.snackBar.open('Image downloaded & Text copied!', 'Close', { duration: 3000 });
                    this.isSharing = false;
                }
            }, 'image/png');

        } catch (error) {
            console.error('Error capturing image:', error);
            this.snackBar.open('Error preparing share', 'Close', { duration: 3000 });
            this.isSharing = false;
        }
    }

    shareTextOnly(): void {
        if (navigator.share) {
            navigator.share({
                title: `Thirukkural #${this.currentNumber}`,
                text: `Thirukkural #${this.currentNumber}\n${window.location.href}`,
                url: window.location.href
            }).catch(console.error);
        }
    }

    private downloadImage(blob: Blob): void {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `thirukkural-${this.currentNumber}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        this.snackBar.open('Image downloaded!', 'Close', { duration: 2000 });
    }
}
