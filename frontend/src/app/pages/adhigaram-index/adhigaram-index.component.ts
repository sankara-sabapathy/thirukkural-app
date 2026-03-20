import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { AdhigaramSummary, KuralService } from '../../services/kural.service';
import { SeoService } from '../../services/seo.service';

interface IyalGroup {
    iyal: string;
    iyal_tr: string;
    iyal_tl?: string;
    adhigarams: AdhigaramSummary[];
}

interface PalGroup {
    pal: string;
    pal_tr: string;
    pal_tl?: string;
    adhigaramCount: number;
    kuralCount: number;
    iyals: IyalGroup[];
}

@Component({
    selector: 'app-adhigaram-index',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './adhigaram-index.component.html',
    styleUrls: ['./adhigaram-index.component.scss']
})
export class AdhigaramIndexComponent implements OnInit, OnDestroy {
    private readonly baseUrl = 'https://thirukkural.site';

    groups$: Observable<PalGroup[]> = of([]);
    loading = true;
    totalAdhigarams = 0;
    totalKurals = 0;

    constructor(
        private kuralService: KuralService,
        private seoService: SeoService
    ) {}

    ngOnInit(): void {
        this.groups$ = this.kuralService.getAdhigarams().pipe(
            map((adhigarams) => this.buildGroups(adhigarams)),
            tap((groups) => {
                this.loading = false;
                this.totalAdhigarams = groups.reduce((sum, group) => sum + group.adhigaramCount, 0);
                this.totalKurals = groups.reduce((sum, group) => sum + group.kuralCount, 0);

                if (this.totalAdhigarams > 0) {
                    this.injectStructuredData(groups);
                    return;
                }

                this.seoService.removeStructuredData('structured-data-adhigaram-index');
            }),
            catchError((error) => {
                console.error('Error loading adhigaram index:', error);
                this.loading = false;
                this.seoService.removeStructuredData('structured-data-adhigaram-index');
                return of([]);
            }),
            shareReplay({ bufferSize: 1, refCount: true })
        );
    }

    ngOnDestroy(): void {
        this.seoService.removeStructuredData('structured-data-adhigaram-index');
    }

    getPalAnchor(group: PalGroup): string {
        return `pal-${group.pal_tr.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    }

    getKuralRange(adhigaram: AdhigaramSummary): string {
        return `Kurals ${adhigaram.start}-${adhigaram.end}`;
    }

    private buildGroups(adhigarams: AdhigaramSummary[]): PalGroup[] {
        const palMap = new Map<string, PalGroup>();

        for (const adhigaram of adhigarams) {
            let palGroup = palMap.get(adhigaram.pal);

            if (!palGroup) {
                palGroup = {
                    pal: adhigaram.pal,
                    pal_tr: adhigaram.pal_tr,
                    pal_tl: adhigaram.pal_tl,
                    adhigaramCount: 0,
                    kuralCount: 0,
                    iyals: []
                };
                palMap.set(adhigaram.pal, palGroup);
            }

            palGroup.adhigaramCount += 1;
            palGroup.kuralCount += adhigaram.end - adhigaram.start + 1;

            let iyalGroup = palGroup.iyals.find((group) => group.iyal === adhigaram.iyal);
            if (!iyalGroup) {
                iyalGroup = {
                    iyal: adhigaram.iyal,
                    iyal_tr: adhigaram.iyal_tr,
                    iyal_tl: adhigaram.iyal_tl,
                    adhigarams: []
                };
                palGroup.iyals.push(iyalGroup);
            }

            iyalGroup.adhigarams.push(adhigaram);
        }

        return Array.from(palMap.values());
    }

    private injectStructuredData(groups: PalGroup[]): void {
        const flatAdhigarams = groups.flatMap((group) => group.iyals.flatMap((iyal) => iyal.adhigarams));
        const url = `${this.baseUrl}/adhigaram`;

        const jsonLd = {
            '@context': 'https://schema.org',
            '@graph': [
                {
                    '@type': 'CollectionPage',
                    '@id': url,
                    url,
                    name: 'Thirukkural Adhigaram Index',
                    isPartOf: {
                        '@type': 'WebSite',
                        name: 'Thirukkural Daily',
                        url: this.baseUrl
                    },
                    mainEntity: {
                        '@type': 'ItemList',
                        name: 'All 133 Thirukkural Adhigarams',
                        numberOfItems: flatAdhigarams.length,
                        itemListElement: flatAdhigarams.map((adhigaram, index) => ({
                            '@type': 'ListItem',
                            position: index + 1,
                            url: `${this.baseUrl}/adhigaram/${adhigaram.id}`,
                            name: `Adhigaram ${adhigaram.id}: ${adhigaram.adikaram_tr}`
                        }))
                    }
                },
                {
                    '@type': 'BreadcrumbList',
                    '@id': `${url}#breadcrumb`,
                    itemListElement: [
                        {
                            '@type': 'ListItem',
                            position: 1,
                            name: 'Home',
                            item: `${this.baseUrl}/`
                        },
                        {
                            '@type': 'ListItem',
                            position: 2,
                            name: 'Adhigarams',
                            item: url
                        }
                    ]
                }
            ]
        };

        this.seoService.setStructuredData(jsonLd, 'structured-data-adhigaram-index');
    }
}
