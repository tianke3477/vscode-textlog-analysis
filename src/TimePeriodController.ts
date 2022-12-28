'use strict';

import * as moment from 'moment';
import * as vscode from 'vscode';
import { State } from './extension';
import TimePeriodCalculator = require('./TimePeriodCalculator');

class TimePeriodController {

    private _timeCalculator: TimePeriodCalculator;
    private _disposable: vscode.Disposable;
    private _statusBarItem: vscode.StatusBarItem;
    private _state:State;

    constructor(timeCalculator: TimePeriodCalculator,state:State) {
        this._timeCalculator = timeCalculator;
        this._state = state;

        // Create as needed
        if (!this._statusBarItem) {
            this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        }

        // subscribe to selection change and editor activation events
        const subscriptions: vscode.Disposable[] = [];
        vscode.window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);
        vscode.window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);

        // // update the counter for the current file
        // this.updateTimePeriod(state);

        // create a combined disposable from both event subscriptions
        this._disposable = vscode.Disposable.from(...subscriptions);
    }

    public dispose() {
        this._statusBarItem.dispose();
        this._disposable.dispose();
    }

    public updateTimePeriod(state:State) {
        this._state = state;
        // Get the current text editor
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this._statusBarItem.hide();
            return;
        }

        const doc = editor.document;

        // Only update status if an log file
        // if (doc.languageId === 'log') {
        if (state.highlighter===true) {

            this._statusBarItem.text = '';

            const startLineNumber = editor.selection.start.line;
            const endLineNumber = editor.selection.end.line;
            let timePeriod: moment.Duration;

            if (startLineNumber !== endLineNumber) {

                // Get the selections first and last non empty line
                const startLine: vscode.TextLine = doc.lineAt(startLineNumber);
                let endLine: vscode.TextLine;

                // If last line is not partially selected use last but first line
                if (editor.selection.end.character === 0) {
                    // Because startLineNumber !== endLineNumber, endLineNumber - 1 >= 0 holds
                    endLine = doc.lineAt(endLineNumber - 1);
                } else {
                    endLine = doc.lineAt(endLineNumber);
                }

                timePeriod = this._timeCalculator.getTimePeriod(startLine.text, endLine.text);
            }

            if (timePeriod !== undefined) {

                // Update the status bar
                this._statusBarItem.text = this._timeCalculator.convertToDisplayString(timePeriod);
                this._statusBarItem.show();

            } else {
                this._statusBarItem.hide();
            }

        } else {
            this._statusBarItem.hide();
        }
    }

    private _onEvent() {
        this.updateTimePeriod(this._state);
    }
}

export = TimePeriodController;
