import * as vscode from 'vscode';
import { FilterNode } from "./utils";

//provides filters as tree items to be displayed on the sidebar
export class FilterTreeViewProvider implements vscode.TreeDataProvider<FilterItem> {

    constructor(private root:FilterNode) {}

    getTreeItem(element: FilterItem): vscode.TreeItem {
        return element;
    }
    getChildren(element?: FilterItem): FilterItem[] {
        if (element) {
            var filterNode=element.filterNode;
            if(!filterNode.children||filterNode.children.length===0){
                return [];
            }else{
                return filterNode.children.map(child=>new FilterItem(child));
            }
          
        } else { // root
            if(this.root.children){
                return this.root.children.map(child=>new FilterItem(child));
            }else{
                return [];
            }           
        }
    }

    private _onDidChangeTreeData: vscode.EventEmitter<FilterItem | undefined> = new vscode.EventEmitter<FilterItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<FilterItem | undefined> = this._onDidChangeTreeData.event;
    
    refresh(): void {
        console.log("in refresh");
        this._onDidChangeTreeData.fire(undefined);
    }
}

//represents a filter as one row in the sidebar
export class FilterItem extends vscode.TreeItem {

    constructor(
        public filterNode: FilterNode) {
        super(filterNode.regex!.toString());
       if(this.filterNode.isGroup){
           this.collapsibleState=vscode.TreeItemCollapsibleState.Expanded;

       }else{
        this.collapsibleState=vscode.TreeItemCollapsibleState.None;
       }
        
        this.label = filterNode.regex!.source;
        // this.iconPath = filterNode.iconPath;
        this.iconPath = (filterNode.iconPath! as vscode.Uri).fsPath;
        if(filterNode.isGroup){
            this.contextValue='group';
        }else{
            if (filterNode.isShown) {
                this.contextValue='shown';
            } else {
                this.contextValue='hiden';
            }
        }
        this.description = filterNode.count.toString();          
    }

   contextValue: 'shown' | 'hiden'|'group' ;
}

