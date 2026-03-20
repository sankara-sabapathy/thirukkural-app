import { Component, Inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
    selector: 'app-widget-docs',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatSnackBarModule
    ],
    templateUrl: './widget-docs.component.html',
    styleUrls: ['./widget-docs.component.scss']
})
export class WidgetDocsComponent {
    readonly scriptSnippet = `<script src="https://thirukkural.site/widgets/daily-kural.js" data-theme="light"></script>`;
    readonly customSnippet = `<script
  src="https://thirukkural.site/widgets/daily-kural.js"
  data-theme="dark"
  data-accent="#0f766e"
  data-kural="1078"
></script>`;

    constructor(
        private snackBar: MatSnackBar,
        @Inject(DOCUMENT) private document: Document
    ) {}

    copySnippet(snippet: string): void {
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(snippet).then(() => {
                this.snackBar.open('Embed code copied.', 'Close', { duration: 2000 });
            }).catch(() => this.fallbackCopy(snippet));
            return;
        }

        this.fallbackCopy(snippet);
    }

    private fallbackCopy(snippet: string): void {
        const textArea = this.document.createElement('textarea');
        textArea.value = snippet;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        this.document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const copied = this.document.execCommand('copy');
        this.document.body.removeChild(textArea);

        this.snackBar.open(copied ? 'Embed code copied.' : 'Unable to copy embed code.', 'Close', {
            duration: 2000
        });
    }
}
