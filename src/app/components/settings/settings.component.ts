import { Component, OnInit } from '@angular/core';
import { SettingsService } from './settings.service';


@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  selectedFont = 'Fira Code';
  editorOptions = {
    theme: 'vs-dark',
    language: 'json',
    minimap: { enabled: false },
    formatOnPaste: true,
    formatOnType: true
  };

  code = localStorage.getItem('nishant.github.io-config') ?? '[]';

  constructor(private settingService: SettingsService) {

  }

  ngOnInit(): void {
    this.settingService.onClose.subscribe(x => {
      this.selectedFont = localStorage.getItem('nishant.github.io-font') ?? 'Fira Code';

      if (x === 'closed') {
        this.settingService.config.next(this.code);
        // this.settingService.font.next(this.selectedFont);
      }
    });
  }

  onSelect = () => {
    this.settingService.font.next(this.selectedFont);
    localStorage.setItem('nishant.github.io-font', this.selectedFont);
    document.querySelectorAll('*:not(.material-symbols-outlined)').forEach(x => {
      (x as HTMLElement).style.fontFamily = this.selectedFont + ', monospace'
    });
  };

  prettify = (obj: unknown) => JSON.stringify(obj, null, '\t');
}
