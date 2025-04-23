import { Component, OnInit } from '@angular/core';
import { SettingsService } from './settings.service';
import { MatOptionModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { LOCAL_STORAGE_CONFIG_KEY, LOCAL_STORAGE_FONT_KEY } from '../../constants';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  standalone: true,
  imports: [MonacoEditorModule, ReactiveFormsModule, FormsModule, MatFormFieldModule, MatSelectModule, MatOptionModule],
})
export class SettingsComponent implements OnInit {
  selectedFont = 'Fira Code';
  editorOptions = {
    theme: 'vs-dark',
    language: 'json',
    minimap: { enabled: false },
    formatOnPaste: true,
    formatOnType: true,
  };

  code = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY) ?? '[]';

  constructor(private settingService: SettingsService) {}

  ngOnInit(): void {
    this.settingService.onClose.subscribe((state) => {
      this.selectedFont = localStorage.getItem(LOCAL_STORAGE_FONT_KEY) ?? 'Fira Code';

      if (state === 'closed') {
        this.settingService.config.next(this.code);
        // this.settingService.font.next(this.selectedFont);
      }
    });
  }

  onSelect = (): void => {
    this.settingService.font.next(this.selectedFont);
    localStorage.setItem(LOCAL_STORAGE_FONT_KEY, this.selectedFont);
    this.applyFont();
  };

  applyFont = (): void => {
    document.querySelectorAll('*:not(.material-symbols-outlined)').forEach((x) => {
      (x as HTMLElement).style.fontFamily = this.selectedFont + ', monospace';
    });
  };
}
