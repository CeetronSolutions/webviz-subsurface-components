import React from "react";
import PropTypes from "prop-types";

import { VectorCalculatorComponent } from "./components/VectorCalculatorComponent";
import { string } from "jsverify";
import "./VectorCalculator.css";

export const VectorCalculator = (props) => {
    return (
        <React.StrictMode>
            <div className={"VectorCalculator"}>
                <VectorCalculatorComponent
                    id={props.id}
                    vectors={props.vectors}
                    expressions={props.expressions}
                    setProps={props.setProps}
                />
            </div>
        </React.StrictMode>
    );
};

VectorCalculator.defaultProps = {
    // Set all non isRequired props
    isDashControlled: false,
};

VectorCalculator.propTypes = {
    /**
     * The ID used to identify this component in Dash callbacks.
     */
    id: PropTypes.string.isRequired,

    /**
     * Existing vectors
     */
    // vectors: PropTypes.arrayOf(PropTypes.string.isRequired).isRequired,

    /**
     * A JSON object holding all existing vectors
     */
    vectors: PropTypes.array.isRequired,

    /**
     * Pre-defined vector calculation expressions
     * Each expression consist of an expression name, mathematical expression with single characther variables
     * and map of characther variables and the corresponding vector name.
     */
    expressions: PropTypes.arrayOf(
        PropTypes.shape({
            name: PropTypes.string.isRequired,
            expression: PropTypes.string.isRequired,
            id: PropTypes.string.isRequired,
            variableVectorMap: PropTypes.arrayOf(
                PropTypes.shape({
                    variableName: string.isRequired,
                    vectorName: string.isRequired,
                })
            ),
        })
    ).isRequired,

    /**
     * State for expression validation in dash plugin
     */
    isDashControlled: PropTypes.bool,

    /**
     * Dash-assigned callback that should be called to report property changes
     * to Dash, to make them available for callbacks.
     */
    setProps: PropTypes.func,
};