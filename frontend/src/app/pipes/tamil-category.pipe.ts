import { Pipe, PipeTransform } from '@angular/core';
import { KURAL_FILTER_MAPPING } from '../pages/kural-list/kural-filter-mapping';

@Pipe({
    name: 'tamilCategory',
    standalone: true,
    pure: true
})
export class TamilCategoryPipe implements PipeTransform {
    transform(value: string | null | undefined, type: 'pal' | 'iyal' | 'adikaram'): string {
        if (!value) return '';
        const mappedValue = KURAL_FILTER_MAPPING[type]?.[value as keyof typeof KURAL_FILTER_MAPPING[typeof type]];
        return mappedValue || value;
    }
}
