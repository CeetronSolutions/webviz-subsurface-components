/** This code is copied directly from
 * https://github.com/anders-kiaer/webviz-subsurface-components/blob/dynamic_tree/src/lib/components/DynamicTree/group_tree.js
 *  This needs to be refactored to develop further
 *
 * 9 july 2021: refactored to use new format.
 */
import * as d3 from "d3";

import { cloneDeep } from "lodash";

import {
    DatedTree,
    DatedTrees,
    EdgeMetadata,
    NodeMetadata,
    RecursiveTreeNode,
} from "../types";

/* eslint camelcase: "off" */
/* eslint array-callback-return: "off" */
/* eslint no-return-assign: "off" */
/* eslint no-use-before-define: "off" */
/* eslint no-useless-concat: "off" */
/* Fix this lint when rewriting the whole file */

interface RecursiveTreeNodeAndRenderInfo extends RecursiveTreeNode {
    customId: string;
    x0?: number;
    y0?: number;
    isVisible: boolean;
}

/**
 * Group tree visualization. Creates an _svg, and appends to the assigned element.
 * Draws the tree provided as tree_data

 * @constructor
 */
export default class GroupTree {
    _treeWidth: number;
    _data: any;

    // svg element as d3 selection
    _svgElementSelection: d3.Selection<SVGGElement, any, null, undefined>;
    _textPaths: d3.Selection<SVGGElement, any, null, undefined>;
    _renderTree: d3.TreeLayout<any>;

    _currentFlowRate: string;
    _currentNodeInfo: string;
    _currentDateTime: string;

    // Map with node/edge key and corresponding label and unit
    _nodeMetadataMap: Map<string, { label: string; unit?: string }>;
    _edgeLabelAndUnitMap: Map<string, { label: string; unit?: string }>;

    _pathScaleMap: Map<string, d3.ScaleLinear<number, number, never>>;

    // Fixed attributes
    _transitionTime = 200;

    /**
     *
     * @param dom_element_id
     * @param {group-tree-data} tree_data
     * @param defaultFlowRate
     */
    constructor(
        renderDivElement: HTMLDivElement,
        datedTrees: DatedTrees,
        defaultFlowRate: string,
        defaultNodeInfo: string,
        currentDateTime: string,
        edgeMetadataList: EdgeMetadata[],
        nodeMetadataList: NodeMetadata[]
    ) {
        // Represent possible empty data by single empty node.
        const emptyDatedTree: DatedTree = {
            dates: [""],
            tree: {
                node_label: "NO DATA",
                edge_label: "NO DATA",
                node_data: {},
                edge_data: {},
                node_type: "Well",
                children: [],
            },
        };
        const _datedTrees: DatedTrees =
            datedTrees.length !== 0 ? cloneDeep(datedTrees) : [emptyDatedTree];

        // Map from node/edge key to label and unit
        this._nodeMetadataMap = new Map();
        this._edgeLabelAndUnitMap = new Map();
        nodeMetadataList.forEach((elm) => {
            this._nodeMetadataMap.set(elm.key, {
                label: elm.label,
                unit: elm.unit,
            });
        });
        edgeMetadataList.forEach((elm) => {
            this._edgeLabelAndUnitMap.set(elm.key, {
                label: elm.label,
                unit: elm.unit,
            });
        });

        this._currentFlowRate = defaultFlowRate;
        this._currentNodeInfo = defaultNodeInfo;
        this._currentDateTime = currentDateTime;

        // Retrieve edge values from nodes for each dated tree
        type EdgeKeyAndDatedValuesMap = { [key: string]: number[][] };
        const edgeAndDatedValues: EdgeKeyAndDatedValuesMap = {};
        for (const datedTree of _datedTrees) {
            const tree = datedTree.tree;

            // Traverse the recursive node tree
            // - Add edge values at each node level into map of edge key and values
            d3.hierarchy(tree, (d) => d.children).each((node) => {
                Object.entries(node.data.edge_data).forEach(([key, values]) => {
                    if (!(key in edgeAndDatedValues)) {
                        edgeAndDatedValues[key] = [];
                    }
                    edgeAndDatedValues[key].push(values);
                });
            });
        }

        // Path scale for each edge key
        this._pathScaleMap = new Map();
        for (const [key, values] of Object.entries(edgeAndDatedValues)) {
            const extent = [0, d3.max(values.flat()) ?? 0];
            this._pathScaleMap.set(
                key,
                d3.scaleLinear().domain(extent).range([2, 100])
            );
        }

        const margin = {
            top: 10,
            right: 90,
            bottom: 30,
            left: 90,
        };
        const renderDivWidth = renderDivElement.getBoundingClientRect().width;
        const renderDivHeight = renderDivElement.getBoundingClientRect().height;

        const minHeight = 500;
        const treeHeight =
            Math.max(minHeight, renderDivHeight) - margin.top - margin.bottom;
        this._treeWidth = renderDivWidth - margin.left - margin.right;

        // Clear possible existing svg's.
        d3.select(renderDivElement).selectAll("svg").remove();

        this._svgElementSelection = d3
            .select(renderDivElement)
            .append("svg")
            .attr("width", renderDivWidth) // TODO: Remove this line?
            .attr("height", treeHeight + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        this._textPaths = this._svgElementSelection.append("g");

        this._renderTree = d3.tree().size([treeHeight, this._treeWidth]);

        this._data = GroupTree.initHierarchies(_datedTrees, treeHeight);

        this._currentTree = {};

        this.update(currentDateTime);
    }

    /**
     * Initialize all trees in the group tree data structure, once for the entire visualization.
     *
     */
    static initHierarchies(
        datedTrees: DatedTrees,
        treeHeight: number
    ): {
        dates: string[];
        tree: d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>;
    }[] {
        let clonedDatedTrees = cloneDeep(datedTrees);

        // Generate the node-id used to match in the enter, update and exit selections
        const createNodeId = (node: d3.HierarchyNode<RecursiveTreeNode>) => {
            return node.parent === null
                ? node.data.node_label
                : `${node.parent.id}_${node.data.node_label}`;
        };

        const output: {
            dates: string[];
            tree: d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>;
        }[] = [];

        // For each dated tree, generate a d3 hierarchy with additional render info
        for (let datedTree of clonedDatedTrees) {
            // Convert from:
            // RecursiveTreeNode -> d3.HierarchyNode<RecursiveTreeNode>
            const root = d3.hierarchy(datedTree.tree, (node) => node.children);

            // Convert from:
            // d3.HierarchyNode<RecursiveTreeNode> -> d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>
            const recursiveNodesWithRenderInfo = root
                .descendants()
                .map((node) => {
                    const customId = createNodeId(node);
                    const nodeWithRenderInfo: RecursiveTreeNodeAndRenderInfo = {
                        customId: customId,
                        isVisible: false,
                        ...node.data,
                    };
                    return d3.hierarchy(nodeWithRenderInfo);
                });

            output.push({
                dates: datedTree.dates,
                tree: recursiveNodesWithRenderInfo,
            });
        }
        return output;
    }

    /**
     * @returns {*} -The initialized hierarchical group tree data structure
     */
    get data() {
        return this._data;
    }

    /**
     * Set the flowrate and update display of all edges accordingly.
     *
     * @param flowrate - key identifying the flowrate of the incoming edge
     */
    set flowrate(flowrate) {
        this._currentFlowRate = flowrate;

        const current_tree_index = this._data.findIndex((e) => {
            return e.dates.includes(this._currentDateTime);
        });

        const date_index = this._data[current_tree_index].dates.indexOf(
            this._currentDateTime
        );

        this._svgElementSelection
            .selectAll("path.link")
            .transition()
            .duration(this._transitionTime)
            .attr(
                "class",
                () => `link grouptree_link grouptree_link__${flowrate}`
            )
            .style("stroke-width", (d) =>
                this.getEdgeStrokeWidth(
                    flowrate,
                    d.data.edge_data[flowrate]?.[date_index] ?? 0
                )
            )
            .style("stroke-dasharray", (d) => {
                return (d.data.edge_data[flowrate]?.[date_index] ?? 0) > 0
                    ? "none"
                    : "5,5";
            });
    }

    get flowrate() {
        return this._currentFlowRate;
    }

    set nodeinfo(nodeinfo) {
        this._currentNodeInfo = nodeinfo;

        const current_tree_index = this._data.findIndex((e) => {
            return e.dates.includes(this._currentDateTime);
        });

        const date_index = this._data[current_tree_index].dates.indexOf(
            this._currentDateTime
        );

        this._svgElementSelection
            .selectAll(".grouptree__pressurelabel")
            .text(
                (d) =>
                    d.data.node_data?.[nodeinfo]?.[date_index]?.toFixed(0) ??
                    "NA"
            );

        this._svgElementSelection
            .selectAll(".grouptree__pressureunit")
            .text(() => {
                const t = this._propertyToLabelMap.get(nodeinfo) ?? ["", ""];
                return t[1];
            });
    }

    get nodeinfo() {
        return this._currentNodeInfo;
    }

    getEdgeStrokeWidth(key, val) {
        const normalized =
            this._pathScaleMap[key] !== undefined
                ? this._pathScaleMap[key](val ?? 0)
                : 2;
        return `${normalized}px`;
    }

    /**
     * Sets the state of the current tree, and updates the tree visualization accordingly.
     * The state is changed either due to a branch open/close, or that the tree is entirely changed
     * when moving back and fourth in time.
     *
     * @param root
     */
    update(newDateTime: string) {
        const self = this;

        self._currentDateTime = newDateTime;

        const new_tree_index = self._data.findIndex((e) => {
            return e.dates.includes(newDateTime);
        });

        const root = self._data[new_tree_index];

        const date_index = root.dates.indexOf(self._currentDateTime);

        /**
         * Assigns y coordinates to all tree nodes in the rendered tree.
         * @param t - a rendered tree
         * @param {int} width - the
         * @returns a rendered tree width coordinates for all nodes.
         */
        function growNewTree(t, width) {
            t.descendants().forEach((d) => {
                d.y = (d.depth * width) / (t.height + 1);
            });

            return t;
        }

        function doPostUpdateOperations(tree) {
            setEndPositions(tree.descendants());
            setNodeVisibility(tree.descendants(), true);
            return tree;
        }

        function findClosestVisibleParent(d) {
            let c = d;
            while (c.parent && !c.isvisible) {
                c = c.parent;
            }
            return c;
        }

        function getClosestVisibleParentStartCoordinates(d) {
            const p = findClosestVisibleParent(d);
            return { x: p.x0 ?? 0, y: p.y0 ?? 0 };
        }

        function getClosestVisibleParentEndCoordinates(d) {
            const p = findClosestVisibleParent(d);
            return { x: p.x, y: p.y };
        }

        /**
         * Implicitly alter the state of a node, by hiding its children
         * @param node
         */
        function toggleBranch(node) {
            if (node.children) {
                node._children = node.children;
                node.children = null;
            } else {
                node.children = node._children;
                node._children = null;
            }

            self.update(self._currentDateTime);
        }

        /**
         * Toggles visibility of a node. This state determines if the node, and its children
         * @param nodes
         * @param visibility
         */
        function setNodeVisibility(nodes, visibility) {
            nodes.forEach((d) => {
                d.isvisible = visibility;
            });
        }

        /**
         * After node translation transition, save end position
         * @param nodes
         */
        function setEndPositions(nodes) {
            nodes.forEach((d) => {
                d.x0 = d.x;
                d.y0 = d.y;
            });
        }

        function getToolTipText(data, date_index) {
            if (data === undefined || date_index === undefined) {
                return "";
            }

            const propNames = Object.keys(data);
            let text = "";
            propNames.forEach(function (s) {
                const t = self._propertyToLabelMap.get(s) ?? [s, ""];
                const pre = t[0];
                const unit = t[1];
                text +=
                    pre +
                    " " +
                    (data[s]?.[date_index]?.toFixed(0) ?? "") +
                    " " +
                    unit +
                    "\n";
            });
            return text;
        }

        /**
         * Clone old node start position to new node start position.
         * Clone new node end position to old node end position.
         * Clone old visibility to new.
         *
         * @param newRoot
         * @param oldRoot
         */
        function cloneExistingNodeStates(newRoot, oldRoot) {
            if (Object.keys(oldRoot).length > 0) {
                oldRoot.descendants().forEach((oldNode) => {
                    newRoot.descendants().forEach((newNode) => {
                        if (oldNode.id === newNode.id) {
                            newNode.x0 = oldNode.x0;
                            newNode.y0 = oldNode.y0;

                            oldNode.x = newNode.x;
                            oldNode.y = newNode.y;

                            newNode.isvisible = oldNode.isvisible;
                        }
                    });
                });
            }
            return newRoot;
        }

        /**
         * Merge the existing tree, with nodes from a new tree.
         * New nodes fold out from the closest visible parent.
         * Old nodes are removed.
         *
         * @param nodes - list of nodes in a tree
         */
        function updateNodes(nodes, nodeinfo) {
            const node = self._svgElementSelection
                .selectAll("g.node")
                .data(nodes, (d) => d.id);

            const nodeEnter = node
                .enter()
                .append("g")
                .attr("class", "node")
                .attr("id", (d) => d.id)
                .attr("transform", (d) => {
                    const c = getClosestVisibleParentStartCoordinates(d);
                    return `translate(${c.y},${c.x})`;
                })
                .on("click", toggleBranch);

            nodeEnter
                .append("circle")
                .attr("id", (d) => d.id)
                .attr("r", 6)
                .transition()
                .duration(self._transitionTime)
                .attr("x", (d) => d.x)
                .attr("y", (d) => d.y);

            nodeEnter
                .append("text")
                .attr("class", "grouptree__nodelabel")
                .attr("dy", ".35em")
                .style("fill-opacity", 1)
                .attr("x", (d) => (d.children || d._children ? -21 : 21))
                .attr("text-anchor", (d) =>
                    d.children || d._children ? "end" : "start"
                )
                .text((d) => d.data.node_label);

            nodeEnter
                .append("text")
                .attr("class", "grouptree__pressurelabel")
                .attr("x", 0)
                .attr("dy", "-.05em")
                .attr("text-anchor", "middle")
                .text(
                    (d) =>
                        d.data.node_data[nodeinfo]?.[date_index]?.toFixed(0) ??
                        "NA"
                );

            nodeEnter
                .append("text")
                .attr("class", "grouptree__pressureunit")
                .attr("x", 0)
                .attr("dy", ".04em")
                .attr("dominant-baseline", "text-before-edge")
                .attr("text-anchor", "middle")
                .text(() => {
                    const t = self._propertyToLabelMap.get(nodeinfo) ?? [
                        "",
                        "",
                    ];
                    return t[1];
                });

            nodeEnter
                .append("title")
                .text((d) => getToolTipText(d.data.node_data, date_index));

            const nodeUpdate = nodeEnter.merge(node);

            // Nodes from earlier exit selection may reenter if transition is interupted. Restore state.
            nodeUpdate
                .filter(".exiting")
                .interrupt()
                .classed("exiting", false)
                .attr("opacity", 1);

            nodeUpdate
                .select("text.grouptree__pressurelabel")
                .text(
                    (d) =>
                        d.data.node_data[nodeinfo]?.[date_index]?.toFixed(0) ??
                        "NA"
                );

            nodeUpdate
                .transition()
                .duration(self._transitionTime)
                .attr("transform", (d) => `translate(${d.y},${d.x})`);

            nodeUpdate
                .select("circle")
                .attr(
                    "class",
                    (d) =>
                        `${"grouptree__node" + " "}${
                            d.children || d._children
                                ? "grouptree__node--withchildren"
                                : "grouptree__node"
                        }`
                )
                .transition()
                .duration(self._transitionTime)
                .attr("r", 15);

            nodeUpdate
                .select("title")
                .text((d) => getToolTipText(d.data.node_data, date_index));

            node.exit()
                .classed("exiting", true)
                .attr("opacity", 1)
                .transition()
                .duration(self._transitionTime)
                .attr("opacity", 1e-6)
                .attr("transform", (d) => {
                    d.isvisible = false;
                    const c = getClosestVisibleParentEndCoordinates(d);
                    return `translate(${c.y},${c.x})`;
                })
                .remove();
        }

        /**
         * Draw new edges, and update existing ones.
         *
         * @param edges -list of nodes in a tree
         * @param flowrate - key identifying the flowrate of the incoming edge
         */
        function updateEdges(edges, flowrate) {
            const link = self._svgElementSelection
                .selectAll("path.link")
                .data(edges, (d) => d.id);

            const linkEnter = link
                .enter()
                .insert("path", "g")
                .attr("id", (d) => `path ${d.id}`)
                .attr("d", (d) => {
                    const c = getClosestVisibleParentStartCoordinates(d);
                    return diagonal(c, c);
                });

            linkEnter
                .append("title")
                .text((d) => getToolTipText(d.data.edge_data, date_index));

            const linkUpdate = linkEnter.merge(link);

            linkUpdate
                .attr(
                    "class",
                    () => `link grouptree_link grouptree_link__${flowrate}`
                )
                .transition()
                .duration(self._transitionTime)
                .attr("d", (d) => diagonal(d, d.parent))
                .style("stroke-width", (d) =>
                    self.getEdgeStrokeWidth(
                        flowrate,
                        d.data.edge_data[flowrate]?.[date_index] ?? 0
                    )
                )
                .style("stroke-dasharray", (d) => {
                    return (d.data.edge_data[flowrate]?.[date_index] ?? 0) > 0
                        ? "none"
                        : "5,5";
                });

            linkUpdate
                .select("title")
                .text((d) => getToolTipText(d.data.edge_data, date_index));

            link.exit()
                .transition()
                .duration(self._transitionTime)
                .attr("d", (d) => {
                    d.isvisible = false;
                    const c = getClosestVisibleParentEndCoordinates(d);
                    return diagonal(c, c);
                })
                .remove();

            /**
             * Create the curve definition for the edge between node s and node d.
             * @param s - source node
             * @param d - destination node
             */
            function diagonal(s, d) {
                return `M ${d.y} ${d.x}
                 C ${(d.y + s.y) / 2} ${d.x},
                   ${(d.y + s.y) / 2} ${s.x},
                   ${s.y} ${s.x}`;
            }
        }

        /**
         * Add new and update existing texts/textpaths on edges.
         *
         * @param edges - list of nodes in a tree
         */
        function updateEdgeTexts(edges) {
            const textpath = self._textPaths
                .selectAll(".edge_info_text")
                .data(edges, (d) => d.id);

            const enter = textpath
                .enter()
                .insert("text")
                .attr("dominant-baseline", "central")
                .attr("text-anchor", "middle")
                .append("textPath")
                .attr("class", "edge_info_text")
                .attr("startOffset", "50%")
                .attr("xlink:href", (d) => `#path ${d.id}`);

            enter
                .merge(textpath)
                .attr("fill-opacity", 1e-6)
                .transition()
                .duration(self._transitionTime)
                .attr("fill-opacity", 1)
                .text((d) => d.data.edge_label);

            textpath.exit().remove();
        }

        const newTree = cloneExistingNodeStates(
            growNewTree(this._renderTree(root.tree), this._width),
            this._currentTree
        );

        // execute visualization operations on enter, update and exit selections
        updateNodes(newTree.descendants(), this.nodeinfo);
        updateEdges(newTree.descendants().slice(1), this.flowrate);
        updateEdgeTexts(newTree.descendants().slice(1));

        // save the state of the now current tree, before next update
        this._currentTree = doPostUpdateOperations(newTree);
    }
}
