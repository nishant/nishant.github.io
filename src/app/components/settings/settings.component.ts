import { Component, OnInit } from '@angular/core';
import { DiffEditorModel } from 'ngx-monaco-editor-v2';
import * as monaco from 'monaco-editor';
import { SettingsService } from './settings.service';


@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit
{
  editorOptions = {
    theme: 'vs-dark',
    language: 'json',
    minimap: { enabled: false }
  };

  code = localStorage.getItem('nishant.github.io-config') ?? '[]';

  constructor(private settingService: SettingsService) {

  }

  ngOnInit(): void {
    this.settingService.onClose.subscribe(x => {
      if (x === 'closed') { this.settingService.config.next(this.code) }
    });
  }

  prettify = (obj: unknown) => JSON.stringify(obj, null, '\t');
}
