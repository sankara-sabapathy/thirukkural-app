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
import { KuralService, SearchIndexItem } from '../../services/kural.service';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

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
        MatButtonModule
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

    // Pagination
    pageSize = 10;
    pageIndex = 0;
    pageSizeOptions = [10, 25, 50, 100];

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
            this.updateDisplayedKurals();
            this.loading = false;
        });
    }

    onSearch(query: string): void {
        this.searchSubject.next(query);
    }

    filterKurals(query: string): void {
        this.pageIndex = 0; // Reset to first page on search

        if (!query || query.trim() === '') {
            this.filteredKurals = this.allKurals;
        } else {
            const lowerQuery = query.toLowerCase();
            this.filteredKurals = this.allKurals.filter(k =>
                k.n.toString().includes(lowerQuery) ||
                k.t.toLowerCase().includes(lowerQuery) ||
                k.l1.toLowerCase().includes(lowerQuery) ||
                k.mk.toLowerCase().includes(lowerQuery) ||
                k.i.toLowerCase().includes(lowerQuery) ||
                k.p.toLowerCase().includes(lowerQuery) ||
                k.a.toLowerCase().includes(lowerQuery)
            );
        }
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
}
