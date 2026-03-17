import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable, of, merge } from 'rxjs';
import { catchError, distinctUntilChanged, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { AdhigaramPageData, Kural, KuralService } from '../../services/kural.service';
import { SeoService } from '../../services/seo.service';
import { TamilCategoryPipe } from '../../pipes/tamil-category.pipe';

interface AdhigaramFaqItem {
    question: string;
    answer: string;
}

@Component({
    selector: 'app-adhigaram-detail',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        TamilCategoryPipe
    ],
    templateUrl: './adhigaram-detail.component.html',
    styleUrls: ['./adhigaram-detail.component.scss']
})
export class AdhigaramDetailComponent implements OnInit, OnDestroy {
    readonly totalAdhigarams = 133;

    adhigaram$: Observable<AdhigaramPageData | undefined> = of(undefined);
    faqItems: AdhigaramFaqItem[] = [];
    loading = false;
    currentId = 1;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private kuralService: KuralService,
        private seoService: SeoService
    ) { }

    ngOnInit(): void {
        const initialValue$ = of(this.route.snapshot.paramMap);
        const paramMap$ = merge(initialValue$, this.route.paramMap);
        let isInitialRouteLoad = true;

        this.adhigaram$ = paramMap$.pipe(
            map((params) => this.parseAdhigaramId(params.get('id'))),
            distinctUntilChanged(),
            switchMap((id) => {
                const hasValidId = typeof id === 'number' && Number.isInteger(id);
                this.currentId = hasValidId ? Math.min(this.totalAdhigarams, Math.max(1, id)) : 1;
                this.loading = !isInitialRouteLoad;
                isInitialRouteLoad = false;

                if (!hasValidId) {
                    this.loading = false;
                    this.faqItems = [];
                    this.seoService.removeStructuredData('structured-data-adhigaram');
                    return of(undefined);
                }

                return this.kuralService.getAdhigaram(id).pipe(
                    tap((adhigaram) => {
                        this.loading = false;

                        if (adhigaram) {
                            this.faqItems = this.buildFaqItems(adhigaram);
                            this.updateMetaTags(adhigaram);
                            return;
                        }

                        this.faqItems = [];
                        this.seoService.removeStructuredData('structured-data-adhigaram');
                    }),
                    catchError(error => {
                        console.error('Error fetching adhigaram:', error);
                        this.loading = false;
                        this.faqItems = [];
                        return of(undefined);
                    })
                );
            }),
            shareReplay(1)
        );
    }

    ngOnDestroy(): void {
        this.seoService.removeStructuredData('structured-data-adhigaram');
    }

    previousAdhigaram(): void {
        if (this.currentId > 1) {
            this.router.navigate(['/adhigaram', this.currentId - 1]);
        }
    }

    nextAdhigaram(): void {
        if (this.currentId < this.totalAdhigarams) {
            this.router.navigate(['/adhigaram', this.currentId + 1]);
        }
    }

    private updateMetaTags(adhigaram: AdhigaramPageData): void {
        const title = `Thirukkural Adhigaram ${adhigaram.id} - ${adhigaram.adikaram} (${adhigaram.adikaram_tr})`;
        const description =
            `Read Thirukkural Adhigaram ${adhigaram.id}, ${adhigaram.adikaram_tr}, ` +
            `from ${adhigaram.pal_tr} > ${adhigaram.iyal_tr}, covering Kurals ${adhigaram.start}-${adhigaram.end}.`;
        const keywords = [
            `Thirukkural Adhigaram ${adhigaram.id}`,
            adhigaram.adikaram_tr,
            adhigaram.adikaram_tl,
            adhigaram.iyal_tr,
            adhigaram.pal_tr
        ].filter(Boolean).join(', ');
        const url = `https://thirukkural.site/adhigaram/${adhigaram.id}`;

        this.seoService.generateTags({
            title,
            description,
            keywords,
            url
        });

        this.injectStructuredData(adhigaram, url);
    }

    private injectStructuredData(adhigaram: AdhigaramPageData, url: string): void {
        const faqItems = this.buildFaqItems(adhigaram);
        const itemListElements = adhigaram.kurals.map((kural, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            url: `https://thirukkural.site/kural/${kural.number}`,
            name: `Thirukkural ${kural.number}`
        }));

        const jsonLd = {
            '@context': 'https://schema.org',
            '@graph': [
                {
                    '@type': 'CollectionPage',
                    '@id': url,
                    url,
                    name: `Thirukkural Adhigaram ${adhigaram.id}`,
                    isPartOf: {
                        '@type': 'WebSite',
                        name: 'Thirukkural Daily',
                        url: 'https://thirukkural.site'
                    },
                    about: [
                        { '@type': 'Thing', name: adhigaram.pal_tr },
                        { '@type': 'Thing', name: adhigaram.iyal_tr },
                        { '@type': 'Thing', name: adhigaram.adikaram_tr }
                    ],
                    mainEntity: {
                        '@type': 'ItemList',
                        name: `Kurals ${adhigaram.start}-${adhigaram.end}`,
                        numberOfItems: adhigaram.kurals.length,
                        itemListElement: itemListElements
                    }
                },
                {
                    '@type': 'FAQPage',
                    '@id': `${url}#faq`,
                    url: `${url}#faq`,
                    mainEntity: faqItems.map((faq) => ({
                        '@type': 'Question',
                        name: faq.question,
                        acceptedAnswer: {
                            '@type': 'Answer',
                            text: faq.answer
                        }
                    }))
                },
                {
                    '@type': 'BreadcrumbList',
                    itemListElement: [
                        {
                            '@type': 'ListItem',
                            position: 1,
                            name: 'Home',
                            item: 'https://thirukkural.site/'
                        },
                        {
                            '@type': 'ListItem',
                            position: 2,
                            name: 'Kurals',
                            item: 'https://thirukkural.site/kurals'
                        },
                        {
                            '@type': 'ListItem',
                            position: 3,
                            name: `Adhigaram ${adhigaram.id}`,
                            item: url
                        }
                    ]
                }
            ]
        };

        this.seoService.setStructuredData(jsonLd, 'structured-data-adhigaram');
    }

    private buildFaqItems(adhigaram: AdhigaramPageData): AdhigaramFaqItem[] {
        const firstKural = adhigaram.kurals[0];

        return [
            {
                question: `What is Adhigaram ${adhigaram.id} in Thirukkural?`,
                answer:
                    `Adhigaram ${adhigaram.id} is "${adhigaram.adikaram_tr}" (${adhigaram.adikaram}). ` +
                    `This chapter covers Kurals ${adhigaram.start}-${adhigaram.end}.`
            },
            {
                question: `Which book and division does Adhigaram ${adhigaram.id} belong to?`,
                answer:
                    `Adhigaram ${adhigaram.id} belongs to the book ${adhigaram.pal_tr} (${adhigaram.pal}) ` +
                    `and the division ${adhigaram.iyal_tr} (${adhigaram.iyal}).`
            },
            {
                question: `Which Kurals are included in Adhigaram ${adhigaram.id}?`,
                answer:
                    `This chapter contains 10 Kurals, from Thirukkural ${adhigaram.start} to ` +
                    `Thirukkural ${adhigaram.end}.`
            },
            {
                question: `What is the opening Kural in Adhigaram ${adhigaram.id}?`,
                answer: this.buildOpeningKuralAnswer(firstKural)
            }
        ];
    }

    private buildOpeningKuralAnswer(kural: Kural | undefined): string {
        if (!kural) {
            return 'Use the chapter list on this page to open each Kural and read its full meaning.';
        }

        return (
            `The opening verse is Thirukkural ${kural.number}: "${kural.line1} ${kural.line2}". ` +
            `Its English translation begins: "${kural.translation}".`
        );
    }

    private parseAdhigaramId(value: string | null): number | undefined {
        if (!value) {
            return 1;
        }

        const parsedValue = Number.parseInt(value, 10);
        return Number.isInteger(parsedValue) ? parsedValue : undefined;
    }
}
