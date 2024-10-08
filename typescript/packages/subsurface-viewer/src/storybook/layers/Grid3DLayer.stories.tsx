import React from "react";

import type { Meta, StoryObj } from "@storybook/react";

import { create, all } from "mathjs";

import type {
    SubsurfaceViewerProps,
    TLayerDefinition,
} from "../../SubsurfaceViewer";
import SubsurfaceViewer, { TGrid3DColoringMode } from "../../SubsurfaceViewer";

import {
    Points as SnubCubePoints,
    Faces as SnubCubeFaces,
    VertexCount as SnubCubeVertexCount,
} from "../../layers/grid3d/test_data/TruncatedSnubCube";

import {
    Points as ToroidPoints,
    Faces as ToroidFaces,
    VertexCount as ToroidVertexCount,
} from "../../layers/grid3d/test_data/PentagonalToroid";

import * as gridPoints from "../../layers/grid3d/test_data/DiscreteProperty/Points.json";
import * as gridPolys from "../../layers/grid3d/test_data/DiscreteProperty/Polys.json";
import * as gridProps from "../../layers/grid3d/test_data/DiscreteProperty/Props.json";

import { default3DViews, defaultStoryParameters } from "../sharedSettings";
import type { Grid3DLayerProps } from "../../layers";
import { AxesLayer, Grid3DLayer } from "../../layers";
import type { CompositeLayer } from "@deck.gl/core";

const stories: Meta = {
    component: SubsurfaceViewer,
    title: "SubsurfaceViewer/Grid3D Layer",
    args: {
        // Add some common controls for all the stories.
        triggerHome: 0,
    },
};
export default stories;

type NumberQuad = [number, number, number, number];

const defaultProps = {
    bounds: [456150, 5925800, 467400, 5939500] as NumberQuad,
    views: default3DViews,
};

// Grid 3d story
const grid3dLayer = {
    "@@type": "Grid3DLayer",
    id: "Grid3DLayer",
    gridLines: true,
    material: true,
    colorMapName: "Rainbow",
    ZIncreasingDownwards: false,
};

const axes = {
    "@@type": "AxesLayer",
    id: "axes-layer2",
    bounds: [453150, 5925800, -2000, 469400, 5939500, 0],
    ZIncreasingDownwards: false,
};
const parameters = {
    docs: {
        ...defaultStoryParameters,
        description: {
            story: "Simgrid.",
        },
    },
};

const SIMPLE_GEOMETRY = {
    points: [
        [0, 0, 0],
        [100, 0, 0],
        [100, 100, 0],
        [0, 100, 0],
        [200, 100, 0],
        [200, 0, 0],
    ],
    polygons: [4, 0, 1, 2, 3, 4, 1, 2, 4, 5],
};

const SIMPLE_GEOMETRY_LAYER = {
    ...grid3dLayer,
    pickable: true,
    pointsData: new Float32Array(SIMPLE_GEOMETRY.points.flat()),
    polysData: new Uint32Array(SIMPLE_GEOMETRY.polygons),
};

const CATEGORICAL_COLOR_MAP = (value: number) => CATEGORICAL_COLOR_TABLE[value];

const BLUE_RED_HEAT_MAP = (value: number): [number, number, number] => {
    return [value * 255, 0, (1 - value) * 255];
};

export const Simgrid: StoryObj<typeof SubsurfaceViewer> = {
    args: {
        ...defaultProps,
        id: "grid-3d",
        layers: [
            axes,
            {
                ...grid3dLayer,
                pointsData: "vtk-grid/Simgrid_points.json",
                polysData: "vtk-grid/Simgrid_polys.json",
                propertiesData: "vtk-grid/Simgrid_scalar.json",
                pickable: true,
            },
        ],
    },
    parameters: parameters,
};

export const SimgridArrayInput: StoryObj<typeof SubsurfaceViewer> = {
    args: {
        ...defaultProps,
        bounds: [456169, 5936050, 456185, 5936055],
        id: "grid-3darray",
        layers: [
            axes,
            {
                ...grid3dLayer,
                pointsData: [
                    456063, 5935991, -1729, 456063, 5935991, -1731, 456138,
                    5935861.518843642, -1727.820068359375, 456138.5, 5935861.5,
                    -1726.3526611328125, 456193.90625, 5936066,
                    -1730.7259521484375, 456193.8825946293, 5936065.981075703,
                    -1732.200439453125, 456268.9375, 5935936.5,
                    -1726.6915283203125,
                ],
                polysData: [4, 0, 1, 2, 3, 4, 0, 4, 5, 1, 4, 0, 3, 6, 4],
                propertiesData: [0.2, 0.6, 0.8],
                pickable: true,
            },
        ],
    },
    parameters: parameters,
};

export const Simgrid2x: StoryObj<typeof SubsurfaceViewer> = {
    args: {
        ...defaultProps,
        id: "grid-3d",
        layers: [
            axes,
            {
                ...grid3dLayer,
                pointsData: "vtk-grid/Simgrid2x_points.json",
                polysData: "vtk-grid/Simgrid2x_polys.json",
                propertiesData: "vtk-grid/Simgrid2x_scalar.json",
                pickable: true,
            },
        ],
    },
    parameters: parameters,
};

export const Simgrid4x: StoryObj<typeof SubsurfaceViewer> = {
    args: {
        ...defaultProps,
        id: "grid-3d",
        layers: [
            axes,
            {
                ...grid3dLayer,
                ZIncreasingDownwards: false,
                pointsData: "vtk-grid/Simgrid4x_points.json",
                polysData: "vtk-grid/Simgrid4x_polys.json",
                propertiesData: "vtk-grid/Simgrid4x_scalar.json",
                pickable: true,
            },
        ],
    },
    parameters: parameters,
};

export const Simgrid8xIJonly: StoryObj<typeof SubsurfaceViewer> = {
    args: {
        ...defaultProps,
        id: "grid-3d",
        layers: [
            axes,
            {
                ...grid3dLayer,
                pointsData: "vtk-grid/Simgrid8xIJonly_points.json",
                polysData: "vtk-grid/Simgrid8xIJonly_polys.json",
                propertiesData: "vtk-grid/Simgrid8xIJonly_scalar.json",
                pickable: true,
            },
        ],
    },
    parameters: parameters,
};

const math = create(all, { randomSeed: "1984" });
const randomFunc = math?.random ? math.random : Math.random;

const snubCubePoints = SnubCubePoints.map((v) => 10 * v);
const snubCubeProperties = Array(SnubCubeVertexCount)
    .fill(0)
    .map(() => 100 + randomFunc() * 50);

const toroidPoints = ToroidPoints.map((v) => 10 * v).map((v, index) =>
    index % 3 === 0 ? v + 30 : v
);
const toroidProperties = Array(ToroidVertexCount)
    .fill(0)
    .map(() => randomFunc() * 10);

/* eslint-disable prettier/prettier */
const CATEGORICAL_COLOR_TABLE: [number, number, number][] = [
    [0, 0, 255],     // 0
    [0, 255, 0],     // 1 
    [0, 255, 255],   // 2 
    [255, 0, 0],     // 3 
    [255, 0, 255],   // 4 
    [255, 255, 0],   // 5 
    [0, 0, 100],     // 6 
    [0, 100, 0],     // 7 
    [0, 100, 100],   // 8
    [100, 0, 0],     // 9 
    [100, 0, 100],   // 10
    [100, 100, 0],   // 11
];

const propertyValueNames = [
    { value: 1, name: "blue"},         // 0
    { value: 2, name:"green"},         // 1
    { value: 5, name: "cyan"},         // 2
    { value: 6, name: "red"},          // 3
    { value: -8, name: "magenta"},     // 4
    { value: 9, name: "yellow"},       // 5
    { value: 20, name: "dark blue"},   // 6
    { value: 30, name: "dark green"},  // 7
    { value: 15, name: "dark cyan"},   // 8
    { value: 10, name: "dark red"},    // 9
    { value: 3, name: "dark magenta"}, // 10
    { value: -10, name: "dark yellow"},// 11
];
/* eslint-enable prettier/prettier */

export const PolyhedralCells: StoryObj<typeof SubsurfaceViewer> = {
    args: {
        bounds: [-25, -25, 50, 30] as NumberQuad,
        views: {
            layout: [1, 1] as [number, number],
            viewports: [
                {
                    id: "view_1",
                    show3D: true,
                },
            ],
        },
        id: "grid-3d-polyhedral-cell",
        layers: [
            {
                ...axes,
                id: "polyhedral-cells-axes",
                bounds: [-15, -15, -15, 40, 20, 15],
            },
            {
                ...grid3dLayer,
                id: "polyhedral1",
                coloringMode: TGrid3DColoringMode.Y,
                pickable: true,
                pointsData: snubCubePoints,
                polysData: SnubCubeFaces,
                propertiesData: snubCubeProperties,
                colorMapName: "Porosity",
            },
            {
                ...grid3dLayer,
                id: "polyhedral2",
                pickable: true,
                pointsData: toroidPoints,
                polysData: ToroidFaces,
                propertiesData: toroidProperties,
                coloringMode: TGrid3DColoringMode.Property,
            },
        ],
    },
    parameters: parameters,
};

// ---------In-place array data handling (storybook fails to rebuild non JSon data)--------------- //
const discretePropsLayerId = "discrete_props";

const layerArrays = {
    [discretePropsLayerId]: {
        pointsData: new Float32Array(gridPoints),
        polysData: new Uint32Array(gridPolys),
        propertiesData: new Uint16Array(gridProps),
        colorMapFunction: new Uint8Array(CATEGORICAL_COLOR_TABLE.flat()),
    },
};

function replaceAllArrays(args: SubsurfaceViewerProps) {
    args.layers?.forEach((layer: TLayerDefinition) => {
        replaceLayerArrays(layer);
    });
    return args;
}

function replaceArrays(args: SubsurfaceViewerProps, keys: string[]) {
    args.layers?.forEach((layer: TLayerDefinition) => {
        replaceLayerArrays(layer, keys);
    });
    return args;
}

function replaceLayerArrays(
    layer: TLayerDefinition,
    keys: string[] | undefined = undefined
) {
    // @ts-expect-error TS7053
    const layerId = layer?.["id"] as string | undefined;
    // @ts-expect-error TS7053
    if (layer && layerId && layerArrays[layerId]) {
        if (!keys) {
            // @ts-expect-error TS7053
            keys = Object.keys(layerArrays[layerId]) as string[];
        }
        for (const key of keys) {
            // @ts-expect-error TS7053
            layer[key] = layerArrays[layerId][key];
        }
    }
}

export const ContinuousProperty: StoryObj<typeof SubsurfaceViewer> = {
    args: {
        id: "grid-property",
        layers: [
            new AxesLayer({
                ...axes,
                bounds: [-300, -300, -2200, 300, 300, -1000],
            }),
            new Grid3DLayer({
                ...SIMPLE_GEOMETRY_LAYER,
                propertiesData: new Float32Array([-1, 100.5]),
                colorMapFunction: BLUE_RED_HEAT_MAP,
            }) as CompositeLayer<Grid3DLayerProps>,
        ],
    },
    parameters: parameters,
    render: (args) => <SubsurfaceViewer {...args} />,
};

export const DiscreteProperty: StoryObj<typeof SubsurfaceViewer> = {
    args: {
        id: "grid-property",
        layers: [
            new AxesLayer({
                ...axes,
                bounds: [-300, -300, -2200, 300, 300, -1000],
            }),
            new Grid3DLayer({
                ...SIMPLE_GEOMETRY_LAYER,
                propertiesData: new Uint16Array([0, 1]),
                discretePropertyValueNames: propertyValueNames,
                colorMapFunction: CATEGORICAL_COLOR_MAP,
            }) as CompositeLayer<Grid3DLayerProps>,
        ],
    },
    parameters: parameters,
    render: (args) => <SubsurfaceViewer {...args} />,
};

export const DiscretePropertyWithClamping: StoryObj<typeof SubsurfaceViewer> = {
    args: {
        bounds: [-2500, -2500, 2500, 2500] as NumberQuad,
        views: {
            layout: [1, 1] as [number, number],
            viewports: [
                {
                    id: "view_1",
                    show3D: true,
                },
            ],
        },
        id: "grid-3d-discrete_props",
        layers: [
            {
                ...axes,
                id: "discrete_props-axes",
                bounds: [-2000, -2200, -2200, 2200, 2000, -1000],
            },
            {
                ...grid3dLayer,
                "@@typedArraySupport": true,
                id: discretePropsLayerId,
                coloringMode: TGrid3DColoringMode.Property,
                pickable: true,
                pointsData: layerArrays[discretePropsLayerId].pointsData,
                polysData: layerArrays[discretePropsLayerId].polysData,
                propertiesData:
                    layerArrays[discretePropsLayerId].propertiesData,
                discretePropertyValueNames: propertyValueNames,
                colorMapName: "Seismic",
                ZIncreasingDownwards: true,
                colorMapFunction:
                    layerArrays[discretePropsLayerId].colorMapFunction,
                material: {
                    ambient: 0.5,
                    diffuse: 0.5,
                    shininess: 32,
                    specularColor: [255, 255, 255],
                },
                colorMapRange: [3, 8],
                colorMapClampColor: [100, 100, 100],
            },
        ],
    },
    parameters: parameters,
    render: (args) => <SubsurfaceViewer {...replaceAllArrays(args)} />,
};

export const CustomColorFuncWithClamping: StoryObj<typeof SubsurfaceViewer> = {
    args: {
        bounds: [-2500, -2500, 2500, 2500] as NumberQuad,
        views: {
            layout: [1, 1] as [number, number],
            viewports: [
                {
                    id: "view_1",
                    show3D: true,
                },
            ],
        },
        id: "grid-3d-discrete_props",
        layers: [
            {
                ...axes,
                id: "discrete_props-axes",
                bounds: [-2000, -2200, -2200, 2200, 2000, -1000],
            },
            {
                ...grid3dLayer,
                "@@typedArraySupport": true,
                id: discretePropsLayerId,
                coloringMode: TGrid3DColoringMode.Property,
                pickable: true,
                pointsData: layerArrays[discretePropsLayerId].pointsData,
                polysData: layerArrays[discretePropsLayerId].polysData,
                propertiesData:
                    layerArrays[discretePropsLayerId].propertiesData,
                colorMapName: "Seismic",
                ZIncreasingDownwards: true,
                // @ts-expect-error TS7006
                colorMapFunction: function (v) {
                    return [255 * v, 0, 255 * (1 - v)];
                },
                material: false,
                colorMapRange: [3, 10],
                colorMapClampColor: [100, 100, 100],
            },
        ],
    },
    parameters: parameters,
    render: (args) => (
        <SubsurfaceViewer
            {...replaceArrays(args, [
                "pointsData",
                "polysData",
                "propertiesData",
            ])}
        />
    ),
};

export const DiscretePropertyWithUndefinedValues: StoryObj<
    typeof SubsurfaceViewer
> = {
    args: {
        bounds: [-2500, -2500, 2500, 2500] as NumberQuad,
        views: {
            layout: [1, 1] as [number, number],
            viewports: [
                {
                    id: "view_1",
                    show3D: true,
                },
            ],
        },
        id: "grid-3d-discrete-props-undef-vals",
        layers: [
            {
                ...axes,
                id: "discrete-props-undef-vals-axes",
                bounds: [-2000, -2200, -2200, 2200, 2000, -1000],
            },
            {
                ...grid3dLayer,
                "@@typedArraySupport": true,
                id: discretePropsLayerId,
                coloringMode: TGrid3DColoringMode.Property,
                colorMapFunction:
                    layerArrays[discretePropsLayerId].colorMapFunction,
                discretePropertyValueNames: propertyValueNames,
                pickable: true,
                pointsData: layerArrays[discretePropsLayerId].pointsData,
                polysData: layerArrays[discretePropsLayerId].polysData,
                propertiesData:
                    layerArrays[discretePropsLayerId].propertiesData,
                colorMapName: "Rainbow",
                ZIncreasingDownwards: true,
                material: false,
                undefinedPropertyValue: 4,
            },
        ],
    },
    parameters: parameters,
    render: (args) => (
        <SubsurfaceViewer
            {...replaceArrays(args, [
                "pointsData",
                "polysData",
                "propertiesData",
            ])}
        />
    ),
};
