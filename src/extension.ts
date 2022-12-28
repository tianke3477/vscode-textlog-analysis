import * as vscode from 'vscode';
import { FilterTreeViewProvider, FilterItem } from "./filterTreeViewProvider";
import { flattenFilterNode, cleanUpIconFiles, getActiveDocument, FilterNode } from "./utils";
import { moveUpOrDown, setShownOrHiden, importFilters, exportFilters, addFilter, editFilter, deleteFilter, refresFilterTreeView } from "./filterCommands";
import { SearchWebViewProvider } from "./searchWebViewProvider";
import { LargeFileSystemProvider } from './LargeFileSystemProvider';
import * as fs from 'fs';
import TimePeriodCalculator = require('./TimePeriodCalculator');
import TimePeriodController = require('./TimePeriodController');

//Extension storge position
let storageUri: vscode.Uri;

export type State = {
    filterRoot: FilterNode;
    filterTreeViewProvider: FilterTreeViewProvider;
    storageUri: vscode.Uri;
    searchWebviewProvider?: SearchWebViewProvider;
    highlighter: boolean;
    decorations: vscode.TextEditorDecorationType[];
    patternDecorations: vscode.TextEditorDecorationType[];
};
export function activate(context: vscode.ExtensionContext) {

    storageUri = context.globalStorageUri;
    cleanUpIconFiles(storageUri);
    //internal globals
    const root: FilterNode = {
        isGroup: true,
        isShown: true,
        id: 0,
        children: [],
        regex: new RegExp("vscode-textlog-analysis-regexp"),
        count: " .0"
    };
    //global variable so you can visit it everywhere
    const state: State = {
        filterRoot: root,
        filterTreeViewProvider: new FilterTreeViewProvider(root),
        storageUri,
        highlighter: true,
        decorations: [],
        patternDecorations:[],
    };

    let treeView = vscode.window.createTreeView("vscode-textlog-analysis-view", {
        treeDataProvider: state.filterTreeViewProvider,
        canSelectMany: true
    });

    context.subscriptions.push(vscode.commands.registerCommand(
        "vscode-textlog-analysis.exportAllFilters",
        () => exportFilters(state.filterRoot)));

    context.subscriptions.push(vscode.commands.registerCommand(
        "vscode-textlog-analysis.exportFilters",
        (filterTreeItem: vscode.TreeItem) => exportFilters(
            (<FilterItem>filterTreeItem).filterNode)));

    context.subscriptions.push(vscode.commands.registerCommand(
        "vscode-textlog-analysis.importAllFilters",
        (filterTreeItem: vscode.TreeItem) => importFilters(state, state.filterRoot)));

    context.subscriptions.push(vscode.commands.registerCommand(
        "vscode-textlog-analysis.importFilters",
        (filterTreeItem: vscode.TreeItem) => importFilters(state, (<FilterItem>filterTreeItem).filterNode)));


    context.subscriptions.push(vscode.commands.registerCommand(
        "vscode-textlog-analysis.addFilter",
        () => {
            addFilter(state);        
        }));

    context.subscriptions.push(vscode.commands.registerCommand(
        "vscode-textlog-analysis.editFilter",
        (filterTreeItem: vscode.TreeItem) => editFilter(state, <FilterItem>filterTreeItem)
    ));

    context.subscriptions.push(vscode.commands.registerCommand(
        "vscode-textlog-analysis.deleteFilter",
        (filterTreeItem: vscode.TreeItem) => deleteFilter(state, (<FilterItem>filterTreeItem).filterNode)
    ));

    context.subscriptions.push(vscode.commands.registerCommand(
        "vscode-textlog-analysis.deleteAllFilter",
        (filterTreeItem: vscode.TreeItem, filterTreeItem2: vscode.TreeItem) => deleteFilter(state, state.filterRoot)
    ));

    context.subscriptions.push(vscode.commands.registerCommand(
        "vscode-textlog-analysis.enableAllFilter",
        (filterTreeItem: vscode.TreeItem) => setShownOrHiden(true, state, state.filterRoot)
    ));
    context.subscriptions.push(vscode.commands.registerCommand(
        "vscode-textlog-analysis.enableFilter",
        (filterTreeItem: vscode.TreeItem) => setShownOrHiden(true, state, (<FilterItem>filterTreeItem).filterNode)
    ));
    context.subscriptions.push(vscode.commands.registerCommand(
        "vscode-textlog-analysis.disableAllFilter",
        (filterTreeItem: vscode.TreeItem) => setShownOrHiden(false, state, state.filterRoot)
    ));
    context.subscriptions.push(vscode.commands.registerCommand(
        "vscode-textlog-analysis.disableFilter",
        (filterTreeItem: vscode.TreeItem) => setShownOrHiden(false, state, (<FilterItem>filterTreeItem).filterNode)
    ));

    context.subscriptions.push(vscode.commands.registerCommand(
        "vscode-textlog-analysis.refresFilterTreeView",
        () => refresFilterTreeView(state)
    ));

    context.subscriptions.push(vscode.commands.registerCommand(
        "vscode-textlog-analysis.moveUp",
        () => moveUpOrDown(state, treeView, true)
    ));
    context.subscriptions.push(vscode.commands.registerCommand(
        "vscode-textlog-analysis.moveDown",
        () => moveUpOrDown(state, treeView, false)
    ));
    
    const provider = new SearchWebViewProvider(context.extensionUri);
    state.searchWebviewProvider = provider;

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('searchWebView', provider, {
            webviewOptions: {
                retainContextWhenHidden: true
            }
        }));


    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-textlog-analysis.searchWebView', () => {
            let doc: vscode.TextDocument | undefined = getActiveDocument();
            if (doc === undefined) {
                vscode.window.showErrorMessage("The VS Code limit plugin use large files, please use ctrl+c copy to a new tab to bypass this restriction, or click on the open large file menu to open the file");
                return;
            }
            doc = doc as vscode.TextDocument;
            var filters = flattenFilterNode(state.filterRoot);
            provider.webViewSearchFilters(doc, filters, state);
            //set regex matching count
            filters.forEach(f => {
                let filterNode = state.filterRoot.children.find(c => c.regex === f.regex);
                filterNode.count = " ." + f.count;
                console.log(filterNode.regex + ":" + filterNode.count);
            });
            state.filterTreeViewProvider.refresh();
        }));

    // create a new time calculator and controller
    const timeCalculator = new TimePeriodCalculator();
    const timeController = new TimePeriodController(timeCalculator, state);
    context.subscriptions.push(timeController);

    context.subscriptions.push(
        vscode.commands.registerCommand("vscode-textlog-analysis.highlighter",
            () => {
                if (state.highlighter) {
                    state.highlighter = false;
                }
                else {
                    state.highlighter = true;
                }
                timeController.updateTimePeriod(state);
            }
        ));

    const lfsp = new LargeFileSystemProvider(context.globalState);
    context.subscriptions.push(vscode.workspace.registerFileSystemProvider('lfsp', lfsp, { isReadonly: true, isCaseSensitive: true }));

    context.subscriptions.push(vscode.commands.registerCommand('vscode-textlog-analysis.openLargeFile', async () => {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        return vscode.window.showOpenDialog({ canSelectFiles: true, canSelectFolders: false, canSelectMany: false, openLabel: 'Select large file to open...' }).then(
            async (uris: vscode.Uri[] | undefined) => {
                if (uris) {
                    uris.forEach(async (uri) => {
                        //get metat of file
                        const fileStat = fs.statSync(uri.fsPath);
                        console.log(`open large file with size=${fileStat.size} from URI=${uri.toString()}`);
                        let lfsUri = uri.with({ scheme: 'lfsp' });
                        lfsp.markLimitSize(lfsUri, true, undefined);
                        vscode.workspace.openTextDocument(lfsUri).then((value) => {

                            vscode.window.showTextDocument(value, { preview: false });
                        });
                    });
                }
            }
        );
    }));

    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((doc) => {
        lfsp.onDidCloseTextDocument(doc.uri);
    }));

    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 10);
    statusBarItem.command = 'vscode-textlog-analysis.debug';
    statusBarItem.text = 'Debug';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);


    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-textlog-analysis.debug', () => {
            console.log("start debug----------------------------------------------");

            


            console.log("end debug----------------------------------------------");
        })
    );
}

// this method is called when your extension is deactivated
export function deactivate() {

}
