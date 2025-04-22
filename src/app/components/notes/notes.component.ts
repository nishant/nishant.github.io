import { Component, OnDestroy, OnInit } from '@angular/core';
import { Editor, Toolbar, Validators, NgxEditorModule } from 'ngx-editor';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NotesService } from './notes.service';
import { Subscription } from 'rxjs';
import { CustomMenuComponent } from './custom-menu/custom-menu.component';

@Component({
    selector: 'app-notes',
    templateUrl: './notes.component.html',
    styleUrls: ['./notes.component.scss'],
    standalone: true,
    imports: [ReactiveFormsModule, NgxEditorModule, CustomMenuComponent]
})
export class NotesComponent implements OnInit, OnDestroy {
  editor: Editor;
  toolbar: Toolbar = [
    ['bold', 'italic'],
    ['underline', 'strike'],
    ['code', 'blockquote'],
    ['ordered_list', 'bullet_list'],
    [{ heading: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] }],
    ['link', 'image'],
    ['text_color', 'background_color'],
    ['align_left', 'align_center', 'align_right', 'align_justify'],
  ];

  form = new FormGroup({
    editorContent: new FormControl({ value: '', disabled: false }, Validators.required()),
  });

  action$: Subscription;

  constructor(private notesService: NotesService) {
    this.editor = new Editor({ keyboardShortcuts: true });
    this.action$ = this.notesService.action.subscribe(action => {
      if (action === 'save') { this.saveContent(); }
    });
  }

  ngOnInit(): void {
    this.setContent();
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
    this.notesService.action.next('');
    this.action$.unsubscribe();
  }

  get content(): string {
    return <string> this.form.get('editorContent')?.value;
  }

  setContent = (): void => {
    const savedContent = localStorage.getItem('nishant.github.io-notes') ?? '';
    this.editor?.setContent(savedContent);
    this.form.get('editorContent')?.setValue(savedContent);
  };

  saveContent = (): void => localStorage.setItem('nishant.github.io-notes', this.content);
}
