import {InternalInputVars, SerializedFilter} from "./types";
import {match, percentile, percentileRange} from "./custom_functions";
import {compileExpression} from "filtrex";

type ExpressionRunner = (data: InternalInputVars) => boolean;

/**
 * Encapsulates a filter, with mechanisms for running expressions
 */
export class Filter {
    private colour: string;
    private expression: string;
    private isGlobal: boolean;
    private runner: ExpressionRunner | undefined;

    private currentVars: InternalInputVars | undefined;

    constructor(expression: string, colour: string, isGlobal: boolean) {
        this.expression = expression;
        this.colour = colour;
        this.isGlobal = isGlobal;
    }

    static from(serialized: SerializedFilter): Filter {
        return new Filter(serialized.expression, serialized.colour, serialized.isGlobal);
    }

    setExpression(expression: string): Filter {
        this.expression = expression;
        this.runner = undefined;
        return this;
    }

    setColor(colour: string): Filter {
        this.colour = colour;
        return this;
    }

    setIsGlobal(isGlobal: boolean): Filter {
        this.isGlobal = isGlobal;
        return this;
    }

    serialize(): SerializedFilter {
        return {
            expression: this.expression,
            colour: this.colour,
            isGlobal: this.isGlobal || false,
        }
    }

    getExtraFunctions() {
        return {
            match: match,
            percentile: (rank: number) => percentile(this.currentVars!, rank),
            percentileRange: (minRank: number, maxRank: number) => percentileRange(this.currentVars!, minRank, maxRank)
        }
    }

    run(vars: InternalInputVars): any {
        // Update vars in use for the functions
        this.currentVars = vars;

        if (!this.runner) {
            // Re-use the runner since it is expensive to create
            this.runner = compileExpression(this.expression, {extraFunctions: this.getExtraFunctions()});
        }

        return this.runner(vars);
    }

    /**
     * Throws if the filter expression is invalid
     */
    validate(): boolean {
        const result = this.run({
            float: 0.01,
            seed: 999,
            minfloat: 0.01,
            maxfloat: 0.99,
            minwearfloat: 0.01,
            maxwearfloat: 0.99,
            phase: 'Phase 1'
        });

        if (typeof result !== "boolean" && result !== 0 && result !== 1) {
            throw new Error("invalid return type " + result.toString());
        }

        return true;
    }

    /**
     * Returns a boolean indicating if the filter expression is valid
     */
    isValid(): boolean {
        try {
            this.validate();
            return true;
        } catch (e) {
            return false;
        }
    }
}
