export interface ModelData {
    vertices: Float32Array;
    normals:  Float32Array;
    indices:  Uint16Array;
}

export const loadOBJ = (text: string): ModelData => {
    const finalVerts:   number[] = [];
    const finalNormals: number[] = [];
    const indices:      number[] = [];
    const tmpPos:       number[][] = [];
    const tmpNorm:      number[][] = [];

    for (const line of text.split('\n')) {
        const parts = line.trim().split(/\s+/);

        if (parts[0] === 'v') {
            tmpPos.push([
                parseFloat(parts[1]),
                parseFloat(parts[2]),
                parseFloat(parts[3]),
            ]);
        } else if (parts[0] === 'vn') {
            tmpNorm.push([
                parseFloat(parts[1]),
                parseFloat(parts[2]),
                parseFloat(parts[3]),
            ]);
        } else if (parts[0] === 'f') {
            const faceVerts = parts.slice(1).map(p => {
                const [vi, , ni] = p.split('/').map(Number);
                return { vi: vi - 1, ni: (ni || 1) - 1 };
            });
            for (let i = 1; i < faceVerts.length - 1; i++) {
                for (const fv of [faceVerts[0], faceVerts[i], faceVerts[i + 1]]) {
                    indices.push(finalVerts.length / 3);
                    finalVerts.push(...tmpPos[fv.vi]);
                    finalNormals.push(...(tmpNorm[fv.ni] ?? [0, 1, 0]));
                }
            }
        }
    }

    return {
        vertices: new Float32Array(finalVerts),
        normals:  new Float32Array(finalNormals),
        indices:  new Uint16Array(indices),
    };
};