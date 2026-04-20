import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { KuralService, Kural } from '../../services/kural.service';
import { switchMap, map, tap, catchError, distinctUntilChanged, shareReplay, take, filter } from 'rxjs/operators';
import { Observable, of, merge } from 'rxjs';
import { SeoService } from '../../services/seo.service';
import { KURAL_FILTER_MAPPING } from '../kural-list/kural-filter-mapping';
import { AuthService } from '../../services/auth.service';

// Helper for JSON-LD structured data
import { DOCUMENT } from '@angular/common';
import { Inject } from '@angular/core';
import { TamilCategoryPipe } from '../../pipes/tamil-category.pipe';

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
        MatSnackBarModule,
        TamilCategoryPipe
    ],
    templateUrl: './kural-detail.component.html',
    styleUrls: ['./kural-detail.component.scss']
})
export class KuralDetailComponent implements OnInit, OnDestroy {
    private readonly baseUrl = 'https://thirukkural.site';

    kural$: Observable<Kural | undefined> = of(undefined);
    loading = false;
    currentNumber = 1;
    isSharing = false;
    isCopied = false;

    // AI State
    aiExplanation: { english: string, tamil: string } | null = null;
    isAiLoading = false;
    aiNotAvailableYet = false;
    canUseAi$: Observable<boolean> = of(false);

    @ViewChild('captureArea') captureArea!: ElementRef;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private kuralService: KuralService,
        private snackBar: MatSnackBar,
        private cdr: ChangeDetectorRef,
        private seoService: SeoService,
        public authService: AuthService,
        @Inject(DOCUMENT) private doc: Document
    ) { 
        this.canUseAi$ = this.authService.canUseProtectedApi$;
    }

    ngOnInit(): void {
        // Create an observable that immediately emits the snapshot value, then listens to paramMap changes
        const initialValue$ = of(this.route.snapshot.paramMap);
        const paramMap$ = merge(initialValue$, this.route.paramMap);
        let isInitialRouteLoad = true;

        this.kural$ = paramMap$.pipe(
            map(params => {
                const id = params.get('id');
                return id ? parseInt(id, 10) : 1;
            }),
            distinctUntilChanged(), // Prevent duplicate emissions with the same ID
            switchMap(id => {
                this.currentNumber = id;
                this.loading = !isInitialRouteLoad;
                isInitialRouteLoad = false;
                
                this.resetAiState();

                return this.authService.authResolved$.pipe(
                    filter(authResolved => authResolved),
                    take(1),
                    tap(() => {
                        if (this.authService.canUseProtectedApi()) {
                            this.checkExistingAiExplanation(id);
                        }
                    }),
                    switchMap(() => this.kuralService.getKural(id).pipe(
                        tap((kural) => {
                            this.loading = false;
                            this.cdr.markForCheck();
                            if (kural) {
                                this.updateMetaTags(kural);
                            }
                        }),
                        catchError(error => {
                            console.error('Error fetching kural:', error);
                            this.loading = false;
                            this.cdr.markForCheck();
                            return of(undefined);
                        })
                    ))
                );
            }),
            shareReplay(1) // Share the result to prevent multiple subscriptions from triggering multiple HTTP requests
        );
    }

    ngOnDestroy(): void {
        this.seoService.removeStructuredData('structured-data-kural');
    }

    updateMetaTags(kural: Kural): void {
        const title = `Thirukkural #${kural.number} - ${kural.translation.substring(0, 50)}...`;
        const description = `Read Thirukkural ${kural.number} with Tamil text, English translation, and meanings by Mu. Varadarajan, Kalaignar, and Solomon Pappaiya.`;
        const keywords = `Thirukkural ${kural.number}, Tirukkural ${kural.number}, ${kural.pal_tr}, ${kural.iyal_tr}, ${kural.adikaram_tr}, Thiruvalluvar, Tamil wisdom`;
        const url = `${this.baseUrl}/kural/${kural.number}`;

        this.seoService.generateTags({
           title,
           description,
           keywords,
           url
        });

        this.injectStructuredData(kural);
    }

    injectStructuredData(kural: Kural): void {
        const explanation = this.getBestExplanation(kural);
        const adhigaramId = this.getAdhigaramId(kural.number);
        const url = `${this.baseUrl}/kural/${kural.number}`;
        const adhigaramUrl = `${this.baseUrl}/adhigaram/${adhigaramId}`;

        const creativeWork = {
            "@type": "CreativeWork",
            "@id": `${url}#creativework`,
            "name": `Thirukkural ${kural.number}`,
            "author": {
                "@type": "Person",
                "name": "Thiruvalluvar"
            },
            "inLanguage": ["ta", "en"],
            "genre": "Poetry",
            "abstract": kural.translation,
            "text": `${kural.line1}\n${kural.line2}`,
            "about": [
                { "@type": "Thing", "name": kural.pal_tr },
                { "@type": "Thing", "name": kural.iyal_tr },
                { "@type": "Thing", "name": kural.adikaram_tr }
            ],
            "translationOfWork": {
                "@type": "CreativeWork",
                "name": "Thirukkural",
                "author": { "@type": "Person", "name": "Thiruvalluvar" }
            },
            "url": url
        };

        if (explanation) {
            (creativeWork as Record<string, unknown>)["comment"] = {
                "@type": "Comment",
                "author": { "@type": "Person", "name": explanation.author },
                "text": explanation.text
            };
        }

        const jsonLd = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "WebPage",
                    "@id": url,
                    "url": url,
                    "name": `Thirukkural ${kural.number}`,
                    "isPartOf": {
                        "@type": "WebSite",
                        "name": "Thirukkural Daily",
                        "url": this.baseUrl
                    },
                    "breadcrumb": {
                        "@id": `${url}#breadcrumb`
                    },
                    "mainEntity": {
                        "@id": `${url}#creativework`
                    }
                },
                creativeWork,
                {
                    "@type": "BreadcrumbList",
                    "@id": `${url}#breadcrumb`,
                    "itemListElement": [
                        {
                            "@type": "ListItem",
                            "position": 1,
                            "name": "Home",
                            "item": `${this.baseUrl}/`
                        },
                        {
                            "@type": "ListItem",
                            "position": 2,
                            "name": "Kurals",
                            "item": `${this.baseUrl}/kurals`
                        },
                        {
                            "@type": "ListItem",
                            "position": 3,
                            "name": `Adhigaram ${adhigaramId}: ${kural.adikaram_tr}`,
                            "item": adhigaramUrl
                        },
                        {
                            "@type": "ListItem",
                            "position": 4,
                            "name": `Thirukkural ${kural.number}`,
                            "item": url
                        }
                    ]
                }
            ]
        };

        this.seoService.setStructuredData(jsonLd);
    }

    previousKural(): void {
        if (this.currentNumber > 1) {
            this.router.navigate(['/kural', this.currentNumber - 1]);
        }
    }

    resetAiState(): void {
        this.aiExplanation = null;
        this.isAiLoading = false;
        this.aiNotAvailableYet = false;
        this.cdr.markForCheck();
    }

    checkExistingAiExplanation(id: number): void {
        this.kuralService.getExistingAiExplanation(id).subscribe(explanation => {
            if (explanation) {
                this.aiExplanation = explanation;
                this.aiNotAvailableYet = false;
            } else {
                this.aiNotAvailableYet = true;
            }
            this.cdr.markForCheck();
        });
    }

    generateAiExplanation(): void {
        this.isAiLoading = true;
        this.aiNotAvailableYet = false;
        this.cdr.markForCheck();

        this.kuralService.generateAiExplanation(this.currentNumber).subscribe(explanation => {
            this.isAiLoading = false;
            if (explanation) {
                this.aiExplanation = explanation;
            } else {
                this.aiNotAvailableYet = true;
                this.snackBar.open('Failed to generate AI explanation. Please try again.', 'Close', { duration: 3000 });
            }
            this.cdr.markForCheck();
        });
    }

    nextKural(): void {
        if (this.currentNumber < 1330) {
            this.router.navigate(['/kural', this.currentNumber + 1]);
        }
    }

    getAdhigaramId(kuralNumber: number): number {
        return Math.floor((kuralNumber - 1) / 10) + 1;
    }

    private writeToClipboard(text: string, onSuccess: () => void, onError: (err: any) => void): void {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard.writeText(text).then(onSuccess).catch(onError);
        } else {
            try {
                const textArea = this.doc.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                this.doc.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = this.doc.execCommand('copy');
                this.doc.body.removeChild(textArea);
                if (successful) onSuccess();
                else onError(new Error('execCommand copy failed'));
            } catch (err) {
                onError(err);
            }
        }
    }

    copyToClipboard(kural: Kural, silent: boolean = false): void {
        let text = `Thirukkural ${kural.number}\n\n`;
        text += `${kural.line1}\n${kural.line2}\n\n`;
        text += `Category: ${kural.pal_tr} › ${kural.iyal_tr} › ${kural.adikaram_tr}\n\n`;
        text += `Translation:\n${kural.translation}\n\n`;

        const expl = this.getBestExplanation(kural);
        if (expl) {
            text += `Explanation (${expl.author}):\n${expl.text}\n\n`;
        }

        text += `Read more: ${window.location.href}`;

        const onSuccess = () => {
            if (!silent) this.snackBar.open('Copied to clipboard!', 'Close', { duration: 2000 });
        };
        const onError = (err: any) => {
            console.error('Failed to copy text: ', err);
            if (!silent) this.snackBar.open('Failed to copy. Please try again.', 'Close', { duration: 2000 });
        };

        this.writeToClipboard(text, onSuccess, onError);
    }

    copyTamilTextOnly(kural: Kural): void {
        const textToCopy = `${kural.line1}\n${kural.line2}\n\n- திருக்குறள் (${kural.number})`;
        const onSuccess = () => {
            this.isCopied = true;
            this.cdr.markForCheck();
            this.snackBar.open('Tamil couplet copied to clipboard!', 'Close', { duration: 2000 });
            setTimeout(() => {
                this.isCopied = false;
                this.cdr.markForCheck();
            }, 2000);
        };
        const onError = (err: any) => {
            console.error('Failed to copy text: ', err);
            this.snackBar.open('Failed to copy. Please try again.', 'Close', { duration: 2000 });
        };

        this.writeToClipboard(textToCopy, onSuccess, onError);
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

            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(this.captureArea.nativeElement, {
                useCORS: true,
                scale: 3, // HD Quality
                backgroundColor: '#ffffff',
                logging: false,
                width: 1080, // Force width to 1080px
                windowWidth: 1080
            });

            // Wrap toBlob in a promise with timeout prevention
            const blobPromise = new Promise<Blob | null>((resolve) => {
                canvas.toBlob((blob) => resolve(blob), 'image/png');
                // Safety timeout if toBlob doesn't fire callback
                setTimeout(() => resolve(null), 5000);
            });

            const blob = await blobPromise;

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
                this.copyToClipboard(kural, true); // Silent copy
                this.snackBar.open('Image downloaded & Text copied!', 'Close', { duration: 3000 });
                this.isSharing = false;
            }

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
        const link = this.doc.createElement('a');
        link.href = url;
        link.download = `thirukkural-${this.currentNumber}.png`;
        this.doc.body.appendChild(link);
        link.click();
        this.doc.body.removeChild(link);
        URL.revokeObjectURL(url);
        this.snackBar.open('Image downloaded!', 'Close', { duration: 2000 });
    }
}
