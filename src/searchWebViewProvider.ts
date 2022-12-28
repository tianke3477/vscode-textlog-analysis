import * as vscode from 'vscode';
import { State } from './extension';
import { ResultItem, searchFilters } from './searchCommands';
import { Filter } from "./utils";
export class SearchWebViewProvider implements vscode.WebviewViewProvider {

	public static readonly viewType = 'searchWebView';
	private _view?: vscode.WebviewView;
	private _results?: ResultItem[];
	private _doc?: vscode.TextDocument;
	private _readCache: boolean = true;

	constructor(
		private readonly _extensionUri: vscode.Uri,
	) { }

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {

		console.log("resolveWebviewView");
		this._view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				this._extensionUri
			]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.type) {
				case 'jump':
					{
						this.jump(data.value);
						break;
					}
			}
		});
	}
	private _getHtmlForWebview(webview: vscode.Webview) {
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'js', 'main.js'));
		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">				
				<meta name="viewport" content="width=device-width, initial-scale=1.0">				
				<title>textlog analysis</title>
				<style>				
					.container{
						font-family:-moz-fixed;
						white-space:pre;
						// margin:4px;
						font-size:14px;
						top: 0; 
						width: 100%; 
					} 

					body.vscode-light .linenumber{
						color: black;
					}
					body.vscode-dark .linenumber{
						color: white;
					}
					body.vscode-high-contrast .linenumber{
						color: red;
					}
				
					body.vscode-light {
						background: white;
    					color: black;
					--color: rgb(19, 1, 1);
					--background-color:white;
					}
					body.vscode-dark {
						background: #252526;
    					color: white;
					--color: rgb(248, 244, 244);
					--background-color:rgb(24, 2, 2);
					}
					body.vscode-high-contrast {
						background: white;
    					color: red;
					--color: rgb(19, 1, 1);
					--background-color:rgb(231, 224, 224);
					}					
				</style>			       
			</head>
			<body>				
				<div id="container" class="container"></div>
				<script  src="${scriptUri}"></script>
			</body>
			</html>`;
	}
	public webViewSearchFilters(doc: vscode.TextDocument | undefined, filters: Filter[],state:State) {

		// remove old decorations from all the text editor using the given decorationType
		state.decorations.forEach(decorationType => decorationType.dispose());
		state.decorations = [];

		// console.log("webViewSearchFilters");
		// console.log("fiters:  " + filters);
		this._doc = doc;

		this._results = searchFilters(doc, filters);
		// console.log("results: " + this._results);

		if (typeof this._results === undefined) {
			// console.log("typeof this._results: " + typeof this._results);
			return;
		}
		this.viewResult(state);
	}

	public viewResult(state:State) {

		vscode.commands.executeCommand("workbench.view.extension.searchWebViewContainer").then(() => {
			// console.log("Webview up！");

			if (this._view) {
				this._view.show(false);
				// console.log("viewResult");
				this._view.webview.postMessage({ type: 'viewResult', value: this._results });

				let editor = vscode.window.activeTextEditor;
				for (var i = 0; i < this._results!.length; i++) {
					var r = this._results![i];
					var docorationType = vscode.window.createTextEditorDecorationType({
						// backgroundColor: `${r.color}`,
                        // isWholeLine: true,
						color: `${r.color}`,
						fontWeight: "bold"
						//	gutterIconPath:`\$(chevron-right)`
					});
					//store the decoration type for future removal
					state.decorations.push(docorationType);
					editor!.setDecorations(docorationType, [new vscode.Range(r.lineBegin, r.columnBegin, r.lineEnd, r.columnEnd)]);

				}

			}
		}

		);

	}

	public jump(value: any) {
		let line: number = value.line;
		let columnEnd: number = value.columnEnd;
		// console.log("line " + line.toString());
		// console.log("columnEn " + columnEnd.toString());
		// Make sure document is showing
		if (!this._doc) {
			return;
		}

		vscode.window.showTextDocument(this._doc).then(
			() => { },
			() => { }
		);
		if (typeof vscode.window.activeTextEditor !== "undefined") {
			console.log(vscode.window.activeTextEditor);
			// Make the result visible
			vscode.window.activeTextEditor.revealRange(new vscode.Range(line, 0, line, columnEnd));

			// Select the result
			vscode.window.activeTextEditor.selection = new vscode.Selection(line, 0, line, columnEnd);
		}

	}

}