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

interface Position {
    x: number;
    y: number;
}

interface RecursiveTreeNodeAndRenderInfo extends RecursiveTreeNode {
    customId: string;
    startPosition: Position; // For start of transition
    endPosition: Position; // For end of transition
    isVisible: boolean;
    children: RecursiveTreeNodeAndRenderInfo[];
    hiddenChildren: RecursiveTreeNodeAndRenderInfo[];
}

interface DatedHierarchyNode {
    dates: string[];
    tree: d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>;
}

/**
 * Group tree visualization. Creates an _svg, and appends to the assigned element.
 * Draws the tree provided as tree_data

 * @constructor
 */
export default class GroupTree {
    _treeWidth: number;
    _datedHierarchyNodes: DatedHierarchyNode[];
    _currentTree: any;

    // svg element as d3 selection
    _svgElementSelection: d3.Selection<SVGGElement, any, null, undefined>;
    _textPaths: d3.Selection<SVGGElement, any, null, undefined>;
    _renderTree: d3.TreeLayout<any>;

    _currentEdgeKey: string;
    _currentNodeKey: string;
    _currentDateTime: string;

    // Map with node/edge key and corresponding metadata
    _keyToMetadataMap: Map<string, { label: string; unit?: string }>;

    _pathScaleMap: Map<string, d3.ScaleLinear<number, number, never>>;

    // Fixed attributes
    _transitionTime = 200;

    /**
     *
     * @param dom_element_id
     * @param {group-tree-data} tree_data
     * @param initialFlowRate
     */
    constructor(
        renderDivElement: HTMLDivElement,
        datedTrees: DatedTrees,
        initialFlowRate: string,
        initialNodeInfo: string,
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
        const metadataList: (EdgeMetadata | NodeMetadata)[] = [
            ...edgeMetadataList,
            ...nodeMetadataList,
        ];
        this._keyToMetadataMap = new Map();
        metadataList.forEach((elm) => {
            this._keyToMetadataMap.set(elm.key, {
                label: elm.label,
                unit: elm.unit,
            });
        });

        this._currentEdgeKey = initialFlowRate;
        this._currentNodeKey = initialNodeInfo;
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

        this._datedHierarchyNodes = GroupTree.createDatedHierarchyNodes(
            _datedTrees,
            treeHeight
        );

        this._currentTree = {};

        this.update(currentDateTime);
    }

    /**
     * Initialize all trees in the group tree data structure, once for the entire visualization.
     *
     */
    static createDatedHierarchyNodes(
        datedTrees: DatedTrees,
        treeHeight: number
    ): DatedHierarchyNode[] {
        let clonedDatedTrees = cloneDeep(datedTrees);

        // Generate the node-id used to match in the enter, update and exit selections
        const createNodeId = (
            node: d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>
        ) => {
            return node.parent === null
                ? node.data.node_label
                : `${node.parent.id}_${node.data.node_label}`;
        };

        // Function to convert RecursiveTreeNode to RecursiveTreeNodeAndRenderInfo
        function convertNode(
            node: RecursiveTreeNode
        ): RecursiveTreeNodeAndRenderInfo {
            const convertedNode: RecursiveTreeNodeAndRenderInfo = {
                ...node,
                customId: "",
                startPosition: { x: 0, y: 0 },
                endPosition: { x: 0, y: 0 },
                isVisible: true,
                // children: [], // Will this work?
                children: node.children?.map(convertNode) ?? [], // Recursively convert children
                hiddenChildren: [],
            };

            // Recursively convert children
            // convertedNode.children = node.children.map(convertNode);

            return convertedNode;
        }

        const output: {
            dates: string[];
            tree: d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>;
        }[] = [];

        // For each dated tree, generate a d3 hierarchy with additional render info
        for (let datedTree of clonedDatedTrees) {
            // RecursiveTreeNode->RecursiveTreeNodeAndRenderInfo
            const convertedTree = convertNode(datedTree.tree);

            // Create a d3 hierarchy from the converted tree
            // RecursiveTreeNodeAndRenderInfo -> d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>
            const rootNode = d3.hierarchy(
                convertedTree,
                (node) => node.children
            );

            // Create custom node Ids from hierarchy
            // d3.HierarchyNode<RecursiveTreeNode> -> d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>
            rootNode
                .descendants()
                .forEach((node) => (node.data.customId = createNodeId(node)));

            // Set root node position
            rootNode.data.startPosition = { x: treeHeight / 2, y: 0 };

            output.push({
                dates: datedTree.dates,
                tree: rootNode,
            });
        }
        return output;
    }

    /**
     * Set the selected flow rate key and update display of all edges accordingly.
     *
     * @param flowRateKey - key identifying the flow rate, i.e. edge key
     */
    set flowRateKey(flowRateKey: string) {
        this._currentEdgeKey = flowRateKey;

        const currentTreeIndex = this._datedHierarchyNodes.findIndex((e) => {
            return e.dates.includes(this._currentDateTime);
        });

        const dateIndex = this._datedHierarchyNodes[
            currentTreeIndex
        ].dates.indexOf(this._currentDateTime);

        this._svgElementSelection
            .selectAll<
                SVGPathElement,
                d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>
            >("path.link")
            .transition()
            .duration(this._transitionTime)
            .attr(
                "class",
                () => `link grouptree_link grouptree_link__${flowRateKey}`
            )
            .style("stroke-width", (d) =>
                this.createEdgeStrokeWidth(
                    flowRateKey,
                    d.data.edge_data[flowRateKey]?.[dateIndex] ?? 0
                )
            )
            .style("stroke-dasharray", (d) => {
                return (d.data.edge_data[flowRateKey]?.[dateIndex] ?? 0) > 0
                    ? "none"
                    : "5,5";
            });
    }
    get flowRateKey(): string {
        return this._currentEdgeKey;
    }

    /**
     * Set the selected node key and update display of all nodes accordingly.
     *
     * @param nodeKey - key identifying the current active node
     */
    set nodeKey(nodeKey: string) {
        this._currentNodeKey = nodeKey;

        const currentTreeIndex = this._datedHierarchyNodes.findIndex((e) => {
            return e.dates.includes(this._currentDateTime);
        });

        const dateIndex = this._datedHierarchyNodes[
            currentTreeIndex
        ].dates.indexOf(this._currentDateTime);

        this._svgElementSelection
            .selectAll<
                SVGPathElement,
                d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>
            >(".grouptree__pressurelabel")
            .text(
                (d) =>
                    d.data.node_data?.[nodeKey]?.[dateIndex]?.toFixed(0) ?? "NA"
            );

        this._svgElementSelection
            .selectAll(".grouptree__pressureunit")
            .text(() => {
                const t = this._keyToMetadataMap.get(nodeKey);
                return t?.unit ?? "";
            });
    }
    get nodeKey(): string {
        return this._currentNodeKey;
    }

    /**
     * Create edge stroke width string from edge key and value.
     * @param key - edge key
     * @param value - edge value to scale
     * @returns Stroke width string scaled using value and the path scale for the edge key
     */
    createEdgeStrokeWidth(key: string, value: number) {
        const normalized = this._pathScaleMap.get(key)?.(value) ?? 2;
        return `${normalized}px`;
    }

    /**
     * Sets the state of the current tree, and updates the tree visualization accordingly.
     * The state is changed either due to a branch open/close, or that the tree is entirely changed
     * when moving back and fourth in time.
     *
     * @param newDateTime - the new date time to visualize
     */
    update(newDateTime: string) {
        const self = this;

        self._currentDateTime = newDateTime;

        const newTreeIndex = self._datedHierarchyNodes.findIndex((e) => {
            return e.dates.includes(newDateTime);
        });

        const root = self._datedHierarchyNodes[newTreeIndex];

        const dateIndex = root.dates.indexOf(self._currentDateTime);

        /**
         * Assigns y coordinates to all tree nodes in the rendered tree.
         * @param t - a rendered tree
         * @param {int} width - the
         * @returns a rendered tree width coordinates for all nodes.
         */
        function growNewTree(
            tree: d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>,
            width: number
        ) {
            tree.descendants().forEach((d) => {
                d.data.endPosition.y = (d.depth * width) / (tree.height + 1);
            });

            return tree;
        }

        function doPostUpdateOperations(
            tree: d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>
        ) {
            setEndPositions(tree.descendants());
            setNodeVisibility(tree.descendants(), true);
            return tree;
        }

        function findClosestVisibleParent(
            d: d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>
        ) {
            let c = d;
            while (c.parent && !c.data.isVisible) {
                c = c.parent;
            }
            return c;
        }

        function getClosestVisibleParentStartCoordinates(
            d: d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>
        ): Position {
            const p = findClosestVisibleParent(d);
            return p.data.startPosition;
        }

        function getClosestVisibleParentEndCoordinates(
            d: d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>
        ): Position {
            const p = findClosestVisibleParent(d);
            return p.data.endPosition;
        }

        /**
         * Implicitly alter the state of a node, by hiding its children
         * @param node
         */
        function toggleBranch(
            node: d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>
        ): void {
            if (node.data.children) {
                node.data.hiddenChildren = node.data.children;
                node.data.children = []; //null;
            } else {
                node.data.children = node.data.hiddenChildren ?? [];
                node.data.hiddenChildren = [];
            }

            self.update(self._currentDateTime);
        }

        /**
         * Toggles visibility of a node. This state determines if the node, and its children
         * @param nodes
         * @param visibility
         */
        function setNodeVisibility(
            nodes: d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>[],
            isVisible: boolean
        ) {
            nodes.forEach((d) => {
                d.data.isVisible = isVisible;
            });
        }

        /**
         * After node translation transition, save end position
         * @param nodes
         */
        function setEndPositions(
            nodes: d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>[]
        ) {
            nodes.forEach((d) => {
                d.data.startPosition = d.data.endPosition;
            });
        }

        function getToolTipText(
            data: { [key: string]: number[] },
            dateIndex: number
        ) {
            if (data === undefined || dateIndex === undefined) {
                return "";
            }

            const propNames = Object.keys(data);
            let text = "";
            propNames.forEach(function (s) {
                const t = self._keyToMetadataMap.get(s);
                const pre = t?.label ?? "";
                const unit = t?.unit ?? "";
                text +=
                    pre +
                    " " +
                    (data[s]?.[dateIndex]?.toFixed(0) ?? "") +
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
        function cloneExistingNodeStates(
            newRoot: d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>,
            oldRoot: d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>
        ) {
            if (Object.keys(oldRoot).length > 0) {
                oldRoot.descendants().forEach((oldNode) => {
                    newRoot.descendants().forEach((newNode) => {
                        if (oldNode.id === newNode.id) {
                            newNode.data.startPosition =
                                oldNode.data.startPosition;
                            oldNode.data.endPosition = newNode.data.endPosition;
                            newNode.data.isVisible = oldNode.data.isVisible;
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
        function updateNodes(
            nodes: d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>[],
            nodeKey: string
        ) {
            const node = self._svgElementSelection
                .selectAll<
                    SVGGElement,
                    d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>
                >("g.node")
                .data(nodes, (d) => d.data.customId);

            const nodeEnter = node
                .enter()
                .append("g")
                .attr("class", "node")
                .attr("id", (d) => d.data.customId)
                .attr("transform", (d) => {
                    const c = getClosestVisibleParentStartCoordinates(d);
                    return `translate(${c.y},${c.x})`;
                })
                .on("click", toggleBranch);

            nodeEnter
                .append("circle")
                .attr("id", (d) => d.data.customId)
                .attr("r", 6)
                .transition()
                .duration(self._transitionTime)
                .attr("x", (d) => d.data.endPosition.x)
                .attr("y", (d) => d.data.endPosition.y);

            nodeEnter
                .append("text")
                .attr("class", "grouptree__nodelabel")
                .attr("dy", ".35em")
                .style("fill-opacity", 1)
                .attr("x", (d) =>
                    d.data.children || d.data.hiddenChildren ? -21 : 21
                )
                .attr("text-anchor", (d) =>
                    d.data.children || d.data.hiddenChildren ? "end" : "start"
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
                        d.data.node_data[nodeKey]?.[dateIndex]?.toFixed(0) ??
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
                    const t = self._keyToMetadataMap.get(nodeKey);
                    return t?.unit ?? "";
                });

            nodeEnter
                .append("title")
                .text((d) => getToolTipText(d.data.node_data, dateIndex));

            const nodeUpdate = nodeEnter.merge(node);

            // Nodes from earlier exit selection may reenter if transition is interrupted. Restore state.
            nodeUpdate
                .filter(".exiting")
                .interrupt()
                .classed("exiting", false)
                .attr("opacity", 1);

            nodeUpdate
                .select("text.grouptree__pressurelabel")
                .text(
                    (d) =>
                        d.data.node_data[nodeKey]?.[dateIndex]?.toFixed(0) ??
                        "NA"
                );

            nodeUpdate
                .transition()
                .duration(self._transitionTime)
                .attr(
                    "transform",
                    (d) =>
                        `translate(${d.data.endPosition.y},${d.data.endPosition.x})`
                );

            nodeUpdate
                .select("circle")
                .attr(
                    "class",
                    (d) =>
                        `${"grouptree__node" + " "}${
                            d.data.children || d.data.hiddenChildren
                                ? "grouptree__node--withchildren"
                                : "grouptree__node"
                        }`
                )
                .transition()
                .duration(self._transitionTime)
                .attr("r", 15);

            nodeUpdate
                .select("title")
                .text((d) => getToolTipText(d.data.node_data, dateIndex));

            node.exit<d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>>()
                .classed("exiting", true)
                .attr("opacity", 1)
                .transition()
                .duration(self._transitionTime)
                .attr("opacity", 1e-6)
                .attr("transform", (d) => {
                    d.data.isVisible = false;
                    const c = getClosestVisibleParentEndCoordinates(d);
                    return `translate(${c.y},${c.x})`;
                })
                .remove();
        }

        /**
         * Draw new edges, and update existing ones.
         *
         * @param edges -list of nodes in a tree
         * @param flowRateKey - key identifying the flowrate of the incoming edge
         */
        function updateEdges(
            edges: d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>[],
            flowRateKey: string
        ) {
            const link = self._svgElementSelection
                .selectAll<
                    SVGPathElement,
                    d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>
                >("path.link")
                .data(edges, (d) => d.data.customId);

            const linkEnter = link
                .enter()
                .insert("path", "g")
                .attr("id", (d) => `path ${d.data.customId}`)
                .attr("d", (d) => {
                    const c = getClosestVisibleParentStartCoordinates(d);
                    return diagonal(c, c);
                });

            linkEnter
                .append("title")
                .text((d) => getToolTipText(d.data.edge_data, dateIndex));

            const linkUpdate = linkEnter.merge(link);

            linkUpdate
                .attr(
                    "class",
                    () => `link grouptree_link grouptree_link__${flowRateKey}`
                )
                .transition()
                .duration(self._transitionTime)
                .attr("d", (d) =>
                    diagonal(
                        d.data.endPosition,
                        d.parent?.data.endPosition ?? { x: 0, y: 0 }
                    )
                )
                .style("stroke-width", (d) =>
                    self.createEdgeStrokeWidth(
                        flowRateKey,
                        d.data.edge_data[flowRateKey]?.[dateIndex] ?? 0
                    )
                )
                .style("stroke-dasharray", (d) => {
                    return (d.data.edge_data[flowRateKey]?.[dateIndex] ?? 0) > 0
                        ? "none"
                        : "5,5";
                });

            linkUpdate
                .select("title")
                .text((d) => getToolTipText(d.data.edge_data, dateIndex));

            link.exit<d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>>()
                .transition()
                .duration(self._transitionTime)
                .attr("d", (d) => {
                    d.data.isVisible = false;
                    const c = getClosestVisibleParentEndCoordinates(d);
                    return diagonal(c, c);
                })
                .remove();

            /**
             * Create the curve definition for the edge between node s and node d.
             * @param s - source node
             * @param d - destination node
             */
            function diagonal(s: Position, d: Position): string {
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
        function updateEdgeTexts(
            edges: d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>[]
        ) {
            const textpath = self._textPaths
                .selectAll<
                    SVGTextPathElement,
                    d3.HierarchyNode<RecursiveTreeNodeAndRenderInfo>
                >(".edge_info_text")
                .data(edges, (d) => d.data.customId);

            const enter = textpath
                .enter()
                .insert("text")
                .attr("dominant-baseline", "central")
                .attr("text-anchor", "middle")
                .append("textPath")
                .attr("class", "edge_info_text")
                .attr("startOffset", "50%")
                .attr("xlink:href", (d) => `#path ${d.data.customId}`);

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
            growNewTree(this._renderTree(root.tree), this._treeWidth),
            this._currentTree
        );

        // execute visualization operations on enter, update and exit selections
        updateNodes(newTree.descendants(), this.nodeKey);
        updateEdges(newTree.descendants().slice(1), this.flowRateKey);
        updateEdgeTexts(newTree.descendants().slice(1));

        // save the state of the now current tree, before next update
        this._currentTree = doPostUpdateOperations(newTree);
    }
}
