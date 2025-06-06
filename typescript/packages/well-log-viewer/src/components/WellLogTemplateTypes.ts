export type TemplatePlotScale = "linear" | "log";

export type TemplatePlotType =
    | ""
    | "line"
    | "linestep"
    | "dot"
    | "area"
    | "differential"
    | "gradientfill"
    | "stacked";

export type CSSColor = string;
// rgbhexcolor pattern: "^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$"
// rgbcolor pattern:  "^rgb\\((25[0-5]|2[0-4][0-9]|1[0-9]?[0-9]?|[1-9][0-9]?|[0-9]), ?(25[0-5]|2[0-4][0-9]|1[0-9]?[0-9]?|[1-9][0-9]?|[0-9]), ?(25[0-5]|2[0-4][0-9]|1[0-9]?[0-9]?|[1-9][0-9]?|[0-9])\\)$"

export type TemplatePlotProps = {
    type?: TemplatePlotType; // should be given or got from a style!
    scale?: TemplatePlotScale; // 'linear' or 'log', default 'linear'
    domain?: [number, number]; // min, max values

    color?: CSSColor; // color or colorMapFunction should be given or got from a style!
    inverseColor?: CSSColor;

    fill?: CSSColor; // for 'area' plot
    fillOpacity?: number; // for 'area' and 'gradientfill' plots! default 0.25
    colorMapFunctionName?: string; // color function/table id (name) for 'gradientfill' plot
    inverseColorMapFunctionName?: string; // color function/table id (name) for 'gradientfill' plot
    colorScale?: TemplatePlotScale; // for 'linear' plot scale. default equal to plot scale
    inverseColorScale?: TemplatePlotScale; // for 'linear' plot scale. default equal to plot scale

    color2?: CSSColor; // for 'differetial' plot
    fill2?: CSSColor; // for 'differetial' plot

    showLabels?: boolean; // for 'stacked' plot
    showLines?: boolean; // for 'stacked' plot
    labelRotation?: number; // for 'stacked' plot
    //...
}; // Part of JSON

export interface TemplatePlot extends TemplatePlotProps {
    name: string;
    style?: string;
    scale?: TemplatePlotScale | undefined;
    name2?: string; // for differential plot
} // Part of JSON

export type TemplateTrack = {
    title?: string; // if it is missed then a name or description of the first plot is used (see makeTrackHeader())
    titleTooltip?: string; // tooltip for mouse hover over title
    required?: boolean;
    /**
     * Relative track width when used in a LogController, i.e. a track with width set to
     * 3 will be three times wider than tracks set to width 1.
     *
     * Default is 1
     */
    width?: number;
    plots: TemplatePlot[];
    scale?: TemplatePlotScale; // 'linear' or 'log', default first plot scale
    domain?: [number, number]; // min, max values, default all plots domain
}; // Part of JSON

export interface TemplateStyle extends TemplatePlotProps {
    name: string;
} // Part of JSON

export interface Template {
    name: string;
    scale: {
        primary: string;
        allowSecondary?: boolean;
    };
    tracks: TemplateTrack[];
    styles?: TemplateStyle[];
    //...
} // JSON
