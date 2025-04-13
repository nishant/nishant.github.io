import { Component, Input, OnInit } from '@angular/core';
import { setBlockType } from 'prosemirror-commands';
import { EditorState, Plugin, PluginKey, Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { isNodeActive } from 'ngx-editor/helpers';
import { Editor } from 'ngx-editor';
import { NotesService } from '../notes.service';

@Component({
  selector: 'app-custom-menu',
  templateUrl: './custom-menu.component.html',
  styleUrls: ['./custom-menu.component.scss']
})
export class CustomMenuComponent implements OnInit {
  @Input() editor?: Editor;
  isActive = false;
  isDisabled = false;

  constructor(private notesService: NotesService) { }
  onClick(e: MouseEvent): void {
    e.preventDefault();
    const { state, dispatch } = this.editor!.view;
    this.execute(state, dispatch);
  }

  execute(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
    this.notesService.action.next('save');
    const { schema } = state;

    return this.isActive
      ? setBlockType(schema.nodes['paragraph'])(state, dispatch)
      : setBlockType(schema.nodes['save'])(state, dispatch);
  }

  update = (view: EditorView) => {
    const { state } = view;
    const { schema } = state;
    this.isActive = isNodeActive(state, schema.nodes['save']);
    // this.isDisabled = !this.execute(state, undefined); // returns true if executable
  };

  ngOnInit(): void {
    const plugin = new Plugin({
      key: new PluginKey(`custom-menu-save`),
      view: () => {
        return {
          update: this.update,
        };
      },
    });

    this.editor?.registerPlugin(plugin);
  }
}
