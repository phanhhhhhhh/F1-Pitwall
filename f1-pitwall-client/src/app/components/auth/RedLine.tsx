import { F1 } from "../../lib/f1-theme";

export function RedLine() {
    return (
        <div
            className="h-px w-full"
            style={{ background: `linear-gradient(90deg,transparent,${F1.red},transparent)` }}
        />
    );
}
