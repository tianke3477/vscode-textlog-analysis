import * as vscode from "vscode";
import { State } from "./extension";
import { reconstructTree, generateSvgUri, writeSvgContent, produceColor, FilterNode, genearteSvgIdStr } from "./utils";
import { FilterItem } from "./filterTreeViewProvider";

let iconNumber: number = 0;

export function addFilter(state: State, treeItem?: FilterItem) {
    vscode.window.showInputBox({
        prompt: "Type a regex to filter",
        ignoreFocusOut: false
    }).then(regexStr => {
        if (regexStr === undefined) {
            return;
        }
        var groupNode;
        if (!treeItem) {
            groupNode = state.filterRoot;
        } else {
            groupNode = treeItem.filterNode;
        }

        if (!groupNode.children) {
            groupNode.children = [];
        }

        const id = groupNode.children!.length;
        let filterNode: FilterNode = {
            id: id,
            regex: new RegExp(regexStr),
            color: produceColor(id),
            isShown: true,
            isGroup: false,
            parent: groupNode,
            count: " .0"

        };
        filterNode.iconPath = generateSvgUri(state.storageUri, genearteSvgIdStr(filterNode), true),
            groupNode.children!.push(filterNode);

        writeSvgContent(filterNode, state.filterTreeViewProvider);
        refresFilterTreeView(state);
        vscode.commands.executeCommand("vscode-textlog-analysis.searchWebView");
    });
}

export function editFilter(state: State, treeItem: FilterItem) {
    var filterNode = treeItem.filterNode;
    var oldStr = filterNode.regex?.source;
    vscode.window.showInputBox({
        prompt: "Type a new regex",
        value: oldStr,
        ignoreFocusOut: false
    }).then(regexStr => {
        if (regexStr === undefined) {
            return;
        }
        filterNode.regex = new RegExp(regexStr);
        refresFilterTreeView(state);
    });
}
export function deleteFilter(state: State, filterNode: FilterNode) {
    if (!filterNode.parent) {
        state.filterRoot.children = [];
    } else {
        var parent = filterNode.parent;
        var index = parent.children?.findIndex(child => (child.id === filterNode.id));

        parent?.children?.splice(index!, 1);
    }
    refresFilterTreeView(state);
}
export function moveUpOrDown(state: State, treeView: vscode.TreeView<FilterItem>, isUp: boolean) {
    var filters = treeView.selection;
    if (!filters || filters.length < 0) {
        return;
    }

    var filterNode = filters[0].filterNode;
    var parent = filterNode.parent;
    if (parent) {
        var index = parent.children?.findIndex(child => (child.id === filterNode.id));
        if (!index || index <= 0) {
            return;
        }
        var p = isUp ? index - 1 : index + 1;
        if (p < 0 || p >= parent.children!.length) {
            return;
        }
        parent.children![index] = parent.children?.splice(p, 1, parent.children[index])[0] as FilterNode;
    }
    refresFilterTreeView(state);
}

export function moveDown(state: State, treeView: vscode.TreeView<FilterItem>) {
    var filters = treeView.selection;
    if (!filters || filters.length < 0) {
        return;
    }
    var filterNode = filters[0].filterNode;
    var parent = filterNode.parent;
    if (parent) {
        var index = parent.children?.findIndex(child => (child.id === filterNode.id));
        if (!index || index <= 0) {
            return;
        }
        parent.children![index] = parent.children?.splice(index - 1, 1, parent.children[index])[0] as FilterNode;
    }
    refresFilterTreeView(state);
}

export function exportFilters(parenNode: FilterNode) {
    // console.log("export filters:" + parenNode.children);
    const content = JSON.stringify(parenNode, (key, value) => {
        if (key === "regex") {
            return value.source;
        }
        if (key === "iconPath") {
            return undefined;
        }
        if (key === "parent") {
            return undefined;
        }
        if (key === "parent") {
            return undefined;
        }
        return value;

    });
    // console.log("content:" + content);
    vscode.workspace.openTextDocument({
        content: content,
        language: "json"
    }).then((doc) => {
        vscode.window.showTextDocument(doc).then(
            () => { },
            () => { }
        );
    }
    );
}

export function importFilters(state: State, parenNode: FilterNode) {
    vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectMany: false,
        filters: {
            "json": ["json"]
        }
    }).then(uriArr => {
        if (!uriArr) {
            return;
        }
        return vscode.workspace.openTextDocument(uriArr[0]);
    }).then(textDocument => {
        const text = textDocument!.getText();
        const parsed = JSON.parse(text, (key, value) => {
            if (key === "regex") {
                return new RegExp(value);
            }
            return value;
        });
        if (typeof parsed !== "object") {
            return;
        }
        const filterNode = parsed as FilterNode;

        reconstructTree(filterNode, state.storageUri);
        //filterNode doesn't belong to any group
        if (filterNode.regex?.source === "vscode-textlog-analysis-regexp") {
            filterNode.children?.forEach((child) => {
                child.id = parenNode.children?.length;
                parenNode.children?.push(child);
                child.parent = parenNode;

            });

        } else {
            filterNode.parent = parenNode;
            filterNode.id = parenNode.children!.length;
            parenNode.children!.push(filterNode);

        }
        refresFilterTreeView(state);
    });
}

export function setShownOrHiden(isShown: boolean, state: State, filterNode: FilterNode) {
    if (filterNode.isGroup) {
        var children = filterNode.children;
        if (children) {
            children.forEach((son) => {
                setShownOrHiden(isShown, state, son);
            });
        }
    } else {

        filterNode.isShown = isShown;
        filterNode.iconPath = generateSvgUri(state.storageUri, genearteSvgIdStr(filterNode), filterNode.isShown!);
        writeSvgContent(filterNode!, state.filterTreeViewProvider);
    }
}

export function refresFilterTreeView(state: State) {
    state.filterTreeViewProvider.refresh();

}