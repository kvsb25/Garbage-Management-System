const forRole = (role) => {

    let result = 'username email phone';

    if (role == 'admin') {
        result += ' region slot';
    }

    return result;

}

function isPointInPolygon(point, polygon) {
    const x = point[0], y = point[1];
    let inside = false;

    // Check if polygon is a GeoJSON Feature or Geometry object
    const coords = polygon.geometry ? polygon.geometry.coordinates : polygon.coordinates;

    // Handle both Polygon and MultiPolygon types
    const polygons = coords[0][0] instanceof Array ? coords : [coords];

    for (let i = 0; i < polygons.length; i++) {
        const ring = polygons[i][0];

        for (let j = 0, k = ring.length - 1; j < ring.length; k = j++) {
            const xi = ring[j][0], yi = ring[j][1];
            const xk = ring[k][0], yk = ring[k][1];

            const intersect = ((yi > y) !== (yk > y))
                && (x < (xk - xi) * (y - yi) / (yk - yi) + xi);
            if (intersect) inside = !inside;
        }
    }

    return inside;

}

module.exports = { forRole, isPointInPolygon }