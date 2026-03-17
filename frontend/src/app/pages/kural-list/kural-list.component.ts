import { DestroyRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
    ActivatedRoute,
    Params,
    ParamMap,
    Router,
    RouterModule
} from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { KuralService, SearchIndexItem, AdhigaramSummary } from '../../services/kural.service';
import { forkJoin, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { KURAL_FILTER_MAPPING } from './kural-filter-mapping';

type LibraryScope = 'kural' | 'adhigaram';

type AdhigaramFilterOption = AdhigaramSummary;

@Component({
    selector: 'app-kural-list',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,
        MatButtonModule,
        MatButtonToggleModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatPaginatorModule,
        MatProgressSpinnerModule,
        MatSelectModule
    ],
    templateUrl: './kural-list.component.html',
    styleUrls: ['./kural-list.component.scss']
})
export class KuralListComponent implements OnInit {
    private readonly destroyRef = inject(DestroyRef);
    private readonly searchSubject = new Subject<string>();

    allKurals: SearchIndexItem[] = [];
    filteredKurals: SearchIndexItem[] = [];
    displayedKurals: SearchIndexItem[] = [];

    allAdhigarams: AdhigaramSummary[] = [];
    filteredAdhigarams: AdhigaramSummary[] = [];
    displayedAdhigarams: AdhigaramSummary[] = [];

    loading = true;
    libraryScope: LibraryScope = 'kural';
    searchQuery = '';

    palOptions: string[] = [];
    iyalOptions: string[] = [];
    adikaramOptions: AdhigaramFilterOption[] = [];

    selectedPal = '';
    selectedIyal = '';
    selectedAdikaramId: number | null = null;

    pageSize = 10;
    pageIndex = 0;
    pageSizeOptions = [10, 25, 50, 100];

    filterLanguage: 'ta' | 'en' = 'ta';

    constructor(
        private kuralService: KuralService,
        private router: Router,
        private route: ActivatedRoute
    ) {
        this.searchSubject.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            takeUntilDestroyed(this.destroyRef)
        ).subscribe((query) => {
            this.searchQuery = query;
            this.pageIndex = 0;
            this.applyFilters(true);
        });
    }

    ngOnInit(): void {
        forkJoin({
            kurals: this.kuralService.getSearchIndex(),
            adhigarams: this.kuralService.getAdhigarams()
        })
            .pipe(
                tap(({ kurals, adhigarams }) => {
                    this.allKurals = [...kurals].sort((left, right) => left.n - right.n);
                    this.allAdhigarams = [...adhigarams].sort((left, right) => left.id - right.id);
                }),
                switchMap(() => this.route.queryParamMap),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((params) => {
                this.hydrateStateFromQueryParams(params);
                this.applyFilters(false);
                this.syncQueryParamsIfNeeded(params);
                this.loading = false;
            });
    }

    get isKuralScope(): boolean {
        return this.libraryScope === 'kural';
    }

    get currentDisplayedCount(): number {
        return this.isKuralScope ? this.displayedKurals.length : this.displayedAdhigarams.length;
    }

    get currentFilteredCount(): number {
        return this.isKuralScope ? this.filteredKurals.length : this.filteredAdhigarams.length;
    }

    get searchPlaceholder(): string {
        return this.isKuralScope
            ? 'Search by number, Tamil text, or meaning...'
            : 'Search by adhigaram number, Tamil title, or English title...';
    }

    get resultsLabel(): string {
        return this.isKuralScope ? 'kurals' : 'adhigarams';
    }

    get noResultsMessage(): string {
        const baseMessage = `No ${this.resultsLabel} found`;
        return this.searchQuery ? `${baseMessage} matching "${this.searchQuery}"` : baseMessage;
    }

    get selectedAdhigaram(): AdhigaramSummary | undefined {
        if (!this.selectedAdikaramId) {
            return undefined;
        }

        return this.allAdhigarams.find((adhigaram) => adhigaram.id === this.selectedAdikaramId);
    }

    onScopeChange(): void {
        if (!this.isKuralScope) {
            this.selectedAdikaramId = null;
        }

        this.pageIndex = 0;
        this.normalizeSelections();
        this.applyFilters(true);
    }

    onPalChange(): void {
        this.selectedIyal = '';
        this.selectedAdikaramId = null;
        this.pageIndex = 0;
        this.normalizeSelections();
        this.applyFilters(true);
    }

    onIyalChange(): void {
        this.selectedAdikaramId = null;
        this.pageIndex = 0;
        this.normalizeSelections();
        this.applyFilters(true);
    }

    onAdikaramChange(): void {
        this.pageIndex = 0;
        this.applyFilters(true);
    }

    onSearch(query: string): void {
        this.searchSubject.next(query);
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.updateDisplayedResults();
    }

    goToRandomEntry(): void {
        if (this.isKuralScope) {
            const randomId = Math.floor(Math.random() * 1330) + 1;
            this.router.navigate(['/kural', randomId]);
            return;
        }

        if (this.allAdhigarams.length === 0) {
            return;
        }

        const randomIndex = Math.floor(Math.random() * this.allAdhigarams.length);
        this.router.navigate(['/adhigaram', this.allAdhigarams[randomIndex].id]);
    }

    toggleFilterLanguage(): void {
        this.filterLanguage = this.filterLanguage === 'ta' ? 'en' : 'ta';
    }

    getTranslatedOption(type: 'pal' | 'iyal' | 'adikaram', value: string): string {
        if (this.filterLanguage === 'en') {
            return value;
        }

        const mappedValue = KURAL_FILTER_MAPPING[type]?.[value as keyof typeof KURAL_FILTER_MAPPING[typeof type]];
        return mappedValue || value;
    }

    getAdhigaramOptionLabel(option: AdhigaramFilterOption): string {
        const label = this.filterLanguage === 'ta' ? option.adikaram : option.adikaram_tr;
        return `${option.id}. ${label}`;
    }

    getAdhigaramSubtitle(adhigaram: AdhigaramSummary): string {
        return [adhigaram.adikaram_tr, adhigaram.adikaram_tl].filter(Boolean).join(' • ');
    }

    getAdhigaramRange(adhigaram: AdhigaramSummary): string {
        return `Kurals ${adhigaram.start}-${adhigaram.end}`;
    }

    private hydrateStateFromQueryParams(params: ParamMap): void {
        this.libraryScope = params.get('view') === 'adhigaram' ? 'adhigaram' : 'kural';
        this.searchQuery = (params.get('q') || '').trim();
        this.selectedPal = params.get('pal') || '';
        this.selectedIyal = params.get('iyal') || '';
        this.selectedAdikaramId = this.libraryScope === 'kural'
            ? this.parseAdikaramId(params.get('adikaram'))
            : null;

        this.pageIndex = 0;
        this.normalizeSelections();
    }

    private normalizeSelections(): void {
        this.updatePalOptions();

        if (this.selectedPal && !this.palOptions.includes(this.selectedPal)) {
            this.selectedPal = '';
        }

        this.updateIyalOptions();

        if (this.selectedIyal && !this.iyalOptions.includes(this.selectedIyal)) {
            this.selectedIyal = '';
            this.updateIyalOptions();
        }

        if (!this.isKuralScope) {
            this.selectedAdikaramId = null;
            this.adikaramOptions = [];
            return;
        }

        this.updateAdikaramOptions();

        if (
            this.selectedAdikaramId &&
            !this.adikaramOptions.some((adhigaram) => adhigaram.id === this.selectedAdikaramId)
        ) {
            this.selectedAdikaramId = null;
        }
    }

    private updatePalOptions(): void {
        const source = this.isKuralScope
            ? this.allKurals.map((kural) => kural.p)
            : this.allAdhigarams.map((adhigaram) => adhigaram.pal_tr);

        this.palOptions = [...new Set(source)];
    }

    private updateIyalOptions(): void {
        if (this.isKuralScope) {
            let kurals = this.allKurals;
            if (this.selectedPal) {
                kurals = kurals.filter((kural) => kural.p === this.selectedPal);
            }
            this.iyalOptions = [...new Set(kurals.map((kural) => kural.i))];
            return;
        }

        let adhigarams = this.allAdhigarams;
        if (this.selectedPal) {
            adhigarams = adhigarams.filter((adhigaram) => adhigaram.pal_tr === this.selectedPal);
        }
        this.iyalOptions = [...new Set(adhigarams.map((adhigaram) => adhigaram.iyal_tr))];
    }

    private updateAdikaramOptions(): void {
        let adhigarams = this.allAdhigarams;

        if (this.selectedPal) {
            adhigarams = adhigarams.filter((adhigaram) => adhigaram.pal_tr === this.selectedPal);
        }

        if (this.selectedIyal) {
            adhigarams = adhigarams.filter((adhigaram) => adhigaram.iyal_tr === this.selectedIyal);
        }

        this.adikaramOptions = adhigarams;
    }

    private applyFilters(syncUrl: boolean): void {
        this.normalizeSelections();

        if (this.isKuralScope) {
            let result = this.allKurals;

            if (this.selectedPal) {
                result = result.filter((kural) => kural.p === this.selectedPal);
            }

            if (this.selectedIyal) {
                result = result.filter((kural) => kural.i === this.selectedIyal);
            }

            if (this.selectedAdikaramId) {
                const adhigaram = this.selectedAdhigaram;
                if (adhigaram) {
                    result = result.filter(
                        (kural) => kural.n >= adhigaram.start && kural.n <= adhigaram.end
                    );
                }
            }

            if (this.searchQuery) {
                const lowerQuery = this.searchQuery.toLowerCase();
                result = result.filter((kural) =>
                    kural.n.toString().includes(lowerQuery) ||
                    kural.t.toLowerCase().includes(lowerQuery) ||
                    kural.l1.toLowerCase().includes(lowerQuery) ||
                    kural.mk.toLowerCase().includes(lowerQuery) ||
                    kural.i.toLowerCase().includes(lowerQuery) ||
                    kural.p.toLowerCase().includes(lowerQuery) ||
                    kural.a.toLowerCase().includes(lowerQuery)
                );
            }

            this.filteredKurals = result;
        } else {
            let result = this.allAdhigarams;

            if (this.selectedPal) {
                result = result.filter((adhigaram) => adhigaram.pal_tr === this.selectedPal);
            }

            if (this.selectedIyal) {
                result = result.filter((adhigaram) => adhigaram.iyal_tr === this.selectedIyal);
            }

            if (this.searchQuery) {
                const lowerQuery = this.searchQuery.toLowerCase();
                result = result.filter((adhigaram) => {
                    const searchText = [
                        adhigaram.id.toString(),
                        adhigaram.adikaram,
                        adhigaram.adikaram_tr,
                        adhigaram.adikaram_tl || '',
                        adhigaram.pal,
                        adhigaram.pal_tr,
                        adhigaram.pal_tl || '',
                        adhigaram.iyal,
                        adhigaram.iyal_tr,
                        adhigaram.iyal_tl || '',
                        `${adhigaram.start}-${adhigaram.end}`,
                        `kurals ${adhigaram.start}-${adhigaram.end}`
                    ].join(' ').toLowerCase();

                    return searchText.includes(lowerQuery);
                });
            }

            this.filteredAdhigarams = result;
        }

        this.updateDisplayedResults();

        if (syncUrl) {
            this.syncQueryParamsIfNeeded();
        }
    }

    private updateDisplayedResults(): void {
        const startIndex = this.pageIndex * this.pageSize;
        const endIndex = startIndex + this.pageSize;

        if (this.isKuralScope) {
            this.displayedKurals = this.filteredKurals.slice(startIndex, endIndex);
            this.displayedAdhigarams = [];
            return;
        }

        this.displayedAdhigarams = this.filteredAdhigarams.slice(startIndex, endIndex);
        this.displayedKurals = [];
    }

    private syncQueryParamsIfNeeded(currentParams: ParamMap = this.route.snapshot.queryParamMap): void {
        const nextParams = this.buildMergedQueryParams(currentParams);

        if (this.areQueryParamsEqual(currentParams, nextParams)) {
            return;
        }

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: nextParams,
            replaceUrl: true
        });
    }

    private buildMergedQueryParams(currentParams: ParamMap): Params {
        const mergedParams = currentParams.keys.reduce<Params>((accumulator, key) => {
            const value = currentParams.get(key);
            if (value !== null) {
                accumulator[key] = value;
            }
            return accumulator;
        }, {});

        for (const [key, value] of Object.entries(this.buildQueryParams())) {
            if (value === null || value === undefined || value === '') {
                delete mergedParams[key];
                continue;
            }

            mergedParams[key] = value;
        }

        return mergedParams;
    }

    private buildQueryParams(): Params {
        return {
            view: this.libraryScope === 'adhigaram' ? 'adhigaram' : null,
            q: this.searchQuery.trim() || null,
            pal: this.selectedPal || null,
            iyal: this.selectedIyal || null,
            adikaram: this.isKuralScope && this.selectedAdikaramId
                ? String(this.selectedAdikaramId)
                : null
        };
    }

    private areQueryParamsEqual(currentParams: ParamMap, nextParams: Params): boolean {
        const normalizedNext = Object.entries(nextParams)
            .filter(([, value]) => value !== null && value !== undefined && value !== '')
            .reduce<Record<string, string>>((accumulator, [key, value]) => {
                accumulator[key] = String(value);
                return accumulator;
            }, {});

        const currentKeys = currentParams.keys.filter((key) => currentParams.get(key) !== null).sort();
        const nextKeys = Object.keys(normalizedNext).sort();

        if (currentKeys.length !== nextKeys.length) {
            return false;
        }

        return nextKeys.every((key) => currentParams.get(key) === normalizedNext[key]);
    }

    private parseAdikaramId(value: string | null): number | null {
        if (!value) {
            return null;
        }

        const normalizedValue = value.trim();
        if (!/^[1-9]\d*$/.test(normalizedValue)) {
            return null;
        }

        const parsedValue = Number(normalizedValue);
        return Number.isSafeInteger(parsedValue) ? parsedValue : null;
    }
}
