import React from "react";

import { View } from "@deck.gl/core";
import { styled } from "@mui/material/styles";
import type { Meta, StoryObj } from "@storybook/react";
import { distance } from "mathjs";

import type { SubsurfaceViewerProps } from "../../SubsurfaceViewer";
import SubsurfaceViewer from "../../SubsurfaceViewer";
import { Axes2DLayer } from "../../layers";
import { TGrid3DColoringMode } from "../../layers/grid3d/grid3dLayer";
import SeismicLayer from "../../layers/seismic/seismicLayer";
import type { WellFeatureCollection } from "../../layers/wells/types";
import {
    calculateTrajectoryGap,
    getWellboreGeometry,
} from "../../layers/wells/utils/abscissaTransform";
import WellsLayer from "../../layers/wells/wellsLayer";
import { SectionView } from "../../views/sectionView";
import {
    TRAJECTORY_SIMULATION_ARGTYPES,
    WELL_COUNT_ARGTYPES,
} from "../constant/argTypes";
import { defaultStoryParameters } from "../sharedSettings";
import type { TrajectorySimulationProps, WellCount } from "../types/well";
import {
    getSyntheticWells,
    useSyntheticWellCollection,
} from "../util/wellSynthesis";

const stories: Meta = {
    component: SubsurfaceViewer,
    title: "SubsurfaceViewer / Intersection Test",
    args: {
        triggerHome: 0,
    },
};
export default stories;

const PREFIX = "IntersectionTest";

const classes = {
    main: `${PREFIX}-main`,
    annotation: `${PREFIX}-annotation`,
};

const Root = styled("div")({
    [`& .${classes.main}`]: {
        height: 500,
        border: "1px solid black",
        position: "relative",
    },
    [`& .${classes.annotation}`]: {
        marginLeft: "100px",
    },
});

const SYNTHETIC_WELLS_PROPS = {
    id: "wells",
    data: getSyntheticWells(10),
    wellLabel: {
        getSize: 10,
        background: true,
    },
};

const WELLS_UNFOLDED_DEFAULT_PROPS = {
    ...SYNTHETIC_WELLS_PROPS,
    id: "unfolded_default",
    section: true,
};

/**
 * Generate synthetic seismic amplitude values for a 2D grid.
 * Produces a layered pattern with some random noise to mimic seismic reflectors.
 */
function generateSyntheticSeismic(
    width: number,
    height: number,
    seed: number
): Float32Array {
    const values = new Float32Array(width * height);
    for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
            const t = row / height;
            const x = col / width;
            const reflector =
                Math.sin(
                    t * Math.PI * 12 + Math.sin(x * Math.PI * 4 + seed) * 0.5
                ) *
                    0.6 +
                Math.sin(t * Math.PI * 20 + x * 2 + seed * 0.3) * 0.3 +
                (Math.sin(seed * 1000 + row * 7 + col * 13) * 0.5 + 0.5 - 0.5) *
                    0.2;
            values[row * width + col] = reflector;
        }
    }
    return values;
}

/**
 * Compute the unfolded abscissa extent for each well, mirroring the logic
 * in abscissaTransform.ts. Returns per-well { abscissaStart, abscissaEnd, depthMin, depthMax }.
 */
function computePerWellSectionExtents(data: WellFeatureCollection) {
    const extents: {
        abscissaStart: number;
        abscissaEnd: number;
        depthMin: number;
        depthMax: number;
    }[] = [];

    let currentAbscissa = 0;

    for (let i = 0; i < data.features.length; i++) {
        const feature = data.features[i];
        const geometry = getWellboreGeometry(feature);
        if (!geometry) continue;

        const coords = geometry.coordinates;

        // Compute cumulative lateral distance (abscissa) for this well
        let maxLocalAbscissa = 0;
        let depthMin = Infinity;
        let depthMax = -Infinity;
        for (let j = 0; j < coords.length; j++) {
            const z = -coords[j][2]; // Negate: WellsLayer flips z when ZIncreasingDownwards=true
            depthMin = Math.min(depthMin, z);
            depthMax = Math.max(depthMax, z);
            if (j > 0) {
                const prev = coords[j - 1];
                const curr = coords[j];
                maxLocalAbscissa += distance(
                    [prev[0], prev[1]],
                    [curr[0], curr[1]]
                ) as number;
            }
        }

        extents.push({
            abscissaStart: currentAbscissa,
            abscissaEnd: currentAbscissa + maxLocalAbscissa,
            depthMin,
            depthMax,
        });

        currentAbscissa += maxLocalAbscissa;

        // Add gap to next well (same as abscissaTransform does)
        if (i < data.features.length - 1) {
            const gap = calculateTrajectoryGap(
                data.features[i],
                data.features[i + 1]
            );
            currentAbscissa += gap;
        }
    }

    return extents;
}

/**
 * Build one seismic fence (triangle strip rectangle) per wellbore in section coordinates.
 */
function buildPerWellSeismicFences(data: WellFeatureCollection) {
    const extents = computePerWellSectionExtents(data);
    const seismicWidth = 120;
    const seismicHeight = 120;

    return extents.map((ext, i) => {
        const vertices = [
            ext.abscissaStart,
            ext.depthMin,
            -1,
            ext.abscissaEnd,
            ext.depthMin,
            -1,
            ext.abscissaStart,
            ext.depthMax,
            -1,
            ext.abscissaEnd,
            ext.depthMax,
            -1,
        ];

        return {
            topology: "triangle-strip" as const,
            vertices,
            texCoords: [0, 0, 1, 0, 0, 1, 1, 1],
            vertexIndices: { value: [0, 1, 2, 3], size: 4 },
            valueMap: {
                width: seismicWidth,
                height: seismicHeight,
                values: generateSyntheticSeismic(
                    seismicWidth,
                    seismicHeight,
                    i
                ),
            },
        };
    });
}

/** Proof of concept: SeismicLayer rendered alongside projected wells in a SectionView */
export const SeismicWithProjectedWells: StoryObj<
    WellCount & TrajectorySimulationProps
> = {
    args: {
        wellCount: 10,
        sampleCount: 20,
        segmentLength: 150,
        dipDeviationMagnitude: 10,
    },
    parameters: {
        docs: {
            ...defaultStoryParameters.docs,
            description: {
                story: "Proof of concept: one SeismicLayer fence per wellbore, rendered in the same SectionView as projected wells.",
            },
        },
    },
    argTypes: {
        ...WELL_COUNT_ARGTYPES,
        ...TRAJECTORY_SIMULATION_ARGTYPES,
    },
    render: ({
        wellCount,
        sampleCount,
        segmentLength,
        dipDeviationMagnitude,
    }) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const data = useSyntheticWellCollection(wellCount, 10, {
            sampleCount,
            segmentLength,
            dipDeviationMagnitude,
        });

        // Build one seismic fence per wellbore, aligned to section coordinates
        const seismicFences = buildPerWellSeismicFences(data);

        const seismicLayer = new SeismicLayer({
            id: "seismic-section",
            cage: {
                origin: [0, 0, 0],
                edgeU: [1, 0, 0],
                edgeV: [0, 1, 0],
                edgeW: [0, 0, 0],
                widthUnits: "pixels" as const,
                lineWidth: 0,
                color: [0, 0, 0, 0],
                visible: false,
            },
            seismicFences,
            showMesh: false,
            colormap: { colormapName: "seismic" },
            colormapSetup: {
                valueRange: [-1, 1],
                clampRange: [-1, 1],
                clampColor: [0, 255, 0, 200],
                undefinedColor: [255, 0, 0, 200],
                smooth: true,
            },
            material: false,
            smoothShading: false,
            ZIncreasingDownwards: false,
            depthTest: true,
        });

        const wellsLayer = new WellsLayer({
            ...WELLS_UNFOLDED_DEFAULT_PROPS,
            id: "wells-section",
            data,
        });

        const axesLayer = new Axes2DLayer({ id: "axes" });

        const layers = [seismicLayer, wellsLayer, axesLayer];

        const viewerArgs: SubsurfaceViewerProps = {
            id: "seismic-with-projected-wells",
            views: {
                layout: [1, 1] as [number, number],
                viewports: [
                    {
                        id: "section-viewport",
                        target: [3000, -1500],
                        viewType: SectionView,
                        zoom: -4.5,
                        layerIds: ["seismic-section", "wells-section", "axes"],
                    },
                ],
            },
            scale: { visible: false },
            bounds: [450000, 6781000, 464000, 6791000],
        };

        return (
            <Root>
                <SubsurfaceViewer {...viewerArgs} layers={layers}>
                    {
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        /* @ts-expect-error */
                        <View id="section-viewport">
                            <h2 className={classes.annotation}>
                                Seismic Fences per Well [distance, z]
                            </h2>
                            <p className={classes.annotation}>
                                One synthetic seismic fence per wellbore,
                                rendered behind projected wells in a section
                                view.
                            </p>
                        </View>
                    }
                </SubsurfaceViewer>
            </Root>
        );
    },
};

/**
 * Build Grid3DLayer data (points, polys, properties) for a grid of quads
 * spanning the section extent of each wellbore.
 * Each well gets a vertical column of cells (nRows rows x 1 column).
 */
function buildPerWellGridData(
    data: WellFeatureCollection,
    nRows: number,
    nCols: number
): {
    pointsData: Float32Array;
    polysData: Uint32Array;
    propertiesData: Float32Array;
} {
    const extents = computePerWellSectionExtents(data);

    // Each well produces nCols x nRows quads.
    const totalQuads = extents.length * nRows * nCols;
    const totalPoints = totalQuads * 4;

    const points = new Float32Array(totalPoints * 3);
    const polys: number[] = [];
    const properties = new Float32Array(totalQuads);

    let pointIndex = 0;
    let quadIndex = 0;

    for (let w = 0; w < extents.length; w++) {
        const ext = extents[w];
        const depthRange = ext.depthMax - ext.depthMin;
        const rowHeight = depthRange / nRows;
        const abscissaRange = ext.abscissaEnd - ext.abscissaStart;
        const colWidth = abscissaRange / nCols;

        for (let r = 0; r < nRows; r++) {
            const top = ext.depthMax - r * rowHeight;
            const bottom = top - rowHeight;
            const zBehind = -1; // behind wells

            for (let c = 0; c < nCols; c++) {
                const left = ext.abscissaStart + c * colWidth;
                const right = left + colWidth;

                // 4 vertices per quad: TL, TR, BR, BL
                const baseIdx = pointIndex;

                points[pointIndex * 3] = left;
                points[pointIndex * 3 + 1] = top;
                points[pointIndex * 3 + 2] = zBehind;
                pointIndex++;

                points[pointIndex * 3] = right;
                points[pointIndex * 3 + 1] = top;
                points[pointIndex * 3 + 2] = zBehind;
                pointIndex++;

                points[pointIndex * 3] = right;
                points[pointIndex * 3 + 1] = bottom;
                points[pointIndex * 3 + 2] = zBehind;
                pointIndex++;

                points[pointIndex * 3] = left;
                points[pointIndex * 3 + 1] = bottom;
                points[pointIndex * 3 + 2] = zBehind;
                pointIndex++;

                polys.push(4, baseIdx, baseIdx + 1, baseIdx + 2, baseIdx + 3);

                // Synthetic property: varies by row, column, and well
                properties[quadIndex] =
                    (r / nRows) * 0.5 +
                    (c / nCols) * 0.3 +
                    Math.sin(w * 1.5 + r * 0.7 + c * 0.4) * 0.15 +
                    0.05;
                quadIndex++;
            }
        }
    }

    return {
        pointsData: points,
        polysData: new Uint32Array(polys),
        propertiesData: properties,
    };
}

/** Proof of concept: Grid3DLayer rendered alongside projected wells in a SectionView */
export const GridWithProjectedWells: StoryObj<
    WellCount & TrajectorySimulationProps
> = {
    args: {
        wellCount: 10,
        sampleCount: 20,
        segmentLength: 150,
        dipDeviationMagnitude: 10,
    },
    parameters: {
        docs: {
            ...defaultStoryParameters.docs,
            description: {
                story: "Proof of concept: Grid3DLayer cells per wellbore, rendered in the same SectionView as projected wells.",
            },
        },
    },
    argTypes: {
        ...WELL_COUNT_ARGTYPES,
        ...TRAJECTORY_SIMULATION_ARGTYPES,
    },
    render: ({
        wellCount,
        sampleCount,
        segmentLength,
        dipDeviationMagnitude,
    }) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const data = useSyntheticWellCollection(wellCount, 10, {
            sampleCount,
            segmentLength,
            dipDeviationMagnitude,
        });

        const nRows = 40;
        const nCols = 10;
        const { pointsData, polysData, propertiesData } = buildPerWellGridData(
            data,
            nRows,
            nCols
        );

        const gridLayer = {
            "@@type": "Grid3DLayer" as const,
            id: "grid-section",
            pointsData: Array.from(pointsData),
            polysData: Array.from(polysData),
            propertiesData: Array.from(propertiesData),
            coloringMode: TGrid3DColoringMode.Property,
            colorMapName: "Rainbow",
            colorMapRange: [0, 1],
            gridLines: false,
            material: false,
            depthTest: true,
            ZIncreasingDownwards: false,
            pickable: true,
        };

        const wellsLayer = new WellsLayer({
            ...WELLS_UNFOLDED_DEFAULT_PROPS,
            id: "wells-section",
            data,
        });

        const axesLayer = new Axes2DLayer({ id: "axes" });

        const layers = [gridLayer, wellsLayer, axesLayer];

        const viewerArgs: SubsurfaceViewerProps = {
            id: "grid-with-projected-wells",
            views: {
                layout: [1, 1] as [number, number],
                viewports: [
                    {
                        id: "section-viewport",
                        target: [3000, -1500],
                        viewType: SectionView,
                        zoom: -4.5,
                        layerIds: ["grid-section", "wells-section", "axes"],
                    },
                ],
            },
            scale: { visible: false },
            bounds: [450000, 6781000, 464000, 6791000],
        };

        return (
            <Root>
                <SubsurfaceViewer {...viewerArgs} layers={layers}>
                    {
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        /* @ts-expect-error */
                        <View id="section-viewport">
                            <h2 className={classes.annotation}>
                                Grid Cells per Well [distance, z]
                            </h2>
                            <p className={classes.annotation}>
                                Synthetic grid cells rendered behind projected
                                wells in a section view. Each well has a column
                                of {nRows}×{nCols} cells colored by a synthetic
                                property.
                            </p>
                        </View>
                    }
                </SubsurfaceViewer>
            </Root>
        );
    },
};

/**
 * Build a single-well seismic fence starting at abscissa 0.
 */
function buildSingleWellSeismicFence(
    singleWellData: WellFeatureCollection,
    seed: number
) {
    const extents = computePerWellSectionExtents(singleWellData);
    if (extents.length === 0) return [];

    const ext = extents[0];
    const seismicWidth = 120;
    const seismicHeight = 120;

    const vertices = [
        ext.abscissaStart,
        ext.depthMin,
        -1,
        ext.abscissaEnd,
        ext.depthMin,
        -1,
        ext.abscissaStart,
        ext.depthMax,
        -1,
        ext.abscissaEnd,
        ext.depthMax,
        -1,
    ];

    return [
        {
            topology: "triangle-strip" as const,
            vertices,
            texCoords: [0, 0, 1, 0, 0, 1, 1, 1],
            vertexIndices: { value: [0, 1, 2, 3], size: 4 },
            valueMap: {
                width: seismicWidth,
                height: seismicHeight,
                values: generateSyntheticSeismic(
                    seismicWidth,
                    seismicHeight,
                    seed
                ),
            },
        },
    ];
}

/** 4 individual well intersections, each in its own viewport with seismic */
export const IndividualWellIntersections: StoryObj<
    WellCount & TrajectorySimulationProps
> = {
    args: {
        wellCount: 10,
        sampleCount: 20,
        segmentLength: 150,
        dipDeviationMagnitude: 10,
    },
    parameters: {
        docs: {
            ...defaultStoryParameters.docs,
            description: {
                story: "4 individual well intersections, each shown in its own viewport with a seismic fence behind.",
            },
        },
    },
    argTypes: {
        ...WELL_COUNT_ARGTYPES,
        ...TRAJECTORY_SIMULATION_ARGTYPES,
    },
    render: ({
        wellCount,
        sampleCount,
        segmentLength,
        dipDeviationMagnitude,
    }) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const allData = useSyntheticWellCollection(wellCount, 10, {
            sampleCount,
            segmentLength,
            dipDeviationMagnitude,
        });

        // Pick 4 wells from the collection
        const wellIndices = [0, 1, 2, 3].filter(
            (i) => i < allData.features.length
        );

        const allLayers: (SeismicLayer | WellsLayer | Axes2DLayer)[] = [];
        const viewports: {
            id: string;
            target: [number, number];
            viewType: typeof SectionView;
            zoom: number;
            layerIds: string[];
        }[] = [];

        for (const idx of wellIndices) {
            const singleWellData: WellFeatureCollection = {
                type: "FeatureCollection",
                features: [allData.features[idx]],
            };

            const seismicFences = buildSingleWellSeismicFence(
                singleWellData,
                idx
            );

            const extents = computePerWellSectionExtents(singleWellData);
            const ext = extents[0];
            const centerX = ext ? (ext.abscissaStart + ext.abscissaEnd) / 2 : 0;
            const centerY = ext ? (ext.depthMin + ext.depthMax) / 2 : 0;

            const seismicId = `seismic-${idx}`;
            const wellId = `well-${idx}`;
            const axesId = `axes-${idx}`;
            const viewportId = `viewport-${idx}`;

            allLayers.push(
                new SeismicLayer({
                    id: seismicId,
                    cage: {
                        origin: [0, 0, 0],
                        edgeU: [1, 0, 0],
                        edgeV: [0, 1, 0],
                        edgeW: [0, 0, 0],
                        widthUnits: "pixels" as const,
                        lineWidth: 0,
                        color: [0, 0, 0, 0],
                        visible: false,
                    },
                    seismicFences,
                    showMesh: false,
                    colormap: { colormapName: "seismic" },
                    colormapSetup: {
                        valueRange: [-1, 1],
                        clampRange: [-1, 1],
                        clampColor: [0, 255, 0, 200],
                        undefinedColor: [255, 0, 0, 200],
                        smooth: true,
                    },
                    material: false,
                    smoothShading: false,
                    ZIncreasingDownwards: false,
                    depthTest: true,
                })
            );

            allLayers.push(
                new WellsLayer({
                    id: wellId,
                    data: singleWellData,
                    section: true,
                    wellLabel: { getSize: 10, background: true },
                })
            );

            allLayers.push(new Axes2DLayer({ id: axesId }));

            viewports.push({
                id: viewportId,
                target: [centerX, centerY],
                viewType: SectionView,
                zoom: -3,
                layerIds: [seismicId, wellId, axesId],
            });
        }

        const viewerArgs: SubsurfaceViewerProps = {
            id: "individual-well-intersections",
            views: {
                layout: [2, 2] as [number, number],
                viewports,
            },
            scale: { visible: false },
            bounds: [450000, 6781000, 464000, 6791000],
        };

        const wellNames = wellIndices.map(
            (i) => allData.features[i]?.properties?.name ?? `Well ${i}`
        );

        return (
            <Root>
                <SubsurfaceViewer {...viewerArgs} layers={allLayers}>
                    {wellIndices.map((idx, i) => (
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-expect-error
                        <View key={idx} id={`viewport-${idx}`}>
                            <h2 className={classes.annotation}>
                                {wellNames[i]}
                            </h2>
                        </View>
                    ))}
                </SubsurfaceViewer>
            </Root>
        );
    },
};

/** Builds seismic + grid layers and viewports for 2 wells */
function buildSeismicAndGridData(allData: WellFeatureCollection) {
    const wellIndices = [0, 1].filter((i) => i < allData.features.length);

    const allLayers: (SeismicLayer | WellsLayer | Axes2DLayer)[] = [];
    const gridJsonLayers: Record<string, unknown>[] = [];

    const viewports: {
        id: string;
        target: [number, number];
        viewType: typeof SectionView;
        zoom: number;
        layerIds: string[];
        isSync: boolean;
    }[] = [];

    const nRows = 40;
    const nCols = 10;

    for (const idx of wellIndices) {
        const singleWellData: WellFeatureCollection = {
            type: "FeatureCollection",
            features: [allData.features[idx]],
        };

        const extents = computePerWellSectionExtents(singleWellData);
        const ext = extents[0];
        const centerX = ext ? (ext.abscissaStart + ext.abscissaEnd) / 2 : 0;
        const centerY = ext ? (ext.depthMin + ext.depthMax) / 2 : 0;

        // --- Seismic layer + well for seismic viewport ---
        const seismicId = `seismic-${idx}`;
        const wellSeismicId = `well-seismic-${idx}`;
        const axesSeismicId = `axes-seismic-${idx}`;

        const seismicFences = buildSingleWellSeismicFence(singleWellData, idx);

        allLayers.push(
            new SeismicLayer({
                id: seismicId,
                cage: {
                    origin: [0, 0, 0],
                    edgeU: [1, 0, 0],
                    edgeV: [0, 1, 0],
                    edgeW: [0, 0, 0],
                    widthUnits: "pixels" as const,
                    lineWidth: 0,
                    color: [0, 0, 0, 0],
                    visible: false,
                },
                seismicFences,
                showMesh: false,
                colormap: { colormapName: "seismic" },
                colormapSetup: {
                    valueRange: [-1, 1],
                    clampRange: [-1, 1],
                    clampColor: [0, 255, 0, 200],
                    undefinedColor: [255, 0, 0, 200],
                    smooth: true,
                },
                material: false,
                smoothShading: false,
                ZIncreasingDownwards: false,
                depthTest: true,
            })
        );

        allLayers.push(
            new WellsLayer({
                id: wellSeismicId,
                data: singleWellData,
                section: true,
                wellLabel: { getSize: 10, background: true },
            })
        );

        allLayers.push(new Axes2DLayer({ id: axesSeismicId }));

        // --- Grid layer + well for grid viewport ---
        const gridId = `grid-${idx}`;
        const wellGridId = `well-grid-${idx}`;
        const axesGridId = `axes-grid-${idx}`;

        const { pointsData, polysData, propertiesData } = buildPerWellGridData(
            singleWellData,
            nRows,
            nCols
        );

        gridJsonLayers.push({
            "@@type": "Grid3DLayer" as const,
            id: gridId,
            pointsData: Array.from(pointsData),
            polysData: Array.from(polysData),
            propertiesData: Array.from(propertiesData),
            coloringMode: TGrid3DColoringMode.Property,
            colorMapName: "Rainbow",
            colorMapRange: [0, 1],
            gridLines: false,
            material: false,
            depthTest: true,
            ZIncreasingDownwards: false,
            pickable: true,
        });

        allLayers.push(
            new WellsLayer({
                id: wellGridId,
                data: singleWellData,
                section: true,
                wellLabel: { getSize: 10, background: true },
            })
        );

        allLayers.push(new Axes2DLayer({ id: axesGridId }));

        // Seismic viewport
        viewports.push({
            id: `seismic-vp-${idx}`,
            target: [centerX, centerY],
            viewType: SectionView,
            zoom: -3,
            layerIds: [seismicId, wellSeismicId, axesSeismicId],
            isSync: true,
        });

        // Grid viewport
        viewports.push({
            id: `grid-vp-${idx}`,
            target: [centerX, centerY],
            viewType: SectionView,
            zoom: -3,
            layerIds: [gridId, wellGridId, axesGridId],
            isSync: true,
        });
    }

    const wellNames = wellIndices.map(
        (i) => allData.features[i]?.properties?.name ?? `Well ${i}`
    );

    return { wellIndices, allLayers, gridJsonLayers, viewports, wellNames };
}

const SEISMIC_GRID_ARGS = {
    wellCount: 10,
    sampleCount: 20,
    segmentLength: 150,
    dipDeviationMagnitude: 10,
};

const SEISMIC_GRID_ARGTYPES = {
    ...WELL_COUNT_ARGTYPES,
    ...TRAJECTORY_SIMULATION_ARGTYPES,
};

/** 2 wells × 2 views each: seismic + grid, all 4 viewports synced together */
export const SeismicAndGridAllSynced: StoryObj<
    WellCount & TrajectorySimulationProps
> = {
    args: SEISMIC_GRID_ARGS,
    parameters: {
        docs: {
            ...defaultStoryParameters.docs,
            description: {
                story: "2 wells, each with a seismic view and a grid view. All 4 viewports are synced together via isSync.",
            },
        },
    },
    argTypes: SEISMIC_GRID_ARGTYPES,
    render: ({
        wellCount,
        sampleCount,
        segmentLength,
        dipDeviationMagnitude,
    }) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const allData = useSyntheticWellCollection(wellCount, 10, {
            sampleCount,
            segmentLength,
            dipDeviationMagnitude,
        });

        const { wellIndices, allLayers, gridJsonLayers, viewports, wellNames } =
            buildSeismicAndGridData(allData);

        // Layout: 2 rows × 2 cols
        // Top row: seismic views, bottom row: grid views
        const orderedViewports = [
            viewports[0], // seismic well 0 (top-left)
            viewports[2], // seismic well 1 (top-right)
            viewports[1], // grid well 0 (bottom-left)
            viewports[3], // grid well 1 (bottom-right)
        ];

        const layers = [
            ...gridJsonLayers,
            ...allLayers,
        ] as SubsurfaceViewerProps["layers"];

        const viewerArgs: SubsurfaceViewerProps = {
            id: "seismic-and-grid-all-synced",
            views: {
                layout: [2, 2] as [number, number],
                viewports: orderedViewports,
            },
            scale: { visible: false },
            bounds: [450000, 6781000, 464000, 6791000],
        };

        return (
            <Root>
                <SubsurfaceViewer {...viewerArgs} layers={layers}>
                    {wellIndices.map((idx, i) => (
                        <React.Fragment key={idx}>
                            {
                                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                // @ts-expect-error
                                <View id={`seismic-vp-${idx}`}>
                                    <h2 className={classes.annotation}>
                                        {wellNames[i]} — Seismic
                                    </h2>
                                </View>
                            }
                            {
                                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                // @ts-expect-error
                                <View id={`grid-vp-${idx}`}>
                                    <h2 className={classes.annotation}>
                                        {wellNames[i]} — Grid
                                    </h2>
                                </View>
                            }
                        </React.Fragment>
                    ))}
                </SubsurfaceViewer>
            </Root>
        );
    },
};

/** 2 wells × 2 views each: seismic + grid, synced per well (independent sync groups) */
export const SeismicAndGridPerWellSync: StoryObj<
    WellCount & TrajectorySimulationProps
> = {
    args: SEISMIC_GRID_ARGS,
    parameters: {
        docs: {
            ...defaultStoryParameters.docs,
            description: {
                story: "2 wells, each with a seismic view and a grid view. Views for the same well are synced independently using separate SubsurfaceViewer instances.",
            },
        },
    },
    argTypes: SEISMIC_GRID_ARGTYPES,
    render: ({
        wellCount,
        sampleCount,
        segmentLength,
        dipDeviationMagnitude,
    }) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const allData = useSyntheticWellCollection(wellCount, 10, {
            sampleCount,
            segmentLength,
            dipDeviationMagnitude,
        });

        const { wellIndices, allLayers, gridJsonLayers, viewports, wellNames } =
            buildSeismicAndGridData(allData);

        // Build per-well viewer configs. Each SubsurfaceViewer has its
        // own sync scope, so isSync: true only links viewports within
        // the same viewer instance.
        const wellViewers = wellIndices.map((idx, i) => {
            const wellViewports = viewports.filter(
                (vp) =>
                    vp.id === `seismic-vp-${idx}` || vp.id === `grid-vp-${idx}`
            );

            const wellLayers = [
                gridJsonLayers[i],
                ...allLayers.filter((l) => {
                    const lid = l.id as string;
                    return lid.endsWith(`-${idx}`);
                }),
            ] as SubsurfaceViewerProps["layers"];

            const viewerArgs: SubsurfaceViewerProps = {
                id: `seismic-and-grid-well-${idx}`,
                views: {
                    layout: [2, 1] as [number, number],
                    viewports: wellViewports,
                },
                scale: { visible: false },
                bounds: [450000, 6781000, 464000, 6791000],
            };

            return { idx, i, viewerArgs, wellLayers };
        });

        return (
            <Root>
                <div style={{ display: "flex", gap: 8 }}>
                    {wellViewers.map(({ idx, i, viewerArgs, wellLayers }) => (
                        <div key={idx} style={{ flex: 1 }}>
                            <h3 style={{ textAlign: "center", margin: 4 }}>
                                {wellNames[i]}
                            </h3>
                            <div
                                className={classes.main}
                                style={{ height: 700 }}
                            >
                                <SubsurfaceViewer
                                    {...viewerArgs}
                                    layers={wellLayers}
                                >
                                    {
                                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                        // @ts-expect-error
                                        <View id={`seismic-vp-${idx}`}>
                                            <h2 className={classes.annotation}>
                                                Seismic
                                            </h2>
                                        </View>
                                    }
                                    {
                                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                        // @ts-expect-error
                                        <View id={`grid-vp-${idx}`}>
                                            <h2 className={classes.annotation}>
                                                Grid
                                            </h2>
                                        </View>
                                    }
                                </SubsurfaceViewer>
                            </div>
                        </div>
                    ))}
                </div>
            </Root>
        );
    },
};
