package backend.model.enums;

/** Where a circuit's 3D racing-line geometry was derived from. */
public enum GeometrySource {
    /** Real car position telemetry (x/y/z) from an OpenF1 race session — includes true elevation. */
    OPENF1,
    /** Open map data (lat/lon LineString) projected to metres — accurate shape, flat elevation. */
    GEOJSON,
    /** Procedurally generated from length/turn count — shape is indicative only. */
    SYNTHETIC
}
