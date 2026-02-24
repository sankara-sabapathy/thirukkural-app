import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { KuralService, SearchIndexItem } from '../../services/kural.service';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { KURAL_FILTER_MAPPING } from './kural-filter-mapping';

@Component({
    selector: 'app-kural-list',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,
        MatInputModule,
        MatFormFieldModule,
        MatIconModule,
        MatListModule,
        MatPaginatorModule,
        MatProgressSpinnerModule,
        MatButtonModule,
        MatSelectModule
    ],
    templateUrl: './kural-list.component.html',
    styleUrls: ['./kural-list.component.scss']
})
export class KuralListComponent implements OnInit {
    allKurals: SearchIndexItem[] = [];
    filteredKurals: SearchIndexItem[] = [];
    displayedKurals: SearchIndexItem[] = [];
    loading = true;
    searchQuery = '';

    // Filter Options
    palOptions: string[] = [];
    iyalOptions: string[] = [];
    adikaramOptions: string[] = [];

    // Selected Filters
    selectedPal: string = '';
    selectedIyal: string = '';
    selectedAdikaram: string = '';

    // Pagination
    pageSize = 10;
    pageIndex = 0;
    pageSizeOptions = [10, 25, 50, 100];

    // Language Toggle
    filterLanguage: 'ta' | 'en' = 'ta';

    private searchSubject = new Subject<string>();

    constructor(
        private kuralService: KuralService,
        private router: Router
    ) {
        this.searchSubject.pipe(
            debounceTime(300),
            distinctUntilChanged()
        ).subscribe(query => {
            this.filterKurals(query);
        });
    }

    ngOnInit(): void {
        this.kuralService.getSearchIndex().subscribe(index => {
            this.allKurals = index;
            this.filteredKurals = index;
            this.extractFilterOptions();
            this.updateDisplayedKurals();
            this.loading = false;
        });
    }

    extractFilterOptions(): void {
        this.palOptions = [...new Set(this.allKurals.map(k => k.p))];
        this.updateIyalOptions();
    }

    onPalChange(): void {
        this.selectedIyal = '';
        this.selectedAdikaram = '';
        this.updateIyalOptions();
        this.applyFilters();
    }

    onIyalChange(): void {
        this.selectedAdikaram = '';
        this.updateAdikaramOptions();
        this.applyFilters();
    }

    onAdikaramChange(): void {
        this.applyFilters();
    }

    updateIyalOptions(): void {
        let kurals = this.allKurals;
        if (this.selectedPal) {
            kurals = kurals.filter(k => k.p === this.selectedPal);
        }
        this.iyalOptions = [...new Set(kurals.map(k => k.i))];
        this.updateAdikaramOptions();
    }

    updateAdikaramOptions(): void {
        let kurals = this.allKurals;
        if (this.selectedPal) {
            kurals = kurals.filter(k => k.p === this.selectedPal);
        }
        if (this.selectedIyal) {
            kurals = kurals.filter(k => k.i === this.selectedIyal);
        }
        this.adikaramOptions = [...new Set(kurals.map(k => k.a))];
    }

    onSearch(query: string): void {
        this.searchSubject.next(query);
    }

    filterKurals(query: string): void {
        this.applyFilters(query);
    }

    applyFilters(query: string = this.searchQuery): void {
        this.pageIndex = 0; // Reset to first page on search

        let result = this.allKurals;

        if (this.selectedPal) {
            result = result.filter(k => k.p === this.selectedPal);
        }
        if (this.selectedIyal) {
            result = result.filter(k => k.i === this.selectedIyal);
        }
        if (this.selectedAdikaram) {
            result = result.filter(k => k.a === this.selectedAdikaram);
        }

        if (query && query.trim() !== '') {
            const lowerQuery = query.toLowerCase();
            result = result.filter(k =>
                k.n.toString().includes(lowerQuery) ||
                k.t.toLowerCase().includes(lowerQuery) ||
                k.l1.toLowerCase().includes(lowerQuery) ||
                k.mk.toLowerCase().includes(lowerQuery) ||
                k.i.toLowerCase().includes(lowerQuery) ||
                k.p.toLowerCase().includes(lowerQuery) ||
                k.a.toLowerCase().includes(lowerQuery)
            );
        }

        this.filteredKurals = result;
        this.updateDisplayedKurals();
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.updateDisplayedKurals();
    }

    updateDisplayedKurals(): void {
        const startIndex = this.pageIndex * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        this.displayedKurals = this.filteredKurals.slice(startIndex, endIndex);
    }

    goToRandomKural(): void {
        const randomId = Math.floor(Math.random() * 1330) + 1;
        this.router.navigate(['/kural', randomId]);
    }

    toggleFilterLanguage(): void {
        this.filterLanguage = this.filterLanguage === 'ta' ? 'en' : 'ta';
    }

    getTranslatedOption(type: 'pal' | 'iyal' | 'adikaram', value: string): string {
        if (this.filterLanguage === 'en') {
            return value;
        }

        const mappedValue = KURAL_FILTER_MAPPING[type]?.[value as keyof typeof KURAL_FILTER_MAPPING[typeof type]];
        return mappedValue || value; // Fallback to English if translation is missing
    }
}
